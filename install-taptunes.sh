#!/bin/bash

# TapTunes Unified Installation Script
# Installs and configures TapTunes on Raspberry Pi
# Includes: Backend, RFID Scanner, GPIO Buttons
#
# Usage:
#   sudo ./install-taptunes.sh                    # Update existing installation
#   sudo ./install-taptunes.sh --clean-install    # Fresh install (recreates venv, reinstalls deps)
#   sudo ./install-taptunes.sh --update-ytdlp     # Update yt-dlp only (for YouTube fixes)

set -e

echo "=========================================="
echo "🎵 TapTunes Installation Script"
echo "=========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Parse command line arguments
CLEAN_INSTALL=false
UPDATE_YTDLP=false
for arg in "$@"; do
    case $arg in
        --clean-install)
            CLEAN_INSTALL=true
            shift
            ;;
        --update-ytdlp)
            UPDATE_YTDLP=true
            shift
            ;;
        --help|-h)
            echo "Usage: sudo ./install-taptunes.sh [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --clean-install    Perform a fresh installation (recreate venv, reinstall all deps)"
            echo "  --update-ytdlp     Update yt-dlp to latest version (for YouTube download fixes)"
            echo "  --help, -h         Show this help message"
            echo ""
            echo "Default behavior (no flags): Update existing installation without recreating venv"
            echo ""
            echo "Note: yt-dlp is only updated during --clean-install or with --update-ytdlp flag."
            echo "      YouTube downloads may break if yt-dlp is outdated. Update regularly!"
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $arg${NC}"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

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

# Check if this is an update or fresh install
EXISTING_INSTALL=false
if [ -d "$INSTALL_DIR" ] && [ -d "$INSTALL_DIR/venv" ]; then
    EXISTING_INSTALL=true
fi

if [ "$CLEAN_INSTALL" = true ]; then
    echo -e "${BLUE}ℹ️  Mode: CLEAN INSTALL (will recreate venv and reinstall all dependencies)${NC}"
elif [ "$EXISTING_INSTALL" = true ]; then
    echo -e "${BLUE}ℹ️  Mode: UPDATE (will preserve venv and only update code)${NC}"
    echo -e "${BLUE}   Use --clean-install flag to force a fresh installation${NC}"
else
    echo -e "${BLUE}ℹ️  Mode: FIRST INSTALL (no existing installation detected)${NC}"
fi
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
if [ "$EXISTING_INSTALL" = true ] && [ "$CLEAN_INSTALL" = false ]; then
    echo "=========================================="
    echo "📦 Step 1: System Dependencies"
    echo "=========================================="
    echo ""
    echo -e "${BLUE}ℹ️  Skipping system dependencies (already installed)${NC}"
    echo ""
else
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
fi

# ============================================
# Step 2: Install Python packages
# ============================================
VENV_DIR="$INSTALL_DIR/venv"

if [ "$EXISTING_INSTALL" = true ] && [ "$CLEAN_INSTALL" = false ]; then
    echo "=========================================="
    echo "🐍 Step 2: Python Virtual Environment"
    echo "=========================================="
    echo ""
    echo -e "${BLUE}ℹ️  Preserving existing virtual environment${NC}"
    echo "   (Use --clean-install to recreate)"
    echo ""

    # Update yt-dlp if requested (YouTube breaks frequently)
    if [ "$UPDATE_YTDLP" = true ]; then
        echo "Updating yt-dlp..."
        "$VENV_DIR/bin/pip" install --upgrade yt-dlp
        echo "  ✓ yt-dlp updated"
        echo ""
    else
        echo -e "${BLUE}ℹ️  Skipping yt-dlp update (use --update-ytdlp to update)${NC}"
        echo ""
    fi
else
    echo "=========================================="
    echo "🐍 Step 2: Creating Python Virtual Environment"
    echo "=========================================="
    echo ""

    # Install python3-venv if not already installed
    apt-get install -y python3-venv python3-full

    # Remove old venv if doing clean install
    if [ "$CLEAN_INSTALL" = true ] && [ -d "$VENV_DIR" ]; then
        echo "Removing old virtual environment..."
        rm -rf "$VENV_DIR"
    fi

    # Create virtual environment
    echo "Creating virtual environment at $VENV_DIR..."
    python3 -m venv "$VENV_DIR"

    # Install packages in virtual environment
    echo "Installing Python packages in virtual environment..."
    "$VENV_DIR/bin/pip" install --upgrade pip

    # Install from requirements.txt if it exists
    if [ -f "$SCRIPT_DIR/python-services/requirements.txt" ]; then
        echo "Installing from requirements.txt..."
        "$VENV_DIR/bin/pip" install -r "$SCRIPT_DIR/python-services/requirements.txt"
    else
        echo "No requirements.txt found, installing default packages..."
        "$VENV_DIR/bin/pip" install RPi.GPIO spidev mfrc522 requests
    fi

    # Ensure yt-dlp is installed (critical for YouTube downloads)
    echo "Installing yt-dlp..."
    "$VENV_DIR/bin/pip" install --upgrade yt-dlp

    echo ""
    echo -e "${GREEN}✅ Python virtual environment created${NC}"
    echo ""
fi

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

# Set ownership of installation directory before npm install
echo ""
echo "Setting directory ownership to $ACTUAL_USER..."
chown -R "$ACTUAL_USER:$ACTUAL_USER" "$INSTALL_DIR"
echo "  ✓ Ownership set"

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
# Step 9: Nginx Configuration (Optional)
# ============================================
echo "=========================================="
echo "🌐 Step 9: Nginx Configuration"
echo "=========================================="
echo ""

if command -v nginx &> /dev/null; then
    echo "Nginx detected on system"
    echo ""

    if [ -f "$SCRIPT_DIR/scripts/taptunes-nginx.conf" ]; then
        read -p "Would you like to install/update the nginx configuration? (y/n) " -n 1 -r
        echo ""

        if [[ $REPLY =~ ^[Yy]$ ]]; then
            echo "Installing nginx configuration..."

            # Backup existing config if it exists
            if [ -f "/etc/nginx/sites-available/taptunes" ]; then
                cp /etc/nginx/sites-available/taptunes /etc/nginx/sites-available/taptunes.backup.$(date +%Y%m%d_%H%M%S)
                echo "  ✓ Backed up existing config"
            fi

            # Copy new config
            cp "$SCRIPT_DIR/scripts/taptunes-nginx.conf" /etc/nginx/sites-available/taptunes
            echo "  ✓ Copied nginx config to /etc/nginx/sites-available/taptunes"

            # Enable site if not already enabled
            if [ ! -f "/etc/nginx/sites-enabled/taptunes" ]; then
                ln -s /etc/nginx/sites-available/taptunes /etc/nginx/sites-enabled/taptunes
                echo "  ✓ Enabled site"
            fi

            # Test nginx config
            if nginx -t 2>/dev/null; then
                echo "  ✓ Nginx configuration is valid"

                # Ask to reload nginx
                read -p "Reload nginx to apply changes? (y/n) " -n 1 -r
                echo ""
                if [[ $REPLY =~ ^[Yy]$ ]]; then
                    systemctl reload nginx
                    echo "  ✓ Nginx reloaded"
                fi
            else
                echo -e "${RED}  ✗ Nginx configuration test failed${NC}"
                echo "  Please check the configuration manually with: sudo nginx -t"
            fi

            echo ""
            echo -e "${GREEN}✅ Nginx configuration updated${NC}"
        else
            echo "  Skipping nginx configuration"
        fi
    else
        echo -e "${YELLOW}⚠️  Nginx config file not found at $SCRIPT_DIR/scripts/taptunes-nginx.conf${NC}"
    fi
else
    echo "Nginx not detected - skipping nginx configuration"
    echo "If you need nginx, install it with: sudo apt-get install nginx"
fi

echo ""

# ============================================
# Installation Complete
# ============================================
echo ""
echo "=========================================="
if [ "$EXISTING_INSTALL" = true ] && [ "$CLEAN_INSTALL" = false ]; then
    echo "✅ Update Complete!"
else
    echo "✅ Installation Complete!"
fi
echo "=========================================="
echo ""
if [ "$EXISTING_INSTALL" = true ] && [ "$CLEAN_INSTALL" = false ]; then
    echo -e "${BLUE}ℹ️  Updated existing installation (preserved venv and dependencies)${NC}"
    echo ""
fi
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
if [ "$EXISTING_INSTALL" = false ] || [ "$CLEAN_INSTALL" = true ]; then
    echo -e "${YELLOW}⚠️  IMPORTANT: Reboot recommended for SPI/hardware changes to take effect${NC}"
    echo ""
fi

# Prompt to start/restart service
if [ "$EXISTING_INSTALL" = true ] && [ "$CLEAN_INSTALL" = false ]; then
    read -p "Would you like to restart TapTunes now? (y/n) " -n 1 -r
else
    read -p "Would you like to start TapTunes now? (y/n) " -n 1 -r
fi

echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    if [ "$EXISTING_INSTALL" = true ] && [ "$CLEAN_INSTALL" = false ]; then
        echo "🔄 Restarting TapTunes..."
        systemctl restart taptunes
    else
        echo "🚀 Starting TapTunes..."
        systemctl start taptunes
    fi
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
    if [ "$EXISTING_INSTALL" = true ] && [ "$CLEAN_INSTALL" = false ]; then
        echo "You can restart TapTunes later with:"
        echo "  sudo systemctl restart taptunes"
    else
        echo "You can start TapTunes later with:"
        echo "  sudo systemctl start taptunes"
    fi
fi

echo ""
echo "🎉 Installation complete!"
echo ""
