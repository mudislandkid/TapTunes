#!/usr/bin/env python3
import RPi.GPIO as GPIO
from mfrc522 import SimpleMFRC522
import time

print("Initializing RFID reader...")
reader = SimpleMFRC522()

print("Ready! Place your RFID card on the reader...")
print("Waiting for 30 seconds...")

timeout = time.time() + 30
while time.time() < timeout:
    try:
        id, text = reader.read_no_block()
        if id:
            print(f"\n✓ SUCCESS! Card detected!")
            print(f"  Card ID: {id}")
            print(f"  Card Data: {text}")
            break
    except Exception as e:
        print(f"Error reading card: {e}")
        break
    time.sleep(0.1)
else:
    print("\nNo card detected in 30 seconds")

GPIO.cleanup()
print("Test complete")
