#!/bin/bash

# Clean webpack cache to avoid large files
echo "Cleaning webpack cache..."
rm -rf .next/cache

# Create an empty .cache directory if it doesn't exist
mkdir -p .next/cache/webpack 