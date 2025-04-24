#!/usr/bin/env node

// This script is meant to be run in the Cloudflare Pages environment
// to ensure that no large cache files are generated during the build

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('Running Cloudflare Pages optimized build script...');

// Function to run a command and log output
function runCommand(command) {
  console.log(`Running: ${command}`);
  try {
    execSync(command, { stdio: 'inherit' });
  } catch (error) {
    console.error(`Command failed: ${command}`);
    console.error(error);
    process.exit(1);
  }
}

// Important paths that could contain large cache files
const WEBPACK_CACHE_PATHS = [
  '.next/cache/webpack',
  'dist/cache/webpack',
  'dist/_next/cache/webpack',
  '.vercel/output/static/_next/cache/webpack'
];

// Function to clean cache directories
function cleanCacheDirectories() {
  WEBPACK_CACHE_PATHS.forEach(dir => {
    const fullPath = path.join(process.cwd(), dir);
    if (fs.existsSync(fullPath)) {
      console.log(`Removing webpack cache directory: ${dir}`);
      try {
        fs.rmSync(fullPath, { recursive: true, force: true });
      } catch (error) {
        console.error(`Error removing directory ${dir}:`, error);
      }
    }
  });
}

// Step 1: Clean any existing cache
cleanCacheDirectories();

// Step 2: Modify NODE_OPTIONS to limit memory usage and prevent large files
process.env.NODE_OPTIONS = '--max-old-space-size=2048'; // Limit memory to prevent large cache
process.env.NEXT_TELEMETRY_DISABLED = '1';
process.env.NODE_ENV = 'production';

// Step 3: Run Next.js build with webpack disabled caching
try {
  // Set options to specifically disable webpack caching
  // These flags should prevent large cache files
  runCommand('next build --no-cache');
} catch (error) {
  console.error('Build failed:', error);
  process.exit(1);
}

// Step 4: Clean up cache files after build
cleanCacheDirectories();

// Step 5: Check for and remove large files in the output directories
const MAX_FILE_SIZE_MB = 20;
function findAndRemoveLargeFiles(directory) {
  if (!fs.existsSync(directory)) return;
  
  console.log(`Checking directory for large files: ${directory}`);
  try {
    const files = fs.readdirSync(directory, { withFileTypes: true });
    
    for (const file of files) {
      const fullPath = path.join(directory, file.name);
      
      if (file.isDirectory()) {
        findAndRemoveLargeFiles(fullPath);
      } else if (file.isFile()) {
        const stats = fs.statSync(fullPath);
        const fileSizeMB = stats.size / (1024 * 1024);
        
        // Check if file size exceeds limit
        if (fileSizeMB > MAX_FILE_SIZE_MB) {
          console.log(`Removing large file (${fileSizeMB.toFixed(2)} MB): ${fullPath}`);
          fs.unlinkSync(fullPath);
        }
        
        // Specifically check for pack files which are known to be large
        if (file.name.endsWith('.pack')) {
          console.log(`Removing pack file: ${fullPath}`);
          fs.unlinkSync(fullPath);
        }
      }
    }
  } catch (error) {
    console.error(`Error processing directory ${directory}:`, error);
  }
}

// Search for large files in build output directories
console.log('Searching for and removing large files...');
findAndRemoveLargeFiles('dist');
findAndRemoveLargeFiles('.next');

// Create empty cache directories to prevent errors
WEBPACK_CACHE_PATHS.forEach(dir => {
  const fullPath = path.join(process.cwd(), dir);
  try {
    fs.mkdirSync(fullPath, { recursive: true });
  } catch (error) {
    // Ignore errors here
  }
});

console.log('Build completed successfully!'); 