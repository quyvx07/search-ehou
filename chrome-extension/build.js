// Build script for Search EHOU Chrome Extension
const fs = require('fs');
const path = require('path');

function buildExtension() {
    console.log('🔨 Building Search EHOU Chrome Extension...');

    const sourceDir = __dirname;
    const distDir = path.join(__dirname, 'dist');

    // Create dist directory if it doesn't exist
    if (!fs.existsSync(distDir)) {
        fs.mkdirSync(distDir);
        console.log('📁 Created dist directory');
    }

    // Files to copy
    const filesToCopy = [
        'manifest.json',
        'background.js',
        'content.js',
        'config.js',
        'config-examples.js',
        'popup.html',
        'popup.js',
        'popup.css'
    ];

    // Copy files
    filesToCopy.forEach(file => {
        const sourcePath = path.join(sourceDir, file);
        const destPath = path.join(distDir, file);

        if (fs.existsSync(sourcePath)) {
            fs.copyFileSync(sourcePath, destPath);
            console.log(`✅ Copied ${file}`);
        } else {
            console.log(`⚠️  File not found: ${file}`);
        }
    });

    // Copy icons directory
    const iconsSource = path.join(sourceDir, 'icons');
    const iconsDest = path.join(distDir, 'icons');

    if (fs.existsSync(iconsSource)) {
        if (!fs.existsSync(iconsDest)) {
            fs.mkdirSync(iconsDest);
        }

        const iconFiles = fs.readdirSync(iconsSource);
        iconFiles.forEach(file => {
            const sourcePath = path.join(iconsSource, file);
            const destPath = path.join(iconsDest, file);
            fs.copyFileSync(sourcePath, destPath);
        });
        console.log('✅ Copied icons directory');
    }

    console.log('🎉 Build completed successfully!');
    console.log(`📦 Extension files are in: ${distDir}`);
    console.log('');
    console.log('📋 Next steps:');
    console.log('1. Open Chrome and go to chrome://extensions/');
    console.log('2. Enable "Developer mode"');
    console.log('3. Click "Load unpacked"');
    console.log('4. Select the "dist" folder');
    console.log('');
    console.log('🧪 To test configuration:');
    console.log('1. Open Chrome DevTools Console on extension pages');
    console.log('2. Use CONFIG object: CONFIG.API.BASE_URL, CONFIG.setEnvironment(\'production\')');
}

if (require.main === module) {
    buildExtension();
}

module.exports = { buildExtension };