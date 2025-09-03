import { Injectable, Logger } from '@nestjs/common';
import { ElasticsearchService } from '@nestjs/elasticsearch';
import { QUESTIONS_INDEX, QUESTIONS_INDEX_SETTINGS } from '../../config/elasticsearch.config';

export interface QuestionDocument {
  question_id: string;
  course_code: string;
  question_text: string;
  answers_text: string;
  correct_answers_text: string;
  explanation_text?: string;
  created_at: Date;
}

export interface SearchResult {
  question_id: string;
  course_code: string;
  question_text: string;
  answers_text: string;
  correct_answers_text: string;
  explanation_text?: string;
  score: number;
}

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);

  constructor(private readonly elasticsearchService: ElasticsearchService) {}

  async onModuleInit() {
    await this.initializeIndex();
  }

  private isElasticsearchCompatibilityError(error: any): boolean {
    const message = error.message || '';
    return message.includes('media_type_header_exception') ||
           message.includes('Accept version must be either version 8 or 7') ||
           message.includes('compatible-with=9');
  }

  private async initializeIndex() {
    try {
      const indexExists = await this.elasticsearchService.indices.exists({
        index: QUESTIONS_INDEX,
      });

      if (!indexExists) {
        await this.elasticsearchService.indices.create({
          index: QUESTIONS_INDEX,
          body: QUESTIONS_INDEX_SETTINGS as any,
        });
        this.logger.log(`Index ${QUESTIONS_INDEX} created successfully`);
      } else {
        this.logger.log(`Index ${QUESTIONS_INDEX} already exists`);
      }
    } catch (error) {
      // Handle Elasticsearch version compatibility issues
      if (error.message?.includes('media_type_header_exception') ||
          error.message?.includes('Accept version must be either version 8 or 7')) {
        this.logger.warn(`Elasticsearch version compatibility issue: ${error.message}`);
        this.logger.warn(`Skipping index creation. Please ensure Elasticsearch server is running and compatible.`);
        this.logger.warn(`Index ${QUESTIONS_INDEX} should be created manually or by upgrading Elasticsearch server.`);
        return; // Don't throw error, just log warning
      }

      this.logger.error(`Failed to initialize index: ${error.message}`);
      throw error;
    }
  }

  async indexQuestion(question: QuestionDocument): Promise<void> {
    try {
      await this.elasticsearchService.index({
        index: QUESTIONS_INDEX,
        id: question.question_id,
        body: {
          ...question,
          created_at: question.created_at.toISOString(),
        },
      });
      this.logger.log(`Question ${question.question_id} indexed successfully`);
    } catch (error) {
      if (this.isElasticsearchCompatibilityError(error)) {
        this.logger.warn(`Skipping question ${question.question_id} indexing due to Elasticsearch compatibility issue`);
        return;
      }
      this.logger.error(`Failed to index question ${question.question_id}: ${error.message}`);
      throw error;
    }
  }

  async bulkIndexQuestions(questions: QuestionDocument[]): Promise<void> {
    try {
      const operations = questions.flatMap((question) => [
        { index: { _index: QUESTIONS_INDEX, _id: question.question_id } },
        {
          ...question,
          created_at: question.created_at.toISOString(),
        },
      ]);

      const result = await this.elasticsearchService.bulk({ body: operations });
      
      if (result.errors) {
        const errors = result.items
          .filter((item) => item.index?.error)
          .map((item) => item.index?.error?.reason);
        this.logger.error(`Bulk indexing errors: ${errors.join(', ')}`);
      } else {
        this.logger.log(`${questions.length} questions indexed successfully`);
      }
    } catch (error) {
      if (this.isElasticsearchCompatibilityError(error)) {
        this.logger.warn(`Skipping bulk question indexing due to Elasticsearch compatibility issue`);
        return;
      }
      this.logger.error(`Failed to bulk index questions: ${error.message}`);
      throw error;
    }
  }

  async searchQuestions(
    query: string,
    courseCode?: string,
    size: number = 10,
  ): Promise<SearchResult[]> {

    try {
      const searchQuery: any = {
        bool: {
          should: [
            {
              match: {
                question_text: {
                  query,
                  fuzziness: 'AUTO',
                  operator: 'or',
                  minimum_should_match: '70%',
                  boost: 2.0,
                },
              },
            },
            {
              match: {
                answers_text: {
                  query,
                  fuzziness: 'AUTO',
                  boost: 1.5,
                },
              },
            },
            {
              match: {
                explanation_text: {
                  query,
                  fuzziness: 'AUTO',
                  boost: 1.2,
                },
              },
            },
          ],
          minimum_should_match: 1,
        },
      };

      if (courseCode) {
        // Use wildcard query to match course codes starting with the given code
        // Example: "IT02" will match "IT02", "IT02.059", "IT02.023", etc.
        searchQuery.bool.filter = [
          {
            wildcard: {
              course_code: {
                value: `${courseCode}*`,
                case_insensitive: true
              }
            }
          }
        ];

        this.logger.log(`🔍 Searching with wildcard courseCode pattern: "${courseCode}*"`);
      }

      const result = await this.elasticsearchService.search({
        index: QUESTIONS_INDEX,
        body: {
          query: searchQuery,
          sort: [
            {
              _score: {
                order: 'desc',
              },
            },
          ],
          size,
        } as any,
      });

      return result.hits.hits.map((hit: any) => ({
        question_id: hit._source.question_id,
        course_code: hit._source.course_code,
        question_text: hit._source.question_text,
        answers_text: hit._source.answers_text,
        correct_answers_text: hit._source.correct_answers_text,
        explanation_text: hit._source.explanation_text,
        score: hit._score,
      }));
    } catch (error) {
      if (this.isElasticsearchCompatibilityError(error)) {
        this.logger.warn(`Search failed due to Elasticsearch compatibility issue, returning empty results`);
        return [];
      }
      this.logger.error(`Search failed: ${error.message}`);
      throw error;
    }
  }

  async searchMultipleQuestions(
    queries: string[],
    courseCode?: string,
    size: number = 20,
  ): Promise<SearchResult[]> {
    try {
      const searchQuery: any = {
        bool: {
          should: queries.map((query) => ({
            match: {
              question_text: {
                query,
                fuzziness: 'AUTO',
                minimum_should_match: '70%',
              },
            },
          })),
          minimum_should_match: 1,
        },
      };

      if (courseCode) {
        // Use wildcard query to match course codes starting with the given code
        // Example: "IT02" will match "IT02", "IT02.059", "IT02.023", etc.
        searchQuery.bool.filter = [
          {
            wildcard: {
              course_code: {
                value: `${courseCode}*`,
                case_insensitive: true
              }
            }
          }
        ];
      }

      const result = await this.elasticsearchService.search({
        index: QUESTIONS_INDEX,
        body: {
          query: searchQuery,
          sort: [
            {
              _score: {
                order: 'desc',
              },
            },
          ],
          size,
        } as any,
      });

      return result.hits.hits.map((hit: any) => ({
        question_id: hit._source.question_id,
        course_code: hit._source.course_code,
        question_text: hit._source.question_text,
        answers_text: hit._source.answers_text,
        correct_answers_text: hit._source.correct_answers_text,
        explanation_text: hit._source.explanation_text,
        score: hit._score,
      }));
    } catch (error) {
      if (this.isElasticsearchCompatibilityError(error)) {
        this.logger.warn(`Multiple search failed due to Elasticsearch compatibility issue, returning empty results`);
        return [];
      }
      this.logger.error(`Multiple search failed: ${error.message}`);
      throw error;
    }
  }

  async deleteQuestion(questionId: string): Promise<void> {
    try {
      await this.elasticsearchService.delete({
        index: QUESTIONS_INDEX,
        id: questionId,
      });
      this.logger.log(`Question ${questionId} deleted successfully`);
    } catch (error) {
      if (this.isElasticsearchCompatibilityError(error)) {
        this.logger.warn(`Skipping question ${questionId} deletion due to Elasticsearch compatibility issue`);
        return;
      }
      this.logger.error(`Failed to delete question ${questionId}: ${error.message}`);
      throw error;
    }
  }

  async getIndexStats(): Promise<any> {
    try {
      const stats = await this.elasticsearchService.indices.stats({
        index: QUESTIONS_INDEX,
      });
      return stats;
    } catch (error) {
      if (this.isElasticsearchCompatibilityError(error)) {
        this.logger.warn(`Failed to get index stats due to Elasticsearch compatibility issue`);
        return { indices: { [QUESTIONS_INDEX]: { total: { docs: { count: 0 } } } } };
      }
      this.logger.error(`Failed to get index stats: ${error.message}`);
      throw error;
    }
  }

  /**
   * Generate multiple courseCode patterns for fuzzy matching
   * Example: "IT02" -> ["IT02", "IT02.*", "IT02*"]
   */
  private generateCourseCodePatterns(courseCode: string): string[] {

    const patterns = new Set<string>();

    // Exact match
    patterns.add(courseCode);

    // Pattern with dot (IT02 -> IT02.*)
    patterns.add(`${courseCode}.*`);

    // Pattern with wildcard at end (IT02 -> IT02*)
    patterns.add(`${courseCode}*`);

    // Pattern with dash (IT02 -> IT02-*)
    patterns.add(`${courseCode}-*`);

    // Pattern with underscore (IT02 -> IT02_*)
    patterns.add(`${courseCode}_*`);

    // If courseCode has dots, also try base pattern
    if (courseCode.includes('.')) {
      const baseCode = courseCode.split('.')[0];
      patterns.add(baseCode);
      patterns.add(`${baseCode}.*`);
      patterns.add(`${baseCode}*`);
    }

    // If courseCode has dashes, also try base pattern
    if (courseCode.includes('-')) {
      const baseCode = courseCode.split('-')[0];
      patterns.add(baseCode);
      patterns.add(`${baseCode}.*`);
      patterns.add(`${baseCode}*`);
    }

    const result = Array.from(patterns);
    return result;
  }
}
