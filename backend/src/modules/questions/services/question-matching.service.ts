import { Injectable, Logger, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Question } from '../entities/question.entity';
// import { SearchService } from '../../elasticsearch/elasticsearch.service';

export interface MatchingResult {
  question: Question;
  confidence: number;
  similarity: number;
  matchedFields: string[];
  explanation: string;
}

export interface MatchingOptions {
  threshold?: number;
  maxResults?: number;
  includeExplanations?: boolean;
  useElasticsearch?: boolean;
  fuzzyMatch?: boolean;
}

@Injectable()
export class QuestionMatchingService {
  private readonly logger = new Logger(QuestionMatchingService.name);
  private readonly defaultThreshold = 0.7;
  private readonly defaultMaxResults = 5;

  constructor(
    @InjectRepository(Question)
    private readonly questionRepository: Repository<Question>,
    @Inject('SearchService')
    private readonly elasticsearchService: any,
  ) {}

  /**
   * Find matching questions using multiple strategies
   */
  async findMatchingQuestions(
    questionText: string,
    options: MatchingOptions = {},
  ): Promise<MatchingResult[]> {
    const {
      threshold = this.defaultThreshold,
      maxResults = this.defaultMaxResults,
      useElasticsearch = true,
      fuzzyMatch = true,
    } = options;

    try {
      let results: MatchingResult[] = [];

      // Strategy 1: Elasticsearch fuzzy matching (if enabled)
      if (useElasticsearch) {
        const esResults = await this.findWithElasticsearch(
          questionText,
          threshold,
          maxResults,
          fuzzyMatch,
        );
        results.push(...esResults);
      }

      // Strategy 2: Database fuzzy matching (fallback)
      if (results.length < maxResults) {
        const dbResults = await this.findWithDatabase(
          questionText,
          threshold,
          maxResults - results.length,
        );
        results.push(...dbResults);
      }

      // Strategy 3: Exact matching
      if (results.length < maxResults) {
        const exactResults = await this.findExactMatches(
          questionText,
          maxResults - results.length,
        );
        results.push(...exactResults);
      }

      // Remove duplicates and sort by confidence
      results = this.removeDuplicates(results);
      results = results
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, maxResults);

      this.logger.log(
        `Found ${results.length} matching questions for: "${questionText.substring(0, 50)}..."`,
      );

      return results;
    } catch (error) {
      this.logger.error('Error finding matching questions:', error);
      throw new Error('Failed to find matching questions');
    }
  }

  /**
   * Find matches using Elasticsearch
   */
  private async findWithElasticsearch(
    questionText: string,
    threshold: number,
    maxResults: number,
    fuzzyMatch: boolean,
  ): Promise<MatchingResult[]> {
    try {
      const normalizedText = this.normalizeVietnameseText(questionText);
      
      const searchQuery = {
        query: {
          bool: {
            should: [
              // Exact match with high boost
              {
                match: {
                  'questionHtml.normalized': {
                    query: normalizedText,
                    boost: 3.0,
                  },
                },
              },
              // Fuzzy match if enabled
              ...(fuzzyMatch
                ? [
                    {
                      fuzzy: {
                        'questionHtml.normalized': {
                          value: normalizedText,
                          fuzziness: 'AUTO',
                          boost: 1.0,
                        },
                      },
                    },
                  ]
                : []),
              // Partial match
              {
                match_phrase_prefix: {
                  'questionHtml.normalized': {
                    query: normalizedText,
                    boost: 1.5,
                  },
                },
              },
            ],
            minimum_should_match: 1,
          },
        },
        size: maxResults,
      };

      const results = await this.elasticsearchService.searchQuestions(questionText, undefined, maxResults);
      
      return results.map((result) => ({
        question: {
          id: result.question_id,
          questionHtml: result.question_text,
          answersHtml: result.answers_text.split('|'),
          correctAnswersHtml: result.correct_answers_text.split('|'),
          courseId: result.course_code,
          createdAt: new Date(),
          updatedAt: new Date(),
          course: null,
        } as Question,
        confidence: result.score / 10, // Normalize score to 0-1 range
        similarity: this.calculateSimilarity(normalizedText, result.question_text),
        matchedFields: ['questionHtml'],
        explanation: `Elasticsearch match (score: ${result.score})`,
      }));
    } catch (error) {
      this.logger.warn('Elasticsearch search failed, falling back to database:', error);
      return [];
    }
  }

  /**
   * Find matches using database queries
   */
  private async findWithDatabase(
    questionText: string,
    threshold: number,
    maxResults: number,
  ): Promise<MatchingResult[]> {
    const normalizedText = this.normalizeVietnameseText(questionText);
    
    // Get all questions and calculate similarity
    const questions = await this.questionRepository.find({
      take: 1000, // Limit for performance
    });

    const results: MatchingResult[] = [];

    for (const question of questions) {
      const similarity = this.calculateSimilarity(
        normalizedText,
        this.normalizeVietnameseText(question.questionHtml),
      );

      if (similarity >= threshold) {
        const confidence = this.calculateConfidence(similarity, question);
        
        results.push({
          question,
          confidence,
          similarity,
          matchedFields: ['questionHtml'],
          explanation: `Database similarity: ${(similarity * 100).toFixed(1)}%`,
        });
      }
    }

    return results
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, maxResults);
  }

  /**
   * Find exact matches
   */
  private async findExactMatches(
    questionText: string,
    maxResults: number,
  ): Promise<MatchingResult[]> {
    const normalizedText = this.normalizeVietnameseText(questionText);
    
    const questions = await this.questionRepository
      .createQueryBuilder('question')
      .where('LOWER(question.questionHtml) LIKE LOWER(:text)', {
        text: `%${normalizedText}%`,
      })
      .take(maxResults)
      .getMany();

    return questions.map((question) => ({
      question,
      confidence: 1.0,
      similarity: 1.0,
      matchedFields: ['questionHtml'],
      explanation: 'Exact match found',
    }));
  }

  /**
   * Calculate similarity between two texts using Levenshtein distance
   */
  private calculateSimilarity(text1: string, text2: string): number {
    if (!text1 || !text2) return 0;
    
    const distance = this.levenshteinDistance(text1, text2);
    const maxLength = Math.max(text1.length, text2.length);
    
    return maxLength > 0 ? 1 - distance / maxLength : 0;
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1)
      .fill(null)
      .map(() => Array(str1.length + 1).fill(null));

    for (let i = 0; i <= str1.length; i++) {
      matrix[0][i] = i;
    }

    for (let j = 0; j <= str2.length; j++) {
      matrix[j][0] = j;
    }

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1, // deletion
          matrix[j - 1][i] + 1, // insertion
          matrix[j - 1][i - 1] + indicator, // substitution
        );
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * Calculate confidence score based on multiple factors
   */
  private calculateConfidence(similarity: number, question: Question): number {
    let confidence = similarity;

    // Boost confidence based on question quality
    if (question.questionHtml && question.questionHtml.length > 50) {
      confidence += 0.1;
    }

    if (question.answersHtml && question.answersHtml.length >= 2) {
      confidence += 0.05;
    }

    if (question.correctAnswersHtml && question.correctAnswersHtml.length > 0) {
      confidence += 0.05;
    }

    // Normalize to 0-1 range
    return Math.min(confidence, 1.0);
  }

  /**
   * Normalize Vietnamese text for better matching
   */
  private normalizeVietnameseText(text: string): string {
    if (!text) return '';

    return text
      .toLowerCase()
      .normalize('NFD') // Decompose characters
      .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
      .replace(/[^\w\s]/g, ' ') // Replace punctuation with spaces
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  }

  /**
   * Remove duplicate results based on question ID
   */
  private removeDuplicates(results: MatchingResult[]): MatchingResult[] {
    const seen = new Set<string>();
    return results.filter((result) => {
      if (seen.has(result.question.id)) {
        return false;
      }
      seen.add(result.question.id);
      return true;
    });
  }

  /**
   * Bulk match multiple questions
   */
  async bulkMatchQuestions(
    questions: Array<{ questionHtml: string; answersHtml?: string[] }>,
    options: MatchingOptions = {},
  ): Promise<Array<{ question: any; matches: MatchingResult[] }>> {
    const results = [];

    for (const question of questions) {
      const matches = await this.findMatchingQuestions(question.questionHtml, options);
      results.push({
        question,
        matches,
      });
    }

    return results;
  }

  /**
   * Get matching statistics
   */
  async getMatchingStats(): Promise<{
    totalQuestions: number;
    averageConfidence: number;
    topMatches: MatchingResult[];
  }> {
    const totalQuestions = await this.questionRepository.count();
    
    // Sample some questions for stats
    const sampleQuestions = await this.questionRepository.find({
      take: 100,
    });

    let totalConfidence = 0;
    let matchCount = 0;

    for (const question of sampleQuestions) {
      const matches = await this.findMatchingQuestions(question.questionHtml, {
        maxResults: 1,
      });
      
      if (matches.length > 0) {
        totalConfidence += matches[0].confidence;
        matchCount++;
      }
    }

    const averageConfidence = matchCount > 0 ? totalConfidence / matchCount : 0;

    return {
      totalQuestions,
      averageConfidence,
      topMatches: [], // Could be implemented to show best matches
    };
  }
}
