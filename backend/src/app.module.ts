import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WinstonModule } from 'nest-winston';
import { ThrottlerModule } from '@nestjs/throttler';
import { CacheModule } from '@nestjs/cache-manager';
import { QuestionsModule } from './modules/questions/questions.module';
import { HealthModule } from './modules/health/health.module';
import { SearchModule } from './modules/elasticsearch/elasticsearch.module';
import { DataProtectionModule } from './modules/data-protection/data-protection.module';

import { getDatabaseConfig } from './config/database.config';
import { getLoggingConfig } from './config/logging.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '.env.local', '.env.development'],
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => getDatabaseConfig(configService),
      inject: [ConfigService],
    }),
    WinstonModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => getLoggingConfig(configService),
      inject: [ConfigService],
    }),
    CacheModule.register({
      ttl: 300000, // 5 minutes
      max: 1000,
      isGlobal: true,
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 1 minute
        limit: 100, // 100 requests per minute
      },
    ]),
    QuestionsModule,
    HealthModule,
    SearchModule,
    DataProtectionModule,
  ],
})
export class AppModule {}
