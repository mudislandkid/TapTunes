#!/bin/bash

# Quick fix script for Node.js version compatibility
echo "🔧 Fixing Node.js version compatibility..."

# Check current Node.js version
CURRENT_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
echo "Current Node.js version: $(node --version)"

if [[ $CURRENT_VERSION -lt 20 ]]; then
    echo "❌ Node.js $(node --version) detected, but packages require Node.js 20+"
    echo "Upgrading to Node.js 20.x..."
    
    # Remove old Node.js
    sudo apt remove --purge -y nodejs npm
    sudo apt autoremove -y
    sudo rm -rf /etc/apt/sources.list.d/nodesource.list*
    
    # Install Node.js 20
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt install -y nodejs
    
    # Verify installation
    if node --version > /dev/null 2>&1; then
        echo "✅ Node.js $(node --version) installed successfully"
        echo "You can now continue with the deployment"
    else
        echo "❌ Node.js installation failed"
        exit 1
    fi
else
    echo "✅ Node.js $(node --version) is compatible"
fi
