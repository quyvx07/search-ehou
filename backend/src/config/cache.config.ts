import { ConfigService } from '@nestjs/config';
import { CacheModuleOptions } from '@nestjs/cache-manager';

export const getCacheConfig = (configService: ConfigService): CacheModuleOptions => ({
  ttl: configService.get('CACHE_TTL', 300), // 5 minutes default
  max: configService.get('CACHE_MAX_ITEMS', 1000),
  isGlobal: true,
});
