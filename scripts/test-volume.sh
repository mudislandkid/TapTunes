#!/bin/bash

echo "Testing Waveshare Audio HAT volume control..."
echo ""

# Test various volume commands that typically work with Waveshare HATs
commands=(
    "amixer set Playback 75%"
    "amixer -c 0 set PCM 75%"
    "amixer -c 1 set PCM 75%"
    "amixer sset PCM 75%"
    "amixer set PCM 75%"
    "amixer -c 0 set Playback 75%"
    "amixer -c 1 set Playback 75%"
)

echo "Commands to test:"
for i in "${!commands[@]}"; do
    echo "$((i+1)). ${commands[i]}"
done
echo ""

for i in "${!commands[@]}"; do
    cmd="${commands[i]}"
    echo -n "[$((i+1))] Testing: $cmd ... "
    
    if $cmd &>/dev/null; then
        echo "✓ SUCCESS"
        echo "    This command worked! Use this for your Waveshare HAT."
        # Test if we can also query the volume
        control=$(echo "$cmd" | sed -n 's/.*set \([^ ]*\).*/\1/p')
        card_param=""
        if echo "$cmd" | grep -q "\-c [01]"; then
            card_param=$(echo "$cmd" | sed -n 's/.*\(-c [01]\).*/\1/p')
        fi
        
        echo -n "    Checking current volume: "
        if [ -n "$card_param" ]; then
            amixer $card_param get $control 2>/dev/null | grep -o '[0-9]*%' | head -1 || echo "Could not read volume"
        else
            amixer get $control 2>/dev/null | grep -o '[0-9]*%' | head -1 || echo "Could not read volume"
        fi
        echo ""
    else
        echo "✗ Failed"
    fi
done

echo ""
echo "Additional diagnostic commands:"
echo "==============================="
echo ""
echo "Show all sound cards:"
cat /proc/asound/cards 2>/dev/null || echo "No sound cards found"
echo ""

echo "Show mixer controls:"
amixer scontrols 2>/dev/null || echo "amixer not available"
echo ""

echo "Waveshare HAT specific check:"
echo "Check if WM8960 codec is loaded:"
dmesg | grep -i wm8960 | tail -5 || echo "No WM8960 messages in dmesg"