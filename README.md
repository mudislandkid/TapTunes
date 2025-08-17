# TapTunes 🎵

**Tap a card, play your tunes!**

A smart audio player designed for kids to independently choose their favorite music and audiobooks using RFID cards.

## Architecture

- **Frontend**: React + Vite + TypeScript
- **Backend**: Express + TypeScript  
- **RFID Service**: Python with hardware libraries
- **Audio**: Web Audio API + backend streaming
- **Deployment**: Docker containers

## Getting Started

### Development

1. Install dependencies:
   ```bash
   cd frontend && npm install
   cd ../backend && npm install
   cd ../python-services && pip install -r requirements.txt
   ```

2. Start development servers:
   ```bash
   # Terminal 1 - Frontend
   cd frontend && npm run dev
   
   # Terminal 2 - Backend
   cd backend && npm run dev
   
   # Terminal 3 - RFID Service
   cd python-services && python rfid_service.py
   ```

## Features

- [x] **Real-time Audio Visualization** - See your music come alive with frequency analysis
- [x] **YouTube Downloader** - Convert videos to audio with automatic metadata
- [x] **Metadata Enrichment** - Automatic album art and song info from MusicBrainz
- [x] **Smart Music Library** - Upload, organize, and search your collection
- [x] **Dual Playback Modes** - Browser audio or hardware audio output
- [x] **RFID Card Management** - Tap cards to instantly play favorites
- [x] **Glassmorphism UI** - Beautiful, modern interface designed for kids
- [x] **Cross-platform** - Works on Raspberry Pi, Windows, macOS, Linux
- [x] **Progressive Web App** - Install on any device
- [x] **File Upload** - Drag & drop music files with progress tracking

## Perfect for Kids! 🎯

- **Simple Operation**: Just tap an RFID card to play music
- **Independence**: Kids can choose their own entertainment
- **Safe**: No internet browsing required during playback
- **Visual**: Colorful visualizer makes music interactive
- **Educational**: Learn about music through visual feedback