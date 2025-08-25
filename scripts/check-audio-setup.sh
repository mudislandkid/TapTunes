#!/bin/bash

echo "======================================"
echo "TapTunes Audio Setup Diagnostic"
echo "======================================"
echo ""

echo "1. Checking for audio devices:"
echo "------------------------------"
if [ -f /proc/asound/cards ]; then
    cat /proc/asound/cards
else
    echo "No /proc/asound/cards file found"
fi
echo ""

echo "2. Checking amixer controls:"
echo "----------------------------"
if command -v amixer &> /dev/null; then
    echo "Available mixer controls:"
    amixer scontrols
    echo ""
    echo "Detailed mixer info:"
    amixer
else
    echo "amixer not found"
fi
echo ""

echo "3. Testing volume commands:"
echo "--------------------------"
test_volume=50

echo "Testing: amixer set Playback ${test_volume}%"
amixer set Playback ${test_volume}% 2>&1 && echo "✓ Success" || echo "✗ Failed"

echo "Testing: amixer -c 0 set PCM ${test_volume}%"
amixer -c 0 set PCM ${test_volume}% 2>&1 && echo "✓ Success" || echo "✗ Failed"

echo "Testing: amixer -c 1 set PCM ${test_volume}%"
amixer -c 1 set PCM ${test_volume}% 2>&1 && echo "✓ Success" || echo "✗ Failed"

echo "Testing: amixer set PCM ${test_volume}%"
amixer set PCM ${test_volume}% 2>&1 && echo "✓ Success" || echo "✗ Failed"

echo "Testing: amixer set Master ${test_volume}%"
amixer set Master ${test_volume}% 2>&1 && echo "✓ Success" || echo "✗ Failed"

echo ""
echo "4. Checking for Waveshare HAT specific settings:"
echo "-----------------------------------------------"
if [ -f /boot/config.txt ]; then
    echo "Audio overlays in /boot/config.txt:"
    grep -E "dtoverlay=.*audio|audio" /boot/config.txt || echo "No audio overlays found"
else
    echo "/boot/config.txt not found"
fi

echo ""
echo "======================================"
echo "Run this script on your Raspberry Pi to identify the correct mixer control."
echo "Look for the command that shows '✓ Success' and update the backend accordingly."
echo "======================================"