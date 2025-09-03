import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { CourseService } from '../services/course.service';
import { CreateCourseDto } from '../dto/create-course.dto';
import { Course } from '../entities/course.entity';

@ApiTags('Courses')
@Controller('courses')
export class CourseController {
  constructor(private readonly courseService: CourseService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new course' })
  @ApiResponse({ status: 201, description: 'Course created successfully', type: Course })
  @ApiResponse({ status: 409, description: 'Course with this code already exists' })
  async create(@Body() createCourseDto: CreateCourseDto): Promise<Course> {
    return await this.courseService.create(createCourseDto);
  }

  @Post('upsert')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Create or update a course (upsert)' })
  @ApiResponse({ status: 200, description: 'Course upserted successfully', type: Course })
  async upsert(@Body() createCourseDto: CreateCourseDto): Promise<Course> {
    return await this.courseService.upsert(createCourseDto);
  }

  @Post('bulk-upsert')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Create or update multiple courses (bulk upsert)' })
  @ApiResponse({ status: 200, description: 'Courses bulk upserted successfully', type: [Course] })
  async bulkUpsert(@Body() createCourseDtos: CreateCourseDto[]): Promise<Course[]> {
    const results: Course[] = [];
    for (const dto of createCourseDtos) {
      try {
        const course = await this.courseService.upsert(dto);
        results.push(course);
      } catch (error) {
        // Skip if upsert fails for this course
        console.error('Error upserting course:', error);
        continue;
      }
    }
    return results;
  }

  @Get()
  @ApiOperation({ summary: 'Get all courses' })
  @ApiResponse({ status: 200, description: 'List of all courses', type: [Course] })
  async findAll(): Promise<Course[]> {
    return await this.courseService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get course by ID' })
  @ApiParam({ name: 'id', description: 'Course ID' })
  @ApiResponse({ status: 200, description: 'Course found', type: Course })
  @ApiResponse({ status: 404, description: 'Course not found' })
  async findOne(@Param('id') id: string): Promise<Course> {
    return await this.courseService.findOne(id);
  }

  @Get('code/:courseCode')
  @ApiOperation({ summary: 'Get course by code' })
  @ApiParam({ name: 'courseCode', description: 'Course code' })
  @ApiResponse({ status: 200, description: 'Course found', type: Course })
  @ApiResponse({ status: 404, description: 'Course not found' })
  async findByCode(@Param('courseCode') courseCode: string): Promise<Course> {
    return await this.courseService.findByCode(courseCode);
  }
}
