#!/bin/bash

echo "=========================================="
echo "Node.js Path Detection"
echo "=========================================="

echo "Checking Node.js installation:"
echo "------------------------------"

# Check which node
if command -v node &> /dev/null; then
    NODE_PATH=$(which node)
    echo "✅ Node.js found at: $NODE_PATH"
    echo "   Version: $(node --version)"
else
    echo "❌ Node.js not found in PATH"
fi

# Check common locations
echo ""
echo "Checking common Node.js locations:"
echo "----------------------------------"

locations=(
    "/usr/bin/node"
    "/usr/local/bin/node"
    "/opt/nodejs/bin/node"
    "~/.nvm/versions/node/*/bin/node"
)

for location in "${locations[@]}"; do
    if [ -f "$location" ]; then
        echo "✅ Found: $location"
    else
        echo "❌ Not found: $location"
    fi
done

# Check npm
echo ""
echo "Checking npm:"
echo "-------------"
if command -v npm &> /dev/null; then
    NPM_PATH=$(which npm)
    echo "✅ npm found at: $NPM_PATH"
    echo "   Version: $(npm --version)"
else
    echo "❌ npm not found in PATH"
fi

# Check if nodejs (alternative name) exists
echo ""
echo "Checking nodejs (alternative name):"
echo "-----------------------------------"
if command -v nodejs &> /dev/null; then
    NODEJS_PATH=$(which nodejs)
    echo "✅ nodejs found at: $NODEJS_PATH"
    echo "   Version: $(nodejs --version)"
else
    echo "❌ nodejs not found"
fi

echo ""
echo "=========================================="