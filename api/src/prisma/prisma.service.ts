import {
  INestApplication,
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    super();
  }

  async onModuleInit() {
    // Подключаемся к БД при старте приложения
    await this.$connect();
    console.log('Prisma connection established successfully.');
  }

  async onModuleDestroy() {
    // Отключаемся при завершении работы
    await this.$disconnect();
    console.log('Prisma connection disconnected.');
  }

  async enableShutdownHooks(app: INestApplication) {
    (this.$on as any)('beforeExit', async () => {
      await app.close();
    });
  }
}
