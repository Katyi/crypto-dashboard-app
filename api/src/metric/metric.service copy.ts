import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { firstValueFrom } from 'rxjs';
import { Metric } from '@prisma/client';

// Интерфейсы для типа Metric, чтобы избежать импорта прямо из @prisma/client везде
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
    private readonly prisma: PrismaService,
  ) {}

  // ----------------------------------------------------------------------
  // 💡 CRON JOB (Работа по расписанию)
  // ----------------------------------------------------------------------

  /**
   * Запуск сбора данных дважды в день (в 00:00 и 12:00 по времени сервера).
   */
  @Cron('0 0,12 * * *')
  async handleCron() {
    this.logger.log('--- CRON JOB STARTED: Running data processing cycle ---');
    await this.runDataProcessingCycle();
    this.logger.log('--- CRON JOB FINISHED ---');
    // await this.runDataProcessingCycle();
    // this.logger.log('--- CRON JOB FINISHED ---');
  }

  // ----------------------------------------------------------------------
  // 💡 ОСНОВНАЯ ЛОГИКА
  // ----------------------------------------------------------------------

  /**
   * Главный метод: Сбор -> Нормализация -> Сохранение.
   */
  async runDataProcessingCycle(): Promise<Metric | null> {
    const rawData = await this.fetchExternalData();

    if (!rawData) {
      this.logger.warn('Data fetching failed. Aborting save.');
      return null;
    }

    // 1. Вычисление DeAI Score
    const deaiScore = this.calculateDeaiScore(rawData);

    // 2. Формирование объекта для сохранения
    const metricData: IMetric = {
      symbol: rawData.symbol.toUpperCase(),
      priceUSD: rawData.current_price,
      marketCapUSD: rawData.market_cap,
      volume24hUSD: rawData.total_volume,
      deaiScore: deaiScore,
    };

    // 3. Сохранение в БД
    return this.saveData(metricData);
  }

  /* Запрос к внешнему API (CoinGecko) */
  private async fetchExternalData(): Promise<CoinGeckoData | null> {
    try {
      const response = await firstValueFrom(
        this.http.get<CoinGeckoData[]>(this.API_URL, {
          params: {
            vs_currency: 'usd',
            ids: this.PROJECT_IDS,
            sparkline: false,
          },
        }),
      );

      if (response.data && response.data.length > 0) {
        return response.data[0];
      }
      return null;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Error fetching data: ${errorMessage}`);
      return null;
    }
  }

  /**
   * ВАША УНИКАЛЬНАЯ ЛОГИКА НОРМАЛИЗАЦИИ
   * Этот метод должен содержать сложный алгоритм.
   */
  private calculateDeaiScore(data: CoinGeckoData): number {
    // 💡 ВАША ЛОГИКА ТУТ: Нормализация данных, взвешивание, расчет скора

    // Пример (простая формула):
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
  // 💡 API ENDPOINT LOGIC (для фронтенда)
  // ----------------------------------------------------------------------

  /**
   * Получение последних N записей метрик для отображения на дашборде.
   */
  async getLatestMetrics(limit: number = 10): Promise<Metric[]> {
    return this.prisma.metric.findMany({
      take: limit,
      orderBy: {
        createdAt: 'desc', // Сортировка от новых к старым
      },
    });
  }
}
