import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Question } from '../entities/question.entity';
import { CreateQuestionDto } from '../dto/create-question.dto';
import { BulkSearchDto } from '../dto/bulk-search.dto';
import { BulkSearchResponseDto } from '../dto/bulk-search-response.dto';
import { CourseService } from './course.service';
import { BulkSearchService } from './bulk-search.service';
import { CacheService } from '../../../common/services/cache.service';

@Injectable()
export class QuestionService {
  private readonly CACHE_TTL = 300; // 5 minutes
  private readonly CACHE_PREFIX = 'question';

  constructor(
    @InjectRepository(Question)
    private questionRepository: Repository<Question>,
    private courseService: CourseService,
    private bulkSearchService: BulkSearchService,
    private cacheService: CacheService,
  ) {}

  async create(createQuestionDto: CreateQuestionDto): Promise<Question> {
    // Check if course exists
    await this.courseService.findOne(createQuestionDto.courseId);

    // Check for similar questions globally
    const similarQuestion = await this.findSimilarQuestion(createQuestionDto);
    if (similarQuestion) {
      throw new ConflictException(
        `Câu hỏi tương tự đã tồn tại (ID: ${similarQuestion.id}). ` +
        `Nếu muốn cập nhật, hãy sử dụng endpoint upsert hoặc xóa câu hỏi cũ trước.`
      );
    }

    const question = this.questionRepository.create(createQuestionDto);
    const savedQuestion = await this.questionRepository.save(question);

    // Invalidate related caches
    await this.invalidateRelatedCaches(createQuestionDto.courseId);

    return savedQuestion;
  }

  async findAll(): Promise<Question[]> {
    const cacheKey = this.cacheService.generateKey(this.CACHE_PREFIX, { action: 'findAll' });
    
    // Try to get from cache first
    const cached = await this.cacheService.get<Question[]>(cacheKey);
    if (cached) {
      return cached;
    }

    // If not in cache, get from database
    const questions = await this.questionRepository.find({
      relations: ['course'],
      order: { createdAt: 'DESC' },
    });

    // Cache the result
    await this.cacheService.set(cacheKey, questions, this.CACHE_TTL);
    
    return questions;
  }

  async findOne(id: string): Promise<Question> {
    const cacheKey = this.cacheService.generateKey(this.CACHE_PREFIX, { action: 'findOne', id });
    
    // Try to get from cache first
    const cached = await this.cacheService.get<Question>(cacheKey);
    if (cached) {
      return cached;
    }

    // If not in cache, get from database
    const question = await this.questionRepository.findOne({
      where: { id },
      relations: ['course'],
    });

    if (!question) {
      throw new NotFoundException(`Question with ID ${id} not found`);
    }

    // Cache the result
    await this.cacheService.set(cacheKey, question, this.CACHE_TTL);
    
    return question;
  }

  async findByCourse(courseId: string): Promise<Question[]> {
    const cacheKey = this.cacheService.generateKey(this.CACHE_PREFIX, { action: 'findByCourse', courseId });
    
    // Try to get from cache first
    const cached = await this.cacheService.get<Question[]>(cacheKey);
    if (cached) {
      return cached;
    }

    // If not in cache, get from database
    const questions = await this.questionRepository.find({
      where: { courseId },
      relations: ['course'],
      order: { createdAt: 'DESC' },
    });

    // Cache the result
    await this.cacheService.set(cacheKey, questions, this.CACHE_TTL);
    
    return questions;
  }

  async searchByQuestionText(searchText: string, courseId?: string): Promise<Question[]> {
    const cacheKey = this.cacheService.generateKey(this.CACHE_PREFIX, { 
      action: 'searchByQuestionText', 
      searchText, 
      courseId 
    });
    
    // Try to get from cache first
    const cached = await this.cacheService.get<Question[]>(cacheKey);
    if (cached) {
      return cached;
    }

    // If not in cache, get from database
    let query = this.questionRepository
      .createQueryBuilder('question')
      .leftJoinAndSelect('question.course', 'course')
      .where('question.questionHtml ILIKE :searchText', {
        searchText: `%${searchText}%`,
      });

    if (courseId) {
      query = query.andWhere('question.courseId = :courseId', { courseId });
    }

    const questions = await query.getMany();

    // Cache the result
    await this.cacheService.set(cacheKey, questions, this.CACHE_TTL);
    
    return questions;
  }

  async bulkCreate(questions: CreateQuestionDto[]): Promise<Question[]> {
    const createdQuestions: Question[] = [];
    const courseIds = new Set<string>();

    for (const questionDto of questions) {
      try {
        const question = await this.create(questionDto);
        createdQuestions.push(question);
        courseIds.add(questionDto.courseId);
      } catch (error) {
        // Skip if question already exists or other errors
        continue;
      }
    }

    // Invalidate caches for all affected courses
    for (const courseId of courseIds) {
      await this.invalidateRelatedCaches(courseId);
    }

    return createdQuestions;
  }

  async bulkUpsert(questions: CreateQuestionDto[]): Promise<Question[]> {
    const upsertedQuestions: Question[] = [];
    const courseIds = new Set<string>();

    // Get unique course IDs to check existing questions
    const uniqueCourseIds = [...new Set(questions.map(q => q.courseId))];

    for (const courseId of uniqueCourseIds) {
      // Get existing questions for this course
      const existingQuestions = await this.questionRepository.find({
        where: { courseId },
        select: ['id', 'questionHtml', 'answersHtml']
      });

      // Create hash map of existing questions
      const existingHashes = new Map<string, string>();
      existingQuestions.forEach(existing => {
        const hash = this.createQuestionHash(existing.questionHtml, existing.answersHtml);
        existingHashes.set(hash, existing.id);
      });

      // Filter and upsert questions for this course
      const courseQuestions = questions.filter(q => q.courseId === courseId);

      for (const questionDto of courseQuestions) {
        try {
          const hash = this.createQuestionHash(questionDto.questionHtml, questionDto.answersHtml);
          const existingId = existingHashes.get(hash);

          if (existingId) {
            // Question exists, update it
            const existingQuestion = await this.questionRepository.findOne({
              where: { id: existingId }
            });

            if (existingQuestion) {
              existingQuestion.questionHtml = questionDto.questionHtml;
              existingQuestion.answersHtml = questionDto.answersHtml;
              existingQuestion.correctAnswersHtml = questionDto.correctAnswersHtml;
              existingQuestion.explanationHtml = questionDto.explanationHtml;
              existingQuestion.updatedAt = new Date();

              const updatedQuestion = await this.questionRepository.save(existingQuestion);
              upsertedQuestions.push(updatedQuestion);
            }
          } else {
            // Check for similar questions globally using cosine similarity
            const similarQuestion = await this.findSimilarQuestion(questionDto);
            if (similarQuestion) {
              // Similar question found, update it instead of creating new
              similarQuestion.questionHtml = questionDto.questionHtml;
              similarQuestion.answersHtml = questionDto.answersHtml;
              similarQuestion.correctAnswersHtml = questionDto.correctAnswersHtml;
              similarQuestion.explanationHtml = questionDto.explanationHtml;
              similarQuestion.updatedAt = new Date();

              const updatedQuestion = await this.questionRepository.save(similarQuestion);
              upsertedQuestions.push(updatedQuestion);
              courseIds.add(similarQuestion.courseId);
            } else {
              // Create new question
              const question = this.questionRepository.create(questionDto);
              const savedQuestion = await this.questionRepository.save(question);
              upsertedQuestions.push(savedQuestion);
              courseIds.add(courseId);
            }
          }

          courseIds.add(courseId);
        } catch (error) {
          console.error('Error upserting question:', error);
          continue;
        }
      }
    }

    // Invalidate caches for all affected courses
    for (const courseId of courseIds) {
      await this.invalidateRelatedCaches(courseId);
    }

    return upsertedQuestions;
  }

  private async findSimilarQuestion(createQuestionDto: CreateQuestionDto): Promise<Question | null> {
    // Clean and normalize the new question content
    const cleanNewQuestion = createQuestionDto.questionHtml
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/\s+/g, ' ')    // Normalize whitespace
      .trim()
      .toLowerCase();

    const cleanNewAnswers = createQuestionDto.answersHtml
      .join(' ')
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/\s+/g, ' ')    // Normalize whitespace
      .trim()
      .toLowerCase();

    // Get all questions from database (limit to recent questions for performance)
    const existingQuestions = await this.questionRepository.find({
      select: ['id', 'questionHtml', 'answersHtml', 'correctAnswersHtml'],
      order: { createdAt: 'DESC' },
      take: 1000 // Limit to avoid performance issues
    });

    // Find similar questions using multiple similarity checks
    for (const existing of existingQuestions) {
      const cleanExistingQuestion = existing.questionHtml
        .replace(/<[^>]*>/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();

      const cleanExistingAnswers = existing.answersHtml
        .join(' ')
        .replace(/<[^>]*>/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();

      // Check exact match first (most reliable)
      if (cleanNewQuestion === cleanExistingQuestion &&
          cleanNewAnswers === cleanExistingAnswers) {
        return existing;
      }

      // Calculate comprehensive similarity score using Cosine Similarity
      const questionSimilarity = this.cosineSimilarity(cleanNewQuestion, cleanExistingQuestion);
      const answersSimilarity = this.cosineSimilarity(cleanNewAnswers, cleanExistingAnswers);

      // Check if both question and answers are highly similar (70%+ match)
      if (questionSimilarity > 0.7 && answersSimilarity > 0.7) {
        return existing;
      }

      // Check correct answers similarity
      const cleanNewCorrect = createQuestionDto.correctAnswersHtml
        .join(' ')
        .replace(/<[^>]*>/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();

      const cleanExistingCorrect = existing.correctAnswersHtml
        .join(' ')
        .replace(/<[^>]*>/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();

      const correctAnswersSimilarity = this.cosineSimilarity(cleanNewCorrect, cleanExistingCorrect);

      // If question is very similar (80%+) and correct answers match well (60%+)
      if (questionSimilarity > 0.8 && correctAnswersSimilarity > 0.6) {
        return existing;
      }

      // Calculate overall similarity score (weighted average)
      const overallSimilarity = (questionSimilarity * 0.6) + (answersSimilarity * 0.3) + (correctAnswersSimilarity * 0.1);

      // If overall similarity is very high (85%+), consider it a duplicate
      if (overallSimilarity > 0.85) {
        return existing;
      }
    }

    return null;
  }

  private cosineSimilarity(text1: string, text2: string): number {
    if (text1 === text2) return 1.0;
    if (!text1 || !text2) return 0.0;

    // Tokenize texts (split by spaces and punctuation)
    const tokens1 = this.tokenize(text1);
    const tokens2 = this.tokenize(text2);

    if (tokens1.length === 0 && tokens2.length === 0) return 1.0;
    if (tokens1.length === 0 || tokens2.length === 0) return 0.0;

    // Create term frequency maps
    const tf1 = this.createTermFrequencyMap(tokens1);
    const tf2 = this.createTermFrequencyMap(tokens2);

    // Calculate dot product and magnitudes
    let dotProduct = 0;
    let magnitude1 = 0;
    let magnitude2 = 0;

    // Get all unique terms
    const allTerms = new Set([...Object.keys(tf1), ...Object.keys(tf2)]);

    for (const term of allTerms) {
      const freq1 = tf1[term] || 0;
      const freq2 = tf2[term] || 0;

      dotProduct += freq1 * freq2;
      magnitude1 += freq1 * freq1;
      magnitude2 += freq2 * freq2;
    }

    magnitude1 = Math.sqrt(magnitude1);
    magnitude2 = Math.sqrt(magnitude2);

    if (magnitude1 === 0 || magnitude2 === 0) return 0.0;

    return dotProduct / (magnitude1 * magnitude2);
  }

  private tokenize(text: string): string[] {
    // Remove punctuation and split by whitespace
    return text
      .toLowerCase()
      .replace(/[.,!?;:()[\]{}"']/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .split(' ')
      .filter(token => token.length > 0);
  }

  private createTermFrequencyMap(tokens: string[]): { [key: string]: number } {
    const tfMap: { [key: string]: number } = {};

    for (const token of tokens) {
      tfMap[token] = (tfMap[token] || 0) + 1;
    }

    return tfMap;
  }

  private createQuestionHash(questionHtml: string, answersHtml: string[]): string {
    // Clean and normalize the content for comparison
    const cleanQuestion = questionHtml
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/\s+/g, ' ')    // Normalize whitespace
      .trim()
      .toLowerCase();

    const cleanAnswers = answersHtml
      .join(' ')
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/\s+/g, ' ')    // Normalize whitespace
      .trim()
      .toLowerCase();

    // Create a simple hash of the combined content
    const combined = cleanQuestion + '|' + cleanAnswers;
    let hash = 0;
    for (let i = 0; i < combined.length; i++) {
      const char = combined.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }

    return hash.toString();
  }

  async createQuiz(quizData: { courseId: string; questionIds: string[] }): Promise<any> {
    // Validate course exists
    await this.courseService.findOne(quizData.courseId);

    // Get questions by IDs
    const questions = await this.questionRepository.find({
      where: quizData.questionIds.map(id => ({ id })),
      relations: ['course'],
    });
    
    if (questions.length !== quizData.questionIds.length) {
      throw new NotFoundException('Some questions not found');
    }

    // Create quiz object
    const quiz = {
      id: `quiz_${Date.now()}`,
      courseId: quizData.courseId,
      questions: questions,
      createdAt: new Date(),
      totalQuestions: questions.length,
    };

    return quiz;
  }

  async bulkSearch(bulkSearchDto: BulkSearchDto): Promise<BulkSearchResponseDto> {
    return await this.bulkSearchService.bulkSearch(bulkSearchDto);
  }

  private async invalidateRelatedCaches(courseId: string): Promise<void> {
    const cacheKeys = [
      this.cacheService.generateKey(this.CACHE_PREFIX, { action: 'findAll' }),
      this.cacheService.generateKey(this.CACHE_PREFIX, { action: 'findByCourse', courseId }),
    ];

    for (const key of cacheKeys) {
      await this.cacheService.del(key);
    }
  }
}
