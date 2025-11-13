import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
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
  }

  async onModuleDestroy() {
    // Отключаемся при завершении работы
    await this.$disconnect();
  }
}
