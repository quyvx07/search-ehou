import { Controller, Get, Post, Query, Body, Param } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { SearchService } from './elasticsearch.service';

export class SearchQueryDto {
  query: string;
  courseCode?: string;
  size?: number;
}

export class BulkSearchQueryDto {
  queries: string[];
  courseCode?: string;
  size?: number;
}

export class SearchResultDto {
  question_id: string;
  course_code: string;
  question_text: string;
  answers_text: string;
  correct_answers_text: string;
  explanation_text?: string;
  score: number;
}

@ApiTags('search')
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  @ApiOperation({ summary: 'Search questions by text' })
  @ApiResponse({ status: 200, description: 'Search results', type: [SearchResultDto] })
  @ApiQuery({ name: 'query', description: 'Search query text' })
  @ApiQuery({ name: 'courseCode', required: false, description: 'Course code filter' })
  @ApiQuery({ name: 'size', required: false, description: 'Number of results', type: Number })
  async searchQuestions(
    @Query('query') query: string,
    @Query('courseCode') courseCode?: string,
    @Query('size') size?: number,
  ): Promise<SearchResultDto[]> {
    return this.searchService.searchQuestions(query, courseCode, size);
  }

  @Post('bulk')
  @ApiOperation({ summary: 'Search multiple questions at once' })
  @ApiResponse({ status: 200, description: 'Bulk search results', type: [SearchResultDto] })
  async searchMultipleQuestions(
    @Body() searchDto: BulkSearchQueryDto,
  ): Promise<SearchResultDto[]> {
    return this.searchService.searchMultipleQuestions(
      searchDto.queries,
      searchDto.courseCode,
      searchDto.size,
    );
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get search index statistics' })
  @ApiResponse({ status: 200, description: 'Index statistics' })
  async getIndexStats() {
    return this.searchService.getIndexStats();
  }
}
