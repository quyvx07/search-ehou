import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class PerformanceInterceptor implements NestInterceptor {
  private readonly logger = new Logger(PerformanceInterceptor.name);

  constructor() {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const { method, url } = request;
    const startTime = Date.now();

    return next.handle().pipe(
      tap({
        next: (_) => {
          const endTime = Date.now();
          const responseTime = endTime - startTime;

          this.logger.log(
            `${method} ${url} - Response time: ${responseTime}ms`,
          );

          // Log slow requests
          if (responseTime > 500) {
            this.logger.warn(
              `Slow request detected: ${method} ${url} - ${responseTime}ms`,
            );
          }
        },
        error: (error) => {
          const endTime = Date.now();
          const responseTime = endTime - startTime;

          this.logger.error(
            `Error request: ${method} ${url} - ${responseTime}ms - ${error.message}`,
          );
        },
      }),
    );
  }
}
