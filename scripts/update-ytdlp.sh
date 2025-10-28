#!/bin/bash
#
# Update yt-dlp to the latest version
# YouTube frequently changes their API, so keeping yt-dlp updated is important
#

set -e

echo "=========================================="
echo "🔄 Updating yt-dlp"
echo "=========================================="
echo ""

# Check if running as root
if [ "$EUID" -eq 0 ]; then
    SUDO=""
else
    SUDO="sudo"
fi

# Get current version
if command -v yt-dlp &> /dev/null; then
    CURRENT_VERSION=$(yt-dlp --version 2>/dev/null || echo "unknown")
    echo "Current version: $CURRENT_VERSION"
else
    echo "yt-dlp not installed"
    CURRENT_VERSION="not installed"
fi

echo ""
echo "Updating yt-dlp..."

# Update using the official method
if command -v yt-dlp &> /dev/null; then
    # If installed via pip, use pip to update
    if pip3 show yt-dlp &> /dev/null; then
        echo "Updating via pip3..."
        $SUDO pip3 install --upgrade yt-dlp
    else
        # Otherwise use yt-dlp's self-update
        echo "Updating via self-update..."
        $SUDO yt-dlp -U
    fi
else
    # Install if not present
    echo "Installing yt-dlp..."
    $SUDO pip3 install yt-dlp
fi

echo ""

# Get new version
NEW_VERSION=$(yt-dlp --version 2>/dev/null || echo "unknown")
echo "✅ Update complete!"
echo "New version: $NEW_VERSION"

if [ "$CURRENT_VERSION" != "$NEW_VERSION" ] && [ "$CURRENT_VERSION" != "not installed" ]; then
    echo ""
    echo "📝 yt-dlp was updated from $CURRENT_VERSION to $NEW_VERSION"
    echo ""
    echo "If TapTunes service is running, restart it to use the new version:"
    echo "  sudo systemctl restart taptunes"
else
    echo ""
    echo "yt-dlp is already up to date"
fi

echo ""
