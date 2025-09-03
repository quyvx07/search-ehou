import { IsString, IsArray, IsOptional, IsNumber, Min, Max, ArrayMinSize, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class QuestionSearchItemDto {
  @ApiProperty({ description: 'Question HTML content' })
  @IsString()
  questionHTML: string;

  @ApiProperty({ description: 'Answer options HTML content', type: [String] })
  @IsArray()
  @ArrayMinSize(2)
  @IsString({ each: true })
  answersHTML: string[];
}

export class BulkSearchDto {
  @ApiProperty({ description: 'Array of questions to search', type: [QuestionSearchItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => QuestionSearchItemDto)
  questions: QuestionSearchItemDto[];

  @ApiPropertyOptional({ description: 'Course code to filter results' })
  @IsOptional()
  @IsString()
  courseCode?: string;

  @ApiPropertyOptional({ description: 'Confidence threshold (0.0-1.0)', default: 0.7 })
  @IsOptional()
  @IsNumber()
  @Min(0.0)
  @Max(1.0)
  threshold?: number = 0.7;
}

