#!/bin/bash

echo "=========================================="
echo "TapTunes RFID Setup for Raspberry Pi"
echo "=========================================="
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo "⚠️  This script needs to run as root for some installations."
    echo "Run with: sudo bash setup-rfid.sh"
    exit 1
fi

echo "1. Installing Python MFRC522 library..."
echo "----------------------------------------"
pip3 install mfrc522
if [ $? -eq 0 ]; then
    echo "✅ mfrc522 library installed successfully"
else
    echo "❌ Failed to install mfrc522 library"
fi
echo ""

echo "2. Verifying RFID hardware connection..."
echo "----------------------------------------"
echo "Checking I2C devices:"
i2cdetect -y 1

echo ""
echo "Checking SPI devices:"
ls -la /dev/spi*

echo ""
echo "3. Testing RFID reader..."
echo "-------------------------"
cat > /tmp/rfid_quick_test.py << 'EOF'
#!/usr/bin/env python3
import sys
import time

try:
    from mfrc522 import SimpleMFRC522
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
        except:
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
    print("   The mfrc522 library may not be installed correctly")
    sys.exit(1)
except Exception as e:
    print(f"❌ Hardware error: {e}")
    print("   Check your wiring and SPI configuration")
    sys.exit(1)
EOF

python3 /tmp/rfid_quick_test.py
rm -f /tmp/rfid_quick_test.py

echo ""
echo "4. RFID Service Status..."
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
    from mfrc522 import SimpleMFRC522
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
    print(f'❌ Missing library: {e}')
    print('Run: sudo pip3 install mfrc522')
    sys.exit(1)
except Exception as e:
    print(f'❌ Error: {e}')
    sys.exit(1)
"

echo "=========================================="