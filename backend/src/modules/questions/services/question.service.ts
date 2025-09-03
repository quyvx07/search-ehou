import { Injectable, NotFoundException } from '@nestjs/common';
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
            // Create new question
            const question = await this.create(questionDto);
            upsertedQuestions.push(question);
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
