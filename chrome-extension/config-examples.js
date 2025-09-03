// Examples of how to use the Search EHOU Configuration System

// ==========================================
// 1. BASIC USAGE
// ==========================================

// Access configuration values
console.log('API Base URL:', CONFIG.API.BASE_URL);
console.log('Search Threshold:', CONFIG.SEARCH.THRESHOLD);

// Use helper functions
const apiUrl = CONFIG.getApiUrl(CONFIG.URLS.HYBRID_BULK_SEARCH);
const fullUrl = CONFIG.getFullUrl(CONFIG.URLS.HYBRID_BULK_SEARCH, {
  elasticsearchSize: '20',
  threshold: '0.6'
});

console.log('API URL:', apiUrl);
console.log('Full URL with params:', fullUrl);

// ==========================================
// 2. ENVIRONMENT SWITCHING
// ==========================================

// Switch to different environments
CONFIG.setEnvironment('development'); // http://localhost:3000/api/v1
CONFIG.setEnvironment('staging');      // https://staging-api.ehou.edu.vn/api/v1
CONFIG.setEnvironment('production');   // https://api.ehou.edu.vn/api/v1

// Check current environment
if (CONFIG.isDevelopment()) {
  console.log('Running in development mode');
} else if (CONFIG.isProduction()) {
  console.log('Running in production mode');
}

// ==========================================
// 3. DYNAMIC CONFIGURATION
// ==========================================

// Load configuration from Chrome storage
await CONFIG.loadFromStorage();

// Modify configuration
CONFIG.API.TIMEOUT = 45000; // Increase timeout
CONFIG.SEARCH.ELASTICSEARCH_SIZE = 30; // More candidates
CONFIG.SEARCH.THRESHOLD = 0.8; // Higher accuracy

// Save changes to storage
await CONFIG.saveToStorage();

// ==========================================
// 4. API CALLS USING CONFIG
// ==========================================

// Example 1: Hybrid Bulk Search
async function searchQuestions(questions, courseCode) {
  const url = CONFIG.getFullUrl(CONFIG.URLS.HYBRID_BULK_SEARCH, {
    elasticsearchSize: CONFIG.SEARCH.ELASTICSEARCH_SIZE.toString(),
    threshold: CONFIG.SEARCH.THRESHOLD.toString()
  });

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        questions,
        courseCode,
        threshold: CONFIG.SEARCH.THRESHOLD
      })
    });

    if (!response.ok) {
      throw new Error(`${CONFIG.MESSAGES.ERROR.API_ERROR}: ${response.status}`);
    }

    const result = await response.json();
    console.log(CONFIG.MESSAGES.SUCCESS.SEARCH_COMPLETED, result);

    return result;
  } catch (error) {
    console.error(CONFIG.MESSAGES.ERROR.NETWORK_ERROR, error);
    throw error;
  }
}

// Example 2: Course Upsert
async function upsertCourse(courseData) {
  const url = CONFIG.getApiUrl(CONFIG.URLS.COURSE_UPSERT);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(courseData)
  });

  return await response.json();
}

// ==========================================
// 5. FEATURE FLAGS
// ==========================================

// Check if features are enabled
if (CONFIG.FEATURES.HYBRID_SEARCH) {
  console.log('Hybrid search is enabled');
}

if (CONFIG.FEATURES.DEBUG_MODE) {
  console.log('Debug mode is active');
}

// ==========================================
// 6. CUSTOM CONFIGURATION
// ==========================================

// Create custom configuration for different deployment scenarios
const customConfig = {
  API: {
    BASE_URL: 'https://my-custom-api.com/api/v1',
    TIMEOUT: 60000
  },
  SEARCH: {
    ELASTICSEARCH_SIZE: 50,
    THRESHOLD: 0.9
  }
};

// Apply custom configuration
Object.assign(CONFIG, customConfig);

// Save custom configuration
await CONFIG.saveToStorage();

// ==========================================
// 7. ERROR HANDLING WITH CONFIG
// ==========================================

async function safeApiCall(url, options = {}) {
  try {
    const response = await fetch(url, {
      timeout: CONFIG.API.TIMEOUT,
      ...options
    });

    if (!response.ok) {
      throw new Error(CONFIG.MESSAGES.ERROR.API_ERROR);
    }

    return await response.json();
  } catch (error) {
    if (error.name === 'AbortError') {
      console.error(CONFIG.MESSAGES.ERROR.NETWORK_ERROR, 'Request timeout');
    } else {
      console.error(CONFIG.MESSAGES.ERROR.API_ERROR, error.message);
    }
    throw error;
  }
}

// ==========================================
// 8. LOGGING WITH CONFIG MESSAGES
// ==========================================

function logWithConfig(level, message, data = null) {
  const timestamp = new Date().toISOString();

  switch (level) {
    case 'info':
      console.info(`[${timestamp}] ℹ️ ${message}`, data || '');
      break;
    case 'success':
      console.log(`[${timestamp}] ✅ ${message}`, data || '');
      break;
    case 'warning':
      console.warn(`[${timestamp}] ⚠️ ${message}`, data || '');
      break;
    case 'error':
      console.error(`[${timestamp}] ❌ ${message}`, data || '');
      break;
  }
}

// Usage examples
logWithConfig('info', CONFIG.MESSAGES.INFO.SEARCHING);
logWithConfig('success', CONFIG.MESSAGES.SUCCESS.SEARCH_COMPLETED, { matched: 5 });
logWithConfig('error', CONFIG.MESSAGES.ERROR.NETWORK_ERROR);
