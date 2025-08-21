#!/bin/bash

# TapTunes Optimized Deployment Script for Raspberry Pi Zero W
# This version is specifically optimized for the limited resources of Pi Zero W

set -e  # Exit on any error

echo "🎵 TapTunes Pi Zero W Optimized Deployment Script"
echo "=================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   print_error "This script should not be run as root. Please run as a regular user."
   exit 1
fi

# Get current user and home directory
CURRENT_USER=$(whoami)
USER_HOME=$(eval echo ~$CURRENT_USER)

# Detect system architecture
ARCH=$(uname -m)
OS_INFO=$(cat /etc/os-release | grep PRETTY_NAME | cut -d'"' -f2)

print_status "Detected user: $CURRENT_USER"
print_status "Home directory: $USER_HOME"
print_status "Architecture: $ARCH"
print_status "OS: $OS_INFO"

# Check if this is a Pi Zero W
if [[ $ARCH == "armv6l" ]]; then
    print_status "🎯 Raspberry Pi Zero W detected - applying optimizations"
elif [[ $ARCH == "armv7l" ]]; then
    print_status "🎯 Raspberry Pi 2/3 detected"
elif [[ $ARCH == "aarch64" ]]; then
    print_status "🎯 Raspberry Pi 4/5 detected"
fi

# Check if we're in the TapTunes directory
if [ ! -f "docker-compose.yml" ]; then
    print_error "Please run this script from the TapTunes project root directory"
    exit 1
fi

# Check for --no-cache flag
CLEAR_CACHE=false
for arg in "$@"; do
    if [[ "$arg" == "--no-cache" ]]; then
        CLEAR_CACHE=true
        break
    fi
done

print_status "Starting TapTunes deployment..."
if [[ "$CLEAR_CACHE" == "true" ]]; then
    print_status "Cache clearing enabled (--no-cache flag detected)"
fi

# Step 1: System Update (minimal)
print_status "Updating system packages..."
sudo apt update -qq
sudo apt upgrade -y -qq

# Step 2: Install Dependencies (minimal set)
print_status "Installing required packages..."

# Essential packages only
sudo apt install -y git curl wget build-essential

# Node.js - install Node.js 20.x for Pi Zero W compatibility
if ! command -v node &> /dev/null; then
    print_status "Installing Node.js 20.x for Pi Zero W compatibility..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt install -y nodejs
else
    NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
    if [[ $NODE_VERSION -lt 20 ]]; then
        print_warning "Node.js $(node --version) detected, but packages require Node.js 20+"
        print_status "Upgrading to Node.js 20.x..."
        
        # Remove old Node.js
        sudo apt remove --purge -y nodejs npm
        sudo apt autoremove -y
        sudo rm -rf /etc/apt/sources.list.d/nodesource.list*
        
        # Install Node.js 20
        curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
        sudo apt install -y nodejs
    else
        print_status "Node.js $(node --version) is compatible"
    fi
fi

# Python and pip
sudo apt install -y python3 python3-pip python3-venv

# Audio dependencies
sudo apt install -y alsa-utils pulseaudio pulseaudio-utils
sudo apt install -y libasound2-dev libpulse-dev

# Database and other dependencies
sudo apt install -y sqlite3 libsqlite3-dev

# Nginx
sudo apt install -y nginx

# Step 3: Verify and Fix Node.js Installation
print_status "Verifying Node.js installation..."

# Check if Node.js is working properly and has correct version
if ! node --version > /dev/null 2>&1; then
    print_error "Node.js binary is corrupted or incompatible"
    print_status "Removing corrupted Node.js installation..."
    sudo apt remove --purge -y nodejs npm
    sudo apt autoremove -y
    sudo rm -rf /etc/apt/sources.list.d/nodesource.list*
    
    print_status "Installing Node.js 20.x for Pi Zero W compatibility..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt install -y nodejs
else
    # Check if we need to upgrade to Node.js 20
    NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
    if [[ $NODE_VERSION -lt 20 ]]; then
        print_warning "Node.js $(node --version) detected, upgrading to 20.x for compatibility..."
        sudo apt remove --purge -y nodejs npm
        sudo apt autoremove -y
        sudo rm -rf /etc/apt/sources.list.d/nodesource.list*
        curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
        sudo apt install -y nodejs
    fi
fi

# Check if npm is working properly
if ! npm --version > /dev/null 2>&1; then
    print_error "npm binary is corrupted or incompatible"
    print_status "Reinstalling npm..."
    sudo apt install --reinstall -y npm
fi

# Final verification of Node.js and npm
print_status "Final verification of Node.js installation..."
if node --version > /dev/null 2>&1 && npm --version > /dev/null 2>&1; then
    print_status "✅ Node.js $(node --version) and npm $(npm --version) are working"
else
    print_error "❌ Node.js or npm still not working after reinstallation"
    exit 1
fi

# Step 4: Configure npm for Pi Zero W
print_status "Configuring npm for Pi Zero W..."
if command -v npm &> /dev/null; then
    # Set npm cache directory to avoid permission issues
    npm config set cache ~/.npm-cache || print_warning "Could not set npm cache directory"
    
    # Increase network timeout for slower connections
    npm config set fetch-timeout 600000 || print_warning "Could not set npm timeout"
    
    # Use legacy peer deps for better ARM compatibility
    npm config set legacy-peer-deps true || print_warning "Could not set legacy peer deps"
    
    # Set registry to use faster mirrors
    npm config set registry https://registry.npmjs.org/ || print_warning "Could not set npm registry"
    
    # Clear npm cache if it exists
    if [ -d ~/.npm-cache ]; then
        print_status "Clearing npm cache..."
        npm cache clean --force || print_warning "Could not clear npm cache"
    fi
fi

# Step 5: Audio Configuration for WM8960 HAT
print_status "Configuring audio for WM8960 HAT..."
sudo usermod -a -G audio $CURRENT_USER

# Enable I2S interface for WM8960
if ! grep -q "dtoverlay=wm8960-soundcard" /boot/config.txt; then
    print_status "Enabling WM8960 HAT support..."
    echo "" | sudo tee -a /boot/config.txt
    echo "# WM8960 Audio HAT Configuration" | sudo tee -a /boot/config.txt
    echo "dtoverlay=wm8960-soundcard" | sudo tee -a /boot/config.txt
    echo "dtparam=audio=on" | sudo tee -a /boot/config.txt
fi

# Create optimized ALSA configuration for WM8960
sudo tee /etc/asound.conf > /dev/null <<EOF
# WM8960 Audio HAT Configuration
pcm.!default {
    type hw
    card 0
    device 0
}

ctl.!default {
    type hw
    card 0
}

# High-quality playback settings
pcm.wm8960_hifi {
    type hw
    card 0
    device 0
    rate 44100
    channels 2
    format S16_LE
}

# Default device
pcm.!default wm8960_hifi
EOF

# Install additional audio tools for WM8960
sudo apt install -y alsa-tools alsa-utils

# Step 6: Create Directories
print_status "Creating data directories..."
mkdir -p data audio uploads
chmod 755 data audio uploads
chown -R $CURRENT_USER:$CURRENT_USER data audio uploads

# Step 7: Backend Setup (Optimized for Pi Zero W)
print_status "Setting up backend..."
cd backend

# Clean any existing node_modules only if --no-cache flag is used
if [[ "$CLEAR_CACHE" == "true" ]] && [ -d "node_modules" ]; then
    print_status "Clearing node_modules (--no-cache flag detected)..."
    rm -rf node_modules
elif [ -d "node_modules" ]; then
    print_status "Keeping existing node_modules (use --no-cache to clear)"
fi

# Install dependencies with Pi Zero W optimizations
print_status "Installing backend dependencies (this may take a while on Pi Zero W)..."
print_status "Installing both production and dev dependencies for build process..."

# Install with dev dependencies for building (but skip optional)
if npm install --omit=optional --legacy-peer-deps --no-audit --no-fund --progress=false; then
    print_status "✅ Backend dependencies installed successfully"
else
    print_error "❌ Backend dependency installation failed"
    print_status "Trying alternative installation method..."
    
    # Try with even more minimal approach
    if npm install --omit=optional --legacy-peer-deps --no-audit --no-fund --progress=false; then
        print_status "✅ Backend dependencies installed with minimal approach"
    else
        print_error "❌ All backend installation methods failed"
        exit 1
    fi
fi

# Verify TypeScript is available
print_status "Verifying TypeScript availability..."
if ! command -v tsc &> /dev/null && ! [ -f "./node_modules/.bin/tsc" ]; then
    print_error "❌ TypeScript not found. Installing TypeScript..."
    npm install typescript --save-dev
fi

# Build TypeScript
print_status "Building backend..."
if npm run build; then
    print_status "✅ Backend built successfully"
else
    print_error "❌ Backend build failed"
    print_status "Trying to install TypeScript and build again..."
    
    # Install TypeScript if not already installed
    npm install typescript --save-dev
    
    # Try building again
    if npm run build; then
        print_status "✅ Backend built successfully after TypeScript installation"
    else
        print_error "❌ Backend build still failed"
        exit 1
    fi
fi

cd ..

# Step 8: Frontend Setup (Optimized for Pi Zero W)
print_status "Setting up frontend..."
cd frontend

# Clean any existing node_modules only if --no-cache flag is used
if [[ "$CLEAR_CACHE" == "true" ]] && [ -d "node_modules" ]; then
    print_status "Clearing frontend node_modules (--no-cache flag detected)..."
    rm -rf node_modules
elif [ -d "node_modules" ]; then
    print_status "Keeping existing frontend node_modules (use --no-cache to clear)"
fi

# Install dependencies with Pi Zero W optimizations
print_status "Installing frontend dependencies (this may take a while on Pi Zero W)..."
print_status "Installing both production and dev dependencies for build process..."

# Install with dev dependencies for building (include optional for esbuild compatibility)
if npm install --legacy-peer-deps --no-audit --no-fund --progress=false; then
    print_status "✅ Frontend dependencies installed successfully"
else
    print_status "Trying alternative installation method..."
    
    # Try with legacy peer deps
    if npm install --legacy-peer-deps --no-audit --no-fund --progress=false; then
        print_status "✅ Frontend dependencies installed with legacy peer deps"
    else
        print_error "❌ All frontend installation methods failed"
        exit 1
    fi
fi

# Build for production
print_status "Building frontend..."
if npm run build; then
    print_status "✅ Frontend built successfully"
else
    print_error "❌ Frontend build failed"
    exit 1
fi

# Copy to nginx directory
print_status "Copying frontend to nginx..."
sudo cp -r dist/* /var/www/html/
sudo chown -R www-data:www-data /var/www/html/
sudo chown -R $CURRENT_USER:www-data /var/www/html/

cd ..

# Step 9: RFID Service Setup
print_status "Setting up RFID service..."
cd python-services

# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install requirements
if [ -f "requirements.txt" ]; then
    pip install -r requirements.txt
else
    print_warning "No requirements.txt found, installing basic packages..."
    pip install pyserial
fi

# Deactivate virtual environment
deactivate

cd ..

# Step 10: Backend Environment Configuration
print_status "Creating backend environment file..."
cd backend

# Create .env file
cat > .env <<EOF
NODE_ENV=production
PORT=3001
HOST=0.0.0.0
AUDIO_DIR=$(pwd)/../audio
DATA_DIR=$(pwd)/../data
UPLOAD_DIR=$(pwd)/../uploads
EOF

cd ..

# Step 11: Nginx Configuration
print_status "Configuring nginx..."

# Create nginx site configuration
sudo tee /etc/nginx/sites-available/taptunes > /dev/null <<EOF
server {
    listen 80;
    server_name _;
    root /var/www/html;
    index index.html;

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://localhost:3001/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF

# Enable site and remove default
sudo ln -sf /etc/nginx/sites-available/taptunes /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Test nginx configuration
sudo nginx -t
sudo systemctl restart nginx

# Step 12: Systemd Services
print_status "Creating systemd services..."

# Backend service
sudo tee /etc/systemd/system/taptunes-backend.service > /dev/null <<EOF
[Unit]
Description=TapTunes Backend
After=network.target

[Service]
Type=simple
User=$CURRENT_USER
WorkingDirectory=$(pwd)/backend
ExecStart=/usr/bin/node dist/index.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
Environment=PORT=3001

[Install]
WantedBy=multi-user.target
EOF

# RFID service
sudo tee /etc/systemd/system/taptunes-rfid.service > /dev/null <<EOF
[Unit]
Description=TapTunes RFID Service
After=network.target

[Service]
Type=simple
User=$CURRENT_USER
WorkingDirectory=$(pwd)/python-services
ExecStart=$(pwd)/python-services/venv/bin/python rfid_service.py
Restart=always
RestartSec=10
Environment=PYTHONPATH=$(pwd)/python-services

[Install]
WantedBy=multi-user.target
EOF

# Reload systemd and enable services
sudo systemctl daemon-reload
sudo systemctl enable taptunes-backend
sudo systemctl enable taptunes-rfid

# Step 13: Firewall Configuration
print_status "Configuring firewall..."
if command -v ufw &> /dev/null; then
    sudo ufw allow 22/tcp    # SSH
    sudo ufw allow 80/tcp    # HTTP
    sudo ufw allow 3001/tcp  # Backend API
    sudo ufw --force enable
else
    print_warning "ufw not found, skipping firewall configuration"
fi

# Step 14: Start Services
print_status "Starting services..."
sudo systemctl start taptunes-backend
sudo systemctl start taptunes-rfid

# Step 15: Performance Optimization for Pi Zero W
print_status "Applying Pi Zero W performance optimizations..."

# Add performance settings to config.txt
if ! grep -q "arm_freq=1000" /boot/config.txt; then
    echo "" | sudo tee -a /boot/config.txt
    echo "# TapTunes Performance Optimizations" | sudo tee -a /boot/config.txt
    echo "arm_freq=1000" | sudo tee -a /boot/config.txt
    echo "over_voltage=2" | sudo tee -a /boot/config.txt
    echo "gpu_mem=16" | sudo tee -a /boot/config.txt
    echo "dtoverlay=vc4-fkms-v3d" | sudo tee -a /boot/config.txt
    echo "" | sudo tee -a /boot/config.txt
    echo "# Audio Performance Optimizations" | sudo tee -a /boot/config.txt
    echo "dtparam=i2s=on" | sudo tee -a /boot/config.txt
    echo "dtparam=i2c=on" | sudo tee -a /boot/config.txt
fi

# Create swap file if it doesn't exist
if [ ! -f /swapfile ]; then
    print_status "Creating swap file for Pi Zero W..."
    sudo fallocate -l 1G /swapfile
    sudo chmod 600 /swapfile
    sudo mkswap /swapfile
    sudo swapon /swapfile
    
    # Make permanent
    if ! grep -q "/swapfile" /etc/fstab; then
        echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
    fi
fi

# Step 16: Final Configuration
print_status "Finalizing configuration..."

# Get Pi's IP address
PI_IP=$(hostname -I | awk '{print $1}')

# Update frontend API URL
if [ -n "$PI_IP" ]; then
    print_status "Updating frontend API URL to use Pi IP: $PI_IP"
    cd /var/www/html
    sudo sed -i "s|http://localhost:3001|http://$PI_IP:3001|g" *.js
    cd - > /dev/null
fi

# Step 17: Verification
print_status "Verifying installation..."

# Check service status
if sudo systemctl is-active --quiet taptunes-backend; then
    print_status "✅ Backend service is running"
else
    print_error "❌ Backend service failed to start"
fi

if sudo systemctl is-active --quiet taptunes-rfid; then
    print_status "✅ RFID service is running"
else
    print_error "❌ RFID service failed to start"
fi

if sudo systemctl is-active --quiet nginx; then
    print_status "✅ Nginx is running"
else
    print_error "❌ Nginx failed to start"
fi

# Test backend API
if curl -s http://localhost:3001/health > /dev/null 2>&1; then
    print_status "✅ Backend API is responding"
else
    print_warning "⚠️  Backend API test failed (this might be normal if no health endpoint exists)"
fi

# Test audio configuration
print_status "Testing audio configuration..."
if aplay -l | grep -q "WM8960"; then
    print_status "✅ WM8960 HAT detected"
else
    print_warning "⚠️  WM8960 HAT not detected - check hardware connection"
fi

# Test audio playback (silent test)
if timeout 3 aplay -D hw:0,0 -f S16_LE -r 44100 -c 2 /dev/zero > /dev/null 2>&1; then
    print_status "✅ Audio playback test passed"
else
    print_warning "⚠️  Audio playback test failed - check ALSA configuration"
fi

# Step 18: Summary
echo ""
echo "🎉 TapTunes deployment completed!"
echo "================================"
echo ""
echo "Services installed and configured:"
echo "  • Backend API (port 3001)"
echo "  • Frontend web interface (port 80)"
echo "  • RFID service"
echo "  • Nginx reverse proxy"
echo ""
echo "Access your TapTunes interface at:"
if [ -n "$PI_IP" ]; then
    echo "  http://$PI_IP"
else
    echo "  http://$(hostname).local"
fi
echo ""
echo "Useful commands:"
echo "  • Check service status: sudo systemctl status taptunes-*"
echo "  • View logs: sudo journalctl -u taptunes-backend -f"
echo "  • Restart services: sudo systemctl restart taptunes-*"
echo "  • Check system resources: htop"
echo ""
echo "Next steps:"
echo "  1. Upload audio files to: $(pwd)/audio/"
echo "  2. Configure RFID cards in the web interface"
echo "  3. Set up automatic backups"
echo "  4. Monitor system performance"
echo ""
print_status "Deployment script completed successfully!"
