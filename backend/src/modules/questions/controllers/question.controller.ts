import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { QuestionService } from '../services/question.service';
import { HybridSearchService } from '../services/hybrid-search.service';
import { CreateQuestionDto } from '../dto/create-question.dto';
import { CreateQuizDto } from '../dto/create-quiz.dto';
import { BulkSearchDto } from '../dto/bulk-search.dto';
import { BulkSearchResponseDto } from '../dto/bulk-search-response.dto';
import { Question } from '../entities/question.entity';

@ApiTags('Questions')
@Controller('questions')
export class QuestionController {
  constructor(
    private readonly questionService: QuestionService,
    private readonly hybridSearchService: HybridSearchService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new question' })
  @ApiResponse({ status: 201, description: 'Question created successfully', type: Question })
  @ApiResponse({ status: 409, description: 'Question with this hash already exists' })
  async create(@Body() createQuestionDto: CreateQuestionDto): Promise<Question> {
    return await this.questionService.create(createQuestionDto);
  }

  @Post('bulk-upsert')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Create or update multiple questions (upsert)' })
  @ApiResponse({ status: 200, description: 'Questions upserted successfully', type: [Question] })
  async bulkUpsert(@Body() createQuestionDtos: CreateQuestionDto[]): Promise<Question[]> {
    return await this.questionService.bulkUpsert(createQuestionDtos);
  }

  @Get()
  @ApiOperation({ summary: 'Get all questions' })
  @ApiResponse({ status: 200, description: 'List of all questions', type: [Question] })
  async findAll(): Promise<Question[]> {
    return await this.questionService.findAll();
  }

  @Get('search')
  @ApiOperation({ summary: 'Search questions by text' })
  @ApiQuery({ name: 'q', description: 'Search query text' })
  @ApiQuery({ name: 'courseId', description: 'Filter by course ID', required: false })
  @ApiResponse({ status: 200, description: 'Search results', type: [Question] })
  async search(
    @Query('q') searchText: string,
    @Query('courseId') courseId?: string,
  ): Promise<Question[]> {
    return await this.questionService.searchByQuestionText(searchText, courseId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get question by ID' })
  @ApiParam({ name: 'id', description: 'Question ID' })
  @ApiResponse({ status: 200, description: 'Question found', type: Question })
  @ApiResponse({ status: 404, description: 'Question not found' })
  async findOne(@Param('id') id: string): Promise<Question> {
    return await this.questionService.findOne(id);
  }

  @Get('course/:courseId')
  @ApiOperation({ summary: 'Get questions by course ID' })
  @ApiParam({ name: 'courseId', description: 'Course ID' })
  @ApiResponse({ status: 200, description: 'Questions found', type: [Question] })
  async findByCourse(@Param('courseId') courseId: string): Promise<Question[]> {
    return await this.questionService.findByCourse(courseId);
  }

  @Post('quizzes')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create quiz from questions' })
  @ApiResponse({ status: 201, description: 'Quiz created successfully' })
  async createQuiz(@Body() createQuizDto: CreateQuizDto): Promise<any> {
    return await this.questionService.createQuiz(createQuizDto);
  }

  @Post('bulk-search')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Bulk search questions with Vietnamese text normalization' })
  @ApiResponse({ status: 200, description: 'Bulk search results', type: BulkSearchResponseDto })
  async bulkSearch(@Body() bulkSearchDto: BulkSearchDto): Promise<BulkSearchResponseDto> {
    return await this.questionService.bulkSearch(bulkSearchDto);
  }

  @Post('hybrid-bulk-search')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Hybrid bulk search using Elasticsearch + Enhanced Keyword Matching',
    description: 'Combines Elasticsearch for rough matching with enhanced keyword matching for precision. Optimized for 4GB RAM systems.'
  })
  @ApiResponse({
    status: 200,
    description: 'Hybrid search results with enhanced accuracy',
    type: BulkSearchResponseDto
  })
  async hybridBulkSearch(
    @Body() bulkSearchDto: BulkSearchDto,
    @Query('elasticsearchSize') elasticsearchSize: string = '20',
    @Query('threshold') threshold: string = '0.6'
  ): Promise<BulkSearchResponseDto> {
    const options = {
      elasticsearchSize: parseInt(elasticsearchSize),
      threshold: parseFloat(threshold),
      courseCode: bulkSearchDto.courseCode,
    };

    return await this.hybridSearchService.hybridBulkSearch(bulkSearchDto, options);
  }
}
