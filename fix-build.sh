#!/bin/bash

# Quick fix script for TypeScript build issues
echo "🔧 Fixing TypeScript build issue..."

cd backend

# Install TypeScript if not available
if ! [ -f "./node_modules/.bin/tsc" ]; then
    echo "Installing TypeScript..."
    npm install typescript --save-dev
fi

# Try building again
echo "Building backend..."
if npm run build; then
    echo "✅ Backend built successfully!"
else
    echo "❌ Build still failed. Check for other issues."
    exit 1
fi

cd ..

echo "✅ Build issue fixed! You can continue with the deployment."
