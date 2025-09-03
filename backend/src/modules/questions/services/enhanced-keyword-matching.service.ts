import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Question } from '../entities/question.entity';
import { BulkSearchDto, QuestionSearchItemDto } from '../dto/bulk-search.dto';

export interface EnhancedMatchResult {
  questionElement?: any;
  questionIndex: number;
  correctAnswers: string[];
  explanation?: string;
  confidence: number;
  matchScore: number;
  matchType: 'exact' | 'enhanced_keyword' | 'partial';
  explanationScore: string;
}

@Injectable()
export class EnhancedKeywordMatchingService {
  private readonly logger = new Logger(EnhancedKeywordMatchingService.name);

  constructor(
    @InjectRepository(Question)
    private questionRepository: Repository<Question>,
  ) {}

  /**
   * Enhanced keyword matching for questions and answers
   * Optimized for low-resource systems (4GB RAM, 2 cores)
   */
  async findBestMatches(
    quizQuestions: QuestionSearchItemDto[],
    elasticsearchResults: any[],
    courseCode?: string,
    threshold: number = 0.6
  ): Promise<EnhancedMatchResult[]> {
    const results: EnhancedMatchResult[] = [];

    for (let i = 0; i < quizQuestions.length; i++) {
      const quizQuestion = quizQuestions[i];
      // Use all elasticsearch results for each question (they are already filtered by course code)
      const questionMatches = elasticsearchResults;

      if (questionMatches.length === 0) {
        results.push({
          questionIndex: i,
          correctAnswers: [],
          confidence: 0,
          matchScore: 0,
          matchType: 'exact',
          explanationScore: 'No matches found'
        });
        continue;
      }

      // Find best match using enhanced keyword matching
      const bestMatch = await this.findBestMatchForQuestion(quizQuestion, questionMatches, threshold);
      bestMatch.questionIndex = i; // Set correct question index

      results.push(bestMatch);
    }

    return results;
  }

  private async findBestMatchForQuestion(
    quizQuestion: QuestionSearchItemDto,
    elasticsearchMatches: any[],
    threshold: number
  ): Promise<EnhancedMatchResult> {
    let bestMatch: EnhancedMatchResult = {
      questionIndex: elasticsearchMatches[0]?.questionIndex || 0,
      correctAnswers: [],
      confidence: 0,
      matchScore: 0,
      matchType: 'exact',
      explanationScore: 'No match found'
    };

    for (const esMatch of elasticsearchMatches) {
      // Try exact match first (100% accuracy)
      const exactMatch = await this.tryExactMatch(quizQuestion, esMatch);
      if (exactMatch.confidence >= 0.95) {
        return exactMatch;
      }

      // Enhanced keyword matching for question + answers
      const enhancedMatch = await this.calculateEnhancedSimilarity(quizQuestion, esMatch);

      if (enhancedMatch.confidence > bestMatch.confidence) {
        bestMatch = enhancedMatch;
      }
    }

    return bestMatch;
  }

  private async tryExactMatch(quizQuestion: QuestionSearchItemDto, esMatch: any): Promise<EnhancedMatchResult> {
    // Normalize texts for comparison
    const quizQuestionText = this.normalizeVietnameseText(quizQuestion.questionHTML);
    const esQuestionText = this.normalizeVietnameseText(esMatch.question_text || '');

    // Exact match for question
    if (quizQuestionText === esQuestionText) {
      return {
        questionIndex: esMatch.questionIndex,
        correctAnswers: this.extractCorrectAnswers(esMatch),
        explanation: esMatch.explanation_text,
        confidence: 1.0,
        matchScore: 1.0,
        matchType: 'exact',
        explanationScore: 'Exact question match (100%)'
      };
    }

    // Check if any answer matches exactly
    const quizAnswers = quizQuestion.answersHTML.map(a => this.normalizeVietnameseText(a));
    const esAnswers = this.extractAnswers(esMatch);

    for (let i = 0; i < quizAnswers.length; i++) {
      for (let j = 0; j < esAnswers.length; j++) {
        if (quizAnswers[i] === esAnswers[j]) {
          return {
            questionIndex: esMatch.questionIndex,
            correctAnswers: this.extractCorrectAnswers(esMatch),
            explanation: esMatch.explanation_text,
            confidence: 0.9,
            matchScore: 0.9,
            matchType: 'exact',
            explanationScore: `Exact answer match: "${quizAnswers[i]}"`
          };
        }
      }
    }

    return {
      questionIndex: esMatch.questionIndex,
      correctAnswers: [],
      confidence: 0,
      matchScore: 0,
      matchType: 'exact',
      explanationScore: 'No exact match'
    };
  }

  private async calculateEnhancedSimilarity(quizQuestion: QuestionSearchItemDto, esMatch: any): Promise<EnhancedMatchResult> {
    // Normalize texts
    const quizQuestionText = this.normalizeVietnameseText(quizQuestion.questionHTML);
    const esQuestionText = this.normalizeVietnameseText(esMatch.question_text || '');

    // Calculate question similarity
    const questionSimilarity = this.calculateTextSimilarity(quizQuestionText, esQuestionText);

    // Calculate answer set similarity
    const quizAnswers = quizQuestion.answersHTML.map(a => this.normalizeVietnameseText(a));
    const esAnswers = this.extractAnswers(esMatch);
    const answerSimilarity = this.calculateAnswerSetSimilarity(quizAnswers, esAnswers);

    // Weighted scoring (question 60%, answers 40%)
    const finalScore = (questionSimilarity * 0.6) + (answerSimilarity * 0.4);

    // Debug logging
    this.logger.debug('Enhanced similarity calculation:', {
      quizQuestionText: quizQuestionText.substring(0, 100),
      esQuestionText: esQuestionText.substring(0, 100),
      questionSimilarity,
      answerSimilarity,
      finalScore,
      quizAnswers: quizAnswers.map(a => a.substring(0, 50)),
      esAnswers: esAnswers.map(a => a.substring(0, 50))
    });

    return {
      questionIndex: esMatch.questionIndex,
      correctAnswers: this.extractCorrectAnswers(esMatch),
      explanation: esMatch.explanation_text,
      confidence: Math.min(finalScore, 0.95), // Cap at 95% for keyword matching
      matchScore: finalScore,
      matchType: 'enhanced_keyword',
      explanationScore: `Question: ${(questionSimilarity * 100).toFixed(1)}%, Answers: ${(answerSimilarity * 100).toFixed(1)}%, Final: ${(finalScore * 100).toFixed(1)}%`
    };
  }

  private calculateTextSimilarity(text1: string, text2: string): number {
    if (!text1 || !text2) return 0;

    const words1 = text1.split(/\s+/).filter(word => word.length > 2);
    const words2 = text2.split(/\s+/).filter(word => word.length > 2);

    if (words1.length === 0 || words2.length === 0) return 0;

    const commonWords = words1.filter(word => words2.includes(word));
    const totalUniqueWords = new Set([...words1, ...words2]).size;

    return totalUniqueWords > 0 ? commonWords.length / totalUniqueWords : 0;
  }

  private calculateAnswerSetSimilarity(answers1: string[], answers2: string[]): number {
    if (answers1.length === 0 || answers2.length === 0) return 0;

    let totalSimilarity = 0;
    let comparisons = 0;

    // Compare each answer from quiz with each answer from database
    for (const answer1 of answers1) {
      let bestSimilarity = 0;

      for (const answer2 of answers2) {
        const similarity = this.calculateTextSimilarity(answer1, answer2);
        bestSimilarity = Math.max(bestSimilarity, similarity);
      }

      totalSimilarity += bestSimilarity;
      comparisons++;
    }

    // Also compare in reverse
    for (const answer2 of answers2) {
      let bestSimilarity = 0;

      for (const answer1 of answers1) {
        const similarity = this.calculateTextSimilarity(answer2, answer1);
        bestSimilarity = Math.max(bestSimilarity, similarity);
      }

      totalSimilarity += bestSimilarity;
      comparisons++;
    }

    return comparisons > 0 ? totalSimilarity / comparisons : 0;
  }

  private extractAnswers(esMatch: any): string[] {
    const answersText = esMatch.answers_text || '';
    if (!answersText) return [];

    // For Elasticsearch data, answers are joined with spaces
    // Try to extract meaningful answer chunks
    const normalized = this.normalizeVietnameseText(answersText);
    
    // Return the full text as one answer for now
    // TODO: Improve answer extraction logic
    return [normalized];
  }

  private extractCorrectAnswers(esMatch: any): string[] {
    const correctAnswersText = esMatch.correct_answers_text || '';
    if (!correctAnswersText) return [];

    // For Elasticsearch data, correct answers are joined with spaces
    const normalized = this.normalizeVietnameseText(correctAnswersText);
    
    // Return the full text as one answer for now
    // TODO: Improve answer extraction logic
    return [normalized];
  }

  private normalizeVietnameseText(text: string): string {
    if (!text) return '';

    return text
      .toLowerCase()
      // Remove HTML tags
      .replace(/<[^>]*>/g, ' ')
      // Remove punctuation but keep Vietnamese chars
      .replace(/[^\w\sàáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/g, ' ')
      // Remove extra spaces
      .replace(/\s+/g, ' ')
      .trim();
  }
}
