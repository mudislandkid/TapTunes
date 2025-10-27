#!/usr/bin/env python3
"""
TapTunes Main Service Launcher
Starts and manages all TapTunes services:
- Node.js Backend
- RFID Scanner Service
- GPIO Button Service
"""

import subprocess
import time
import logging
import signal
import sys
import os
from pathlib import Path

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('TapTunes')

class TapTunesService:
    def __init__(self):
        self.backend_process = None
        self.rfid_process = None
        self.gpio_process = None
        self.running = True

        # Determine installation directory
        self.install_dir = Path.home() / 'taptunes'
        self.backend_dir = self.install_dir / 'backend'
        self.python_services_dir = self.install_dir / 'python-services'
        self.venv_dir = self.install_dir / 'venv'

        # Use venv Python if available, otherwise system Python
        venv_python = self.venv_dir / 'bin' / 'python3'
        self.python_cmd = str(venv_python) if venv_python.exists() else 'python3'
        logger.info(f"Using Python: {self.python_cmd}")

    def start_backend(self):
        """Start the Node.js backend"""
        try:
            logger.info("🚀 Starting TapTunes Backend...")

            backend_script = self.backend_dir / 'dist' / 'index.js'

            if not backend_script.exists():
                logger.error(f"Backend not found at {backend_script}")
                return False

            env = os.environ.copy()
            env['NODE_ENV'] = 'production'
            env['PORT'] = '3001'
            env['HOST'] = '0.0.0.0'

            self.backend_process = subprocess.Popen(
                ['node', str(backend_script)],
                cwd=str(self.backend_dir),
                env=env,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE
            )

            logger.info(f"✅ Backend started (PID: {self.backend_process.pid})")

            # Give backend time to start
            time.sleep(3)

            # Check if it's still running
            if self.backend_process.poll() is not None:
                logger.error("❌ Backend exited immediately")
                return False

            return True

        except Exception as e:
            logger.error(f"❌ Failed to start backend: {e}")
            return False

    def start_rfid(self):
        """Start the RFID scanner service"""
        try:
            logger.info("📡 Starting RFID Scanner...")

            rfid_script = self.python_services_dir / 'rfid_service.py'

            if not rfid_script.exists():
                logger.warning(f"⚠️ RFID service not found at {rfid_script}")
                return False

            self.rfid_process = subprocess.Popen(
                [self.python_cmd, str(rfid_script)],
                cwd=str(self.python_services_dir),
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE
            )

            logger.info(f"✅ RFID Scanner started (PID: {self.rfid_process.pid})")
            return True

        except Exception as e:
            logger.error(f"⚠️ Failed to start RFID scanner: {e}")
            return False

    def start_gpio(self):
        """Start the GPIO button service"""
        try:
            logger.info("🎮 Starting GPIO Button Service...")

            gpio_script = self.python_services_dir / 'gpio_button_service.py'

            if not gpio_script.exists():
                logger.warning(f"⚠️ GPIO service not found at {gpio_script}")
                return False

            # GPIO service needs root for hardware access
            # If running as root, start directly; otherwise warn
            if os.geteuid() == 0:
                self.gpio_process = subprocess.Popen(
                    [self.python_cmd, str(gpio_script)],
                    cwd=str(self.python_services_dir),
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE
                )
                logger.info(f"✅ GPIO Button Service started (PID: {self.gpio_process.pid})")
                return True
            else:
                logger.warning("⚠️ GPIO service requires root access - skipping")
                return False

        except Exception as e:
            logger.error(f"⚠️ Failed to start GPIO service: {e}")
            return False

    def monitor_processes(self):
        """Monitor all processes and restart if needed"""
        while self.running:
            try:
                # Check backend
                if self.backend_process and self.backend_process.poll() is not None:
                    logger.warning("⚠️ Backend process died, restarting...")
                    self.start_backend()

                # Check RFID
                if self.rfid_process and self.rfid_process.poll() is not None:
                    logger.warning("⚠️ RFID process died, restarting...")
                    self.start_rfid()

                # Check GPIO
                if self.gpio_process and self.gpio_process.poll() is not None:
                    logger.warning("⚠️ GPIO process died, restarting...")
                    self.start_gpio()

                time.sleep(5)  # Check every 5 seconds

            except Exception as e:
                logger.error(f"Error in monitor loop: {e}")
                time.sleep(5)

    def stop_all(self):
        """Stop all services"""
        logger.info("\n🛑 Stopping all TapTunes services...")
        self.running = False

        processes = [
            ('GPIO', self.gpio_process),
            ('RFID', self.rfid_process),
            ('Backend', self.backend_process)
        ]

        for name, process in processes:
            if process:
                try:
                    logger.info(f"  Stopping {name}...")
                    process.terminate()
                    process.wait(timeout=5)
                    logger.info(f"  ✅ {name} stopped")
                except subprocess.TimeoutExpired:
                    logger.warning(f"  Force killing {name}...")
                    process.kill()
                    logger.info(f"  ✅ {name} killed")
                except Exception as e:
                    logger.error(f"  Error stopping {name}: {e}")

        logger.info("✅ All services stopped")

    def run(self):
        """Main run method"""
        logger.info("=" * 60)
        logger.info("🎵 TapTunes Service Manager Starting")
        logger.info("=" * 60)
        logger.info(f"Installation directory: {self.install_dir}")
        logger.info("")

        # Start all services
        backend_ok = self.start_backend()
        if not backend_ok:
            logger.error("❌ Backend failed to start - cannot continue")
            sys.exit(1)

        rfid_ok = self.start_rfid()
        gpio_ok = self.start_gpio()

        logger.info("")
        logger.info("=" * 60)
        logger.info("✅ TapTunes Service Manager Running")
        logger.info("=" * 60)
        logger.info(f"  Backend:       {'✅ Running' if backend_ok else '❌ Failed'}")
        logger.info(f"  RFID Scanner:  {'✅ Running' if rfid_ok else '⚠️ Not Running'}")
        logger.info(f"  GPIO Buttons:  {'✅ Running' if gpio_ok else '⚠️ Not Running'}")
        logger.info("=" * 60)
        logger.info("")

        # Monitor processes
        try:
            self.monitor_processes()
        except KeyboardInterrupt:
            logger.info("\nReceived interrupt signal...")
        finally:
            self.stop_all()

def signal_handler(signum, frame):
    """Handle shutdown signals"""
    logger.info(f"\nReceived signal {signum}")
    if hasattr(signal_handler, 'service'):
        signal_handler.service.stop_all()
    sys.exit(0)

def main():
    """Entry point"""
    # Register signal handlers
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)

    # Create and run service
    service = TapTunesService()
    signal_handler.service = service

    try:
        service.run()
    except Exception as e:
        logger.error(f"Fatal error: {e}")
        sys.exit(1)

if __name__ == '__main__':
    main()
