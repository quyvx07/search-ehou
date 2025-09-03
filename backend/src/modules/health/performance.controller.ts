import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';

interface PerformanceStats {
  totalRequests: number;
  averageResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  errorRate: number;
  requestsPerSecond: number;
}

@ApiTags('Performance')
@Controller('performance')
export class PerformanceController {
  constructor() {}

  @Get('stats')
  @ApiOperation({ summary: 'Get performance statistics' })
  @ApiQuery({ name: 'timeWindow', required: false, description: 'Time window in minutes (default: 5)' })
  getStats(@Query('timeWindow') timeWindow?: string): PerformanceStats {
    const timeWindowMinutes = timeWindow ? parseInt(timeWindow, 10) : 5;
    // Return mock data since monitoring services are disabled
    return {
      totalRequests: 0,
      averageResponseTime: 0,
      p95ResponseTime: 0,
      p99ResponseTime: 0,
      errorRate: 0,
      requestsPerSecond: 0,
    };
  }

  @Get('slow-endpoints')
  @ApiOperation({ summary: 'Get top slow endpoints' })
  @ApiQuery({ name: 'limit', required: false, description: 'Number of endpoints to return (default: 10)' })
  getSlowEndpoints(@Query('limit') limit?: string) {
    const limitNum = limit ? parseInt(limit, 10) : 10;
    // Return empty array since monitoring services are disabled
    return [];
  }

  @Get('error-endpoints')
  @ApiOperation({ summary: 'Get top error endpoints' })
  @ApiQuery({ name: 'limit', required: false, description: 'Number of endpoints to return (default: 10)' })
  getErrorEndpoints(@Query('limit') limit?: string) {
    const limitNum = limit ? parseInt(limit, 10) : 10;
    // Return empty array since monitoring services are disabled
    return [];
  }

  @Get('report')
  @ApiOperation({ summary: 'Get comprehensive performance report' })
  getReport(): any {
    // Return mock data since monitoring services are disabled
    const stats = {
      totalRequests: 0,
      averageResponseTime: 0,
      p95ResponseTime: 0,
      p99ResponseTime: 0,
      errorRate: 0,
      requestsPerSecond: 0,
    };
    const slowEndpoints = [];
    const errorEndpoints = [];

    return {
      timestamp: new Date(),
      stats,
      slowEndpoints,
      errorEndpoints,
      recommendations: this.generateRecommendations(stats, slowEndpoints, errorEndpoints),
      note: 'Performance monitoring is disabled',
    };
  }

  private generateRecommendations(stats: any, slowEndpoints: any[], errorEndpoints: any[]): string[] {
    const recommendations: string[] = [];

    if (stats.averageResponseTime > 500) {
      recommendations.push('Consider implementing caching for frequently accessed data');
    }

    if (stats.p95ResponseTime > 1000) {
      recommendations.push('Optimize database queries and add indexes');
    }

    if (stats.errorRate > 5) {
      recommendations.push('Investigate and fix error endpoints');
    }

    if (stats.requestsPerSecond < 50) {
      recommendations.push('Consider horizontal scaling or load balancing');
    }

    if (slowEndpoints.length > 0) {
      recommendations.push('Optimize slow endpoints identified in the report');
    }

    if (errorEndpoints.length > 0) {
      recommendations.push('Fix error endpoints identified in the report');
    }

    return recommendations;
  }
}
