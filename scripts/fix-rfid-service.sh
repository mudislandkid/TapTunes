#!/bin/bash

echo "=========================================="
echo "Fixing TapTunes RFID Service"
echo "=========================================="
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo "⚠️  This script needs to run as root."
    echo "Run with: sudo bash fix-rfid-service.sh"
    exit 1
fi

echo "1. Stopping existing service..."
systemctl stop taptunes-rfid
systemctl disable taptunes-rfid

echo ""
echo "2. Checking current service paths..."
echo "------------------------------------"

# Check where TapTunes is actually installed
TAPTUNES_BASE="/home/greg/TapTunes"
PYTHON_SERVICES="$TAPTUNES_BASE/python-services"
RFID_SCRIPT="$PYTHON_SERVICES/rfid_service.py"

echo "Checking paths:"
echo "  TapTunes base: $TAPTUNES_BASE"
if [ -d "$TAPTUNES_BASE" ]; then
    echo "    ✓ Found"
else
    echo "    ✗ Not found"
fi

echo "  Python services: $PYTHON_SERVICES"
if [ -d "$PYTHON_SERVICES" ]; then
    echo "    ✓ Found"
else
    echo "    ✗ Not found"
fi

echo "  RFID script: $RFID_SCRIPT"
if [ -f "$RFID_SCRIPT" ]; then
    echo "    ✓ Found"
else
    echo "    ✗ Not found"
fi

echo ""
echo "3. Creating corrected service file..."
echo "------------------------------------"

cat > /etc/systemd/system/taptunes-rfid.service << EOF
[Unit]
Description=TapTunes RFID Scanner
After=network.target

[Service]
Type=simple
User=greg
WorkingDirectory=$PYTHON_SERVICES
ExecStart=/usr/bin/python3 $RFID_SCRIPT
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

echo "✅ Service file created/updated"

echo ""
echo "4. Reloading systemd and starting service..."
echo "--------------------------------------------"
systemctl daemon-reload
systemctl enable taptunes-rfid
systemctl start taptunes-rfid

echo ""
echo "5. Checking service status..."
echo "----------------------------"
sleep 2
systemctl status taptunes-rfid --no-pager

echo ""
echo "6. Recent logs..."
echo "----------------"
journalctl -u taptunes-rfid --no-pager -n 10

echo ""
echo "=========================================="
echo "Service Fix Complete!"
echo "=========================================="
echo ""
echo "To monitor logs in real-time:"
echo "sudo journalctl -u taptunes-rfid -f"
echo ""
echo "To test RFID scanning:"
echo "1. Make sure the backend is running on port 3001"
echo "2. Scan an RFID card"
echo "3. Check the logs for card detection"
echo "=========================================="