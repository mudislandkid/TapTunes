import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import audioRoutes from './routes/audio';
import rfidRoutes from './routes/rfid';
import mediaRoutes from './routes/media';
import systemRoutes from './routes/system';
import settingsRoutes from './routes/settings';

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/audio', audioRoutes);
app.use('/api/rfid', rfidRoutes);
app.use('/api/media', mediaRoutes);
app.use('/api/system', systemRoutes);
app.use('/api/settings', settingsRoutes);

const HOST = process.env.HOST || '0.0.0.0';

app.listen(PORT, HOST, () => {
  console.log(`🎵 TapTunes Server running on ${HOST}:${PORT}`);
  console.log(`🌐 Frontend: http://localhost:5173`);
  console.log(`🔧 API: http://localhost:${PORT}/api`);
});