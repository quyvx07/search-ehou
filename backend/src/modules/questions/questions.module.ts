import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Course } from './entities/course.entity';
import { Question } from './entities/question.entity';
import { CourseController } from './controllers/course.controller';
import { QuestionController } from './controllers/question.controller';
import { QuestionMatchingController } from './controllers/question-matching.controller';
import { CourseService } from './services/course.service';
import { QuestionService } from './services/question.service';
import { BulkSearchService } from './services/bulk-search.service';
import { QuestionMatchingService } from './services/question-matching.service';
import { EnhancedKeywordMatchingService } from './services/enhanced-keyword-matching.service';
import { HybridSearchService } from './services/hybrid-search.service';
import { SearchModule } from '../elasticsearch/elasticsearch.module';
import { CacheService } from '../../common/services/cache.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Course, Question]),
    SearchModule,
  ],
  controllers: [CourseController, QuestionController, QuestionMatchingController],
  providers: [
    CourseService,
    QuestionService,
    BulkSearchService,
    QuestionMatchingService,
    EnhancedKeywordMatchingService,
    HybridSearchService,
    CacheService,
    {
      provide: 'SearchService',
      useValue: {
        searchSimilar: () => Promise.resolve([]),
        searchQuestions: () => Promise.resolve([])
      }
    }
  ],
  exports: [CourseService, QuestionService, QuestionMatchingService, EnhancedKeywordMatchingService, HybridSearchService],
})
export class QuestionsModule {}
