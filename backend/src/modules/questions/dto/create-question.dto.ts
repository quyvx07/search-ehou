import { IsString, IsNotEmpty, IsArray, IsOptional, IsNumber, ArrayMinSize } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateQuestionDto {
  @ApiProperty({ description: 'Course ID' })
  @IsString()
  courseId: string;

  @ApiProperty({ description: 'Question HTML content' })
  @IsString()
  @IsNotEmpty()
  questionHtml: string;

  @ApiProperty({ description: 'Answer options HTML content', type: [String] })
  @IsArray()
  @ArrayMinSize(2)
  @IsString({ each: true })
  answersHtml: string[];

  @ApiProperty({ description: 'Correct answers HTML content', type: [String] })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  correctAnswersHtml: string[];

  @ApiPropertyOptional({ description: 'Explanation HTML content' })
  @IsOptional()
  @IsString()
  explanationHtml?: string;
}
