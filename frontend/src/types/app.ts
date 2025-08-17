export interface AudioTrack {
  id: string;
  title: string;
  artist?: string;
  album?: string;
  duration?: number;
  file_path: string;
  filePath?: string; // Support both naming conventions
}

export interface PlaybackState {
  playlist: any;
  trackIndex: number;
  isPlaying: boolean;
  currentTrack: any | null; // Will be Track but avoiding circular import
  progress?: number; // 0-100
  currentTime?: number; // in seconds
  duration?: number; // in seconds
}

export type PlaybackMode = 'browser' | 'hardware';
export type RepeatMode = 'off' | 'one' | 'all';
export type ActiveTab = 'player' | 'library' | 'rfid' | 'settings';

export interface AppTab {
  id: ActiveTab;
  label: string;
  icon: any;
}