import { ApiProperty } from '@nestjs/swagger';

export class SearchMatchDto {
  @ApiProperty({ description: 'Question ID' })
  id: string;

  @ApiProperty({ description: 'Question HTML content' })
  questionHtml: string;

  @ApiProperty({ description: 'Answer options HTML content', type: [String] })
  answersHtml: string[];

  @ApiProperty({ description: 'Correct answers HTML content', type: [String] })
  correctAnswersHtml: string[];

  @ApiProperty({ description: 'Explanation HTML content' })
  explanationHtml?: string;

  @ApiProperty({ description: 'Course information' })
  course: {
    id: string;
    courseCode: string;
    courseName: string;
  };

  @ApiProperty({ description: 'Confidence score (0.0-1.0)' })
  confidenceScore: number;

  @ApiProperty({ description: 'Match type: question, answer, explanation, combined, exact, enhanced_keyword, or partial' })
  matchType: 'question' | 'answer' | 'explanation' | 'combined' | 'exact' | 'enhanced_keyword' | 'partial';

  @ApiProperty({ description: 'Similarity percentage' })
  similarityPercentage: number;
}

export class BulkSearchResultDto {
  @ApiProperty({ description: 'Original question index' })
  questionIndex: number;

  @ApiProperty({ description: 'Original question HTML' })
  originalQuestion: string;

  @ApiProperty({ description: 'Original answers HTML', type: [String] })
  originalAnswers: string[];

  @ApiProperty({ description: 'Best match found', type: SearchMatchDto })
  bestMatch?: SearchMatchDto;

  @ApiProperty({ description: 'All matches found', type: [SearchMatchDto] })
  allMatches: SearchMatchDto[];

  @ApiProperty({ description: 'Whether a match was found' })
  hasMatch: boolean;

  @ApiProperty({ description: 'Error message if any' })
  error?: string;
}

export class BulkSearchResponseDto {
  @ApiProperty({ description: 'Total questions processed' })
  totalQuestions: number;

  @ApiProperty({ description: 'Questions with matches found' })
  matchedQuestions: number;

  @ApiProperty({ description: 'Average confidence score' })
  averageConfidence: number;

  @ApiProperty({ description: 'Processing time in milliseconds' })
  processingTimeMs: number;

  @ApiProperty({ description: 'Search results for each question', type: [BulkSearchResultDto] })
  results: BulkSearchResultDto[];

  @ApiProperty({ description: 'Any errors that occurred' })
  errors?: string[];
}

