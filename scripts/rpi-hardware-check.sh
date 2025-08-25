#!/bin/bash

echo "=========================================="
echo "TapTunes Raspberry Pi Hardware Diagnostic"
echo "=========================================="
echo ""
echo "Date: $(date)"
echo "Hostname: $(hostname)"
echo "Kernel: $(uname -r)"
echo ""

echo "==========================================  "
echo "AUDIO HARDWARE CHECK"
echo "=========================================="
echo ""

echo "1. Sound Cards:"
echo "---------------"
if [ -f /proc/asound/cards ]; then
    cat /proc/asound/cards
else
    echo "✗ No /proc/asound/cards file found"
fi
echo ""

echo "2. ALSA Devices:"
echo "----------------"
aplay -l 2>/dev/null || echo "✗ aplay command not found"
echo ""

echo "3. Mixer Controls:"
echo "------------------"
if command -v amixer &> /dev/null; then
    echo "Simple controls:"
    amixer scontrols
    echo ""
    echo "Full mixer state:"
    amixer contents
else
    echo "✗ amixer not found"
fi
echo ""

echo "4. Current Volume Settings:"
echo "---------------------------"
amixer get PCM 2>/dev/null || echo "No PCM control"
amixer get Playback 2>/dev/null || echo "No Playback control"
amixer get Master 2>/dev/null || echo "No Master control"
echo ""

echo "5. Testing Volume Commands:"
echo "---------------------------"
test_volume=50

commands=(
    "amixer set Playback ${test_volume}%"
    "amixer -c 0 set PCM ${test_volume}%"
    "amixer -c 1 set PCM ${test_volume}%"
    "amixer sset PCM ${test_volume}%"
    "amixer set PCM ${test_volume}%"
    "amixer set Master ${test_volume}%"
    "amixer -c 0 set Playback ${test_volume}%"
    "amixer -c 1 set Playback ${test_volume}%"
)

for cmd in "${commands[@]}"; do
    echo -n "Testing: $cmd ... "
    if $cmd &>/dev/null; then
        echo "✓ SUCCESS"
        echo "  ^ This command works for volume control!"
    else
        echo "✗ Failed"
    fi
done
echo ""

echo "=========================================="
echo "RFID HARDWARE CHECK"
echo "=========================================="
echo ""

echo "1. I2C Status:"
echo "--------------"
if [ -c /dev/i2c-1 ]; then
    echo "✓ /dev/i2c-1 exists"
else
    echo "✗ /dev/i2c-1 not found - I2C may not be enabled"
fi

if command -v i2cdetect &> /dev/null; then
    echo ""
    echo "I2C devices detected on bus 1:"
    sudo i2cdetect -y 1
else
    echo "✗ i2cdetect not installed (install with: sudo apt-get install i2c-tools)"
fi
echo ""

echo "2. SPI Status:"
echo "--------------"
if [ -c /dev/spidev0.0 ]; then
    echo "✓ /dev/spidev0.0 exists"
else
    echo "✗ /dev/spidev0.0 not found - SPI may not be enabled"
fi

if [ -c /dev/spidev0.1 ]; then
    echo "✓ /dev/spidev0.1 exists"
else
    echo "✗ /dev/spidev0.1 not found"
fi
echo ""

echo "3. GPIO Status:"
echo "---------------"
if command -v gpio &> /dev/null; then
    gpio readall
else
    echo "GPIO utility not found, checking /sys/class/gpio:"
    ls -la /sys/class/gpio/ 2>/dev/null || echo "✗ GPIO sysfs not available"
fi
echo ""

echo "4. Python RFID Libraries:"
echo "-------------------------"
python3 -c "import RPi.GPIO; print('✓ RPi.GPIO version:', RPi.GPIO.VERSION)" 2>/dev/null || echo "✗ RPi.GPIO not installed"
python3 -c "import mfrc522; print('✓ mfrc522 library installed')" 2>/dev/null || echo "✗ mfrc522 not installed"
python3 -c "import spidev; print('✓ spidev library installed')" 2>/dev/null || echo "✗ spidev not installed"
echo ""

echo "5. RFID Reader Test (MFRC522):"
echo "-------------------------------"
echo "Creating test script..."
cat > /tmp/rfid_test.py << 'EOF'
#!/usr/bin/env python3
import time
try:
    from mfrc522 import SimpleMFRC522
    import RPi.GPIO as GPIO
    
    print("Initializing RFID reader...")
    reader = SimpleMFRC522()
    
    print("✓ RFID reader initialized successfully!")
    print("Place an RFID card near the reader (5 second timeout)...")
    
    # Set a timeout
    timeout = time.time() + 5
    
    GPIO.setmode(GPIO.BCM)
    
    while time.time() < timeout:
        id, text = reader.read_no_block()
        if id:
            print(f"✓ Card detected! ID: {id}")
            break
        time.sleep(0.1)
    else:
        print("No card detected in 5 seconds (this is normal if no card was presented)")
    
    GPIO.cleanup()
    print("GPIO cleaned up")
    
except ImportError as e:
    print(f"✗ Import error: {e}")
    print("Install with: sudo pip3 install mfrc522")
except Exception as e:
    print(f"✗ Error: {e}")
    print("Make sure SPI is enabled and wiring is correct")
EOF

if command -v python3 &> /dev/null; then
    sudo python3 /tmp/rfid_test.py
else
    echo "✗ Python3 not found"
fi
rm -f /tmp/rfid_test.py
echo ""

echo "=========================================="
echo "SYSTEM CONFIGURATION"
echo "=========================================="
echo ""

echo "1. Boot Config (audio/i2c/spi settings):"
echo "-----------------------------------------"
if [ -f /boot/config.txt ]; then
    echo "Relevant lines from /boot/config.txt:"
    grep -E "dtoverlay|dtparam=i2c|dtparam=spi|dtparam=audio|audio" /boot/config.txt | grep -v "^#"
elif [ -f /boot/firmware/config.txt ]; then
    echo "Relevant lines from /boot/firmware/config.txt:"
    grep -E "dtoverlay|dtparam=i2c|dtparam=spi|dtparam=audio|audio" /boot/firmware/config.txt | grep -v "^#"
else
    echo "✗ config.txt not found"
fi
echo ""

echo "2. Loaded Kernel Modules:"
echo "-------------------------"
echo "I2C modules:"
lsmod | grep i2c || echo "No I2C modules loaded"
echo ""
echo "SPI modules:"
lsmod | grep spi || echo "No SPI modules loaded"
echo ""
echo "Sound modules:"
lsmod | grep snd || echo "No sound modules loaded"
echo ""

echo "=========================================="
echo "RECOMMENDATIONS"
echo "=========================================="
echo ""
echo "1. If I2C is not working, enable it with:"
echo "   sudo raspi-config -> Interface Options -> I2C -> Enable"
echo ""
echo "2. If SPI is not working (needed for MFRC522), enable it with:"
echo "   sudo raspi-config -> Interface Options -> SPI -> Enable"
echo ""
echo "3. For Waveshare Audio HAT, ensure these lines are in /boot/config.txt:"
echo "   dtoverlay=wm8960-soundcard"
echo "   (or the appropriate overlay for your specific HAT model)"
echo ""
echo "4. Install missing Python libraries:"
echo "   sudo pip3 install mfrc522 RPi.GPIO spidev"
echo ""
echo "5. Install I2C tools:"
echo "   sudo apt-get install i2c-tools"
echo ""
echo "=========================================="
echo "Please run this script with: sudo bash rpi-hardware-check.sh"
echo "and share the output to help configure TapTunes correctly."
echo "==========================================="