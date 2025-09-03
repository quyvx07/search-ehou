import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { PerformanceController } from './performance.controller';

@Module({
  imports: [],
  controllers: [HealthController, PerformanceController],
  providers: [],
  exports: [],
})
export class HealthModule {}
