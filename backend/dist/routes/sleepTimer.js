"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkTimerExpired = checkTimerExpired;
const express_1 = __importDefault(require("express"));
const router = express_1.default.Router();
let timerState = {
    isActive: false,
    remainingSeconds: 0,
    totalSeconds: 0
};
let timerInterval = null;
let fadeInterval = null;
// Get current timer status
router.get('/status', (req, res) => {
    // Update remaining time if timer is active
    if (timerState.isActive && timerState.startTime) {
        const elapsed = Math.floor((Date.now() - timerState.startTime) / 1000);
        timerState.remainingSeconds = Math.max(0, timerState.totalSeconds - elapsed);
        // If timer has expired, stop it
        if (timerState.remainingSeconds === 0) {
            stopTimer();
        }
    }
    res.json(timerState);
});
// Start sleep timer
router.post('/start', (req, res) => {
    const { minutes, fadeVolume = true, fadeDuration = 10 } = req.body;
    if (!minutes || minutes < 1 || minutes > 180) {
        return res.status(400).json({ error: 'Minutes must be between 1 and 180' });
    }
    // Stop any existing timer
    if (timerInterval) {
        clearInterval(timerInterval);
    }
    const totalSeconds = minutes * 60;
    timerState = {
        isActive: true,
        remainingSeconds: totalSeconds,
        totalSeconds: totalSeconds,
        startTime: Date.now(),
        fadeVolume,
        fadeDuration
    };
    console.log(`⏱️ [SLEEP TIMER] Started: ${minutes} minutes (${totalSeconds} seconds)`);
    console.log(`⏱️ [SLEEP TIMER] Fade settings: enabled=${fadeVolume}, duration=${fadeDuration}s`);
    // Set up interval to check timer
    timerInterval = setInterval(() => {
        if (timerState.startTime) {
            const elapsed = Math.floor((Date.now() - timerState.startTime) / 1000);
            timerState.remainingSeconds = Math.max(0, timerState.totalSeconds - elapsed);
            // Start fade when fade duration seconds remain (if fade is enabled)
            if (timerState.fadeVolume && timerState.fadeDuration &&
                timerState.remainingSeconds <= timerState.fadeDuration &&
                timerState.remainingSeconds > 0 &&
                !fadeInterval) {
                console.log(`⏱️ [SLEEP TIMER] Starting volume fade (${timerState.fadeDuration}s)`);
                startVolumeFade(timerState.fadeDuration);
            }
            // When timer reaches 0, pause playback
            if (timerState.remainingSeconds === 0) {
                console.log('⏱️ [SLEEP TIMER] Timer expired - pausing playback');
                stopTimer();
            }
        }
    }, 1000);
    res.json(timerState);
});
// Stop sleep timer
router.post('/stop', (req, res) => {
    console.log('⏱️ [SLEEP TIMER] Stopped');
    stopTimer();
    res.json(timerState);
});
// Add time to active timer
router.post('/add', (req, res) => {
    const { minutes } = req.body;
    if (!minutes || minutes < 1 || minutes > 60) {
        return res.status(400).json({ error: 'Minutes must be between 1 and 60' });
    }
    if (!timerState.isActive) {
        return res.status(400).json({ error: 'No active timer' });
    }
    // Add time by adjusting the start time
    if (timerState.startTime) {
        const addedSeconds = minutes * 60;
        timerState.totalSeconds += addedSeconds;
        // Recalculate remaining time
        const elapsed = Math.floor((Date.now() - timerState.startTime) / 1000);
        timerState.remainingSeconds = Math.max(0, timerState.totalSeconds - elapsed);
        console.log(`⏱️ [SLEEP TIMER] Added ${minutes} minutes (new total: ${timerState.totalSeconds}s)`);
    }
    res.json(timerState);
});
// Start volume fade
async function startVolumeFade(duration) {
    try {
        console.log(`🔉 [SLEEP TIMER] Starting volume fade over ${duration} seconds`);
        // Get current volume
        const currentResponse = await fetch('http://localhost:3001/api/audio/current');
        if (!currentResponse.ok) {
            console.error('⏱️ [SLEEP TIMER] Failed to get current volume');
            return;
        }
        const currentData = await currentResponse.json();
        const startVolume = currentData.volume || 50;
        const startTime = Date.now();
        console.log(`🔉 [SLEEP TIMER] Starting fade from ${startVolume}% to 0%`);
        // Fade volume gradually
        fadeInterval = setInterval(async () => {
            const elapsed = (Date.now() - startTime) / 1000;
            const progress = Math.min(elapsed / duration, 1);
            const newVolume = Math.round(startVolume * (1 - progress));
            try {
                await fetch('http://localhost:3001/api/audio/volume', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ volume: newVolume })
                });
                console.log(`🔉 [SLEEP TIMER] Fade progress: ${(progress * 100).toFixed(1)}% - Volume: ${newVolume}%`);
                // Stop fade when complete
                if (progress >= 1) {
                    if (fadeInterval) {
                        clearInterval(fadeInterval);
                        fadeInterval = null;
                    }
                    console.log(`✅ [SLEEP TIMER] Volume fade complete`);
                }
            }
            catch (error) {
                console.error('⏱️ [SLEEP TIMER] Error setting volume during fade:', error);
            }
        }, 500); // Update volume every 500ms for smooth fade
    }
    catch (error) {
        console.error('⏱️ [SLEEP TIMER] Error starting volume fade:', error);
    }
}
function stopTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
    if (fadeInterval) {
        clearInterval(fadeInterval);
        fadeInterval = null;
    }
    timerState = {
        isActive: false,
        remainingSeconds: 0,
        totalSeconds: 0
    };
    // Pause playback - we'll import this from the audio route
    // For now, we'll make an internal API call
    pausePlayback();
}
// Helper to pause playback
async function pausePlayback() {
    try {
        console.log('⏱️ [SLEEP TIMER] Triggering pause playback');
        // Make internal API call to pause endpoint
        const response = await fetch('http://localhost:3001/api/audio/pause', {
            method: 'POST'
        });
        if (response.ok) {
            console.log('⏱️ [SLEEP TIMER] Successfully paused playback');
        }
        else {
            console.error('⏱️ [SLEEP TIMER] Failed to pause playback - response not ok');
        }
    }
    catch (error) {
        console.error('⏱️ [SLEEP TIMER] Failed to pause playback:', error);
    }
}
// Export function to check if timer expired (called from other routes)
function checkTimerExpired() {
    if (timerState.isActive && timerState.remainingSeconds === 0) {
        stopTimer();
        return true;
    }
    return false;
}
exports.default = router;
