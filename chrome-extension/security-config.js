// Security configuration for Search EHOU Chrome Extension

const SecurityConfig = {
  // Content Security Policy
  csp: {
    extension_pages: "script-src 'self'; object-src 'self'; connect-src 'self' http://localhost:3000 https://*.ehou.edu.vn;",
    sandbox: "allow-scripts allow-forms allow-popups allow-modals; script-src 'self' 'unsafe-inline' 'unsafe-eval'; child-src 'self';"
  },

  // API Security
  api: {
    baseUrl: 'http://localhost:3000/api/v1',
    timeout: 30000,
    maxRetries: 3,
    allowedOrigins: [
      'http://localhost:3000',
      'https://*.ehou.edu.vn'
    ]
  },

  // Data Protection
  data: {
    encryption: {
      enabled: true,
      algorithm: 'AES-256-GCM',
      keyDerivation: 'PBKDF2'
    },
    storage: {
      secure: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      cleanupInterval: 60 * 60 * 1000 // 1 hour
    }
  },

  // Permissions
  permissions: {
    required: [
      'activeTab',
      'storage',
      'scripting'
    ],
    optional: [
      'contextMenus',
      'notifications'
    ],
    hostPermissions: [
      'http://localhost:3000/*',
      'https://*.ehou.edu.vn/*'
    ]
  },

  // Validation Rules
  validation: {
    input: {
      maxLength: 10000,
      allowedTags: ['p', 'br', 'strong', 'em', 'u', 'ol', 'ul', 'li'],
      allowedAttributes: ['class', 'id']
    },
    api: {
      maxPayloadSize: 1024 * 1024, // 1MB
      rateLimit: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 100 // limit each IP to 100 requests per windowMs
      }
    }
  },

  // Security Headers
  headers: {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin'
  },

  // Code Obfuscation
  obfuscation: {
    enabled: true,
    options: {
      compact: true,
      controlFlowFlattening: true,
      controlFlowFlatteningThreshold: 0.75,
      deadCodeInjection: true,
      deadCodeInjectionThreshold: 0.4,
      debugProtection: false,
      debugProtectionInterval: 0,
      disableConsoleOutput: true,
      identifierNamesGenerator: 'hexadecimal',
      log: false,
      numbersToExpressions: true,
      renameGlobals: false,
      selfDefending: true,
      simplify: true,
      splitStrings: true,
      splitStringsChunkLength: 10,
      stringArray: true,
      stringArrayEncoding: ['base64'],
      stringArrayThreshold: 0.75,
      transformObjectKeys: true,
      unicodeEscapeSequence: false
    }
  },

  // Audit Configuration
  audit: {
    enabled: true,
    checks: [
      'dangerous-patterns',
      'permission-usage',
      'api-calls',
      'data-leakage',
      'xss-vulnerabilities'
    ],
    reporting: {
      console: true,
      file: false,
      remote: false
    }
  }
};

// Security utility functions
const SecurityUtils = {
  // Validate input
  validateInput(input, type = 'text') {
    if (!input || typeof input !== 'string') {
      return false;
    }

    if (input.length > SecurityConfig.validation.input.maxLength) {
      return false;
    }

    // XSS protection
    const dangerousPatterns = [
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi,
      /data:text\/html/gi
    ];

    return !dangerousPatterns.some(pattern => pattern.test(input));
  },

  // Sanitize HTML
  sanitizeHTML(html) {
    if (!html) return '';
    
    // Remove dangerous tags and attributes
    const allowedTags = SecurityConfig.validation.input.allowedTags;
    const allowedAttributes = SecurityConfig.validation.input.allowedAttributes;
    
    // Basic sanitization - in production, use a proper HTML sanitizer
    return html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '')
      .replace(/data:text\/html/gi, '');
  },

  // Validate API response
  validateAPIResponse(response) {
    if (!response || typeof response !== 'object') {
      return false;
    }

    // Check for suspicious patterns in response
    const responseStr = JSON.stringify(response);
    const suspiciousPatterns = [
      /<script/gi,
      /javascript:/gi,
      /eval\s*\(/gi
    ];

    return !suspiciousPatterns.some(pattern => pattern.test(responseStr));
  },

  // Generate secure random string
  generateSecureRandom(length = 32) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    
    for (let i = 0; i < length; i++) {
      result += chars.charAt(array[i] % chars.length);
    }
    
    return result;
  },

  // Hash sensitive data
  async hashData(data) {
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  },

  // Log security events
  logSecurityEvent(event, details = {}) {
    if (SecurityConfig.audit.enabled) {
      const logEntry = {
        timestamp: new Date().toISOString(),
        event,
        details,
        userAgent: navigator.userAgent,
        url: window.location.href
      };

      if (SecurityConfig.audit.reporting.console) {
        console.warn('[SECURITY]', logEntry);
      }
    }
  }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { SecurityConfig, SecurityUtils };
} else if (typeof window !== 'undefined') {
  window.SecurityConfig = SecurityConfig;
  window.SecurityUtils = SecurityUtils;
}
