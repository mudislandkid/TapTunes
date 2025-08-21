#!/bin/bash

# Troubleshooting script for TapTunes backend connectivity issues

echo "==================================="
echo "TapTunes Backend Troubleshooting"
echo "==================================="
echo ""

# Check if backend service is running
echo "1. Checking backend service status..."
sudo systemctl status taptunes-backend --no-pager
echo ""

# Check if backend is listening on port 3001
echo "2. Checking if backend is listening on port 3001..."
sudo netstat -tlnp | grep 3001 || sudo ss -tlnp | grep 3001
echo ""

# Check recent backend logs
echo "3. Recent backend logs:"
sudo journalctl -u taptunes-backend -n 20 --no-pager
echo ""

# Check firewall status
echo "4. Checking firewall rules..."
if command -v ufw &> /dev/null; then
    sudo ufw status numbered | grep 3001
else
    echo "ufw not installed"
fi

if command -v iptables &> /dev/null; then
    sudo iptables -L -n | grep 3001
fi
echo ""

# Test backend health endpoint
echo "5. Testing backend health endpoint..."
PI_IP=$(hostname -I | awk '{print $1}')
echo "   Testing http://localhost:3001/health"
curl -s http://localhost:3001/health || echo "Failed to connect to localhost"
echo ""
echo "   Testing http://$PI_IP:3001/health"
curl -s http://$PI_IP:3001/health || echo "Failed to connect to $PI_IP"
echo ""

# Check Node.js and npm versions
echo "6. Node.js and npm versions:"
node --version
npm --version
echo ""

# Check if backend dist folder exists
echo "7. Checking backend build..."
if [ -d "backend/dist" ]; then
    echo "✅ Backend dist folder exists"
    ls -la backend/dist/index.js 2>/dev/null || echo "❌ index.js not found"
else
    echo "❌ Backend dist folder not found - need to build backend"
fi
echo ""

# Provide fix suggestions
echo "==================================="
echo "Common fixes:"
echo "==================================="
echo "1. Rebuild and restart backend:"
echo "   cd backend && npm run build"
echo "   sudo systemctl restart taptunes-backend"
echo ""
echo "2. Check backend logs for errors:"
echo "   sudo journalctl -u taptunes-backend -f"
echo ""
echo "3. Manually test backend (stop service first):"
echo "   sudo systemctl stop taptunes-backend"
echo "   cd backend && HOST=0.0.0.0 PORT=3001 node dist/index.js"
echo ""
echo "4. Ensure firewall allows port 3001:"
echo "   sudo ufw allow 3001/tcp"
echo "   sudo ufw reload"
echo ""