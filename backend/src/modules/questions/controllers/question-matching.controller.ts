import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { QuestionMatchingService, MatchingOptions } from '../services/question-matching.service';

export interface MatchQuestionDto {
  questionHtml: string;
  answersHtml?: string[];
  threshold?: number;
  maxResults?: number;
  useElasticsearch?: boolean;
  fuzzyMatch?: boolean;
}

export interface BulkMatchQuestionsDto {
  questions: Array<{
    questionHtml: string;
    answersHtml?: string[];
  }>;
  options?: MatchingOptions;
}

@Controller('questions/matching')
export class QuestionMatchingController {
  private readonly logger = new Logger(QuestionMatchingController.name);

  constructor(
    private readonly questionMatchingService: QuestionMatchingService,
  ) {}

  /**
   * Match a single question
   */
  @Post('match')
  async matchQuestion(@Body() dto: MatchQuestionDto) {
    try {
      this.logger.log(`Matching question: "${dto.questionHtml.substring(0, 50)}..."`);

      const options: MatchingOptions = {
        threshold: dto.threshold,
        maxResults: dto.maxResults,
        useElasticsearch: dto.useElasticsearch,
        fuzzyMatch: dto.fuzzyMatch,
      };

      const matches = await this.questionMatchingService.findMatchingQuestions(
        dto.questionHtml,
        options,
      );

      return {
        success: true,
        data: {
          question: dto.questionHtml,
          matches,
          totalMatches: matches.length,
          bestMatch: matches.length > 0 ? matches[0] : null,
        },
      };
    } catch (error) {
      this.logger.error('Error matching question:', error);
      throw new HttpException(
        {
          success: false,
          error: 'Failed to match question',
          details: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Bulk match multiple questions
   */
  @Post('bulk-match')
  async bulkMatchQuestions(@Body() dto: BulkMatchQuestionsDto) {
    try {
      this.logger.log(`Bulk matching ${dto.questions.length} questions`);

      const results = await this.questionMatchingService.bulkMatchQuestions(
        dto.questions,
        dto.options,
      );

      const summary = {
        totalQuestions: dto.questions.length,
        questionsWithMatches: results.filter(r => r.matches.length > 0).length,
        totalMatches: results.reduce((sum, r) => sum + r.matches.length, 0),
        averageMatchesPerQuestion: results.reduce((sum, r) => sum + r.matches.length, 0) / dto.questions.length,
      };

      return {
        success: true,
        data: {
          results,
          summary,
        },
      };
    } catch (error) {
      this.logger.error('Error bulk matching questions:', error);
      throw new HttpException(
        {
          success: false,
          error: 'Failed to bulk match questions',
          details: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Get matching statistics
   */
  @Get('stats')
  async getMatchingStats() {
    try {
      this.logger.log('Getting matching statistics');

      const stats = await this.questionMatchingService.getMatchingStats();

      return {
        success: true,
        data: stats,
      };
    } catch (error) {
      this.logger.error('Error getting matching stats:', error);
      throw new HttpException(
        {
          success: false,
          error: 'Failed to get matching statistics',
          details: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Test matching algorithm with sample data
   */
  @Post('test')
  async testMatching(@Body() dto: { questionHtml: string; expectedMatches?: number }) {
    try {
      this.logger.log('Testing matching algorithm');

      const matches = await this.questionMatchingService.findMatchingQuestions(
        dto.questionHtml,
        {
          threshold: 0.5,
          maxResults: 10,
          useElasticsearch: true,
          fuzzyMatch: true,
        },
      );

      const testResults = {
        question: dto.questionHtml,
        matchesFound: matches.length,
        expectedMatches: dto.expectedMatches || 0,
        accuracy: dto.expectedMatches 
          ? Math.min(matches.length / dto.expectedMatches, 1) 
          : null,
        topMatches: matches.slice(0, 3).map(match => ({
          confidence: match.confidence,
          similarity: match.similarity,
          explanation: match.explanation,
        })),
      };

      return {
        success: true,
        data: testResults,
      };
    } catch (error) {
      this.logger.error('Error testing matching:', error);
      throw new HttpException(
        {
          success: false,
          error: 'Failed to test matching algorithm',
          details: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Health check for matching service
   */
  @Get('health')
  async healthCheck() {
    try {
      // Test with a simple question
      const testQuestion = 'What is the capital of Vietnam?';
      const matches = await this.questionMatchingService.findMatchingQuestions(
        testQuestion,
        { maxResults: 1 },
      );

      return {
        success: true,
        data: {
          status: 'healthy',
          service: 'QuestionMatchingService',
          testResult: {
            question: testQuestion,
            matchesFound: matches.length,
            responseTime: 'OK',
          },
        },
      };
    } catch (error) {
      this.logger.error('Health check failed:', error);
      throw new HttpException(
        {
          success: false,
          error: 'Matching service is unhealthy',
          details: error.message,
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }
}
