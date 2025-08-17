import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import audioRoutes from './routes/audio';
import rfidRoutes from './routes/rfid';
import mediaRoutes from './routes/media';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/audio', audioRoutes);
app.use('/api/rfid', rfidRoutes);
app.use('/api/media', mediaRoutes);

app.listen(PORT, () => {
  console.log(`🎵 TapTunes Server running on port ${PORT}`);
  console.log(`🌐 Frontend: http://localhost:5173`);
  console.log(`🔧 API: http://localhost:${PORT}/api`);
});