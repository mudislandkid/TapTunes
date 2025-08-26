"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const router = express_1.default.Router();
const defaultSettings = {
    audioOutputMode: 'browser',
    defaultVolume: 70,
    fadeInDuration: 2,
    fadeOutDuration: 3,
    crossfadeDuration: 5,
    enableGaplessPlayback: true,
    enableEqualizer: false,
    sleepTimerEnabled: false,
    sleepTimerDuration: 30,
    fadeVolumeOnSleep: true,
    fadeVolumeDuration: 10,
    autoStartOnBoot: true,
    enableLogging: true,
    logLevel: 'info',
    enableTelemetry: false,
    wifiSSID: '',
    enableHotspot: false,
    hotspotName: 'TapTunes-RPi',
    enableSSH: false,
    sshPort: 22,
    autoMetadataLookup: true,
    autoDownloadAlbumArt: true,
    preferredAudioQuality: 'high',
    libraryPath: '/home/pi/taptunes/media',
    // RFID Card Behavior Settings defaults
    rfidSameCardBehavior: 'pause',
    rfidCardDebounceMs: 500,
    rfidAutoPlayOnScan: true,
    rfidVolumeCards: true,
    rfidVolumeStep: 10
};
const settingsPath = path_1.default.join(process.cwd(), 'data', 'settings.json');
// Get current settings
router.get('/', async (req, res) => {
    try {
        const settings = await loadSettings();
        res.json(settings);
    }
    catch (error) {
        console.error('Error loading settings:', error);
        res.status(500).json({ error: 'Failed to load settings' });
    }
});
// Update settings
router.put('/', async (req, res) => {
    try {
        const newSettings = { ...defaultSettings, ...req.body };
        await saveSettings(newSettings);
        res.json(newSettings);
        console.log('⚙️ [SETTINGS] Settings updated successfully');
    }
    catch (error) {
        console.error('Error saving settings:', error);
        res.status(500).json({ error: 'Failed to save settings' });
    }
});
// Update specific setting
router.patch('/:key', async (req, res) => {
    try {
        const { key } = req.params;
        const { value } = req.body;
        const settings = await loadSettings();
        if (!(key in settings)) {
            return res.status(400).json({ error: `Invalid setting key: ${key}` });
        }
        settings[key] = value;
        await saveSettings(settings);
        res.json({ key, value, updated: true });
        console.log(`⚙️ [SETTINGS] Updated ${key} = ${value}`);
    }
    catch (error) {
        console.error(`Error updating setting ${req.params.key}:`, error);
        res.status(500).json({ error: 'Failed to update setting' });
    }
});
// Reset settings to defaults
router.post('/reset', async (req, res) => {
    try {
        await saveSettings(defaultSettings);
        res.json(defaultSettings);
        console.log('⚙️ [SETTINGS] Settings reset to defaults');
    }
    catch (error) {
        console.error('Error resetting settings:', error);
        res.status(500).json({ error: 'Failed to reset settings' });
    }
});
// Export settings
router.get('/export', async (req, res) => {
    try {
        const settings = await loadSettings();
        const exportData = {
            settings,
            exportedAt: new Date().toISOString(),
            version: '1.0.0'
        };
        res.setHeader('Content-Disposition', 'attachment; filename=taptunes-settings.json');
        res.setHeader('Content-Type', 'application/json');
        res.send(JSON.stringify(exportData, null, 2));
    }
    catch (error) {
        console.error('Error exporting settings:', error);
        res.status(500).json({ error: 'Failed to export settings' });
    }
});
// Import settings
router.post('/import', async (req, res) => {
    try {
        const importData = req.body;
        if (!importData.settings) {
            return res.status(400).json({ error: 'Invalid import data format' });
        }
        const settings = { ...defaultSettings, ...importData.settings };
        await saveSettings(settings);
        res.json({ success: true, settings });
        console.log('⚙️ [SETTINGS] Settings imported successfully');
    }
    catch (error) {
        console.error('Error importing settings:', error);
        res.status(500).json({ error: 'Failed to import settings' });
    }
});
// Helper functions
async function loadSettings() {
    try {
        // Ensure data directory exists
        await promises_1.default.mkdir(path_1.default.dirname(settingsPath), { recursive: true });
        const data = await promises_1.default.readFile(settingsPath, 'utf8');
        const settings = JSON.parse(data);
        // Merge with defaults to ensure all required fields exist
        return { ...defaultSettings, ...settings };
    }
    catch (error) {
        // If file doesn't exist or is invalid, return defaults
        console.log('⚙️ [SETTINGS] Using default settings (file not found or invalid)');
        return defaultSettings;
    }
}
async function saveSettings(settings) {
    // Ensure data directory exists
    await promises_1.default.mkdir(path_1.default.dirname(settingsPath), { recursive: true });
    // Write settings to file
    await promises_1.default.writeFile(settingsPath, JSON.stringify(settings, null, 2));
}
exports.default = router;
