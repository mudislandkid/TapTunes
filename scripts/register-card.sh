#!/bin/bash

# Quick script to register the detected card ID: 285378937817

CARD_ID="285378937817"
BACKEND_URL="http://localhost:3001"

echo "=========================================="
echo "Registering RFID Card: $CARD_ID"
echo "=========================================="

# Register the card with a basic setup
curl -X POST "$BACKEND_URL/api/rfid/cards" \
  -H "Content-Type: application/json" \
  -d '{
    "cardId": "'$CARD_ID'",
    "name": "Test Card",
    "description": "My first RFID card",
    "assignmentType": "action",
    "action": "play_pause",
    "color": "#3b82f6"
  }'

echo ""
echo ""
echo "Card registered! You can now:"
echo "1. Scan the card to trigger play/pause"
echo "2. Edit it in the web interface to assign it to tracks/playlists"
echo "3. Use the 'Read Card' button in the web interface to properly read cards"