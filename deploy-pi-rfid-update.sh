#!/bin/bash

# TapTunes RFID Update Deployment Script
# This script updates an existing TapTunes installation with the new RFID functionality
#
# Prerequisites:
#   1. Build frontend locally: npm run build (in frontend/)
#   2. Copy project files including dist/ to Pi
#
# Usage:
#   ./deploy-pi-rfid-update.sh                  # Update installation
#   ./deploy-pi-rfid-update.sh --full-rebuild   # Rebuild backend fully

set -e  # Exit on any error

echo "🎵 TapTunes RFID Update Deployment Script"
echo "=========================================="

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

print_status "Updating TapTunes with RFID functionality..."
print_status "Current user: $CURRENT_USER"

# Check if we're in the TapTunes directory
if [ ! -f "docker-compose.yml" ]; then
    print_error "Please run this script from the TapTunes project root directory"
    exit 1
fi

# Check for flags
FULL_REBUILD=false
for arg in "$@"; do
    if [[ "$arg" == "--full-rebuild" ]]; then
        FULL_REBUILD=true
    fi
done

if [[ "$FULL_REBUILD" == "true" ]]; then
    print_status "Full rebuild mode enabled (--full-rebuild flag detected)"
fi

# Step 1: Stop existing services
print_status "Stopping TapTunes services..."
sudo systemctl stop taptunes-backend 2>/dev/null || true
sudo systemctl stop taptunes-rfid 2>/dev/null || true

# Step 2: Install RFID Dependencies
print_status "Installing RFID dependencies..."

# Install Python packages for RFID
print_status "Installing Python RFID libraries..."
sudo pip3 install mfrc522 requests --break-system-packages || {
    print_warning "pip3 install failed, trying alternative methods..."
    # Try apt packages first
    sudo apt update -qq
    sudo apt install -y python3-requests python3-rpi.gpio python3-spidev i2c-tools
    # Then try pip again
    sudo pip3 install mfrc522 --break-system-packages || print_warning "mfrc522 installation may have failed"
}

# Install audio players for hardware playback
print_status "Installing audio players for hardware playback..."

# Install mpg123 (faster startup on Pi)
if ! command -v mpg123 &> /dev/null; then
    sudo apt update -qq
    sudo apt install -y mpg123
    print_status "✅ mpg123 installed successfully (fast startup)"
else
    print_status "✅ mpg123 already installed"
fi

# Install mpv as backup (better pause/resume but slower)
if ! command -v mpv &> /dev/null; then
    sudo apt install -y mpv
    print_status "✅ mpv installed successfully (backup player)"
else
    print_status "✅ mpv already installed"
fi

# Verify audio players are available
print_status "Verifying audio players..."
if command -v mpg123 &> /dev/null; then
    print_status "✅ mpg123 available (preferred for fast startup)"
    if command -v mpv &> /dev/null; then
        print_status "✅ mpv available as backup"
    fi
else
    print_error "❌ No suitable audio player found (mpg123 or mpv required)"
fi

# Enable I2C and SPI if not already enabled
print_status "Ensuring I2C and SPI are enabled..."
if ! grep -q "dtparam=i2c=on" /boot/config.txt; then
    print_status "Enabling I2C..."
    echo "dtparam=i2c=on" | sudo tee -a /boot/config.txt
fi

if ! grep -q "dtparam=spi=on" /boot/config.txt; then
    print_status "Enabling SPI..."
    echo "dtparam=spi=on" | sudo tee -a /boot/config.txt
fi

# Add user to required groups
sudo usermod -a -G spi,i2c,gpio $CURRENT_USER || true

# Step 3: Update Backend
print_status "Updating backend..."
cd backend

if [[ "$FULL_REBUILD" == "true" ]]; then
    print_status "Full rebuild: removing node_modules..."
    rm -rf node_modules dist
fi

# Install/update dependencies
npm install --legacy-peer-deps --no-audit --no-fund

# Build backend
print_status "Building backend with RFID updates..."
npm run build

# Step 4: Configure nginx to serve frontend directly from TapTunes directory
print_status "Configuring nginx to serve frontend directly..."
cd ../frontend

if [ -d "dist" ]; then
    print_status "Found pre-built frontend, configuring nginx..."
    
    # Update nginx config to serve from TapTunes directory
    sudo tee /etc/nginx/sites-available/default > /dev/null <<EOF
server {
    listen 80 default_server;
    listen [::]:80 default_server;

    root $(pwd)/dist;
    index index.html index.htm;

    server_name _;
    client_max_body_size 500M;

    # Serve static files
    location / {
        try_files \$uri \$uri/ /index.html;
    }

    # Proxy API requests to backend
    location /api/ {
        proxy_pass http://localhost:3001;
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

    # Test and reload nginx
    sudo nginx -t && sudo systemctl reload nginx
    print_status "✅ Nginx configured to serve directly from $(pwd)/dist"
else
    print_warning "⚠️  No frontend dist/ directory found!"
    print_warning "Please build the frontend locally and copy the dist/ directory to Pi"
    print_warning "Local build command: npm run build"
    print_warning "Then copy: scp -r frontend/dist/* pi@your-pi:/home/greg/TapTunes/frontend/dist/"
fi

cd ..

# Step 5: Update RFID Service
print_status "Updating RFID service..."

# Create/update the RFID service file with correct paths
sudo tee /etc/systemd/system/taptunes-rfid.service > /dev/null <<EOF
[Unit]
Description=TapTunes RFID Scanner
After=network.target taptunes-backend.service

[Service]
Type=simple
User=$CURRENT_USER
WorkingDirectory=$(pwd)/python-services
ExecStart=/usr/bin/python3 $(pwd)/python-services/rfid_service.py
Restart=always
RestartSec=10
Environment=PYTHONUNBUFFERED=1
Environment=BACKEND_URL=http://localhost:3001

# System limits for Pi Zero W
MemoryMax=128M
CPUQuota=30%

[Install]
WantedBy=multi-user.target
EOF

# Step 6: Update Backend Service (ensure hardware mode default)
print_status "Updating backend service..."
sudo tee /etc/systemd/system/taptunes-backend.service > /dev/null <<EOF
[Unit]
Description=TapTunes Backend
After=network.target

[Service]
Type=simple
User=$CURRENT_USER
WorkingDirectory=$(pwd)/backend
ExecStart=/usr/local/bin/node dist/index.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
Environment=PORT=3001
Environment=HOST=0.0.0.0
Environment=AUDIO_DIR=$(pwd)/audio
Environment=DATA_DIR=$(pwd)/data
Environment=UPLOAD_DIR=$(pwd)/uploads

# Resource limits for Pi Zero W
MemoryMax=256M
CPUQuota=50%

[Install]
WantedBy=multi-user.target
EOF

# Step 7: Reload and restart services
print_status "Reloading systemd and starting services..."
sudo systemctl daemon-reload
sudo systemctl enable taptunes-backend
sudo systemctl enable taptunes-rfid

# Start services
sudo systemctl start taptunes-backend
sleep 3  # Give backend time to start
sudo systemctl start taptunes-rfid

# Step 8: Register existing card (if detected)
print_status "Checking for existing RFID cards..."
DETECTED_CARD="285378937817"

# Wait a moment for services to stabilize
sleep 5

# Test if backend is responding
if curl -s http://localhost:3001/api/rfid/cards > /dev/null 2>&1; then
    print_status "✅ Backend API is responding"
    
    # Register the detected card
    print_status "Registering detected RFID card: $DETECTED_CARD"
    curl -X POST "http://localhost:3001/api/rfid/cards" \
      -H "Content-Type: application/json" \
      -d "{
        \"cardId\": \"$DETECTED_CARD\",
        \"name\": \"My First Card\",
        \"description\": \"Automatically registered during deployment\",
        \"assignmentType\": \"action\",
        \"action\": \"play_pause\",
        \"color\": \"#3b82f6\"
      }" > /dev/null 2>&1 && print_status "✅ Card registered successfully" || print_warning "⚠️ Card registration failed"
else
    print_warning "⚠️ Backend API not responding yet"
fi

# Step 9: Update frontend API URL for Pi IP
print_status "Updating frontend API configuration..."
PI_IP=$(hostname -I | awk '{print $1}')

if [ -n "$PI_IP" ]; then
    print_status "Updating frontend to use Pi IP: $PI_IP"
    cd /var/www/html
    sudo find . -name "*.js" -type f -exec sed -i "s|http://localhost:3001|http://$PI_IP:3001|g" {} \;
    cd - > /dev/null
fi

# Step 10: Verification
print_status "Verifying updated installation..."

# Check services
sleep 2
if sudo systemctl is-active --quiet taptunes-backend; then
    print_status "✅ Backend service is running"
else
    print_error "❌ Backend service failed to start"
    print_status "Backend logs:"
    sudo journalctl -u taptunes-backend --no-pager -n 10
fi

if sudo systemctl is-active --quiet taptunes-rfid; then
    print_status "✅ RFID service is running"
else
    print_error "❌ RFID service failed to start"
    print_status "RFID logs:"
    sudo journalctl -u taptunes-rfid --no-pager -n 10
fi

# Check RFID hardware
print_status "Checking RFID hardware..."
if [ -c /dev/spidev0.0 ] && [ -c /dev/i2c-1 ]; then
    print_status "✅ RFID hardware interfaces available"
else
    print_warning "⚠️ RFID hardware interfaces may not be available"
fi

# Test audio configuration
print_status "Checking audio configuration..."
if amixer get Master > /dev/null 2>&1; then
    print_status "✅ Audio mixer available"
else
    print_warning "⚠️ Audio mixer not available"
fi

# Step 11: Summary
echo ""
echo "🎉 TapTunes RFID Update completed!"
echo "=================================="
echo ""
echo "New features added:"
echo "  • RFID card reading and assignment"
echo "  • Hardware mode as default playback"
echo "  • Volume control fixes for WM8960"
echo "  • Card assignment to tracks/playlists/albums/artists"
echo "  • RFID card behavior settings (pause/resume, stop, restart, nothing)"
echo "  • Optimized audio playback with mpg123 for fast startup"
echo "  • Automatic duration detection from audio files"
echo ""
if [ -n "$PI_IP" ]; then
    echo "Access your TapTunes interface at: http://$PI_IP"
else
    echo "Access your TapTunes interface at: http://$(hostname).local"
fi
echo ""
echo "RFID Features:"
echo "  • Scan card ID $DETECTED_CARD to test play/pause"
echo "  • Use 'Cards' tab to assign cards to music"
echo "  • Click 'Read Card' to register new cards"
echo ""
echo "Service commands:"
echo "  • View logs: sudo journalctl -u taptunes-rfid -f"
echo "  • Restart RFID: sudo systemctl restart taptunes-rfid"
echo "  • Check status: sudo systemctl status taptunes-*"
echo ""

if grep -q "dtparam=i2c=on\|dtparam=spi=on" /boot/config.txt; then
    print_warning "⚠️  I2C/SPI was enabled - please reboot for hardware changes to take effect:"
    print_warning "     sudo reboot"
fi

print_status "Update deployment completed successfully!"

# Step 12: Optional - Test RFID immediately
echo ""
read -p "Would you like to test RFID card detection now? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    print_status "Testing RFID card detection..."
    print_status "Place your RFID card near the reader now..."
    
    # Monitor logs for 30 seconds
    timeout 30 sudo journalctl -u taptunes-rfid -f | while read line; do
        if [[ "$line" == *"Card detected"* ]]; then
            print_status "✅ RFID card detected successfully!"
            break
        fi
    done || print_status "⏱️ Test timeout - check logs with: sudo journalctl -u taptunes-rfid -f"
fi