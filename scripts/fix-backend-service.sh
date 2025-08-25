#!/bin/bash

echo "=========================================="
echo "Fixing TapTunes Backend Service"
echo "=========================================="

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo "⚠️  This script needs to run as root."
    echo "Run with: sudo bash fix-backend-service.sh"
    exit 1
fi

CURRENT_USER=$(whoami)
if [ "$CURRENT_USER" = "root" ]; then
    # Get the actual user who called sudo
    CURRENT_USER=${SUDO_USER:-$(logname 2>/dev/null || echo "greg")}
fi

echo "Setting up service for user: $CURRENT_USER"

# Find Node.js executable
NODE_PATH=""
if command -v node &> /dev/null; then
    NODE_PATH=$(which node)
    echo "✅ Found Node.js at: $NODE_PATH"
elif command -v nodejs &> /dev/null; then
    NODE_PATH=$(which nodejs)
    echo "✅ Found Node.js at: $NODE_PATH (nodejs)"
else
    echo "❌ Node.js not found! Please install Node.js first."
    exit 1
fi

# Verify Node.js works
if ! $NODE_PATH --version > /dev/null 2>&1; then
    echo "❌ Node.js at $NODE_PATH is not working properly"
    exit 1
fi

echo "Node.js version: $($NODE_PATH --version)"

# Get the correct working directory
WORKING_DIR="/home/$CURRENT_USER/TapTunes/backend"
if [ ! -d "$WORKING_DIR" ]; then
    echo "❌ Backend directory not found at: $WORKING_DIR"
    echo "Please ensure TapTunes is installed correctly"
    exit 1
fi

if [ ! -f "$WORKING_DIR/dist/index.js" ]; then
    echo "❌ Backend build not found at: $WORKING_DIR/dist/index.js"
    echo "Please build the backend first: cd backend && npm run build"
    exit 1
fi

echo "✅ Backend files found at: $WORKING_DIR"

# Stop existing service
echo "Stopping existing backend service..."
systemctl stop taptunes-backend 2>/dev/null || true

# Create corrected service file
echo "Creating corrected service file..."
cat > /etc/systemd/system/taptunes-backend.service << EOF
[Unit]
Description=TapTunes Backend
After=network.target

[Service]
Type=simple
User=$CURRENT_USER
WorkingDirectory=$WORKING_DIR
ExecStart=$NODE_PATH $WORKING_DIR/dist/index.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
Environment=PORT=3001
Environment=HOST=0.0.0.0
Environment=AUDIO_DIR=$WORKING_DIR/../audio
Environment=DATA_DIR=$WORKING_DIR/../data
Environment=UPLOAD_DIR=$WORKING_DIR/../uploads

# Resource limits for Pi Zero W
MemoryMax=256M
CPUQuota=50%

[Install]
WantedBy=multi-user.target
EOF

echo "✅ Service file created with correct paths"

# Reload systemd
echo "Reloading systemd..."
systemctl daemon-reload

# Enable and start service
echo "Enabling and starting backend service..."
systemctl enable taptunes-backend
systemctl start taptunes-backend

# Check status
sleep 3
echo ""
echo "Service status:"
echo "==============="
systemctl status taptunes-backend --no-pager

echo ""
echo "Recent logs:"
echo "============"
journalctl -u taptunes-backend --no-pager -n 10

echo ""
echo "=========================================="
if systemctl is-active --quiet taptunes-backend; then
    echo "✅ Backend service is now running successfully!"
else
    echo "❌ Backend service is still not running properly"
    echo "Check logs with: sudo journalctl -u taptunes-backend -f"
fi
echo "=========================================="