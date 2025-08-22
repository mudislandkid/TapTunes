#!/bin/bash

# Install TapTunes services
# This script should be run with sudo

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
USER=${SUDO_USER:-$USER}

echo "Installing TapTunes services..."

# Install backend service
echo "Installing backend service..."
cp "$SCRIPT_DIR/taptunes-backend.service" /etc/systemd/system/
sed -i "s/User=greg/User=$USER/g" /etc/systemd/system/taptunes-backend.service
sed -i "s|/home/greg|/home/$USER|g" /etc/systemd/system/taptunes-backend.service

# Install RFID service
echo "Installing RFID service..."
cp "$SCRIPT_DIR/taptunes-rfid.service" /etc/systemd/system/
sed -i "s/User=greg/User=$USER/g" /etc/systemd/system/taptunes-rfid.service
sed -i "s|/home/greg|/home/$USER|g" /etc/systemd/system/taptunes-rfid.service

# Install nginx configuration
echo "Installing nginx configuration..."
cp "$SCRIPT_DIR/taptunes-nginx.conf" /etc/nginx/sites-available/taptunes
ln -sf /etc/nginx/sites-available/taptunes /etc/nginx/sites-enabled/

# Test nginx configuration
nginx -t

# Reload systemd and nginx
systemctl daemon-reload
systemctl reload nginx

echo "Services installed successfully!"
echo ""
echo "To enable and start services, run:"
echo "  sudo systemctl enable taptunes-backend.service"
echo "  sudo systemctl start taptunes-backend.service"
echo "  sudo systemctl enable taptunes-rfid.service"
echo "  sudo systemctl start taptunes-rfid.service"
echo ""
echo "To check status:"
echo "  sudo systemctl status taptunes-backend.service"
echo "  sudo systemctl status taptunes-rfid.service"