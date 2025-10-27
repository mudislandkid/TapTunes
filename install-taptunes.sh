#!/bin/bash

# TapTunes Unified Installation Script
# Installs and configures TapTunes on Raspberry Pi
# Includes: Backend, RFID Scanner, GPIO Buttons

set -e

echo "=========================================="
echo "🎵 TapTunes Installation Script"
echo "=========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if running on Raspberry Pi
echo "🔍 Checking system..."
if ! grep -q "Raspberry Pi" /proc/cpuinfo 2>/dev/null && ! grep -q "Raspberry Pi" /proc/device-tree/model 2>/dev/null; then
    echo -e "${YELLOW}⚠️  Warning: This does not appear to be a Raspberry Pi${NC}"
    echo "   Hardware features (GPIO, RFID) may not work properly"
    echo ""
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}❌ This script must be run as root (use sudo)${NC}"
    exit 1
fi

# Get the actual user (not root)
ACTUAL_USER="${SUDO_USER:-$USER}"
ACTUAL_HOME=$(getent passwd "$ACTUAL_USER" | cut -d: -f6)

echo "👤 Installing for user: $ACTUAL_USER"
echo "🏠 Home directory: $ACTUAL_HOME"
echo ""

# Installation directory
INSTALL_DIR="$ACTUAL_HOME/taptunes"
BACKEND_DIR="$INSTALL_DIR/backend"
FRONTEND_DIR="$INSTALL_DIR/frontend"
PYTHON_DIR="$INSTALL_DIR/python-services"

# Script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

echo "📦 Installation directory: $INSTALL_DIR"
echo ""

# ============================================
# Step 0: Clean up old installations
# ============================================
echo "=========================================="
echo "🧹 Step 0: Cleaning Up Old Installations"
echo "=========================================="
echo ""

# Stop and remove old service files
OLD_SERVICES=(
    "taptunes-backend"
    "taptunes-rfid"
    "taptunes-rfid-fixed"
    "taptunes-gpio"
)

for service in "${OLD_SERVICES[@]}"; do
    if [ -f "/etc/systemd/system/${service}.service" ]; then
        echo "Removing old service: ${service}.service"
        systemctl stop "$service" 2>/dev/null || true
        systemctl disable "$service" 2>/dev/null || true
        rm -f "/etc/systemd/system/${service}.service"
        echo "  ✓ Removed ${service}.service"
    fi
done

# Clean up old installation directories if they exist (but not git repos!)
if [ -d "/home/greg/TapTunes" ] && [ "/home/greg/TapTunes" != "$INSTALL_DIR" ]; then
    # Check if it's a git repository - don't offer to delete source code!
    if [ -d "/home/greg/TapTunes/.git" ]; then
        echo "  ℹ️  Found git repository at /home/greg/TapTunes (keeping as source code)"
    else
        echo "Found old installation at /home/greg/TapTunes"
        read -p "Remove old installation? (y/n) " -n 1 -r
        echo ""
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            rm -rf /home/greg/TapTunes
            echo "  ✓ Removed old installation"
        fi
    fi
fi

systemctl daemon-reload

echo ""
echo -e "${GREEN}✅ Cleanup complete${NC}"
echo ""

# ============================================
# Step 1: Install system dependencies
# ============================================
echo "=========================================="
echo "📦 Step 1: Installing System Dependencies"
echo "=========================================="
echo ""

echo "Updating package list..."
apt-get update -qq

echo "Installing Node.js and npm..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
    apt-get install -y nodejs
fi

echo "Installing Python dependencies..."
apt-get install -y python3 python3-pip python3-dev

echo "Installing audio tools..."
apt-get install -y mpg123 alsa-utils

echo "Installing SPI tools (for RFID)..."
apt-get install -y python3-spidev

echo ""
echo -e "${GREEN}✅ System dependencies installed${NC}"
echo ""

# ============================================
# Step 2: Install Python packages
# ============================================
echo "=========================================="
echo "🐍 Step 2: Installing Python Packages"
echo "=========================================="
echo ""

# Install python3-venv if not already installed
apt-get install -y python3-venv python3-full

# Create virtual environment
VENV_DIR="$INSTALL_DIR/venv"
echo "Creating virtual environment at $VENV_DIR..."
python3 -m venv "$VENV_DIR"

# Install packages in virtual environment
echo "Installing Python packages in virtual environment..."
"$VENV_DIR/bin/pip" install --upgrade pip
"$VENV_DIR/bin/pip" install RPi.GPIO spidev mfrc522 requests

# Set ownership
chown -R "$ACTUAL_USER:$ACTUAL_USER" "$VENV_DIR"

echo ""
echo -e "${GREEN}✅ Python packages installed in virtual environment${NC}"
echo ""

# ============================================
# Step 3: Create installation directories
# ============================================
echo "=========================================="
echo "📁 Step 3: Creating Directories"
echo "=========================================="
echo ""

mkdir -p "$INSTALL_DIR"
mkdir -p "$BACKEND_DIR"
mkdir -p "$FRONTEND_DIR"
mkdir -p "$PYTHON_DIR"

echo -e "${GREEN}✅ Directories created${NC}"
echo ""

# ============================================
# Step 4: Copy application files
# ============================================
echo "=========================================="
echo "📋 Step 4: Copying Application Files"
echo "=========================================="
echo ""

echo "Copying backend..."
if [ -d "$SCRIPT_DIR/backend/dist" ]; then
    cp -r "$SCRIPT_DIR/backend/dist" "$BACKEND_DIR/"
    cp "$SCRIPT_DIR/backend/package.json" "$BACKEND_DIR/"
    echo "  ✓ Backend copied"
else
    echo -e "${RED}  ✗ Backend dist not found - run 'npm run build' in backend directory first${NC}"
    exit 1
fi

echo "Copying frontend..."
if [ -d "$SCRIPT_DIR/frontend/dist" ]; then
    cp -r "$SCRIPT_DIR/frontend/dist" "$FRONTEND_DIR/"
    echo "  ✓ Frontend copied"
else
    echo -e "${YELLOW}  ⚠ Frontend dist not found - skipping${NC}"
fi

echo "Copying Python services..."
cp "$SCRIPT_DIR/python-services/"*.py "$PYTHON_DIR/"
chmod +x "$PYTHON_DIR/taptunes_main.py"
chmod +x "$PYTHON_DIR/gpio_button_service.py"
chmod +x "$PYTHON_DIR/rfid_service.py"
echo "  ✓ Python services copied"

echo ""
echo -e "${GREEN}✅ Application files copied${NC}"
echo ""

# ============================================
# Step 5: Install backend dependencies
# ============================================
echo "=========================================="
echo "📦 Step 5: Installing Backend Dependencies"
echo "=========================================="
echo ""

cd "$BACKEND_DIR"
if [ -f "package.json" ]; then
    echo "Running npm install..."
    sudo -u "$ACTUAL_USER" npm install --production
    echo -e "${GREEN}✅ Backend dependencies installed${NC}"
else
    echo -e "${YELLOW}⚠ No package.json found${NC}"
fi
cd "$SCRIPT_DIR"

echo ""

# ============================================
# Step 6: Configure GPIO and SPI
# ============================================
echo "=========================================="
echo "🔧 Step 6: Configuring Hardware"
echo "=========================================="
echo ""

# Enable SPI for RFID
if ! grep -q "^dtparam=spi=on" /boot/config.txt; then
    echo "dtparam=spi=on" >> /boot/config.txt
    echo "  ✓ SPI enabled in /boot/config.txt"
else
    echo "  ✓ SPI already enabled"
fi

# Add user to gpio and spi groups
usermod -a -G gpio,spi "$ACTUAL_USER"
echo "  ✓ User added to gpio and spi groups"

echo ""
echo -e "${GREEN}✅ Hardware configured${NC}"
echo ""

# ============================================
# Step 7: Install systemd service
# ============================================
echo "=========================================="
echo "⚙️  Step 7: Installing Systemd Service"
echo "=========================================="
echo ""

# Copy service file
cp "$SCRIPT_DIR/systemd/taptunes.service" /etc/systemd/system/

# Set ownership
chown -R "$ACTUAL_USER:$ACTUAL_USER" "$INSTALL_DIR"

# Reload systemd
systemctl daemon-reload

# Enable service
systemctl enable taptunes.service

echo -e "${GREEN}✅ Systemd service installed and enabled${NC}"
echo ""

# ============================================
# Step 8: Create music directory
# ============================================
echo "=========================================="
echo "🎵 Step 8: Creating Music Directory"
echo "=========================================="
echo ""

MUSIC_DIR="$ACTUAL_HOME/Music"
mkdir -p "$MUSIC_DIR"
chown "$ACTUAL_USER:$ACTUAL_USER" "$MUSIC_DIR"

echo "  ✓ Music directory: $MUSIC_DIR"
echo ""

# ============================================
# Installation Complete
# ============================================
echo ""
echo "=========================================="
echo "✅ Installation Complete!"
echo "=========================================="
echo ""
echo "📍 Installation Location: $INSTALL_DIR"
echo "🎵 Music Directory: $MUSIC_DIR"
echo ""
echo "Hardware Configuration:"
echo "  • Volume Up:       GPIO 5  (Pin 29)"
echo "  • Volume Down:     GPIO 6  (Pin 31)"
echo "  • Track Next:      GPIO 23 (Pin 16)"
echo "  • Track Previous:  GPIO 22 (Pin 15)"
echo "  • Play/Pause:      GPIO 27 (Pin 13)"
echo ""
echo "Service Commands:"
echo "  • Start:   sudo systemctl start taptunes"
echo "  • Stop:    sudo systemctl stop taptunes"
echo "  • Status:  sudo systemctl status taptunes"
echo "  • Logs:    sudo journalctl -u taptunes -f"
echo ""
echo "Utility Scripts:"
echo "  • Test GPIO pins:      sudo python3 $INSTALL_DIR/../gpio-pin-detector.py"
echo "  • Register RFID card:  python3 $PYTHON_DIR/register-card.py"
echo "  • Hardware check:      bash $INSTALL_DIR/../scripts/rpi-hardware-check.sh"
echo ""
echo -e "${YELLOW}⚠️  IMPORTANT: Reboot required for SPI changes to take effect${NC}"
echo ""
read -p "Would you like to start TapTunes now? (y/n) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    echo "🚀 Starting TapTunes..."
    systemctl start taptunes
    sleep 3
    echo ""
    echo "Service Status:"
    systemctl status taptunes --no-pager | head -15
    echo ""
    echo -e "${GREEN}✅ TapTunes is running!${NC}"
    echo ""
    echo "Access the web interface at: http://$(hostname -I | awk '{print $1}'):3001"
else
    echo ""
    echo "You can start TapTunes later with:"
    echo "  sudo systemctl start taptunes"
fi

echo ""
echo "🎉 Installation complete!"
echo ""
