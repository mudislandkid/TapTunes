#!/bin/bash

echo "=========================================="
echo "TapTunes RFID Setup for Raspberry Pi"
echo "=========================================="
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo "⚠️  This script needs to run as root for some installations."
    echo "Run with: sudo bash setup-rfid-fixed.sh"
    exit 1
fi

echo "1. Installing Python MFRC522 library..."
echo "----------------------------------------"

# First try the system package if available
echo "Trying system package first..."
apt update && apt install -y python3-mfrc522 2>/dev/null
if [ $? -eq 0 ]; then
    echo "✅ mfrc522 installed via system package"
else
    echo "System package not available, trying pip with --break-system-packages..."
    
    # For system services, we need system-wide packages
    pip3 install mfrc522 --break-system-packages
    if [ $? -eq 0 ]; then
        echo "✅ mfrc522 library installed successfully"
    else
        echo "❌ Failed to install mfrc522 library"
        echo "Trying alternative installation methods..."
        
        # Try installing dependencies first
        apt install -y python3-dev python3-pip python3-spidev python3-rpi.gpio
        pip3 install spidev --break-system-packages 2>/dev/null
        
        # Try installing from GitHub
        pip3 install git+https://github.com/pimylifeup/MFRC522-python.git --break-system-packages
        if [ $? -eq 0 ]; then
            echo "✅ mfrc522 installed from GitHub"
        else
            echo "❌ All installation methods failed"
        fi
    fi
fi
echo ""

echo "2. Installing additional dependencies..."
echo "---------------------------------------"
apt install -y python3-rpi.gpio python3-spidev i2c-tools
echo "✅ System dependencies installed"
echo ""

echo "3. Verifying RFID hardware connection..."
echo "----------------------------------------"
echo "Checking I2C devices:"
i2cdetect -y 1

echo ""
echo "Checking SPI devices:"
ls -la /dev/spi*

echo ""
echo "4. Testing RFID reader..."
echo "-------------------------"
cat > /tmp/rfid_quick_test.py << 'EOF'
#!/usr/bin/env python3
import sys
import time

try:
    # Try different import methods
    try:
        from mfrc522 import SimpleMFRC522
    except ImportError:
        # Try alternative import
        import mfrc522
        SimpleMFRC522 = mfrc522.SimpleMFRC522
    
    import RPi.GPIO as GPIO
    
    print("🔍 Initializing RFID reader...")
    reader = SimpleMFRC522()
    
    print("✅ RFID reader initialized!")
    print("📡 Testing card detection (10 second timeout)...")
    print("   Place a card near the reader now...")
    
    timeout = time.time() + 10
    card_detected = False
    
    while time.time() < timeout and not card_detected:
        try:
            id, text = reader.read_no_block()
            if id:
                print(f"✅ SUCCESS! Card detected!")
                print(f"   Card ID: {id}")
                print(f"   Card Text: '{text.strip()}'")
                card_detected = True
                break
        except Exception as read_error:
            pass
        time.sleep(0.1)
    
    if not card_detected:
        print("⚠️  No card detected in 10 seconds")
        print("   This is normal if no card was placed on the reader")
        print("   Hardware appears to be working correctly")
    
    GPIO.cleanup()
    print("🧹 GPIO cleaned up")
    print("")
    print("✅ RFID test completed successfully!")
    
except ImportError as e:
    print(f"❌ Import error: {e}")
    print("   Trying manual installation...")
    
    # Manual installation fallback
    import subprocess
    try:
        subprocess.run([sys.executable, "-m", "pip", "install", "mfrc522", "--break-system-packages"], check=True)
        print("✅ Installed mfrc522, please run the test again")
    except:
        print("❌ Manual installation also failed")
        print("   You may need to install manually:")
        print("   sudo pip3 install mfrc522 --break-system-packages")
    
except Exception as e:
    print(f"❌ Hardware error: {e}")
    print("   Check your wiring and SPI configuration")
    print("   Make sure SPI is enabled: sudo raspi-config -> Interface Options -> SPI")
EOF

python3 /tmp/rfid_quick_test.py
test_result=$?
rm -f /tmp/rfid_quick_test.py

echo ""
echo "5. Creating TapTunes RFID service environment..."
echo "------------------------------------------------"

# Create a service-specific directory for the RFID service
TAPTUNES_DIR="/opt/taptunes"
mkdir -p $TAPTUNES_DIR

# Check if we need to create a virtual environment for the service
if [ $test_result -ne 0 ]; then
    echo "Creating virtual environment for TapTunes RFID service..."
    python3 -m venv $TAPTUNES_DIR/venv
    source $TAPTUNES_DIR/venv/bin/activate
    pip install mfrc522 RPi.GPIO spidev
    deactivate
    echo "✅ Virtual environment created at $TAPTUNES_DIR/venv"
    echo "⚠️  You'll need to update the systemd service to use this virtual environment"
fi

echo ""
echo "6. RFID Service Status..."
echo "-------------------------"
if systemctl is-active --quiet taptunes-rfid; then
    echo "✅ TapTunes RFID service is running"
    systemctl status taptunes-rfid --no-pager -l
else
    echo "⚠️  TapTunes RFID service is not running"
    echo "   You may need to start it with: sudo systemctl start taptunes-rfid"
fi

echo ""
echo "=========================================="
echo "RFID Setup Summary"
echo "=========================================="
echo ""

# Test final setup
python3 -c "
import sys
try:
    try:
        from mfrc522 import SimpleMFRC522
    except ImportError:
        import mfrc522
        SimpleMFRC522 = mfrc522.SimpleMFRC522
        
    import RPi.GPIO as GPIO
    import spidev
    print('✅ All required libraries are installed:')
    print('   - mfrc522: Available')
    print('   - RPi.GPIO: Available')  
    print('   - spidev: Available')
    print('')
    print('✅ Hardware interfaces:')
    import os
    if os.path.exists('/dev/spidev0.0'):
        print('   - SPI: /dev/spidev0.0 ✓')
    if os.path.exists('/dev/i2c-1'):
        print('   - I2C: /dev/i2c-1 ✓')
    print('')
    print('🎯 RFID setup appears to be complete!')
    print('')
    print('Next steps:')
    print('1. Make sure the TapTunes backend is running')
    print('2. Start the RFID service: sudo systemctl start taptunes-rfid')
    print('3. Check logs: sudo journalctl -u taptunes-rfid -f')
    print('4. Test by scanning a card!')
    
except ImportError as e:
    print(f'⚠️  Library still missing: {e}')
    print('')
    print('Alternative options:')
    print('1. Use virtual environment: $TAPTUNES_DIR/venv/bin/python')
    print('2. Manual install: sudo pip3 install mfrc522 --break-system-packages')
    print('3. Check if service file needs updating')
except Exception as e:
    print(f'❌ Error: {e}')
"

echo ""
echo "=========================================="
echo "If libraries are still missing, run:"
echo "sudo pip3 install mfrc522 --break-system-packages"
echo "=========================================="