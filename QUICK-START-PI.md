# 🚀 Quick Start: TapTunes on Pi Zero W

## Prerequisites
- Raspberry Pi Zero W with Raspberry Pi OS
- SSH access enabled
- Internet connection

## Option 1: Automated Deployment (Recommended)

1. **SSH into your Pi**
   ```bash
   ssh pi@your-pi-ip
   ```

2. **Clone your TapTunes repository**
   ```bash
   cd /home/pi
   git clone https://github.com/your-username/TapTunes.git
   cd TapTunes
   ```

3. **Run the deployment script**
   ```bash
   ./deploy-pi.sh
   ```

4. **Wait for completion** (takes 10-15 minutes)

5. **Access TapTunes** at `http://your-pi-ip`

## Option 2: Manual Step-by-Step

Follow the detailed guide in `deploy-pi-zero.md`

## What Gets Installed

- ✅ Node.js 18.x (LTS)
- ✅ Python 3 + virtual environment
- ✅ Nginx web server
- ✅ Audio libraries (ALSA, PulseAudio)
- ✅ SQLite database
- ✅ Systemd services (auto-start)
- ✅ Firewall configuration
- ✅ Performance optimizations

## Post-Installation

1. **Upload audio files** to `/home/pi/TapTunes/audio/`
2. **Configure RFID cards** in the web interface
3. **Monitor performance** with `htop`
4. **Check logs** with `sudo journalctl -u taptunes-* -f`

## Troubleshooting

- **Services not starting**: Check logs with `sudo systemctl status taptunes-*`
- **Audio issues**: Verify ALSA config and audio group membership
- **Performance**: Monitor memory usage, consider adding swap file
- **Network**: Check firewall settings and port availability

## Performance Tips for Pi Zero W

- Use Class 10+ SD card
- Monitor memory usage (512MB limit)
- Avoid heavy concurrent operations
- Consider USB audio adapter for better audio quality

## Support

- Check service logs first
- Verify all dependencies installed
- Monitor system resources
- Ensure proper file permissions
