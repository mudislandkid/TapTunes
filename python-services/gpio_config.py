"""
GPIO Pin Configuration for TapTunes
Maps GPIO pins (BCM numbering) to their functions
"""

# GPIO Pin Mappings (BCM numbering)
GPIO_PINS = {
    'VOLUME_UP': 5,
    'VOLUME_DOWN': 6,
    'TRACK_NEXT': 23,
    'TRACK_PREVIOUS': 22,
    'PLAY_PAUSE': 27
}

# Volume control settings
VOLUME_STEP = 5  # Increase/decrease volume by 5% per button press
VOLUME_MIN = 0
VOLUME_MAX = 100

# Debounce settings (in milliseconds)
DEBOUNCE_TIME = 200  # Ignore button presses within 200ms of each other

# Backend API configuration
BACKEND_URL = 'http://localhost:3001'
