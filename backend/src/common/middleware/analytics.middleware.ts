import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class AnalyticsMiddleware implements NestMiddleware {
  private readonly logger = new Logger(AnalyticsMiddleware.name);

  constructor() {}

  async use(req: Request, res: Response, next: NextFunction) {
    const startTime = Date.now();
    const sessionId = this.extractSessionId(req);
    const userId = this.extractUserId(req);

    // Log page view for GET requests
    if (req.method === 'GET' && req.url !== '/favicon.ico') {
      this.logger.log(`Page view: ${req.method} ${req.url} - Session: ${sessionId}`);
    }

    // Override res.end to track performance after response
    const originalEnd = res.end;
    res.end = function(...args: any[]) {
      const duration = Date.now() - startTime;

      // Log API performance
      this.logger.log(`API call: ${req.method} ${req.url} - ${duration}ms - Status: ${res.statusCode}`);

      // Log search events for search endpoints
      if (req.url.includes('/search') && req.method === 'GET') {
        const query = req.query.q || req.query.query || req.query.search;
        if (query && typeof query === 'string') {
          this.logger.log(`Search query: "${query}" - Session: ${sessionId}`);
        }
      }

      // Log user actions for POST/PUT/DELETE requests
      if (['POST', 'PUT', 'DELETE'].includes(req.method)) {
        this.logger.log(`Action: ${req.method} ${req.url} - Session: ${sessionId}`);
      }

      // Call original end method
      return originalEnd.apply(this, args);
    }.bind(res);

    next();
  }

  private extractSessionId(req: Request): string {
    // Try to get session ID from various sources
    return (
      req.headers['x-session-id'] as string ||
      req.query.sessionId as string ||
      req.cookies?.sessionId ||
      req.cookies?.session_id ||
      `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    );
  }

  private extractUserId(req: Request): string | undefined {
    // Try to get user ID from various sources
    return (
      req.headers['x-user-id'] as string ||
      req.query.userId as string ||
      req.cookies?.userId ||
      req.cookies?.user_id ||
      (req as any).user?.id ||
      undefined
    );
  }

  private sanitizeBody(body: any): any {
    if (!body || typeof body !== 'object') return body;

    const sensitiveFields = ['password', 'token', 'secret', 'key', 'auth'];
    const sanitized = { ...body };

    for (const field of sensitiveFields) {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    }

    // Limit size for logging
    const bodyString = JSON.stringify(sanitized);
    if (bodyString.length > 1000) {
      return { ...sanitized, _truncated: true };
    }

    return sanitized;
  }
}
