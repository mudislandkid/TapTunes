"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
const audio_1 = __importDefault(require("./routes/audio"));
const rfid_1 = __importDefault(require("./routes/rfid"));
const media_1 = __importDefault(require("./routes/media"));
const system_1 = __importDefault(require("./routes/system"));
const settings_1 = __importDefault(require("./routes/settings"));
const sleepTimer_1 = __importDefault(require("./routes/sleepTimer"));
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = parseInt(process.env.PORT || '3001', 10);
app.use((0, cors_1.default)());
app.use(express_1.default.json({ limit: '500mb' }));
app.use(express_1.default.urlencoded({ limit: '500mb', extended: true }));
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
// Serve uploaded files (album art, audio files) at /api/uploads to work with nginx proxy
app.use('/api/uploads', express_1.default.static(path_1.default.join(process.cwd(), 'uploads')));
app.use('/api/audio', audio_1.default);
app.use('/api/rfid', rfid_1.default);
app.use('/api/media', media_1.default);
app.use('/api/system', system_1.default);
app.use('/api/settings', settings_1.default);
app.use('/api/sleep-timer', sleepTimer_1.default);
const HOST = process.env.HOST || '0.0.0.0';
app.listen(PORT, HOST, () => {
    console.log(`🎵 TapTunes Server running on ${HOST}:${PORT}`);
    console.log(`🌐 Frontend: http://localhost:5173`);
    console.log(`🔧 API: http://localhost:${PORT}/api`);
});
