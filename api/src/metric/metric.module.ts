import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { MetricService } from './metric.service';
import { MetricController } from './metric.controller';

@Module({
  imports: [HttpModule], // 💡 Импортируем HttpModule
  controllers: [MetricController],
  providers: [MetricService],
  exports: [MetricService],
})
export class MetricModule {}
