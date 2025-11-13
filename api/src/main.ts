import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap');

  // Включаем CORS, чтобы фронтенд мог получать данные с другого порта (например, Vite/React).
  // Origin: '*' разрешает запросы с любого источника (подходит для разработки).
  app.enableCors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  const port = process.env.PORT || 3000;

  const prismaService = app.get(PrismaService);

  const shutdown = async (signal: string) => {
    logger.log(`Received ${signal}. Starting graceful shutdown...`);
    try {
      // КЛЮЧЕВОЙ ШАГ: отключение Prisma
      await prismaService.$disconnect();
      await app.close();
      logger.log('Graceful shutdown completed.');
      process.exit(0);
    } catch (error) {
      logger.error('Shutdown failed:', error);
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => shutdown('SIGTERM')); // Сигнал от Render
  process.on('SIGINT', () => shutdown('SIGINT')); // Сигнал от Ctrl+C

  await app.listen(port);

  logger.log(`Application is successfully running on port: ${port}`);
  logger.log(`Application URL: ${await app.getUrl()}`);
}
bootstrap();
