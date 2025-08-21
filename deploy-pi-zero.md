# TapTunes Deployment Guide for Raspberry Pi Zero W

## Prerequisites
- Raspberry Pi Zero W with Raspberry Pi OS (Bullseye or newer)
- SSH access enabled
- At least 8GB SD card (16GB recommended)
- Internet connection

## Step 1: Remove Phoniebox (Optional)
If you want to completely remove Phoniebox:

```bash
# SSH into your Pi
ssh pi@your-pi-ip

# Stop Phoniebox services
sudo systemctl stop phoniebox
sudo systemctl disable phoniebox

# Remove Phoniebox files (adjust paths as needed)
sudo rm -rf /home/pi/Phoniebox
sudo rm -rf /opt/phoniebox

# Remove from systemd if it exists
sudo rm -f /etc/systemd/system/phoniebox.service
sudo systemctl daemon-reload
```

## Step 2: System Preparation

### Update system
```bash
sudo apt update && sudo apt upgrade -y
sudo apt autoremove -y
```

### Install required packages
```bash
# Essential packages
sudo apt install -y git curl wget build-essential

# Node.js 18.x (LTS for Pi Zero W)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Python and pip (for RFID service)
sudo apt install -y python3 python3-pip python3-venv

# Audio dependencies
sudo apt install -y alsa-utils pulseaudio pulseaudio-utils
sudo apt install -y libasound2-dev libpulse-dev

# Database and other dependencies
sudo apt install -y sqlite3 libsqlite3-dev

# Nginx for serving frontend
sudo apt install -y nginx

# Verify installations
node --version
npm --version
python3 --version
```

### Configure audio
```bash
# Add pi user to audio group
sudo usermod -a -G audio pi

# Configure ALSA
sudo nano /etc/asound.conf
```

Add this content to `/etc/asound.conf`:
```
pcm.!default {
    type hw
    card 0
}

ctl.!default {
    type hw
    card 0
}
```

## Step 3: Deploy TapTunes

### Clone project
```bash
cd /home/pi
git clone https://github.com/your-username/TapTunes.git
cd TapTunes
```

### Backend Setup
```bash
cd backend

# Install dependencies
npm ci --only=production

# Build TypeScript
npm run build

# Create data directories
mkdir -p /home/pi/TapTunes/data
mkdir -p /home/pi/TapTunes/audio
mkdir -p /home/pi/TapTunes/uploads

# Set permissions
chmod 755 /home/pi/TapTunes/data
chmod 755 /home/pi/TapTunes/audio
chmod 755 /home/pi/TapTunes/uploads
```

### Frontend Setup
```bash
cd /home/pi/TapTunes/frontend

# Install dependencies
npm ci

# Build for production
npm run build

# Copy built files to nginx directory
sudo cp -r dist/* /var/www/html/
sudo chown -R www-data:www-data /var/www/html/
```

### RFID Service Setup
```bash
cd /home/pi/TapTunes/python-services

# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install requirements
pip install -r requirements.txt

# Deactivate virtual environment
deactivate
```

## Step 4: Configuration

### Backend Environment
```bash
cd /home/pi/TapTunes/backend
nano .env
```

Create `.env` file:
```env
NODE_ENV=production
PORT=3001
HOST=0.0.0.0
AUDIO_DIR=/home/pi/TapTunes/audio
DATA_DIR=/home/pi/TapTunes/data
UPLOAD_DIR=/home/pi/TapTunes/uploads
```

### Frontend Configuration
Update the API URL in the built frontend:
```bash
cd /var/www/html
sudo sed -i 's|http://localhost:3001|http://your-pi-ip:3001|g' *.js
```

### Nginx Configuration
```bash
sudo nano /etc/nginx/sites-available/taptunes
```

Add this configuration:
```nginx
server {
    listen 80;
    server_name _;
    root /var/www/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://localhost:3001/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable the site:
```bash
sudo ln -s /etc/nginx/sites-available/taptunes /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx
```

## Step 5: Systemd Services

### Backend Service
```bash
sudo nano /etc/systemd/system/taptunes-backend.service
```

Add this content:
```ini
[Unit]
Description=TapTunes Backend
After=network.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/TapTunes/backend
ExecStart=/usr/bin/node dist/index.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
Environment=PORT=3001

[Install]
WantedBy=multi-user.target
```

### RFID Service
```bash
sudo nano /etc/systemd/system/taptunes-rfid.service
```

Add this content:
```ini
[Unit]
Description=TapTunes RFID Service
After=network.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/TapTunes/python-services
ExecStart=/home/pi/TapTunes/python-services/venv/bin/python rfid_service.py
Restart=always
RestartSec=10
Environment=PYTHONPATH=/home/pi/TapTunes/python-services

[Install]
WantedBy=multi-user.target
```

### Enable and Start Services
```bash
sudo systemctl daemon-reload
sudo systemctl enable taptunes-backend
sudo systemctl enable taptunes-rfid
sudo systemctl start taptunes-backend
sudo systemctl start taptunes-rfid

# Check status
sudo systemctl status taptunes-backend
sudo systemctl status taptunes-rfid
```

## Step 6: Firewall and Network

### Configure firewall (if using ufw)
```bash
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 3001/tcp  # Backend API
sudo ufw enable
```

### Set static IP (optional but recommended)
```bash
sudo nano /etc/dhcpcd.conf
```

Add at the end:
```
interface wlan0
static ip_address=192.168.1.100/24
static routers=192.168.1.1
static domain_name_servers=8.8.8.8
```

## Step 7: Testing

### Test backend
```bash
curl http://localhost:3001/health
```

### Test frontend
Open `http://your-pi-ip` in a browser

### Test RFID service
Check logs:
```bash
sudo journalctl -u taptunes-rfid -f
```

## Step 8: Optimization for Pi Zero W

### Memory optimization
```bash
# Add to /boot/config.txt
sudo nano /boot/config.txt
```

Add these lines:
```
# Overclock slightly for better performance
arm_freq=1000
over_voltage=2

# GPU memory split (minimal for headless)
gpu_mem=16

# Enable hardware acceleration
dtoverlay=vc4-fkms-v3d
```

### Swap file (if needed)
```bash
sudo fallocate -l 1G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# Make permanent
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

## Troubleshooting

### Check service logs
```bash
sudo journalctl -u taptunes-backend -f
sudo journalctl -u taptunes-rfid -f
sudo journalctl -u nginx -f
```

### Check system resources
```bash
htop
df -h
free -h
```

### Restart services
```bash
sudo systemctl restart taptunes-backend
sudo systemctl restart taptunes-rfid
sudo systemctl restart nginx
```

## Performance Notes for Pi Zero W

- **Memory**: Limited to 512MB RAM - monitor usage closely
- **CPU**: Single-core ARM11 - avoid heavy concurrent operations
- **Storage**: Use Class 10+ SD card for better I/O performance
- **Network**: WiFi only - consider Ethernet adapter for better performance
- **Audio**: Hardware audio support is limited - may need USB audio adapter

## Next Steps

1. Upload your audio files to `/home/pi/TapTunes/audio/`
2. Configure RFID cards in the web interface
3. Set up automatic backups of your data directory
4. Consider setting up a reverse proxy for external access
5. Monitor system performance and adjust as needed

## Support

If you encounter issues:
1. Check service logs first
2. Verify all dependencies are installed
3. Check file permissions
4. Ensure ports are not blocked by firewall
5. Monitor system resources during operation
