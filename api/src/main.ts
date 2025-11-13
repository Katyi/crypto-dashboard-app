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

  // Это гарантирует, что при завершении работы NestJS (например, на Render),
  // соединение с базой данных будет закрыто корректно.
  const prismaService = app.get(PrismaService);
  await prismaService.enableShutdownHooks(app);

  await app.listen(port);

  logger.log(`Application is successfully running on port: ${port}`);
  logger.log(`Application URL: ${await app.getUrl()}`);
}
bootstrap();
