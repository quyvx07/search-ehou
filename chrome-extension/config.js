// Configuration constants for Search EHOU Chrome Extension

const CONFIG = {
  // API Configuration
  API: {
    BASE_URL: 'http://localhost:3000/api/v1',
    TIMEOUT: 30000, // 30 seconds
    RETRY_ATTEMPTS: 3,
    RETRY_DELAY: 1000 // 1 second
  },

  // Extension Configuration
  EXTENSION: {
    NAME: 'Search EHOU - Auto Extract',
    VERSION: '1.0.1',
    AUTHOR: 'Search EHOU Team'
  },

  // Feature Flags
  FEATURES: {
    AUTO_EXTRACT: true,
    AUTO_FILL: true,
    HYBRID_SEARCH: true,
    DEBUG_MODE: true
  },

  // Search Configuration
  SEARCH: {
    ELASTICSEARCH_SIZE: 20,
    THRESHOLD: 0.2,  // Lowered threshold for better matching
    MAX_RETRIES: 3,
    BATCH_SIZE: 10
  },

  // URLs and Patterns
  URLS: {
    COURSE_UPSERT: '/courses/upsert',
    QUESTION_BULK_UPSERT: '/questions/bulk-upsert',
    HYBRID_BULK_SEARCH: '/questions/hybrid-bulk-search',
    BULK_SEARCH: '/questions/bulk-search'
  },

  // Messages
  MESSAGES: {
    SUCCESS: {
      AUTO_EXTRACT_COMPLETED: 'Đã hoàn thành auto extract',
      SEARCH_COMPLETED: 'Tìm thấy đáp án thành công',
      EXTENSION_LOADED: 'Extension đã được tải thành công'
    },
    ERROR: {
      NETWORK_ERROR: 'Lỗi kết nối mạng',
      API_ERROR: 'Lỗi API server',
      SEARCH_FAILED: 'Không tìm thấy đáp án phù hợp',
      EXTENSION_ERROR: 'Lỗi extension'
    },
    INFO: {
      SEARCHING: 'Đang tìm kiếm đáp án...',
      PROCESSING: 'Đang xử lý dữ liệu...',
      LOADING: 'Đang tải...'
    }
  },

  // Storage Keys
  STORAGE_KEYS: {
    EXTENSION_STATE: 'extensionState',
    USER_PREFERENCES: 'userPreferences',
    SEARCH_HISTORY: 'searchHistory'
  }
};

// Helper functions
CONFIG.getApiUrl = function(endpoint) {
  return `${this.API.BASE_URL}${endpoint}`;
};

CONFIG.getFullUrl = function(endpoint, params = {}) {
  const url = new URL(this.getApiUrl(endpoint));
  Object.keys(params).forEach(key => {
    url.searchParams.append(key, params[key]);
  });
  return url.toString();
};

// Environment detection
CONFIG.isDevelopment = function() {
  return this.API.BASE_URL.includes('localhost');
};

CONFIG.isProduction = function() {
  return !this.isDevelopment();
};

// Dynamic configuration loading
CONFIG.loadFromStorage = async function() {
  if (typeof chrome !== 'undefined' && chrome.storage) {
    try {
      const result = await chrome.storage.local.get(['extensionConfig']);
      if (result.extensionConfig) {
        // Override configuration with stored values
        Object.assign(this, result.extensionConfig);
        console.log('✅ Configuration loaded from storage');
      }
    } catch (error) {
      console.warn('⚠️ Could not load config from storage:', error);
    }
  }
};

CONFIG.saveToStorage = async function() {
  if (typeof chrome !== 'undefined' && chrome.storage) {
    try {
      await chrome.storage.local.set({ extensionConfig: this });
      console.log('💾 Configuration saved to storage');
    } catch (error) {
      console.warn('⚠️ Could not save config to storage:', error);
    }
  }
};

// Environment switching helpers
CONFIG.setEnvironment = function(env) {
  const environments = {
    development: 'http://localhost:3000/api/v1',
    staging: 'https://staging-api.ehou.edu.vn/api/v1',
    production: 'https://api.ehou.edu.vn/api/v1'
  };

  if (environments[env]) {
    this.API.BASE_URL = environments[env];
    console.log(`🔄 Switched to ${env} environment: ${this.API.BASE_URL}`);
    return true;
  } else {
    console.warn(`⚠️ Unknown environment: ${env}`);
    return false;
  }
};

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CONFIG;
} else if (typeof window !== 'undefined') {
  window.SEARCH_EHOU_CONFIG = CONFIG;
} else if (typeof globalThis !== 'undefined') {
  globalThis.SEARCH_EHOU_CONFIG = CONFIG;
}
