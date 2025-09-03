import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Course } from '../entities/course.entity';
import { CreateCourseDto } from '../dto/create-course.dto';

@Injectable()
export class CourseService {
  constructor(
    @InjectRepository(Course)
    private courseRepository: Repository<Course>,
  ) {}

  async create(createCourseDto: CreateCourseDto): Promise<Course> {
    const existingCourse = await this.courseRepository.findOne({
      where: { courseCode: createCourseDto.courseCode },
    });

    if (existingCourse) {
      throw new ConflictException(`Course with code ${createCourseDto.courseCode} already exists`);
    }

    const course = this.courseRepository.create(createCourseDto);
    return await this.courseRepository.save(course);
  }

  async findAll(): Promise<Course[]> {
    return await this.courseRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Course> {
    const course = await this.courseRepository.findOne({
      where: { id },
      relations: ['questions'],
    });

    if (!course) {
      throw new NotFoundException(`Course with ID ${id} not found`);
    }

    return course;
  }

  async findByCode(courseCode: string): Promise<Course> {
    const course = await this.courseRepository.findOne({
      where: { courseCode },
      relations: ['questions'],
    });

    if (!course) {
      throw new NotFoundException(`Course with code ${courseCode} not found`);
    }

    return course;
  }

  async upsert(createCourseDto: CreateCourseDto): Promise<Course> {
    const existingCourse = await this.courseRepository.findOne({
      where: { courseCode: createCourseDto.courseCode },
    });

    if (existingCourse) {
      // Update existing course with new data if needed
      existingCourse.courseName = createCourseDto.courseName;
      existingCourse.updatedAt = new Date();
      return await this.courseRepository.save(existingCourse);
    }

    // Create new course
    const course = this.courseRepository.create(createCourseDto);
    return await this.courseRepository.save(course);
  }
}
