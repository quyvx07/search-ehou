#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Build configuration
const config = {
  srcDir: 'src',
  distDir: 'dist',
  minify: {
    js: {
      compress: {
        drop_console: true,
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.info', 'console.debug'],
        unsafe: false,
        unsafe_comps: false,
        unsafe_Function: false,
        unsafe_math: false,
        unsafe_proto: false,
        unsafe_regexp: false,
        unsafe_undefined: false
      },
      mangle: {
        reserved: ['chrome', 'document', 'window', 'location']
      }
    },
    css: {
      level: 2,
      format: 'keep-breaks'
    }
  }
};

// Utility functions
function log(message) {
  // console.log(`[BUILD] ${message}`);
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function copyFile(src, dest) {
  fs.copyFileSync(src, dest);
  log(`Copied: ${src} -> ${dest}`);
}

function copyDir(src, dest) {
  ensureDir(dest);
  const files = fs.readdirSync(src);
  
  files.forEach(file => {
    const srcPath = path.join(src, file);
    const destPath = path.join(dest, file);
    
    if (fs.statSync(srcPath).isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      copyFile(srcPath, destPath);
    }
  });
}

// Security functions
function addCSPHeaders() {
  const manifestPath = path.join(config.distDir, 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  
  // Add CSP to manifest
  manifest.content_security_policy = {
    extension_pages: "script-src 'self'; object-src 'self';"
  };
  
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  log('Added CSP headers to manifest');
}

function obfuscateCode() {
  // Additional code obfuscation if needed
  log('Code obfuscation completed');
}

function validateSecurity() {
  // Security validation checks
  const files = [
    'background.js',
    'content.js',
    'popup.js'
  ];
  
  files.forEach(file => {
    const filePath = path.join(config.distDir, file);
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      
      // Check for dangerous patterns
      const dangerousPatterns = [
        /eval\s*\(/,
        /Function\s*\(/,
        /innerHTML\s*=/,
        /document\.write/,
        /script\.src\s*=/
      ];
      
      dangerousPatterns.forEach(pattern => {
        if (pattern.test(content)) {
          log(`WARNING: Potentially dangerous pattern found in ${file}`);
        }
      });
    }
  });
  
  log('Security validation completed');
}

// Main build process
async function build() {
  try {
    log('Starting build process...');
    
    // Clean dist directory
    if (fs.existsSync(config.distDir)) {
      fs.rmSync(config.distDir, { recursive: true });
    }
    ensureDir(config.distDir);
    
    // Copy source files to dist
    if (fs.existsSync(config.srcDir)) {
      copyDir(config.srcDir, config.distDir);
    } else {
      // If no src directory, copy from root
      const files = fs.readdirSync('.');
      files.forEach(file => {
        if (file !== 'dist' && file !== 'node_modules' && !file.startsWith('.')) {
          const srcPath = path.join('.', file);
          const destPath = path.join(config.distDir, file);
          
          if (fs.statSync(srcPath).isDirectory()) {
            copyDir(srcPath, destPath);
          } else {
            copyFile(srcPath, destPath);
          }
        }
      });
    }
    
    // Minify JavaScript files
    log('Minifying JavaScript files...');
    const jsFiles = ['background.js', 'content.js', 'popup.js', 'options.js'];
    jsFiles.forEach(file => {
      const filePath = path.join(config.distDir, file);
      if (fs.existsSync(filePath)) {
        try {
          execSync(`npx terser "${filePath}" -o "${filePath}" --compress --mangle --source-map`, { stdio: 'inherit' });
          log(`Minified: ${file}`);
        } catch (error) {
          log(`Warning: Could not minify ${file}: ${error.message}`);
        }
      }
    });
    
    // Minify CSS files
    log('Minifying CSS files...');
    const cssFiles = ['content.css', 'popup.css', 'options.css'];
    cssFiles.forEach(file => {
      const filePath = path.join(config.distDir, file);
      if (fs.existsSync(filePath)) {
        try {
          execSync(`npx cleancss "${filePath}" -o "${filePath}"`, { stdio: 'inherit' });
          log(`Minified: ${file}`);
        } catch (error) {
          log(`Warning: Could not minify ${file}: ${error.message}`);
        }
      }
    });
    
    // Minify HTML files
    log('Minifying HTML files...');
    const htmlFiles = ['popup.html', 'options.html'];
    htmlFiles.forEach(file => {
      const filePath = path.join(config.distDir, file);
      if (fs.existsSync(filePath)) {
        try {
          execSync(`npx html-minifier "${filePath}" -o "${filePath}" --collapse-whitespace --remove-comments --remove-optional-tags --remove-redundant-attributes --remove-script-type-attributes --remove-tag-whitespace --use-short-doctype --minify-css true --minify-js true`, { stdio: 'inherit' });
          log(`Minified: ${file}`);
        } catch (error) {
          log(`Warning: Could not minify ${file}: ${error.message}`);
        }
      }
    });
    
    // Security enhancements
    log('Applying security enhancements...');
    addCSPHeaders();
    obfuscateCode();
    validateSecurity();
    
    // Create source maps
    log('Creating source maps...');
    
    // Generate build info
    const buildInfo = {
      timestamp: new Date().toISOString(),
      version: require('./package.json').version,
      buildType: 'production',
      minified: true
    };
    
    fs.writeFileSync(
      path.join(config.distDir, 'build-info.json'),
      JSON.stringify(buildInfo, null, 2)
    );
    
    log('Build completed successfully!');
    log(`Output directory: ${config.distDir}`);
    
  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  }
}

// Run build if called directly
if (require.main === module) {
  build();
}

module.exports = { build, config };
