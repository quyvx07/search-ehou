import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Question } from '../entities/question.entity';
import { Course } from '../entities/course.entity';
import { BulkSearchDto, QuestionSearchItemDto } from '../dto/bulk-search.dto';
import { BulkSearchResponseDto, BulkSearchResultDto, SearchMatchDto } from '../dto/bulk-search-response.dto';

@Injectable()
export class BulkSearchService {
  private readonly logger = new Logger(BulkSearchService.name);

  constructor(
    @InjectRepository(Question)
    private questionRepository: Repository<Question>,
    @InjectRepository(Course)
    private courseRepository: Repository<Course>,
  ) {}

  async bulkSearch(bulkSearchDto: BulkSearchDto): Promise<BulkSearchResponseDto> {
    const startTime = Date.now();
    const { questions, courseCode, threshold = 0.7 } = bulkSearchDto;

    this.logger.log(`Starting bulk search for ${questions.length} questions`);

    const results: BulkSearchResultDto[] = [];
    const errors: string[] = [];

    // Process each question
    for (let i = 0; i < questions.length; i++) {
      try {
        const result = await this.searchSingleQuestion(questions[i], courseCode, threshold, i);
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

    this.logger.log(`Bulk search completed: ${matchedQuestions}/${questions.length} matched in ${processingTimeMs}ms`);

    return {
      totalQuestions: questions.length,
      matchedQuestions,
      averageConfidence,
      processingTimeMs,
      results,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  private async searchSingleQuestion(
    questionItem: QuestionSearchItemDto,
    courseCode?: string,
    threshold: number = 0.7,
    questionIndex: number = 0,
  ): Promise<BulkSearchResultDto> {
    const normalizedQuestion = this.normalizeVietnameseText(questionItem.questionHTML);
    const normalizedAnswers = questionItem.answersHTML.map(answer => 
      this.normalizeVietnameseText(answer)
    );

    // Build query with course filter
    let query = this.questionRepository
      .createQueryBuilder('question')
      .leftJoinAndSelect('question.course', 'course');

    if (courseCode) {
      query = query.andWhere('course.courseCode = :courseCode', { courseCode });
    }

    // Get all potential matches
    const potentialMatches = await query.getMany();

    // Calculate similarity scores
    const matches: SearchMatchDto[] = [];

    for (const match of potentialMatches) {
      const matchScore = this.calculateSimilarityScore(
        normalizedQuestion,
        normalizedAnswers,
        match,
        questionItem
      );

      if (matchScore.confidenceScore >= threshold) {
        matches.push({
          id: match.id,
          questionHtml: match.questionHtml,
          answersHtml: match.answersHtml,
          correctAnswersHtml: match.correctAnswersHtml,
          explanationHtml: match.explanationHtml,
          course: {
            id: match.course.id,
            courseCode: match.course.courseCode,
            courseName: match.course.courseName,
          },
          confidenceScore: matchScore.confidenceScore,
          matchType: matchScore.matchType,
          similarityPercentage: matchScore.similarityPercentage,
        });
      }
    }

    // Sort by confidence score
    matches.sort((a, b) => b.confidenceScore - a.confidenceScore);

    return {
      questionIndex,
      originalQuestion: questionItem.questionHTML,
      originalAnswers: questionItem.answersHTML,
      bestMatch: matches.length > 0 ? matches[0] : undefined,
      allMatches: matches,
      hasMatch: matches.length > 0,
    };
  }

  private normalizeVietnameseText(text: string): string {
    if (!text) return '';

    return text
      .toLowerCase()
      // Remove HTML tags
      .replace(/<[^>]*>/g, ' ')
      // Normalize Vietnamese characters
      .replace(/[àáạảãâầấậẩẫăằắặẳẵ]/g, 'a')
      .replace(/[èéẹẻẽêềếệểễ]/g, 'e')
      .replace(/[ìíịỉĩ]/g, 'i')
      .replace(/[òóọỏõôồốộổỗơờớợởỡ]/g, 'o')
      .replace(/[ùúụủũưừứựửữ]/g, 'u')
      .replace(/[ỳýỵỷỹ]/g, 'y')
      .replace(/[đ]/g, 'd')
      // Remove extra spaces
      .replace(/\s+/g, ' ')
      .trim();
  }

  private calculateSimilarityScore(
    normalizedQuestion: string,
    normalizedAnswers: string[],
    match: Question,
    originalQuestion: QuestionSearchItemDto,
  ): { confidenceScore: number; matchType: 'question' | 'answer' | 'explanation' | 'combined'; similarityPercentage: number } {
    const normalizedMatchQuestion = this.normalizeVietnameseText(match.questionHtml);
    const normalizedMatchAnswers = match.answersHtml.map(answer => 
      this.normalizeVietnameseText(answer)
    );

    // Calculate question similarity
    const questionSimilarity = this.calculateTextSimilarity(normalizedQuestion, normalizedMatchQuestion);
    
    // Calculate answer similarity
    const answerSimilarity = this.calculateAnswerSimilarity(normalizedAnswers, normalizedMatchAnswers);
    
    // Calculate explanation similarity if available
    let explanationSimilarity = 0;
    if (match.explanationHtml && originalQuestion.questionHTML) {
      const normalizedExplanation = this.normalizeVietnameseText(match.explanationHtml);
      explanationSimilarity = this.calculateTextSimilarity(normalizedQuestion, normalizedExplanation);
    }

    // Weighted scoring
    const questionWeight = 0.5;
    const answerWeight = 0.3;
    const explanationWeight = 0.2;

    let confidenceScore = questionSimilarity * questionWeight + answerSimilarity * answerWeight;
    let matchType: 'question' | 'answer' | 'explanation' | 'combined' = 'combined';

    // If explanation similarity is high, boost the score
    if (explanationSimilarity > 0.7) {
      confidenceScore += explanationSimilarity * explanationWeight;
      matchType = 'explanation';
    } else if (questionSimilarity > 0.8) {
      matchType = 'question';
    } else if (answerSimilarity > 0.8) {
      matchType = 'answer';
    }

    // Normalize to 0-1 range
    confidenceScore = Math.min(confidenceScore, 1.0);

    return {
      confidenceScore,
      matchType,
      similarityPercentage: Math.round(confidenceScore * 100),
    };
  }

  private calculateTextSimilarity(text1: string, text2: string): number {
    if (!text1 || !text2) return 0;

    const words1 = text1.split(/\s+/);
    const words2 = text2.split(/\s+/);

    const commonWords = words1.filter(word => words2.includes(word));
    const totalWords = new Set([...words1, ...words2]).size;

    return totalWords > 0 ? commonWords.length / totalWords : 0;
  }

  private calculateAnswerSimilarity(answers1: string[], answers2: string[]): number {
    if (answers1.length === 0 || answers2.length === 0) return 0;

    let totalSimilarity = 0;
    let comparisons = 0;

    for (const answer1 of answers1) {
      for (const answer2 of answers2) {
        const similarity = this.calculateTextSimilarity(answer1, answer2);
        totalSimilarity += similarity;
        comparisons++;
      }
    }

    return comparisons > 0 ? totalSimilarity / comparisons : 0;
  }
}
