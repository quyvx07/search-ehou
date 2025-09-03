import { IsString, IsNotEmpty, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateCourseDto {
  @ApiProperty({ description: 'Course code', example: 'IT01.100' })
  @IsString()
  @IsNotEmpty()
  @Length(3, 50)
  courseCode: string;

  @ApiProperty({ description: 'Course name', example: 'Kỹ thuật lập trình cơ sở' })
  @IsString()
  @IsNotEmpty()
  @Length(1, 255)
  courseName: string;
}
