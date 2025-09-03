import { ElasticsearchModuleOptions } from '@nestjs/elasticsearch';
import { ConfigService } from '@nestjs/config';

export const getElasticsearchConfig = (configService: ConfigService): ElasticsearchModuleOptions => ({
  node: configService.get('ELASTICSEARCH_NODE', 'http://localhost:9200'),
  auth: {
    username: configService.get('ELASTICSEARCH_USERNAME', 'elastic'),
    password: configService.get('ELASTICSEARCH_PASSWORD', 'changeme'),
  },
  tls: {
    rejectUnauthorized: false,
  },
  maxRetries: 3,
  requestTimeout: 10000,
  sniffOnStart: false, // Disable sniffing để tránh compatibility issues
});

export const QUESTIONS_INDEX = 'questions';

export const QUESTIONS_INDEX_SETTINGS = {
  settings: {
    number_of_shards: 1,
    number_of_replicas: 1,
    analysis: {
      analyzer: {
        vietnamese_analyzer: {
          type: 'custom',
          tokenizer: 'icu_tokenizer',
          filter: [
            'icu_folding',
            'lowercase',
            'vietnamese_stop',
            'vietnamese_stemmer'
          ]
        },
        vietnamese_search_analyzer: {
          type: 'custom',
          tokenizer: 'icu_tokenizer',
          filter: [
            'icu_folding',
            'lowercase'
          ]
        }
      },
      filter: {
        vietnamese_stop: {
          type: 'stop',
          stopwords: '_vietnamese_'
        },
        vietnamese_stemmer: {
          type: 'stemmer',
          language: 'vietnamese'
        }
      }
    }
  },
  mappings: {
    properties: {
      question_text: {
        type: 'text',
        analyzer: 'vietnamese_analyzer',
        search_analyzer: 'vietnamese_search_analyzer',
        fields: {
          keyword: {
            type: 'keyword',
            ignore_above: 256
          }
        }
      },
      answers_text: {
        type: 'text',
        analyzer: 'vietnamese_analyzer',
        search_analyzer: 'vietnamese_search_analyzer'
      },
      correct_answers_text: {
        type: 'text',
        analyzer: 'vietnamese_analyzer',
        search_analyzer: 'vietnamese_search_analyzer'
      },
      explanation_text: {
        type: 'text',
        analyzer: 'vietnamese_analyzer',
        search_analyzer: 'vietnamese_search_analyzer'
      },
      course_code: {
        type: 'keyword'
      },
      question_id: {
        type: 'keyword'
      },
      created_at: {
        type: 'date'
      }
    }
  }
};
