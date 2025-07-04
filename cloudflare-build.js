#!/usr/bin/env node

// This script is meant to be run in the Cloudflare Pages environment
// to ensure that no large cache files are generated during the build

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Starting Cloudflare Pages build...');

try {
  // Clean up any existing build artifacts
  console.log('🧹 Cleaning up previous build...');
  if (fs.existsSync('dist')) {
    fs.rmSync('dist', { recursive: true, force: true });
  }
  if (fs.existsSync('.next')) {
    fs.rmSync('.next', { recursive: true, force: true });
  }

  // Set environment variables for production build
  process.env.NODE_ENV = 'production';
  process.env.NEXT_TELEMETRY_DISABLED = '1';

  // Run the Next.js build
  console.log('🏗️  Building Next.js application...');
  execSync('npm run build', { 
    stdio: 'inherit',
    env: {
      ...process.env,
      NODE_OPTIONS: '--max-old-space-size=4096'
    }
  });

  // Verify build output
  if (!fs.existsSync('dist')) {
    throw new Error('Build output directory not found');
  }

  console.log('✅ Build completed successfully!');
  
  // Check build size
  const buildSize = execSync('du -sh dist', { encoding: 'utf8' }).trim();
  console.log(`📦 Build size: ${buildSize}`);

  // Create deployment info
  const deploymentInfo = {
    buildTime: new Date().toISOString(),
    buildSize: buildSize,
    nodeVersion: process.version,
    webAssemblySupport: 'fallback-enabled'
  };

  fs.writeFileSync(
    path.join('dist', 'deployment-info.json'),
    JSON.stringify(deploymentInfo, null, 2)
  );

  console.log('🎉 Ready for Cloudflare Pages deployment!');

} catch (error) {
  console.error('❌ Build failed:', error.message);
  
  // Additional error handling for common issues
  if (error.message.includes('FFmpeg') || error.message.includes('WebAssembly')) {
    console.log('💡 FFmpeg/WebAssembly error detected - this is expected in production');
    console.log('🔄 The application will use placeholder images instead of WebAssembly processing');
  }
  
  if (error.message.includes('Out of memory')) {
    console.log('💡 Try increasing Node.js memory: NODE_OPTIONS="--max-old-space-size=8192"');
  }
  
  process.exit(1);
} 