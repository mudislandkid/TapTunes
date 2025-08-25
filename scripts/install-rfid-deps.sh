#!/bin/bash

echo "=========================================="
echo "Installing RFID Service Dependencies"
echo "=========================================="
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo "⚠️  This script needs to run as root."
    echo "Run with: sudo bash install-rfid-deps.sh"
    exit 1
fi

echo "1. Installing missing Python packages..."
echo "---------------------------------------"

# Install required packages
packages=("python-dotenv" "requests" "mfrc522")

for package in "${packages[@]}"; do
    echo "Installing $package..."
    pip3 install "$package" --break-system-packages
    if [ $? -eq 0 ]; then
        echo "✅ $package installed"
    else
        echo "❌ Failed to install $package"
    fi
done

echo ""
echo "2. Testing imports..."
echo "--------------------"
python3 -c "
try:
    from dotenv import load_dotenv
    print('✅ dotenv: Available')
except ImportError:
    print('❌ dotenv: Missing')

try:
    import requests
    print('✅ requests: Available')
except ImportError:
    print('❌ requests: Missing')

try:
    from mfrc522 import SimpleMFRC522
    print('✅ mfrc522: Available')
except ImportError:
    print('❌ mfrc522: Missing')

try:
    import RPi.GPIO
    print('✅ RPi.GPIO: Available')
except ImportError:
    print('❌ RPi.GPIO: Missing')
"

echo ""
echo "3. Restarting RFID service..."
echo "----------------------------"
systemctl restart taptunes-rfid
sleep 2

echo ""
echo "4. Checking service status..."
echo "----------------------------"
systemctl status taptunes-rfid --no-pager -l

echo ""
echo "=========================================="
echo "Dependencies installed!"
echo "Monitor with: sudo journalctl -u taptunes-rfid -f"
echo "=========================================="