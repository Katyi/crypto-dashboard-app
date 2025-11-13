import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service'; // Путь к PrismaService
import { firstValueFrom } from 'rxjs';
import { Metric } from '@prisma/client';

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
  id: string;
  symbol: string;
  name: string;
  current_price: number;
  market_cap: number;
  total_volume: number;
}

@Injectable()
export class MetricService {
  private readonly logger = new Logger(MetricService.name);
  private readonly API_URL = 'https://api.coingecko.com/api/v3/coins/markets';
  private readonly PROJECT_IDS = 'ethereum'; // Фокус на Ethereum

  constructor(
    private readonly http: HttpService,
    private readonly prisma: PrismaService, // 💡 ИНЖЕКТИРУЕМ PrismaService
  ) {}

  // ----------------------------------------------------------------------
  // CRON JOB (Работа по расписанию)
  // ----------------------------------------------------------------------

  /**
   * Запуск сбора данных дважды в день (в 00:00 и 12:00 по времени сервера).
   */
  // @Cron('0 0,12 * * *')
  @Cron('*/30 * * * * *') // Запускать каждые 30 секунд
  async handleCron() {
    this.logger.log('Запуск CRON-задачи для сбора метрик...');
    await this.fetchAndSaveMetrics();
  }

  /**
   * Основной метод для сбора данных, обработки и сохранения.
   */
  async fetchAndSaveMetrics() {
    const rawData = await this.fetchCoinGeckoData();

    if (!rawData) {
      this.logger.error('Не удалось получить данные с CoinGecko.');
      return;
    }

    const ethData = rawData.find((d) => d.symbol === this.PROJECT_IDS);

    if (ethData) {
      const deaiScore = this.calculateDeaiScore(ethData);

      const metricData: IMetric = {
        symbol: ethData.symbol,
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
        `Данные для ${this.PROJECT_IDS} не найдены в ответе CoinGecko.`,
      );
    }
  }

  /**
   * Получение данных с CoinGecko API.
   */
  private async fetchCoinGeckoData(): Promise<CoinGeckoData[] | null> {
    try {
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
    // 💡 ВАША ЛОГИКА ТУТ: Нормализация данных, взвешивание, расчет скора
    const marketFactor = Math.log(data.market_cap) / 10;
    const volumeFactor = Math.log(data.total_volume) / 10;

    // Итоговый балл (от 0 до 100)
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
   * 💡 ИСПРАВЛЕННЫЙ МЕТОД: Получение последних записей метрик из базы данных.
   */
  async getLatestMetrics(limit: number): Promise<Metric[]> {
    this.logger.log(`Запрос последних ${limit} метрик.`);

    // 1. Запрашиваем записи, сортируя по убыванию (новые сверху)
    const metrics = await this.prisma.metric.findMany({
      orderBy: {
        createdAt: 'desc', // Сортируем по времени создания (новые первыми)
      },
      take: limit, // Ограничиваем количество
    });

    // 2. Возвращаем массив в обратном порядке (от старых к новым), что идеально для графиков.
    return metrics.reverse();
  }
}
