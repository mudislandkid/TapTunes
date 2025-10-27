#!/usr/bin/env python3
"""
GPIO Pin Detector for Raspberry Pi
This script monitors GPIO pins and reports which pin is triggered when you press a button.
Press Ctrl+C to exit.
"""

import RPi.GPIO as GPIO
import time

# Disable warnings
GPIO.setwarnings(False)

# Clean up any existing GPIO setup
GPIO.cleanup()

# Use BCM GPIO numbering
GPIO.setmode(GPIO.BCM)

# Common GPIO pins used for buttons (excluding special pins)
# These are the most commonly used GPIO pins for buttons
PINS_TO_MONITOR = [2, 3, 4, 17, 27, 22, 10, 9, 11, 5, 6, 13, 19, 26, 14, 15, 18, 23, 24, 25, 8, 7, 12, 16, 20, 21]

print("=" * 60)
print("GPIO PIN DETECTOR")
print("=" * 60)
print("\nInitializing GPIO pins...")

# Dictionary to track button states
button_states = {}
successful_pins = []

try:
    # Setup all pins as inputs with pull-up resistors
    for pin in PINS_TO_MONITOR:
        try:
            GPIO.setup(pin, GPIO.IN, pull_up_down=GPIO.PUD_UP)
            button_states[pin] = GPIO.input(pin)
            successful_pins.append(pin)
        except Exception as e:
            print(f"Could not setup GPIO {pin}: {e}")

    if len(successful_pins) == 0:
        print("\nERROR: Could not set up any GPIO pins!")
        print("Try running: sudo chmod 666 /dev/gpiomem")
        print("Or try rebooting the Pi first")
        exit(1)

    print(f"\nSuccessfully monitoring {len(successful_pins)} GPIO pins: {successful_pins}")
    print("\nPress your buttons one at a time to identify them:")
    print("  - Volume Up")
    print("  - Volume Down")
    print("  - Track Next")
    print("  - Track Previous")
    print("  - Play/Pause")
    print("\nPress Ctrl+C to exit\n")

    # Polling loop - check each pin's state
    while True:
        for pin in successful_pins:
            current_state = GPIO.input(pin)
            previous_state = button_states[pin]

            # Detect state change
            if current_state != previous_state:
                if current_state == GPIO.LOW:
                    print(f"\n>>> BUTTON PRESSED on GPIO {pin} (BCM numbering)")
                else:
                    print(f"    Button released on GPIO {pin}")

                button_states[pin] = current_state

        time.sleep(0.01)  # 10ms polling interval

except KeyboardInterrupt:
    print("\n\nExiting...")
    print("\nGPIO Pin Mapping Summary:")
    print("=" * 60)
    print("Create a mapping file with the pins you identified above")
    print("Example format:")
    print("  VOLUME_UP: GPIO 17")
    print("  VOLUME_DOWN: GPIO 27")
    print("  etc.")

finally:
    GPIO.cleanup()
    print("\nGPIO cleanup complete")
