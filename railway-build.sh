#!/bin/bash

# This script is used for Railway deployment to copy migration files
# to the correct location after the build process

echo "Running post-build script for Railway deployment..."

# Make sure migrations directory exists in dist
mkdir -p dist/migrations

# Railway deploys to /app directory, so we also need to copy there if it exists
if [ -d "/app" ]; then
  mkdir -p /app/dist/migrations
  mkdir -p /app/server/migrations
fi

# Copy migration files from server/migrations to dist/migrations
echo "Copying migration files to dist/migrations..."
cp -r server/migrations/* dist/migrations/

# If we're in Railway's environment, also copy to /app paths
if [ -d "/app" ]; then
  echo "Detected Railway environment, copying to /app paths..."
  cp -r server/migrations/* /app/dist/migrations/
  cp -r server/migrations/* /app/server/migrations/
fi

# Show the files in the migration directories
echo "Files in dist/migrations:"
ls -la dist/migrations/

if [ -d "/app" ]; then
  echo "Files in /app/dist/migrations:"
  ls -la /app/dist/migrations/
  
  echo "Files in /app/server/migrations:"
  ls -la /app/server/migrations/
fi

echo "Post-build script completed successfully!"