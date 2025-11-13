import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global() // Делаем его глобальным для легкого доступа
@Module({
  providers: [PrismaService],
  exports: [PrismaService], // Обязательно экспортируем!
})
export class PrismaModule {}
