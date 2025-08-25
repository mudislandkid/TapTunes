#!/usr/bin/env python3

import platform
import os

print("========================================")
print("Platform Detection Debug")
print("========================================")
print(f"platform.machine(): {platform.machine()}")
print(f"platform.system(): {platform.system()}")
print(f"platform.platform(): {platform.platform()}")
print(f"platform.processor(): {platform.processor()}")
print(f"platform.architecture(): {platform.architecture()}")
print("")

# Check for Raspberry Pi specific files
pi_indicators = [
    "/proc/device-tree/model",
    "/sys/firmware/devicetree/base/model",
    "/proc/cpuinfo"
]

for indicator in pi_indicators:
    if os.path.exists(indicator):
        print(f"Found Pi indicator: {indicator}")
        try:
            with open(indicator, 'r') as f:
                content = f.read().strip()
                print(f"  Content: {content}")
        except:
            print(f"  Could not read {indicator}")
    else:
        print(f"Missing: {indicator}")

print("")
print("Checking /proc/cpuinfo for 'Raspberry Pi':")
try:
    with open('/proc/cpuinfo', 'r') as f:
        cpuinfo = f.read()
        if 'Raspberry Pi' in cpuinfo:
            print("✅ Found 'Raspberry Pi' in /proc/cpuinfo")
        else:
            print("❌ No 'Raspberry Pi' found in /proc/cpuinfo")
except:
    print("❌ Could not read /proc/cpuinfo")

print("")
print("Current detection logic result:")
machine = platform.machine()
is_pi = machine in ['armv7l', 'aarch64']
print(f"machine = '{machine}'")
print(f"is_raspberry_pi = {is_pi}")

print("========================================")