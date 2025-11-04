import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import audioRoutes from './routes/audio';
import rfidRoutes from './routes/rfid';
import mediaRoutes from './routes/media';
import systemRoutes from './routes/system';
import settingsRoutes from './routes/settings';
import sleepTimerRoutes from './routes/sleepTimer';
import audiobooksRoutes from './routes/audiobooks';

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);

app.use(cors());
app.use(express.json({ limit: '500mb' }));
app.use(express.urlencoded({ limit: '500mb', extended: true }));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve uploaded files (album art, audio files) at /api/uploads to work with nginx proxy
app.use('/api/uploads', express.static(path.join(process.cwd(), 'uploads')));

app.use('/api/audio', audioRoutes);
app.use('/api/rfid', rfidRoutes);
app.use('/api/media', mediaRoutes);
app.use('/api/system', systemRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/sleep-timer', sleepTimerRoutes);
app.use('/api/audiobooks', audiobooksRoutes);

const HOST = process.env.HOST || '0.0.0.0';

app.listen(PORT, HOST, () => {
  console.log(`🎵 TapTunes Server running on ${HOST}:${PORT}`);
  console.log(`🌐 Frontend: http://localhost:5173`);
  console.log(`🔧 API: http://localhost:${PORT}/api`);
});