// Shared Audio Context Service for TapTunes
// Manages a single audio graph that both visualizer and audio enhancement can use

export class SharedAudioContextService {
  private static instance: SharedAudioContextService | null = null;
  private audioContext: AudioContext | null = null;
  private sourceNode: MediaElementAudioSourceNode | null = null;
  private analyserNode: AnalyserNode | null = null;
  private gainNode: GainNode | null = null;
  private audioElement: HTMLAudioElement | null = null;
  private subscribers: ((analyser: AnalyserNode) => void)[] = [];

  private constructor() {}

  static getInstance(): SharedAudioContextService {
    if (!SharedAudioContextService.instance) {
      SharedAudioContextService.instance = new SharedAudioContextService();
    }
    return SharedAudioContextService.instance;
  }

  async initialize(audioElement: HTMLAudioElement): Promise<void> {
    if (this.audioContext && this.sourceNode && this.audioElement === audioElement) {
      // Already initialized with this element
      return;
    }

    try {
      // Create audio context if it doesn't exist
      if (!this.audioContext) {
        this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        console.log('🎵 [SHARED-AUDIO] Audio context created');
      }

      // Resume context if suspended
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
        console.log('🎵 [SHARED-AUDIO] Audio context resumed');
      }

      // Clean up existing nodes if switching audio elements
      if (this.sourceNode && this.audioElement !== audioElement) {
        this.sourceNode.disconnect();
        this.sourceNode = null;
      }

      this.audioElement = audioElement;

      // Create source node if it doesn't exist
      if (!this.sourceNode) {
        this.sourceNode = this.audioContext.createMediaElementSource(audioElement);
        console.log('🎵 [SHARED-AUDIO] Source node created');
      }

      // Create analyser node for visualizer
      if (!this.analyserNode) {
        this.analyserNode = this.audioContext.createAnalyser();
        this.analyserNode.fftSize = 256;
        this.analyserNode.smoothingTimeConstant = 0.75;
        this.analyserNode.minDecibels = -90;
        this.analyserNode.maxDecibels = -10;
        console.log('🎵 [SHARED-AUDIO] Analyser node created');
      }

      // Create gain node for volume control
      if (!this.gainNode) {
        this.gainNode = this.audioContext.createGain();
        console.log('🎵 [SHARED-AUDIO] Gain node created');
      }

      // Connect the basic audio graph: source -> analyser -> gain -> destination
      this.connectAudioGraph();

      // Notify subscribers (like visualizer) that analyser is ready
      this.notifySubscribers();

    } catch (error) {
      console.error('❌ [SHARED-AUDIO] Failed to initialize:', error);
      throw error;
    }
  }

  private connectAudioGraph(): void {
    if (!this.sourceNode || !this.analyserNode || !this.gainNode || !this.audioContext) return;

    try {
      // Disconnect all nodes first
      this.sourceNode.disconnect();
      this.analyserNode.disconnect();
      this.gainNode.disconnect();

      // Connect: source -> analyser -> gain -> destination
      this.sourceNode.connect(this.analyserNode);
      this.analyserNode.connect(this.gainNode);
      this.gainNode.connect(this.audioContext.destination);

      console.log('🎵 [SHARED-AUDIO] Audio graph connected');
    } catch (error) {
      console.error('❌ [SHARED-AUDIO] Failed to connect audio graph:', error);
    }
  }

  // Insert equalizer nodes into the audio graph
  insertEqualizerNodes(equalizerNodes: BiquadFilterNode[]): void {
    if (!this.sourceNode || !this.analyserNode || !this.gainNode || !this.audioContext) return;

    try {
      // Disconnect existing connections
      this.sourceNode.disconnect();
      this.analyserNode.disconnect();
      this.gainNode.disconnect();

      // Connect: source -> analyser -> equalizer chain -> gain -> destination
      let currentNode: AudioNode = this.sourceNode;
      
      // Connect to analyser first
      currentNode.connect(this.analyserNode);
      currentNode = this.analyserNode;

      // Connect equalizer chain
      equalizerNodes.forEach((eqNode, index) => {
        currentNode.connect(eqNode);
        currentNode = eqNode;
      });

      // Connect to gain and destination
      currentNode.connect(this.gainNode);
      this.gainNode.connect(this.audioContext.destination);

      console.log(`🎵 [SHARED-AUDIO] Equalizer nodes inserted (${equalizerNodes.length} bands)`);
    } catch (error) {
      console.error('❌ [SHARED-AUDIO] Failed to insert equalizer nodes:', error);
      // Fallback to basic connection
      this.connectAudioGraph();
    }
  }

  // Subscribe to analyser updates (for visualizer)
  subscribeToAnalyser(callback: (analyser: AnalyserNode) => void): void {
    this.subscribers.push(callback);
    
    // If analyser is already available, notify immediately
    if (this.analyserNode) {
      callback(this.analyserNode);
    }
  }

  private notifySubscribers(): void {
    if (this.analyserNode) {
      this.subscribers.forEach(callback => callback(this.analyserNode!));
    }
  }

  getAnalyserNode(): AnalyserNode | null {
    return this.analyserNode;
  }

  getGainNode(): GainNode | null {
    return this.gainNode;
  }

  getAudioContext(): AudioContext | null {
    return this.audioContext;
  }

  getSourceNode(): MediaElementAudioSourceNode | null {
    return this.sourceNode;
  }

  async fadeVolume(targetVolume: number, duration: number): Promise<void> {
    if (!this.gainNode || !this.audioContext) return;

    const currentTime = this.audioContext.currentTime;
    this.gainNode.gain.cancelScheduledValues(currentTime);
    this.gainNode.gain.setValueAtTime(this.gainNode.gain.value, currentTime);
    this.gainNode.gain.linearRampToValueAtTime(targetVolume, currentTime + duration);

    return new Promise(resolve => {
      setTimeout(resolve, duration * 1000);
    });
  }

  destroy(): void {
    this.subscribers = [];

    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }

    if (this.analyserNode) {
      this.analyserNode.disconnect();
      this.analyserNode = null;
    }

    if (this.gainNode) {
      this.gainNode.disconnect();
      this.gainNode = null;
    }

    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
      this.audioContext = null;
    }

    this.audioElement = null;
    console.log('🎵 [SHARED-AUDIO] Service destroyed');
  }

  static reset(): void {
    if (SharedAudioContextService.instance) {
      SharedAudioContextService.instance.destroy();
      SharedAudioContextService.instance = null;
    }
  }
}