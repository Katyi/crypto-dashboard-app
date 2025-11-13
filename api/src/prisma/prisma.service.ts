import { INestApplication, Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  async onModuleInit() {
    await this.$connect();
  }

  // Оставляем метод для совместимости с NestJS, но он больше не содержит
  // ненадежной логики $on('beforeExit'), которая вызывает ошибку.
  // Фактическое отключение будет обрабатываться в main.ts.
  async enableShutdownHooks(app: INestApplication) {
    app.enableShutdownHooks();
  }
}
