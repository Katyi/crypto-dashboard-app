import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { firstValueFrom } from 'rxjs';
import { Metric } from '@prisma/client';
import { ConfigService } from '@nestjs/config';

// Интерфейсы для типа Metric
interface IMetric {
  symbol: string;
  priceUSD: number;
  marketCapUSD: number;
  volume24hUSD: number;
  deaiScore: number;
}

// Интерфейс для данных CoinGecko (упрощенный)
interface CoinGeckoData {
  id: string; // 'ethereum'
  symbol: string; // 'eth'
  name: string;
  current_price: number;
  market_cap: number;
  total_volume: number;
}

@Injectable()
export class MetricService {
  private readonly logger = new Logger(MetricService.name);

  // 💡 Поля для хранения значений из .env
  private readonly API_URL: string;
  private readonly PROJECT_IDS: string;

  // 💡 Константы, прописанные прямо в классе
  // private readonly API_URL = 'https://api.coingecko.com/api/v3/coins/markets';
  // private readonly PROJECT_IDS = 'ethereum'; // Фокус на Ethereum

  constructor(
    private readonly http: HttpService,
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    // 💡 Чтение конфигурации из .env и сохранение в полях класса
    const apiUrl = this.configService.get<string>('COINGECKO_API_URL');
    const projectIds = this.configService.get<string>('PROJECT_IDS');

    if (!apiUrl || !projectIds) {
      const message =
        'COINGECKO_API_URL или PROJECT_IDS не определены в конфигурации. Проверьте ваш файл .env!';
      this.logger.error(message);
      throw new Error(message);
    }

    this.API_URL = apiUrl;
    this.PROJECT_IDS = projectIds;
  }

  // ----------------------------------------------------------------------
  // CRON JOB (Работа по расписанию)
  // ----------------------------------------------------------------------

  /**
   * 💡 ВРЕМЕННОЕ ИЗМЕНЕНИЕ: Запуск каждые 30 секунд для тестовой записи.
   */
  @Cron('*/30 * * * * *')
  // @Cron('0 0,12 * * *')
  async handleCron() {
    this.logger.log('Запуск CRON-задачи для сбора метрик...');
    await this.fetchAndSaveMetrics();
  }

  /**
   * Основной метод для сбора данных, обработки и сохранения.
   */
  async fetchAndSaveMetrics() {
    const rawData = await this.fetchCoinGeckoData();

    if (!rawData || rawData.length === 0) {
      this.logger.error(
        'Не удалось получить данные с CoinGecko или получен пустой ответ.',
      );
      return;
    }

    // 💡 КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Ищем по полю 'id', которое совпадает с 'ethereum'.
    const ethData = rawData.find((d) => d.id === this.PROJECT_IDS);

    if (ethData) {
      const deaiScore = this.calculateDeaiScore(ethData);

      const metricData: IMetric = {
        symbol: ethData.symbol, // Сохраняем 'eth'
        priceUSD: ethData.current_price,
        marketCapUSD: ethData.market_cap,
        volume24hUSD: ethData.total_volume,
        deaiScore: deaiScore,
      };

      try {
        await this.saveData(metricData);
        this.logger.log(
          `Метрика для ${ethData.symbol.toUpperCase()} сохранена. Score: ${deaiScore}`,
        );
      } catch (error) {
        this.logger.error(`Ошибка при сохранении метрики: ${error.message}`);
      }
    } else {
      this.logger.warn(
        `Данные для ID ${this.PROJECT_IDS} не найдены в ответе CoinGecko. Проверьте ID.`,
      );
    }
  }

  /**
   * Получение данных с CoinGecko API.
   */
  private async fetchCoinGeckoData(): Promise<CoinGeckoData[] | null> {
    try {
      // Используем жёстко прописанные константы
      const url = `${this.API_URL}?vs_currency=usd&ids=${this.PROJECT_IDS}&sparkline=false`;

      const { data } = await firstValueFrom(
        this.http.get<CoinGeckoData[]>(url),
      );

      return data;
    } catch (error) {
      this.logger.error(`Ошибка при запросе CoinGecko: ${error.message}`);
      return null;
    }
  }

  /**
   * ВАША УНИКАЛЬНАЯ ЛОГИКА НОРМАЛИЗАЦИИ
   */
  private calculateDeaiScore(data: CoinGeckoData): number {
    const marketFactor = Math.log(data.market_cap) / 10;
    const volumeFactor = Math.log(data.total_volume) / 10;

    const score = Math.min(100, 70 + (marketFactor + volumeFactor) * 2);

    return parseFloat(score.toFixed(2));
  }

  /**
   * Сохранение обработанных данных в PostgreSQL через Prisma.
   */
  private async saveData(data: IMetric): Promise<Metric> {
    return this.prisma.metric.create({
      data: {
        symbol: data.symbol,
        source: 'CoinGecko',
        priceUSD: data.priceUSD,
        marketCapUSD: data.marketCapUSD,
        volume24hUSD: data.volume24hUSD,
        deaiScore: data.deaiScore,
      },
    });
  }

  // ----------------------------------------------------------------------
  // API ENDPOINT LOGIC (для фронтенда)
  // ----------------------------------------------------------------------

  /**
   * Получение последних записей метрик из базы данных.
   */
  async getLatestMetrics(limit: number): Promise<Metric[]> {
    this.logger.log(`Запрос последних ${limit} метрик.`);

    const metrics = await this.prisma.metric.findMany({
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
    });

    return metrics.reverse();
  }
}
