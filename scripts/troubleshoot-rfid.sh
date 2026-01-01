#!/bin/bash

# RFID Card Playback Troubleshooting Script
# This script helps diagnose why RFID cards aren't triggering playback

echo "================================"
echo "TapTunes RFID Troubleshooting"
echo "================================"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check 1: Is the backend service running?
echo "1. Checking if backend service is running..."
if systemctl is-active --quiet taptunes; then
    echo -e "${GREEN}✓ TapTunes service is running${NC}"
else
    echo -e "${RED}✗ TapTunes service is NOT running${NC}"
    echo "  Fix: sudo systemctl start taptunes"
    echo "  View logs: sudo journalctl -u taptunes -f"
fi
echo ""

# Check 2: Is the backend responding on port 3001?
echo "2. Checking if backend API is responding..."
if curl -s http://localhost:3001/api/audio/current > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Backend API is responding on port 3001${NC}"
else
    echo -e "${RED}✗ Backend API is NOT responding${NC}"
    echo "  Fix: Check if backend is running: ps aux | grep node"
    echo "  Check backend logs: sudo journalctl -u taptunes -n 50"
fi
echo ""

# Check 3: Is the RFID service running?
echo "3. Checking if RFID service is running..."
if pgrep -f "rfid_service.py" > /dev/null; then
    echo -e "${GREEN}✓ RFID service is running${NC}"
else
    echo -e "${YELLOW}⚠ RFID service may not be running${NC}"
    echo "  Check: ps aux | grep rfid_service"
fi
echo ""

# Check 4: Test card registration
echo "4. Checking registered cards..."
CARDS=$(curl -s http://localhost:3001/api/rfid/cards | jq -r '.cards | length' 2>/dev/null)
if [ "$CARDS" != "" ] && [ "$CARDS" -gt 0 ]; then
    echo -e "${GREEN}✓ Found $CARDS registered card(s)${NC}"
    echo "  Card details:"
    curl -s http://localhost:3001/api/rfid/cards | jq -r '.cards[] | "  - \(.name) (\(.assignment_type)): \(.card_id)"' 2>/dev/null
else
    echo -e "${YELLOW}⚠ No cards registered or unable to fetch cards${NC}"
fi
echo ""

# Check 5: Check current playback mode
echo "5. Checking playback mode..."
MODE=$(curl -s http://localhost:3001/api/audio/current | jq -r '.playbackMode' 2>/dev/null)
if [ "$MODE" = "hardware" ]; then
    echo -e "${GREEN}✓ Playback mode: hardware${NC}"
elif [ "$MODE" = "browser" ]; then
    echo -e "${YELLOW}⚠ Playback mode: browser (RFID cards won't work in browser mode)${NC}"
    echo "  Fix: Switch to hardware mode in the web interface or:"
    echo "  curl -X POST http://localhost:3001/api/audio/playback-mode -H 'Content-Type: application/json' -d '{\"mode\":\"hardware\"}'"
else
    echo -e "${RED}✗ Unable to determine playback mode${NC}"
fi
echo ""

# Check 6: Check if MPD/audio backend is configured
echo "6. Checking audio backend..."
if systemctl is-active --quiet mpd; then
    echo -e "${GREEN}✓ MPD service is running${NC}"
elif command -v mpv &> /dev/null; then
    echo -e "${GREEN}✓ mpv is installed${NC}"
else
    echo -e "${RED}✗ No audio backend found${NC}"
    echo "  TapTunes needs either MPD or mpv installed"
fi
echo ""

# Check 7: Test a simulated card tap
echo "7. Testing simulated card tap..."
echo "  Attempting to trigger a card tap..."
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST http://localhost:3001/api/rfid/card-detected \
    -H "Content-Type: application/json" \
    -d '{"cardId":"TEST_CARD_123"}' 2>/dev/null)

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)

if [ "$HTTP_CODE" = "404" ]; then
    echo -e "${YELLOW}⚠ Test card not registered (expected)${NC}"
    echo "  Register a real card and try tapping it"
elif [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✓ Backend processed the card tap${NC}"
    echo "  Response: $BODY"
else
    echo -e "${RED}✗ Unexpected response: HTTP $HTTP_CODE${NC}"
    echo "  Response: $BODY"
fi
echo ""

# Check 8: View recent RFID-related logs
echo "8. Recent RFID logs (last 20 lines):"
echo "================================"
sudo journalctl -u taptunes -n 20 --no-pager | grep -i "rfid\|card" || echo "No recent RFID logs found"
echo ""

echo "================================"
echo "Troubleshooting Summary"
echo "================================"
echo ""
echo "Common issues:"
echo "1. ${YELLOW}Playback mode is 'browser'${NC} - RFID only works in 'hardware' mode"
echo "2. ${YELLOW}Backend not running${NC} - Start with: sudo systemctl start taptunes"
echo "3. ${YELLOW}Audio backend not configured${NC} - Install MPD or mpv"
echo "4. ${YELLOW}Cards not registered${NC} - Register cards via web interface"
echo ""
echo "Next steps:"
echo "- Check full logs: ${GREEN}sudo journalctl -u taptunes -f${NC}"
echo "- Test card manually: ${GREEN}curl -X POST http://localhost:3001/api/rfid/scan -H 'Content-Type: application/json' -d '{\"cardId\":\"YOUR_CARD_ID\"}'${NC}"
echo "- View settings: ${GREEN}cat ~/taptunes/data/settings.json${NC}"
echo ""
