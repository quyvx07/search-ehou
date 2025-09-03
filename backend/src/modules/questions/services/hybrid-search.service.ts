import { Injectable, Logger } from '@nestjs/common';
import { SearchService } from '../../elasticsearch/elasticsearch.service';
import { EnhancedKeywordMatchingService, EnhancedMatchResult } from './enhanced-keyword-matching.service';
import { BulkSearchDto, QuestionSearchItemDto } from '../dto/bulk-search.dto';
import { BulkSearchResponseDto, BulkSearchResultDto, SearchMatchDto } from '../dto/bulk-search-response.dto';

@Injectable()
export class HybridSearchService {
  private readonly logger = new Logger(HybridSearchService.name);

  constructor(
    private readonly searchService: SearchService,
    private readonly enhancedKeywordMatchingService: EnhancedKeywordMatchingService,
  ) {}

  /**
   * Hybrid search combining Elasticsearch + Enhanced Keyword Matching
   * Optimized for 4GB RAM, 2 cores systems
   */
  async hybridBulkSearch(
    bulkSearchDto: BulkSearchDto,
    options: {
      elasticsearchSize?: number;
      threshold?: number;
      courseCode?: string;
    } = {}
  ): Promise<BulkSearchResponseDto> {

    const startTime = Date.now();
    const { questions, courseCode } = bulkSearchDto;
    const { elasticsearchSize = 20, threshold = 0.6 } = options;

    this.logger.log(`🚀 Starting hybrid search for ${questions.length} questions (Elasticsearch + Enhanced Keyword)`);

    const results: BulkSearchResultDto[] = [];
    const errors: string[] = [];

    // Process each question
    for (let i = 0; i < questions.length; i++) {
      try {
        const result = await this.processSingleQuestionHybrid(
          questions[i],
          courseCode,
          elasticsearchSize,
          threshold,
          i
        );
        results.push(result);
      } catch (error) {
        this.logger.error(`Error processing question ${i}: ${error.message}`);
        errors.push(`Question ${i}: ${error.message}`);

        // Add error result
        results.push({
          questionIndex: i,
          originalQuestion: questions[i].questionHTML,
          originalAnswers: questions[i].answersHTML,
          allMatches: [],
          hasMatch: false,
          error: error.message,
        });
      }
    }

    const processingTimeMs = Date.now() - startTime;
    const matchedQuestions = results.filter(r => r.hasMatch).length;
    const averageConfidence = results.length > 0
      ? results.reduce((sum, r) => sum + (r.bestMatch?.confidenceScore || 0), 0) / results.length
      : 0;

    this.logger.log(`✅ Hybrid search completed: ${matchedQuestions}/${questions.length} matched in ${processingTimeMs}ms`);

    return {
      totalQuestions: questions.length,
      matchedQuestions,
      averageConfidence,
      processingTimeMs,
      results,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  private async processSingleQuestionHybrid(
    question: QuestionSearchItemDto,
    courseCode: string | undefined,
    elasticsearchSize: number,
    threshold: number,
    questionIndex: number
  ): Promise<BulkSearchResultDto> {
    // Step 1: Extract question text for Elasticsearch search
    const questionText = this.extractQuestionText(question.questionHTML);

    // Step 2: Search in Elasticsearch to get rough matches
    const elasticsearchResults = await this.searchElasticsearch(questionText, courseCode, elasticsearchSize);
    
    console.log('🔍 DEBUG: Elasticsearch results:', {
      count: elasticsearchResults.length,
      firstResult: elasticsearchResults[0] ? {
        question_id: elasticsearchResults[0].question_id,
        course_code: elasticsearchResults[0].course_code,
        question_text: elasticsearchResults[0].question_text?.substring(0, 100)
      } : null
    });

    // Step 3: Enhanced keyword matching for precision
    const enhancedMatches = await this.enhancedKeywordMatchingService.findBestMatches(
      [question],
      elasticsearchResults.map((result, index) => ({ ...result, questionIndex: questionIndex })),
      courseCode,
      threshold
    );

    // Step 4: Convert to BulkSearchResultDto format
    const bestMatch = enhancedMatches[0];
    const allMatches: SearchMatchDto[] = [];

    if (bestMatch.confidence >= threshold) {
      // Create mock SearchMatchDto from elasticsearch result
      const esResult = elasticsearchResults[0];
      if (esResult) {
        allMatches.push({
          id: esResult.question_id || `es_${Date.now()}`,
          questionHtml: esResult.question_text || '',
          answersHtml: [esResult.answers_text || ''],
          correctAnswersHtml: [bestMatch.correctAnswers.join('; ')],
          explanationHtml: bestMatch.explanation,
          course: {
            id: 'unknown',
            courseCode: courseCode || 'unknown',
            courseName: courseCode || 'unknown'
          },
          confidenceScore: bestMatch.confidence,
          matchType: bestMatch.matchType,
          similarityPercentage: Math.round(bestMatch.confidence * 100),
        });
      }
    }

    return {
      questionIndex,
      originalQuestion: question.questionHTML,
      originalAnswers: question.answersHTML,
      bestMatch: allMatches.length > 0 ? allMatches[0] : undefined,
      allMatches,
      hasMatch: allMatches.length > 0,
    };
  }

  private async searchElasticsearch(questionText: string, courseCode?: string, size: number = 20): Promise<any[]> {
    try {
      console.log('🔍 DEBUG: Calling SearchService.searchQuestions with:', {
        questionText,
        courseCode,
        size
      });
      
      // Use existing SearchService to search Elasticsearch
      const results = await this.searchService.searchQuestions(questionText, courseCode, size);
      
      console.log('🔍 DEBUG: SearchService results:', {
        count: results.length,
        firstResult: results[0] ? {
          question_id: results[0].question_id,
          course_code: results[0].course_code,
          question_text: results[0].question_text?.substring(0, 100)
        } : null
      });

      // Transform results to expected format
      return results.map(result => ({
        question_id: result.question_id,
        course_code: result.course_code,
        question_text: result.question_text,
        answers_text: result.answers_text,
        correct_answers_text: result.correct_answers_text,
        explanation_text: result.explanation_text,
        score: result.score,
      }));
    } catch (error) {
      console.error('❌ DEBUG: Elasticsearch search error:', error);
      this.logger.warn(`Elasticsearch search failed: ${error.message}, falling back to empty results`);
      return [];
    }
  }

  private extractQuestionText(questionHTML: string): string {
    // Extract clean text from HTML
    return questionHTML
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
}
