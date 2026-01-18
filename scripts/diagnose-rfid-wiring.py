#!/usr/bin/env python3
import RPi.GPIO as GPIO
import spidev
import time

print("=" * 50)
print("RFID Reader Wiring Diagnostic")
print("=" * 50)
print()

# Test 1: Check SPI bus
print("Test 1: Checking SPI bus...")
try:
    spi = spidev.SpiDev()
    spi.open(0, 0)
    spi.max_speed_hz = 1000000
    print("✓ SPI bus opened successfully")

    # Try to read from MFRC522 version register (address 0x37)
    # This should return 0x91 or 0x92 for genuine MFRC522
    spi.xfer2([0x37 << 1 | 0x80, 0x00])
    response = spi.xfer2([0x37 << 1 | 0x80, 0x00])
    version = response[1]

    print(f"  MFRC522 Version Register: 0x{version:02X}")
    if version in [0x91, 0x92]:
        print("  ✓ Valid MFRC522 detected!")
    elif version == 0x00 or version == 0xFF:
        print("  ✗ No response from MFRC522 (check wiring)")
        print("    - Verify SDA/SS (GPIO 8, Pin 24)")
        print("    - Verify SCK (GPIO 11, Pin 23)")
        print("    - Verify MOSI (GPIO 10, Pin 19)")
        print("    - Verify MISO (GPIO 9, Pin 21)")
    else:
        print(f"  ? Unexpected version: 0x{version:02X}")
        print("    - Could be a clone or wiring issue")

    spi.close()
except Exception as e:
    print(f"✗ SPI Error: {e}")
    print("  - Check SPI is enabled: ls /dev/spidev*")

print()

# Test 2: Check GPIO (RST pin)
print("Test 2: Checking GPIO pins...")
RST_PIN = 25  # GPIO 25 (Pin 22)

try:
    GPIO.setmode(GPIO.BCM)
    GPIO.setwarnings(False)

    # Configure RST pin
    GPIO.setup(RST_PIN, GPIO.OUT)

    # Toggle RST pin
    GPIO.output(RST_PIN, GPIO.LOW)
    time.sleep(0.01)
    GPIO.output(RST_PIN, GPIO.HIGH)
    time.sleep(0.01)

    print(f"✓ GPIO {RST_PIN} (RST) toggled successfully")
    print("  - RST pin appears to be working")

except Exception as e:
    print(f"✗ GPIO Error: {e}")
    print("  - Check RST pin wiring (GPIO 25, Pin 22)")

print()

# Test 3: Power check
print("Test 3: Power supply check...")
print("  - You mentioned power LED is on: ✓ Good!")
print("  - Verify 3.3V connection (Pin 1)")
print("  - Verify GND connection (Pin 6)")
print("  - WARNING: Do NOT connect to 5V - use 3.3V only!")

print()

# Test 4: Complete wiring reference
print("Test 4: Complete Wiring Reference")
print("-" * 50)
print("MFRC522 Pin | RPi Pin | RPi GPIO | Description")
print("-" * 50)
print("SDA (SS)    | Pin 24  | GPIO 8   | Chip Select")
print("SCK         | Pin 23  | GPIO 11  | Clock")
print("MOSI        | Pin 19  | GPIO 10  | Data OUT")
print("MISO        | Pin 21  | GPIO 9   | Data IN")
print("IRQ         | ---     | ---      | NOT CONNECTED")
print("GND         | Pin 6   | GND      | Ground")
print("RST         | Pin 22  | GPIO 25  | Reset")
print("3.3V        | Pin 1   | 3.3V     | Power")
print("-" * 50)

print()

# Test 5: Try basic MFRC522 initialization
print("Test 5: Testing MFRC522 library initialization...")
try:
    from mfrc522 import SimpleMFRC522
    reader = SimpleMFRC522()
    print("✓ SimpleMFRC522 initialized successfully")
    print("  Attempting a quick read test (5 seconds)...")

    start = time.time()
    found = False
    while time.time() - start < 5:
        try:
            id, text = reader.read_no_block()
            if id:
                print(f"  ✓ Card detected! ID: {id}")
                found = True
                break
        except:
            pass
        time.sleep(0.1)

    if not found:
        print("  ✗ No card detected in 5 seconds")
        print()
        print("Troubleshooting steps:")
        print("1. Check all wire connections are secure")
        print("2. Verify no wires are swapped (especially MOSI/MISO)")
        print("3. Try a different RFID card")
        print("4. Measure voltage on 3.3V pin (should be ~3.3V)")
        print("5. Check for loose connections on the reader board")

except ImportError:
    print("✗ mfrc522 library not found")
    print("  Install with: pip install mfrc522")
except Exception as e:
    print(f"✗ Error initializing reader: {e}")

print()
GPIO.cleanup()
print("=" * 50)
print("Diagnostic complete")
print("=" * 50)
