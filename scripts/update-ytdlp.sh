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

# Determine TapTunes installation directory
INSTALL_DIR="${TAPTUNES_INSTALL_DIR:-/home/greg/taptunes}"
VENV_DIR="$INSTALL_DIR/venv"
VENV_YTDLP="$VENV_DIR/bin/yt-dlp"
VENV_PIP="$VENV_DIR/bin/pip"

# Check if running as root
if [ "$EUID" -eq 0 ]; then
    SUDO=""
else
    SUDO="sudo"
fi

# Get current version from venv
if [ -f "$VENV_YTDLP" ]; then
    CURRENT_VERSION=$("$VENV_YTDLP" --version 2>/dev/null || echo "unknown")
    echo "Current venv version: $CURRENT_VERSION"
    echo "Location: $VENV_YTDLP"
elif command -v yt-dlp &> /dev/null; then
    CURRENT_VERSION=$(yt-dlp --version 2>/dev/null || echo "unknown")
    echo "Current system version: $CURRENT_VERSION"
else
    echo "yt-dlp not installed"
    CURRENT_VERSION="not installed"
fi

echo ""
echo "Updating yt-dlp..."

# Prefer updating in venv (where TapTunes uses it)
if [ -d "$VENV_DIR" ] && [ -f "$VENV_PIP" ]; then
    echo "Updating in virtual environment: $VENV_DIR"
    $SUDO "$VENV_PIP" install --upgrade yt-dlp
    UPDATED_IN_VENV=true
else
    echo "Virtual environment not found, updating system yt-dlp..."
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
    UPDATED_IN_VENV=false
fi

echo ""

# Get new version
if [ "$UPDATED_IN_VENV" = true ] && [ -f "$VENV_YTDLP" ]; then
    NEW_VERSION=$("$VENV_YTDLP" --version 2>/dev/null || echo "unknown")
else
    NEW_VERSION=$(yt-dlp --version 2>/dev/null || echo "unknown")
fi

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
