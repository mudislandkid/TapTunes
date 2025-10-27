# GPIO Button Integration for TapTunes

This document describes the GPIO button setup for TapTunes on Raspberry Pi.

## Button Mapping

The following GPIO pins (BCM numbering) are mapped to control functions:

| Function | GPIO Pin | Physical Pin |
|----------|----------|--------------|
| Volume Up | GPIO 5 | Pin 29 |
| Volume Down | GPIO 6 | Pin 31 |
| Track Next | GPIO 23 | Pin 16 |
| Track Previous | GPIO 22 | Pin 15 |
| Play/Pause | GPIO 27 | Pin 13 |

## Hardware Setup

Each button should be wired as follows:
- One side of the button → GPIO pin
- Other side of the button → Ground (GND)

The GPIO pins are configured with internal pull-up resistors, so when a button is pressed, it connects the GPIO pin to ground.

## Software Installation

### Prerequisites
- Raspberry Pi with TapTunes installed
- Python 3 installed
- Root/sudo access

### Installation Steps

1. **Transfer files to Raspberry Pi** (if needed):
   ```bash
   scp -r python-services scripts systemd pi@your-pi-ip:~/taptunes/
   ```

2. **Run the installation script**:
   ```bash
   ssh pi@your-pi-ip
   cd ~/taptunes/scripts
   sudo chmod +x install-gpio-buttons.sh
   sudo ./install-gpio-buttons.sh
   ```

3. The installer will:
   - Install required Python packages (RPi.GPIO, requests)
   - Copy service files to `/home/greg/taptunes/`
   - Install systemd service
   - Enable auto-start on boot
   - Optionally start the service

## Service Management

### Start/Stop/Restart
```bash
# Start the service
sudo systemctl start taptunes-gpio

# Stop the service
sudo systemctl stop taptunes-gpio

# Restart the service
sudo systemctl restart taptunes-gpio

# Check service status
sudo systemctl status taptunes-gpio
```

### View Logs
```bash
# View all logs
sudo journalctl -u taptunes-gpio

# Follow live logs
sudo journalctl -u taptunes-gpio -f

# View last 50 lines
sudo journalctl -u taptunes-gpio -n 50
```

### Enable/Disable Auto-start
```bash
# Enable service to start on boot
sudo systemctl enable taptunes-gpio

# Disable auto-start
sudo systemctl disable taptunes-gpio
```

## Configuration

You can modify button behavior by editing the configuration file:

```bash
sudo nano /home/greg/taptunes/python-services/gpio_config.py
```

### Available Settings

- **GPIO_PINS**: Pin mappings (change if your buttons are wired differently)
- **VOLUME_STEP**: Amount to increase/decrease volume per button press (default: 5%)
- **DEBOUNCE_TIME**: Minimum time between button presses in milliseconds (default: 200ms)
- **BACKEND_URL**: TapTunes backend API URL (default: http://localhost:3001)

After changing configuration, restart the service:
```bash
sudo systemctl restart taptunes-gpio
```

## Troubleshooting

### Buttons not responding
1. Check if the service is running:
   ```bash
   sudo systemctl status taptunes-gpio
   ```

2. Check the logs for errors:
   ```bash
   sudo journalctl -u taptunes-gpio -n 50
   ```

3. Verify backend is running:
   ```bash
   curl http://localhost:3001/audio/current
   ```

4. Test GPIO pins manually:
   ```bash
   sudo python3 ~/gpio-pin-detector.py
   ```

### Service won't start
1. Check if Python packages are installed:
   ```bash
   pip3 list | grep -E "RPi.GPIO|requests"
   ```

2. Check file permissions:
   ```bash
   ls -l /home/greg/taptunes/python-services/gpio_button_service.py
   ```

3. View detailed error messages:
   ```bash
   sudo journalctl -u taptunes-gpio -xe
   ```

### Wrong pin mapping
If you pressed a button and a different function triggered, your physical wiring might be different from the expected mapping. You can:

1. Run the detector script again to identify actual pins:
   ```bash
   sudo systemctl stop taptunes-gpio
   sudo python3 ~/gpio-pin-detector.py
   ```

2. Update the configuration with correct pins:
   ```bash
   sudo nano /home/greg/taptunes/python-services/gpio_config.py
   ```

3. Restart the service:
   ```bash
   sudo systemctl restart taptunes-gpio
   ```

## Uninstallation

To remove the GPIO button service:

```bash
# Stop and disable the service
sudo systemctl stop taptunes-gpio
sudo systemctl disable taptunes-gpio

# Remove service file
sudo rm /etc/systemd/system/taptunes-gpio.service

# Reload systemd
sudo systemctl daemon-reload

# Optionally remove service files
sudo rm -rf /home/greg/taptunes/python-services
```

## Development

### Testing without hardware
The service will log connection errors but continue running if the backend is not available. This allows for testing the service startup without a fully functional TapTunes installation.

### Manual testing
You can run the service directly (without systemd) for testing:

```bash
cd /home/greg/taptunes/python-services
sudo python3 gpio_button_service.py
```

Press Ctrl+C to stop.

## Support

For issues or questions:
- Check logs: `sudo journalctl -u taptunes-gpio -f`
- Verify hardware connections
- Ensure TapTunes backend is running on port 3001
