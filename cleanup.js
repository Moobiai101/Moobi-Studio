// cleanup.js - Removes large cache files that exceed Cloudflare Pages limits
const fs = require('fs');
const path = require('path');

// Directories to clean
const dirsToClean = [
  '.next/cache',
  'dist/cache',
  '.vercel/output/static/_next/cache',
  'dist/_next/cache'
];

// Files to check for large size (over 20MB)
const maxSizeInBytes = 20 * 1024 * 1024; // 20MB
const filesToCheck = [
  '.next/cache/webpack/client-production/0.pack',
  '.next/cache/webpack/server-production/0.pack',
  'dist/cache/webpack/client-production/0.pack',
  'dist/cache/webpack/server-production/0.pack'
];

// Clean directories
console.log('Starting cache cleanup...');
dirsToClean.forEach(dir => {
  try {
    if (fs.existsSync(dir)) {
      console.log(`Removing directory: ${dir}`);
      fs.rmSync(dir, { recursive: true, force: true });
    }
  } catch (error) {
    console.error(`Error removing directory ${dir}:`, error);
  }
});

// Check for large files
filesToCheck.forEach(file => {
  try {
    if (fs.existsSync(file)) {
      const stats = fs.statSync(file);
      console.log(`File ${file} size: ${(stats.size / (1024 * 1024)).toFixed(2)}MB`);
      
      if (stats.size > maxSizeInBytes) {
        console.log(`Removing large file: ${file}`);
        fs.unlinkSync(file);
      }
    }
  } catch (error) {
    console.error(`Error checking/removing file ${file}:`, error);
  }
});

// Create directory structure for .next/cache to avoid errors
try {
  fs.mkdirSync('.next/cache/webpack', { recursive: true });
  console.log('Created directory structure for .next/cache/webpack');
} catch (error) {
  console.error('Error creating directory structure:', error);
}

console.log('Cache cleanup complete!'); 