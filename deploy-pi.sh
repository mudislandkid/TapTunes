#!/bin/bash

# TapTunes Deployment Script for Raspberry Pi Zero W
# Run this script on your Pi after cloning the repository

set -e  # Exit on any error

echo "🎵 TapTunes Pi Zero W Deployment Script"
echo "======================================"

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
   print_error "This script should not be run as root. Please run as pi user."
   exit 1
fi

# Check if we're in the TapTunes directory
if [ ! -f "docker-compose.yml" ]; then
    print_error "Please run this script from the TapTunes project root directory"
    exit 1
fi

print_status "Starting TapTunes deployment..."

# Step 1: System Update
print_status "Updating system packages..."
sudo apt update && sudo apt upgrade -y
sudo apt autoremove -y

# Step 2: Install Dependencies
print_status "Installing required packages..."

# Essential packages
sudo apt install -y git curl wget build-essential

# Node.js 18.x
if ! command -v node &> /dev/null; then
    print_status "Installing Node.js 18.x..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt install -y nodejs
else
    print_status "Node.js already installed: $(node --version)"
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

# Step 3: Audio Configuration
print_status "Configuring audio..."
sudo usermod -a -G audio pi

# Create ALSA configuration
sudo tee /etc/asound.conf > /dev/null <<EOF
pcm.!default {
    type hw
    card 0
}

ctl.!default {
    type hw
    card 0
}
EOF

# Step 4: Create Directories
print_status "Creating data directories..."
mkdir -p data audio uploads
chmod 755 data audio uploads

# Step 5: Backend Setup
print_status "Setting up backend..."
cd backend

# Install dependencies
print_status "Installing backend dependencies..."
npm ci --only=production

# Build TypeScript
print_status "Building backend..."
npm run build

cd ..

# Step 6: Frontend Setup
print_status "Setting up frontend..."
cd frontend

# Install dependencies
print_status "Installing frontend dependencies..."
npm ci

# Build for production
print_status "Building frontend..."
npm run build

# Copy to nginx directory
print_status "Copying frontend to nginx..."
sudo cp -r dist/* /var/www/html/
sudo chown -R www-data:www-data /var/www/html/

cd ..

# Step 7: RFID Service Setup
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

# Step 8: Backend Environment Configuration
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

# Step 9: Nginx Configuration
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

# Step 10: Systemd Services
print_status "Creating systemd services..."

# Backend service
sudo tee /etc/systemd/system/taptunes-backend.service > /dev/null <<EOF
[Unit]
Description=TapTunes Backend
After=network.target

[Service]
Type=simple
User=pi
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
User=pi
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

# Step 11: Firewall Configuration
print_status "Configuring firewall..."
if command -v ufw &> /dev/null; then
    sudo ufw allow 22/tcp    # SSH
    sudo ufw allow 80/tcp    # HTTP
    sudo ufw allow 3001/tcp  # Backend API
    sudo ufw --force enable
else
    print_warning "ufw not found, skipping firewall configuration"
fi

# Step 12: Start Services
print_status "Starting services..."
sudo systemctl start taptunes-backend
sudo systemctl start taptunes-rfid

# Step 13: Performance Optimization
print_status "Applying Pi Zero W optimizations..."

# Add performance settings to config.txt
if ! grep -q "arm_freq=1000" /boot/config.txt; then
    echo "" | sudo tee -a /boot/config.txt
    echo "# TapTunes Performance Optimizations" | sudo tee -a /boot/config.txt
    echo "arm_freq=1000" | sudo tee -a /boot/config.txt
    echo "over_voltage=2" | sudo tee -a /boot/config.txt
    echo "gpu_mem=16" | sudo tee -a /boot/config.txt
    echo "dtoverlay=vc4-fkms-v3d" | sudo tee -a /boot/config.txt
fi

# Create swap file if it doesn't exist
if [ ! -f /swapfile ]; then
    print_status "Creating swap file..."
    sudo fallocate -l 1G /swapfile
    sudo chmod 600 /swapfile
    sudo mkswap /swapfile
    sudo swapon /swapfile
    
    # Make permanent
    if ! grep -q "/swapfile" /etc/fstab; then
        echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
    fi
fi

# Step 14: Final Configuration
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

# Step 15: Verification
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

# Step 16: Summary
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
