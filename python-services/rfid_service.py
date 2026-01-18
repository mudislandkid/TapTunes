#!/usr/bin/env python3

import asyncio
import json
import logging
import platform
import time
import requests
from typing import Optional
import os

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Backend API configuration
BACKEND_URL = os.getenv('BACKEND_URL', 'http://localhost:3001')

class RFIDReader:
    def __init__(self):
        self.is_raspberry_pi = self._is_raspberry_pi()
        self.reader = None
        self._setup_reader()
    
    def _is_raspberry_pi(self) -> bool:
        """Check if running on Raspberry Pi"""
        # Check multiple indicators
        machine = platform.machine()
        
        # Check for ARM architecture
        if machine in ['armv6l', 'armv7l', 'aarch64', 'arm64']:
            return True
            
        # Check for Raspberry Pi specific files
        pi_files = ['/proc/device-tree/model', '/sys/firmware/devicetree/base/model']
        for pi_file in pi_files:
            try:
                if os.path.exists(pi_file):
                    with open(pi_file, 'r') as f:
                        content = f.read()
                        if 'Raspberry Pi' in content:
                            return True
            except:
                pass
                
        # Check /proc/cpuinfo for Raspberry Pi
        try:
            with open('/proc/cpuinfo', 'r') as f:
                cpuinfo = f.read()
                if 'Raspberry Pi' in cpuinfo:
                    return True
        except:
            pass
            
        # If we can import RPi.GPIO, we're probably on a Pi
        try:
            import RPi.GPIO
            return True
        except ImportError:
            pass
            
        return False
    
    def _setup_reader(self):
        """Setup RFID reader - only on Raspberry Pi"""
        if self.is_raspberry_pi:
            try:
                from mfrc522 import SimpleMFRC522
                import RPi.GPIO as GPIO
                self.reader = SimpleMFRC522()
                logger.info("RFID reader initialized on Raspberry Pi")
            except ImportError as e:
                logger.error(f"Failed to import RFID libraries: {e}")
                self.reader = None
        else:
            logger.info("Running on non-Raspberry Pi system - RFID reader disabled")
    
    def read_card(self) -> Optional[str]:
        """Read RFID card and return card ID (non-blocking check)"""
        if not self.reader:
            # For testing on non-Pi systems, simulate card reads
            if not self.is_raspberry_pi:
                time.sleep(2)
                return f"test_card_{int(time.time()) % 100}"
            return None

        try:
            # Use read_no_block instead of blocking read() to prevent CPU spin
            # This checks once and returns immediately instead of busy-waiting
            id, text = self.reader.read_no_block()
            if id:
                # Normalize card ID: trim whitespace and convert to uppercase for consistency
                card_id_str = str(id).strip().upper()
                logger.info(f"Card detected: {card_id_str} (raw: {repr(id)}, type: {type(id).__name__})")
                return card_id_str
            return None
        except AttributeError:
            # Fallback: If library doesn't have read_no_block, use timeout
            # Note: This will still block but with error handling
            logger.warning("RFID library doesn't support non-blocking reads, using blocking mode")
            try:
                card_id, text = self.reader.read()
                # Normalize card ID: trim whitespace and convert to uppercase for consistency
                card_id_str = str(card_id).strip().upper()
                logger.info(f"Card detected: {card_id_str} (raw: {repr(card_id)}, type: {type(card_id).__name__})")
                return card_id_str
            except Exception as e:
                logger.error(f"Error reading RFID card: {e}")
                return None
        except Exception as e:
            # Silently ignore errors to prevent log spam (check every 0.5s is normal)
            return None
    
    def cleanup(self):
        """Cleanup GPIO resources"""
        if self.is_raspberry_pi and self.reader:
            try:
                import RPi.GPIO as GPIO
                GPIO.cleanup()
                logger.info("GPIO cleanup completed")
            except Exception as e:
                logger.error(f"Error during GPIO cleanup: {e}")

class BackendClient:
    def __init__(self, base_url: str):
        self.base_url = base_url

    def notify_card_scan(self, card_id: str) -> bool:
        """Notify backend of card scan"""
        try:
            # Use the new card-detected endpoint
            response = requests.post(
                f"{self.base_url}/api/rfid/card-detected",
                json={"cardId": card_id},
                timeout=5
            )

            if response.status_code == 200:
                data = response.json()
                logger.info(f"Card scan processed: {data}")
                return True
            elif response.status_code == 404:
                logger.warning(f"Unknown card scanned: {card_id}")
                return False
            else:
                logger.error(f"Backend error: {response.status_code}")
                return False

        except requests.RequestException as e:
            logger.error(f"Failed to communicate with backend: {e}")
            return False

    def stop_playback(self, card_id: str) -> bool:
        """Stop playback when card is removed and save position"""
        try:
            # First, save the playback position
            try:
                save_response = requests.post(
                    f"{self.base_url}/api/rfid/save-position",
                    json={"cardId": card_id},
                    timeout=5
                )
                if save_response.status_code == 200:
                    logger.info(f"Saved playback position for card {card_id}")
                else:
                    logger.warning(f"Failed to save position: {save_response.status_code}")
            except requests.RequestException as e:
                logger.error(f"Failed to save position: {e}")

            # Then stop playback
            response = requests.post(
                f"{self.base_url}/api/audio/stop",
                timeout=5
            )

            if response.status_code == 200:
                logger.info("Playback stopped (card removed)")
                return True
            else:
                logger.error(f"Failed to stop playback: {response.status_code}")
                return False

        except requests.RequestException as e:
            logger.error(f"Failed to stop playback: {e}")
            return False

async def main():
    """Main service loop"""
    logger.info("Starting RFID service...")

    rfid_reader = RFIDReader()
    backend_client = BackendClient(BACKEND_URL)

    last_card_id = None  # Track the last seen card
    card_absent_count = 0  # Count consecutive absences
    REMOVAL_THRESHOLD = 4  # Card must be absent for 4 consecutive reads (2 seconds) to be considered removed

    try:
        while True:
            card_id = rfid_reader.read_card()

            if card_id:
                # Card detected
                card_absent_count = 0  # Reset absence counter

                if card_id != last_card_id:
                    # New card detected
                    logger.info(f"New card detected: {card_id}")
                    success = backend_client.notify_card_scan(card_id)
                    if success:
                        logger.info(f"Successfully processed card: {card_id}")
                    else:
                        logger.warning(f"Failed to process card: {card_id}")
                    last_card_id = card_id
            else:
                # No card detected this cycle
                if last_card_id:
                    # We had a card before, increment absence counter
                    card_absent_count += 1

                    if card_absent_count >= REMOVAL_THRESHOLD:
                        # Card has been absent for multiple consecutive reads - consider it removed
                        logger.info(f"Card removed: {last_card_id} (absent for {card_absent_count} reads)")
                        backend_client.stop_playback(last_card_id)
                        last_card_id = None
                        card_absent_count = 0

            # Check for cards every 500ms (2Hz) - plenty fast for RFID scanning
            await asyncio.sleep(0.5)
            
    except KeyboardInterrupt:
        logger.info("Shutting down RFID service...")
    except Exception as e:
        logger.error(f"Unexpected error: {e}")
    finally:
        rfid_reader.cleanup()

if __name__ == "__main__":
    asyncio.run(main())