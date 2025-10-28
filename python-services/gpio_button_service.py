#!/usr/bin/env python3
"""
GPIO Button Service for TapTunes
Monitors GPIO buttons and controls audio playback via API
"""

import RPi.GPIO as GPIO
import time
import requests
import logging
import sys
from gpio_config import GPIO_PINS, VOLUME_STEP, VOLUME_MIN, VOLUME_MAX, DEBOUNCE_TIME, BACKEND_URL

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('GPIO-Buttons')

class GPIOButtonService:
    def __init__(self):
        self.current_volume = 75  # Default volume
        self.button_states = {}
        self.last_press_time = {}
        self.setup_gpio()

    def setup_gpio(self):
        """Initialize GPIO pins"""
        logger.info("Initializing GPIO pins...")

        # Disable GPIO warnings
        GPIO.setwarnings(False)

        # Clean up any existing GPIO setup
        GPIO.cleanup()

        # Use BCM numbering
        GPIO.setmode(GPIO.BCM)

        # Setup each pin as input with pull-up resistor
        for button_name, pin_number in GPIO_PINS.items():
            try:
                GPIO.setup(pin_number, GPIO.IN, pull_up_down=GPIO.PUD_UP)
                self.button_states[button_name] = GPIO.HIGH
                self.last_press_time[button_name] = 0
                logger.info(f"  ✓ {button_name}: GPIO {pin_number}")
            except Exception as e:
                logger.error(f"  ✗ Failed to setup {button_name} (GPIO {pin_number}): {e}")

        logger.info("GPIO initialization complete")

    def is_debounced(self, button_name):
        """Check if enough time has passed since last button press"""
        current_time = time.time() * 1000  # Convert to milliseconds
        last_time = self.last_press_time.get(button_name, 0)

        if current_time - last_time >= DEBOUNCE_TIME:
            self.last_press_time[button_name] = current_time
            return True
        return False

    def get_current_volume(self):
        """Get current volume from backend"""
        try:
            response = requests.get(f"{BACKEND_URL}/audio/current", timeout=2)
            if response.status_code == 200:
                data = response.json()
                return data.get('volume', self.current_volume)
        except Exception as e:
            logger.warning(f"Failed to get current volume: {e}")
        return self.current_volume

    def api_call(self, endpoint, method='POST', data=None):
        """Make API call to backend"""
        try:
            url = f"{BACKEND_URL}{endpoint}"

            if method == 'POST':
                response = requests.post(url, json=data or {}, timeout=2)
            else:
                response = requests.get(url, timeout=2)

            if response.status_code in [200, 201]:
                logger.info(f"  ✓ API call successful: {endpoint}")
                return response.json()
            else:
                logger.warning(f"  ✗ API call failed: {endpoint} - Status {response.status_code}")
                return None

        except requests.exceptions.Timeout:
            logger.error(f"  ✗ API call timeout: {endpoint}")
        except requests.exceptions.ConnectionError:
            logger.error(f"  ✗ API connection error: {endpoint} - Is the backend running?")
        except Exception as e:
            logger.error(f"  ✗ API call error: {endpoint} - {e}")
        return None

    def handle_volume_up(self):
        """Increase volume"""
        logger.info("🔊 Volume Up pressed")
        self.current_volume = self.get_current_volume()
        new_volume = min(self.current_volume + VOLUME_STEP, VOLUME_MAX)

        if new_volume != self.current_volume:
            result = self.api_call('/audio/volume', data={'volume': new_volume})
            if result:
                self.current_volume = new_volume
                logger.info(f"  Volume: {self.current_volume}%")

    def handle_volume_down(self):
        """Decrease volume"""
        logger.info("🔉 Volume Down pressed")
        self.current_volume = self.get_current_volume()
        new_volume = max(self.current_volume - VOLUME_STEP, VOLUME_MIN)

        if new_volume != self.current_volume:
            result = self.api_call('/audio/volume', data={'volume': new_volume})
            if result:
                self.current_volume = new_volume
                logger.info(f"  Volume: {self.current_volume}%")

    def handle_track_next(self):
        """Skip to next track"""
        logger.info("⏭️ Next Track pressed")
        self.api_call('/audio/next')

    def handle_track_previous(self):
        """Go to previous track"""
        logger.info("⏮️ Previous Track pressed")
        self.api_call('/audio/previous')

    def handle_play_pause(self):
        """Toggle play/pause"""
        logger.info("⏯️ Play/Pause pressed")

        # Get current playing state
        try:
            response = requests.get(f"{BACKEND_URL}/audio/current", timeout=2)
            if response.status_code == 200:
                data = response.json()
                is_playing = data.get('isPlaying', False)

                # Toggle: if playing, pause; if paused, play
                if is_playing:
                    logger.info("  Pausing playback")
                    self.api_call('/audio/pause')
                else:
                    logger.info("  Resuming playback")
                    self.api_call('/audio/play')
        except Exception as e:
            logger.error(f"Failed to toggle play/pause: {e}")

    def check_buttons(self):
        """Check all button states"""
        for button_name, pin_number in GPIO_PINS.items():
            try:
                current_state = GPIO.input(pin_number)
                previous_state = self.button_states.get(button_name, GPIO.HIGH)

                # Button pressed (state changed from HIGH to LOW)
                if current_state == GPIO.LOW and previous_state == GPIO.HIGH:
                    if self.is_debounced(button_name):
                        # Handle button press
                        if button_name == 'VOLUME_UP':
                            self.handle_volume_up()
                        elif button_name == 'VOLUME_DOWN':
                            self.handle_volume_down()
                        elif button_name == 'TRACK_NEXT':
                            self.handle_track_next()
                        elif button_name == 'TRACK_PREVIOUS':
                            self.handle_track_previous()
                        elif button_name == 'PLAY_PAUSE':
                            self.handle_play_pause()

                # Update button state
                self.button_states[button_name] = current_state

            except Exception as e:
                logger.error(f"Error checking button {button_name}: {e}")

    def run(self):
        """Main loop"""
        logger.info("=" * 60)
        logger.info("TapTunes GPIO Button Service Started")
        logger.info("=" * 60)
        logger.info(f"Backend URL: {BACKEND_URL}")
        logger.info(f"Volume Step: {VOLUME_STEP}%")
        logger.info("Monitoring buttons...")
        logger.info("Press Ctrl+C to exit")
        logger.info("")

        try:
            while True:
                self.check_buttons()
                time.sleep(0.05)  # 50ms polling interval (20Hz - plenty for buttons)

        except KeyboardInterrupt:
            logger.info("\nShutting down GPIO Button Service...")
        finally:
            GPIO.cleanup()
            logger.info("GPIO cleanup complete")

def main():
    """Entry point"""
    try:
        service = GPIOButtonService()
        service.run()
    except Exception as e:
        logger.error(f"Fatal error: {e}")
        sys.exit(1)

if __name__ == '__main__':
    main()
