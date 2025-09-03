import { IsString, IsArray, ArrayMinSize, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateQuizDto {
  @ApiProperty({ description: 'Course ID' })
  @IsString()
  @IsUUID()
  courseId: string;

  @ApiProperty({ description: 'Question IDs for the quiz', type: [String] })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  questionIds: string[];
}
