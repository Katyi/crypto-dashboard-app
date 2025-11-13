import {
  Controller,
  Get,
  Query,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { MetricService } from './metric.service';
import { Metric } from '@prisma/client';
import { ApiTags, ApiQuery, ApiOperation } from '@nestjs/swagger';

@ApiTags('Metrics')
@Controller('metrics')
export class MetricController {
  constructor(private readonly metricService: MetricService) {}

  @Get()
  @ApiOperation({
    summary: 'Получение последних записей метрик (исторические данные).',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description:
      'Количество последних записей для отображения (по умолчанию 10).',
  })
  async getMetrics(
    // Используем DefaultValuePipe и ParseIntPipe для безопасного парсинга query-параметров
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ): Promise<Metric[]> {
    // В контроллере можно также добавить проверку, чтобы limit не превышал, скажем, 1000
    return this.metricService.getLatestMetrics(limit);
  }
}
