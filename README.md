# Phoniebox Modern

A modern, cross-platform reimplementation of Phoniebox with RFID capabilities.

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

- [ ] Web-based audio player
- [ ] RFID card management
- [ ] Cross-platform compatibility
- [ ] Modern React UI
- [ ] RESTful API
- [ ] Real-time WebSocket communication
- [ ] Docker deployment