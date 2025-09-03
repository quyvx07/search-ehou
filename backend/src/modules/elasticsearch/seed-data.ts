import { SearchService } from './elasticsearch.service';

const sampleQuestions = [
  {
    question_id: 'sample-1',
    course_code: 'SAMPLE001',
    question_text: 'What is JavaScript?',
    answers_text: 'A programming language',
    correct_answers_text: 'JavaScript is a programming language.',
    explanation_text: 'JavaScript is a high-level programming language.',
    created_at: new Date()
  },
  {
    question_id: 'sample-2',
    course_code: 'SAMPLE001',
    question_text: 'What is TypeScript?',
    answers_text: 'A superset of JavaScript',
    correct_answers_text: 'TypeScript is a superset of JavaScript.',
    explanation_text: 'TypeScript adds static typing to JavaScript.',
    created_at: new Date()
  }
];

export async function seedElasticsearchData(searchService: SearchService): Promise<void> {
  try {
    console.log('Starting to seed Elasticsearch data...');

    // Index sample questions
    await searchService.bulkIndexQuestions(sampleQuestions);

    console.log(`Successfully indexed ${sampleQuestions.length} sample questions`);

    // Test search functionality
    console.log('\nTesting search functionality...');

    // Test single search
    const singleSearchResults = await searchService.searchQuestions('JavaScript');
    console.log(`Single search for "JavaScript" returned ${singleSearchResults.length} results`);

    // Test search with course filter
    const courseFilterResults = await searchService.searchQuestions('programming', 'SAMPLE001');
    console.log(`Search with course filter returned ${courseFilterResults.length} results`);

    // Test multiple search
    const multipleSearchResults = await searchService.searchMultipleQuestions([
      'JavaScript',
      'TypeScript',
      'programming'
    ]);
    console.log(`Multiple search returned ${multipleSearchResults.length} results`);

    // Get index stats
    const stats = await searchService.getIndexStats();
    console.log('Index statistics:', JSON.stringify(stats, null, 2));

    console.log('\nElasticsearch seeding completed successfully!');
  } catch (error) {
    console.error('Error seeding Elasticsearch data:', error);
    throw error;
  }
}
