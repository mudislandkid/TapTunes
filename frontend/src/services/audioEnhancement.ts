// Audio Enhancement Service for TapTunes
// Handles gapless playback, equalizer, crossfade, and other audio processing

import { SharedAudioContextService } from './sharedAudioContext';

export interface EqualizerSettings {
  enabled: boolean;
  preset: string;
  bands: {
    frequency: number;
    gain: number; // -12 to +12 dB
  }[];
}

export interface AudioEnhancementSettings {
  gaplessPlayback: boolean;
  crossfadeDuration: number; // seconds
  fadeInDuration: number; // seconds
  fadeOutDuration: number; // seconds
  equalizer: EqualizerSettings;
}

export const EQUALIZER_PRESETS = {
  'flat': {
    name: 'Flat',
    bands: [
      { frequency: 60, gain: 0 },
      { frequency: 170, gain: 0 },
      { frequency: 310, gain: 0 },
      { frequency: 600, gain: 0 },
      { frequency: 1000, gain: 0 },
      { frequency: 3000, gain: 0 },
      { frequency: 6000, gain: 0 },
      { frequency: 12000, gain: 0 },
      { frequency: 14000, gain: 0 },
      { frequency: 16000, gain: 0 }
    ]
  },
  'rock': {
    name: 'Rock',
    bands: [
      { frequency: 60, gain: 4 },
      { frequency: 170, gain: 2 },
      { frequency: 310, gain: -2 },
      { frequency: 600, gain: -1 },
      { frequency: 1000, gain: 0 },
      { frequency: 3000, gain: 2 },
      { frequency: 6000, gain: 4 },
      { frequency: 12000, gain: 3 },
      { frequency: 14000, gain: 2 },
      { frequency: 16000, gain: 1 }
    ]
  },
  'pop': {
    name: 'Pop',
    bands: [
      { frequency: 60, gain: 2 },
      { frequency: 170, gain: 1 },
      { frequency: 310, gain: 0 },
      { frequency: 600, gain: 1 },
      { frequency: 1000, gain: 2 },
      { frequency: 3000, gain: 2 },
      { frequency: 6000, gain: 1 },
      { frequency: 12000, gain: 0 },
      { frequency: 14000, gain: -1 },
      { frequency: 16000, gain: -1 }
    ]
  },
  'jazz': {
    name: 'Jazz',
    bands: [
      { frequency: 60, gain: 2 },
      { frequency: 170, gain: 1 },
      { frequency: 310, gain: 1 },
      { frequency: 600, gain: 1 },
      { frequency: 1000, gain: 0 },
      { frequency: 3000, gain: 0 },
      { frequency: 6000, gain: 1 },
      { frequency: 12000, gain: 2 },
      { frequency: 14000, gain: 2 },
      { frequency: 16000, gain: 1 }
    ]
  },
  'classical': {
    name: 'Classical',
    bands: [
      { frequency: 60, gain: 3 },
      { frequency: 170, gain: 2 },
      { frequency: 310, gain: 1 },
      { frequency: 600, gain: 0 },
      { frequency: 1000, gain: -1 },
      { frequency: 3000, gain: -1 },
      { frequency: 6000, gain: 0 },
      { frequency: 12000, gain: 2 },
      { frequency: 14000, gain: 3 },
      { frequency: 16000, gain: 3 }
    ]
  },
  'bass-boost': {
    name: 'Bass Boost',
    bands: [
      { frequency: 60, gain: 6 },
      { frequency: 170, gain: 4 },
      { frequency: 310, gain: 2 },
      { frequency: 600, gain: 0 },
      { frequency: 1000, gain: 0 },
      { frequency: 3000, gain: 0 },
      { frequency: 6000, gain: 0 },
      { frequency: 12000, gain: 0 },
      { frequency: 14000, gain: 0 },
      { frequency: 16000, gain: 0 }
    ]
  },
  'vocal': {
    name: 'Vocal',
    bands: [
      { frequency: 60, gain: -2 },
      { frequency: 170, gain: -1 },
      { frequency: 310, gain: 1 },
      { frequency: 600, gain: 3 },
      { frequency: 1000, gain: 4 },
      { frequency: 3000, gain: 4 },
      { frequency: 6000, gain: 2 },
      { frequency: 12000, gain: 1 },
      { frequency: 14000, gain: 0 },
      { frequency: 16000, gain: -1 }
    ]
  }
};

export class AudioEnhancementService {
  private sharedAudio: SharedAudioContextService;
  private equalizerNodes: BiquadFilterNode[] = [];
  private currentAudioElement: HTMLAudioElement | null = null;
  private settings: AudioEnhancementSettings;

  constructor() {
    this.sharedAudio = SharedAudioContextService.getInstance();
    this.settings = {
      gaplessPlayback: true,
      crossfadeDuration: 3,
      fadeInDuration: 2,
      fadeOutDuration: 2,
      equalizer: {
        enabled: false,
        preset: 'flat',
        bands: EQUALIZER_PRESETS.flat.bands
      }
    };
  }

  async initialize(audioElement: HTMLAudioElement): Promise<void> {
    try {
      // Initialize shared audio context
      await this.sharedAudio.initialize(audioElement);
      
      this.currentAudioElement = audioElement;
      this.setupAudioGraph();
      console.log('🎵 [AUDIO-ENHANCEMENT] Service initialized successfully');
    } catch (error) {
      console.error('❌ [AUDIO-ENHANCEMENT] Failed to initialize:', error);
      throw error;
    }
  }

  private setupAudioGraph(): void {
    const audioContext = this.sharedAudio.getAudioContext();
    if (!audioContext || !this.currentAudioElement) return;

    try {
      // Create equalizer nodes using the shared audio context
      this.createEqualizerNodes();

      // Insert equalizer nodes into the shared audio graph
      if (this.settings.equalizer.enabled && this.equalizerNodes.length > 0) {
        this.sharedAudio.insertEqualizerNodes(this.equalizerNodes);
      }

      console.log('🎵 [AUDIO-ENHANCEMENT] Audio graph setup complete');
    } catch (error) {
      console.error('❌ [AUDIO-ENHANCEMENT] Failed to setup audio graph:', error);
    }
  }

  private createEqualizerNodes(): void {
    const audioContext = this.sharedAudio.getAudioContext();
    if (!audioContext) return;

    // Clear existing equalizer nodes
    this.equalizerNodes.forEach(node => node.disconnect());
    this.equalizerNodes = [];

    // Create new equalizer nodes
    this.settings.equalizer.bands.forEach((band, index) => {
      const filter = audioContext.createBiquadFilter();
      
      // Set filter type based on frequency
      if (index === 0) {
        filter.type = 'lowshelf';
      } else if (index === this.settings.equalizer.bands.length - 1) {
        filter.type = 'highshelf';
      } else {
        filter.type = 'peaking';
        filter.Q.value = 1;
      }
      
      filter.frequency.value = band.frequency;
      filter.gain.value = this.settings.equalizer.enabled ? band.gain : 0;
      
      this.equalizerNodes.push(filter);
    });

    console.log(`🎵 [AUDIO-ENHANCEMENT] Created ${this.equalizerNodes.length} equalizer nodes`);
  }


  updateSettings(newSettings: Partial<AudioEnhancementSettings>): void {
    this.settings = { ...this.settings, ...newSettings };
    
    if (newSettings.equalizer) {
      this.createEqualizerNodes();
      if (this.settings.equalizer.enabled && this.equalizerNodes.length > 0) {
        this.sharedAudio.insertEqualizerNodes(this.equalizerNodes);
      }
      console.log('🎵 [AUDIO-ENHANCEMENT] Equalizer settings updated');
    }
  }

  setEqualizerPreset(presetName: string): void {
    const preset = EQUALIZER_PRESETS[presetName as keyof typeof EQUALIZER_PRESETS];
    if (preset) {
      this.settings.equalizer.preset = presetName;
      this.settings.equalizer.bands = [...preset.bands];
      this.createEqualizerNodes();
      if (this.settings.equalizer.enabled && this.equalizerNodes.length > 0) {
        this.sharedAudio.insertEqualizerNodes(this.equalizerNodes);
      }
      console.log(`🎵 [AUDIO-ENHANCEMENT] Equalizer preset set to: ${preset.name}`);
    }
  }

  setEqualizerEnabled(enabled: boolean): void {
    this.settings.equalizer.enabled = enabled;
    
    // Update gain values for all equalizer nodes
    this.equalizerNodes.forEach((node, index) => {
      const band = this.settings.equalizer.bands[index];
      if (band) {
        node.gain.value = enabled ? band.gain : 0;
      }
    });
    
    console.log(`🎵 [AUDIO-ENHANCEMENT] Equalizer ${enabled ? 'enabled' : 'disabled'}`);
  }

  setEqualizerBand(bandIndex: number, gain: number): void {
    if (bandIndex >= 0 && bandIndex < this.settings.equalizer.bands.length) {
      this.settings.equalizer.bands[bandIndex].gain = gain;
      
      if (this.equalizerNodes[bandIndex] && this.settings.equalizer.enabled) {
        this.equalizerNodes[bandIndex].gain.value = gain;
      }
    }
  }

  async fadeIn(duration: number = this.settings.fadeInDuration): Promise<void> {
    await this.sharedAudio.fadeVolume(1, duration);
    console.log(`🎵 [AUDIO-ENHANCEMENT] Fade in started (${duration}s)`);
  }

  async fadeOut(duration: number = this.settings.fadeOutDuration): Promise<void> {
    console.log(`🎵 [AUDIO-ENHANCEMENT] Fade out started (${duration}s)`);
    await this.sharedAudio.fadeVolume(0, duration);
  }

  async crossfade(_fromElement: HTMLAudioElement, _toElement: HTMLAudioElement): Promise<void> {
    const audioContext = this.sharedAudio.getAudioContext();
    if (!audioContext) return;

    console.log(`🎵 [AUDIO-ENHANCEMENT] Crossfade started (${this.settings.crossfadeDuration}s)`);
    
    // Create separate gain nodes for crossfade
    const fromGain = audioContext.createGain();
    const toGain = audioContext.createGain();
    
    // Set initial values
    fromGain.gain.value = 1;
    toGain.gain.value = 0;
    
    const currentTime = audioContext.currentTime;
    const duration = this.settings.crossfadeDuration;
    
    // Schedule crossfade
    fromGain.gain.linearRampToValueAtTime(0, currentTime + duration);
    toGain.gain.linearRampToValueAtTime(1, currentTime + duration);
    
    return new Promise(resolve => {
      setTimeout(resolve, duration * 1000);
    });
  }

  prepareGaplessPlayback(nextTrackElement: HTMLAudioElement): void {
    if (!this.settings.gaplessPlayback) return;
    
    this.nextAudioElement = nextTrackElement;
    
    // Preload the next track
    nextTrackElement.preload = 'auto';
    nextTrackElement.load();
    
    console.log('🎵 [AUDIO-ENHANCEMENT] Next track prepared for gapless playback');
  }

  getSettings(): AudioEnhancementSettings {
    return { ...this.settings };
  }

  getEqualizerPresets(): typeof EQUALIZER_PRESETS {
    return EQUALIZER_PRESETS;
  }

  destroy(): void {
    this.equalizerNodes.forEach(node => node.disconnect());
    this.equalizerNodes = [];
    
    // Note: We don't destroy the shared audio context here as it might be used by other components
    console.log('🎵 [AUDIO-ENHANCEMENT] Service destroyed');
  }
}