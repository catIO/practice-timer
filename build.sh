#!/bin/bash
set -e

echo "Starting build process..."
echo "Current directory: $(pwd)"
echo "Directory contents:"
ls -la

echo "Installing root dependencies..."
npm install

echo "Changing to client directory..."
cd client

echo "Installing client dependencies..."
npm install

echo "Building client..."
npm run build

echo "Build completed successfully!" 