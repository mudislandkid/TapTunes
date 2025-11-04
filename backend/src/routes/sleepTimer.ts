import express from 'express';

const router = express.Router();

interface SleepTimerState {
  isActive: boolean;
  remainingSeconds: number;
  totalSeconds: number;
  startTime?: number;
}

let timerState: SleepTimerState = {
  isActive: false,
  remainingSeconds: 0,
  totalSeconds: 0
};

let timerInterval: NodeJS.Timeout | null = null;

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
  const { minutes } = req.body;

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
    startTime: Date.now()
  };

  console.log(`⏱️ [SLEEP TIMER] Started: ${minutes} minutes (${totalSeconds} seconds)`);

  // Set up interval to check timer
  timerInterval = setInterval(() => {
    if (timerState.startTime) {
      const elapsed = Math.floor((Date.now() - timerState.startTime) / 1000);
      timerState.remainingSeconds = Math.max(0, timerState.totalSeconds - elapsed);

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

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
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
    } else {
      console.error('⏱️ [SLEEP TIMER] Failed to pause playback - response not ok');
    }
  } catch (error) {
    console.error('⏱️ [SLEEP TIMER] Failed to pause playback:', error);
  }
}

// Export function to check if timer expired (called from other routes)
export function checkTimerExpired(): boolean {
  if (timerState.isActive && timerState.remainingSeconds === 0) {
    stopTimer();
    return true;
  }
  return false;
}

export default router;
