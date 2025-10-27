# TapTunes Installation Guide

Complete installation guide for TapTunes on Raspberry Pi.

## Prerequisites

- Raspberry Pi (any model with GPIO support)
- MicroSD card with Raspberry Pi OS installed
- Internet connection
- (Optional) Waveshare Audio HAT or compatible sound card
- (Optional) MFRC522 RFID reader module
- (Optional) Physical buttons connected to GPIO pins

## Quick Install

### 1. Build the Application (on development machine)

```bash
# Build backend
cd backend
npm install
npm run build

# Build frontend
cd ../frontend
npm install
npm run build
```

### 2. Transfer to Raspberry Pi

```bash
# From your project root
scp -r backend frontend python-services systemd install-taptunes.sh scripts gpio-pin-detector.py pi@your-pi-ip:~/taptunes/
```

### 3. Run Installation Script

```bash
# SSH into your Raspberry Pi
ssh pi@your-pi-ip

# Run the installer
cd ~/taptunes
sudo ./install-taptunes.sh
```

The installer will:
- ✅ Install all system dependencies (Node.js, Python, audio tools)
- ✅ Install Python packages (RPi.GPIO, spidev, mfrc522, requests)
- ✅ Copy application files to `/home/greg/taptunes/`
- ✅ Install backend dependencies
- ✅ Configure GPIO and SPI hardware
- ✅ Install and enable the unified systemd service
- ✅ Create music directory

### 4. Reboot (if needed)

If this is a fresh installation with new hardware:
```bash
sudo reboot
```

## Service Management

TapTunes runs as a single unified service that manages:
- **Node.js Backend** - Main application server (port 3001)
- **RFID Scanner** - Monitors for RFID card taps
- **GPIO Buttons** - Handles physical button controls

### Service Commands

```bash
# Start TapTunes
sudo systemctl start taptunes

# Stop TapTunes
sudo systemctl stop taptunes

# Restart TapTunes
sudo systemctl restart taptunes

# Check status
sudo systemctl status taptunes

# View live logs
sudo journalctl -u taptunes -f

# View last 50 log lines
sudo journalctl -u taptunes -n 50

# Enable auto-start on boot (default)
sudo systemctl enable taptunes

# Disable auto-start
sudo systemctl disable taptunes
```

## Hardware Configuration

### GPIO Buttons

The following GPIO pins (BCM numbering) are configured for button controls:

| Function | GPIO Pin | Physical Pin |
|----------|----------|--------------|
| Volume Up | GPIO 5 | Pin 29 |
| Volume Down | GPIO 6 | Pin 31 |
| Track Next | GPIO 23 | Pin 16 |
| Track Previous | GPIO 22 | Pin 15 |
| Play/Pause | GPIO 27 | Pin 13 |

**Button Wiring:**
- One side of button → GPIO pin
- Other side of button → Ground (GND)

Internal pull-up resistors are enabled in software, so buttons connect GPIO to ground when pressed.

#### Identify Your GPIO Pins

If you're unsure which pins your buttons are connected to:

```bash
cd ~/taptunes
sudo python3 gpio-pin-detector.py
```

Press each button to see which GPIO pin it's connected to. Then update the configuration:

```bash
sudo nano /home/greg/taptunes/python-services/gpio_config.py
```

Edit the `GPIO_PINS` dictionary with your actual pin numbers, then restart:

```bash
sudo systemctl restart taptunes
```

### RFID Reader (MFRC522)

The RFID reader connects via SPI:

| MFRC522 Pin | Raspberry Pi Pin | BCM GPIO |
|-------------|------------------|----------|
| SDA/SS | Pin 24 | GPIO 8 |
| SCK | Pin 23 | GPIO 11 |
| MOSI | Pin 19 | GPIO 10 |
| MISO | Pin 21 | GPIO 9 |
| IRQ | Not connected | - |
| GND | Pin 6 | GND |
| RST | Pin 22 | GPIO 25 |
| 3.3V | Pin 1 | 3.3V |

**Note:** SPI must be enabled in `/boot/config.txt` (the installer does this automatically).

#### Register RFID Cards

To associate RFID cards with playlists:

```bash
cd /home/greg/taptunes/python-services
python3 register-card.py
```

Follow the prompts to scan your card and assign it to a playlist.

## Directory Structure

After installation, TapTunes is installed at:

```
/home/greg/taptunes/
├── backend/               # Node.js backend server
│   ├── dist/             # Compiled TypeScript
│   ├── package.json
│   └── node_modules/
├── frontend/              # React frontend (if deployed)
│   └── dist/
└── python-services/       # Python services
    ├── taptunes_main.py       # Main service launcher
    ├── rfid_service.py        # RFID scanner
    ├── gpio_button_service.py # GPIO button handler
    ├── gpio_config.py         # GPIO configuration
    └── requirements.txt
```

## Configuration

### Backend Configuration

Environment variables are set in `/etc/systemd/system/taptunes.service`:

- `NODE_ENV=production`
- `BACKEND_URL=http://localhost:3001`

### GPIO Configuration

Edit `/home/greg/taptunes/python-services/gpio_config.py`:

```python
# GPIO Pin Mappings
GPIO_PINS = {
    'VOLUME_UP': 5,
    'VOLUME_DOWN': 6,
    'TRACK_NEXT': 23,
    'TRACK_PREVIOUS': 22,
    'PLAY_PAUSE': 27
}

# Volume settings
VOLUME_STEP = 5  # % to change per button press
VOLUME_MIN = 0
VOLUME_MAX = 100

# Debounce time (ms)
DEBOUNCE_TIME = 200

# Backend URL
BACKEND_URL = 'http://localhost:3001'
```

After editing, restart the service:
```bash
sudo systemctl restart taptunes
```

## Troubleshooting

### Service won't start

1. Check the logs:
   ```bash
   sudo journalctl -u taptunes -n 50
   ```

2. Verify backend was built:
   ```bash
   ls -la /home/greg/taptunes/backend/dist/
   ```

3. Check Python dependencies:
   ```bash
   pip3 list | grep -E "RPi.GPIO|spidev|mfrc522|requests"
   ```

### GPIO buttons not working

1. Check if service is running:
   ```bash
   sudo systemctl status taptunes
   ```

2. Test GPIO pins:
   ```bash
   sudo python3 ~/taptunes/gpio-pin-detector.py
   ```

3. Verify backend is responding:
   ```bash
   curl http://localhost:3001/audio/current
   ```

### RFID not working

1. Check if SPI is enabled:
   ```bash
   ls /dev/spidev*
   ```
   Should show `/dev/spidev0.0` and `/dev/spidev0.1`

2. Check logs for RFID errors:
   ```bash
   sudo journalctl -u taptunes -f | grep RFID
   ```

3. Verify wiring connections

### Audio not playing

1. Test audio output:
   ```bash
   speaker-test -t wav -c 2
   ```

2. Check ALSA mixer:
   ```bash
   alsamixer
   ```

3. List audio devices:
   ```bash
   aplay -l
   ```

4. Run audio diagnostics:
   ```bash
   bash ~/taptunes/scripts/check-audio-setup.sh
   ```

### Backend API not responding

1. Check if backend is running:
   ```bash
   ps aux | grep node
   ```

2. Check port 3001:
   ```bash
   sudo netstat -tulpn | grep 3001
   ```

3. Test backend directly:
   ```bash
   curl http://localhost:3001/audio/current
   ```

## Utility Scripts

### Hardware Check
```bash
bash ~/taptunes/scripts/rpi-hardware-check.sh
```
Checks GPIO, SPI, audio, and system resources.

### Audio Setup Check
```bash
bash ~/taptunes/scripts/check-audio-setup.sh
```
Verifies audio device configuration.

### Volume Test
```bash
bash ~/taptunes/scripts/test-volume.sh
```
Tests volume control functionality.

### GPIO Pin Detector
```bash
sudo python3 ~/taptunes/gpio-pin-detector.py
```
Identifies which GPIO pins your buttons are connected to.

### Register RFID Card
```bash
python3 /home/greg/taptunes/python-services/register-card.py
```
Associates RFID cards with playlists.

## Uninstallation

To completely remove TapTunes:

```bash
# Stop and disable service
sudo systemctl stop taptunes
sudo systemctl disable taptunes

# Remove service file
sudo rm /etc/systemd/system/taptunes.service

# Reload systemd
sudo systemctl daemon-reload

# Remove application files
rm -rf ~/taptunes

# Optional: Remove system packages
sudo apt-get remove nodejs python3-spidev
sudo pip3 uninstall RPi.GPIO spidev mfrc522 requests
```

## Accessing TapTunes

After installation, access the web interface at:

```
http://your-pi-ip:3001
```

Or on the Pi itself:
```
http://localhost:3001
```

## Support

For issues or questions:
- Check logs: `sudo journalctl -u taptunes -f`
- Run hardware check: `bash ~/taptunes/scripts/rpi-hardware-check.sh`
- Verify audio setup: `bash ~/taptunes/scripts/check-audio-setup.sh`
- Test GPIO pins: `sudo python3 ~/taptunes/gpio-pin-detector.py`

## Updates

To update TapTunes:

1. Build new version on development machine
2. Transfer files to Pi
3. Run installation script again:
   ```bash
   cd ~/taptunes
   sudo ./install-taptunes.sh
   ```
4. Restart service:
   ```bash
   sudo systemctl restart taptunes
   ```
