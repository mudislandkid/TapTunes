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
        machine = platform.machine()
        return machine in ['armv7l', 'aarch64']
    
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
        """Read RFID card and return card ID"""
        if not self.reader:
            # For testing on non-Pi systems, simulate card reads
            if not self.is_raspberry_pi:
                time.sleep(2)
                return f"test_card_{int(time.time()) % 100}"
            return None
        
        try:
            logger.info("Waiting for RFID card...")
            card_id, text = self.reader.read()
            card_id_str = str(card_id)
            logger.info(f"Card detected: {card_id_str}")
            return card_id_str
        except Exception as e:
            logger.error(f"Error reading RFID card: {e}")
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
            response = requests.post(
                f"{self.base_url}/api/rfid/scan",
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

async def main():
    """Main service loop"""
    logger.info("Starting RFID service...")
    
    rfid_reader = RFIDReader()
    backend_client = BackendClient(BACKEND_URL)
    
    try:
        while True:
            card_id = rfid_reader.read_card()
            
            if card_id:
                success = backend_client.notify_card_scan(card_id)
                if success:
                    logger.info(f"Successfully processed card: {card_id}")
                else:
                    logger.warning(f"Failed to process card: {card_id}")
                
                # Prevent rapid repeated reads
                await asyncio.sleep(1)
            
            await asyncio.sleep(0.1)
            
    except KeyboardInterrupt:
        logger.info("Shutting down RFID service...")
    except Exception as e:
        logger.error(f"Unexpected error: {e}")
    finally:
        rfid_reader.cleanup()

if __name__ == "__main__":
    asyncio.run(main())