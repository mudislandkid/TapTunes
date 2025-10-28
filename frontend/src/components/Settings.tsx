import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Settings as SettingsIcon,
  Volume2,
  Clock,
  Wifi,
  Download,
  Power,
  Monitor,
  Headphones,
  Timer,
  VolumeX,
  RefreshCw,
  Music,
  HardDrive,
  Cpu,
  Thermometer,
  CreditCard,
  Pause,
  Square
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Switch } from './ui/switch';
import { Slider } from './ui/slider';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { Separator } from './ui/separator';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Badge } from './ui/badge';
import Equalizer from './Equalizer';
import { AudioEnhancementService } from '../services/audioEnhancement';

interface SettingsProps {
  isVisible: boolean;
  audioEnhancementService: AudioEnhancementService | null;
  onInitializeAudio?: () => Promise<void>;
}

interface AppSettings {
  // Audio Settings
  audioOutputMode: 'browser' | 'hardware' | 'both';
  defaultVolume: number;
  startupVolume: number;
  fadeInDuration: number;
  fadeOutDuration: number;
  crossfadeDuration: number;
  enableGaplessPlayback: boolean;
  enableEqualizer: boolean;
  
  // Sleep Timer
  sleepTimerEnabled: boolean;
  sleepTimerDuration: number; // minutes
  fadeVolumeOnSleep: boolean;
  fadeVolumeDuration: number; // seconds
  
  // System Settings
  autoStartOnBoot: boolean;
  enableLogging: boolean;
  logLevel: 'error' | 'warn' | 'info' | 'debug';
  enableTelemetry: boolean;
  
  // Network Settings (RPi)
  wifiSSID: string;
  enableHotspot: boolean;
  hotspotName: string;
  enableSSH: boolean;
  sshPort: number;
  
  // Library Settings
  autoMetadataLookup: boolean;
  autoDownloadAlbumArt: boolean;
  preferredAudioQuality: 'low' | 'medium' | 'high' | 'lossless';
  libraryPath: string;
  
  // RFID Card Behavior Settings
  rfidSameCardBehavior: 'nothing' | 'pause' | 'stop' | 'restart';
  rfidCardDebounceMs: number;
  rfidAutoPlayOnScan: boolean;
  rfidVolumeCards: boolean;
  rfidVolumeStep: number;
}

const defaultSettings: AppSettings = {
  audioOutputMode: 'browser',
  defaultVolume: 70,
  startupVolume: 50,
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
  rfidSameCardBehavior: 'pause',
  rfidCardDebounceMs: 500,
  rfidAutoPlayOnScan: true,
  rfidVolumeCards: true,
  rfidVolumeStep: 10
};

export default function Settings({ isVisible, audioEnhancementService, onInitializeAudio }: SettingsProps) {
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [systemInfo, setSystemInfo] = useState({
    platform: 'Unknown',
    version: '1.0.0',
    uptime: '0h 0m',
    cpuUsage: 0,
    memoryUsage: 0,
    diskUsage: 0,
    temperature: 0
  });
  const [isUpdating, setIsUpdating] = useState(false);
  const [sleepTimerActive, setSleepTimerActive] = useState(false);
  const [sleepTimeRemaining, setSleepTimeRemaining] = useState(0);

  // Load settings from backend on mount
  useEffect(() => {
    loadSettings();
    fetchSystemInfo();
  }, []);

  // Save settings to backend whenever they change
  useEffect(() => {
    if (settings !== defaultSettings) {
      saveSettings();
    }
  }, [settings]);

  const loadSettings = async () => {
    try {
      const response = await fetch('/api/settings');
      if (response.ok) {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const loadedSettings = await response.json();
          setSettings(loadedSettings);
          return;
        }
      }
      throw new Error(`API returned non-JSON response: ${response.status}`);
    } catch (error) {
      console.warn('Backend not available, using localStorage:', error);
      // Fallback to localStorage
      const savedSettings = localStorage.getItem('taptunes-settings');
      if (savedSettings) {
        setSettings({ ...defaultSettings, ...JSON.parse(savedSettings) });
      } else {
        setSettings(defaultSettings);
      }
    }
  };

  const saveSettings = async () => {
    try {
      const response = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      
      if (response.ok) {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          // Backend save successful
          localStorage.setItem('taptunes-settings', JSON.stringify(settings));
          return;
        }
      }
      throw new Error(`API returned non-JSON response: ${response.status}`);
    } catch (error) {
      console.warn('Backend not available, using localStorage only:', error);
      // Fallback to localStorage only
      localStorage.setItem('taptunes-settings', JSON.stringify(settings));
    }
  };

  const fetchSystemInfo = async () => {
    try {
      const response = await fetch('/api/system/info');
      if (response.ok) {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const info = await response.json();
          setSystemInfo(info);
          return;
        }
      }
      throw new Error(`API returned non-JSON response: ${response.status}`);
    } catch (error) {
      console.warn('System info not available:', error);
      // Use mock data when backend is not available
      setSystemInfo({
        platform: navigator.platform || 'Web Browser',
        version: '1.0.0',
        uptime: '0h 0m',
        cpuUsage: 0,
        memoryUsage: 0,
        diskUsage: 0,
        temperature: 0
      });
    }
  };

  const updateSetting = (key: keyof AppSettings, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleSystemUpdate = async () => {
    setIsUpdating(true);
    try {
      const response = await fetch('/api/system/update', { method: 'POST' });
      if (response.ok) {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          console.log('System update initiated');
          alert('System update initiated successfully');
        } else {
          throw new Error('Update service not available');
        }
      } else {
        throw new Error(`Update failed: ${response.status}`);
      }
    } catch (error) {
      console.warn('Update service not available:', error);
      alert('Update service not available. Please update manually or check if backend is running.');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSystemReboot = async () => {
    if (window.confirm('Are you sure you want to reboot the system?')) {
      try {
        const response = await fetch('/api/system/reboot', { method: 'POST' });
        if (response.ok) {
          const contentType = response.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            alert('System reboot initiated');
          } else {
            throw new Error('Reboot service not available');
          }
        } else {
          throw new Error(`Reboot failed: ${response.status}`);
        }
      } catch (error) {
        console.warn('Reboot service not available:', error);
        alert('Reboot service not available. This feature requires backend connection and may only work on Linux systems.');
      }
    }
  };

  const startSleepTimer = () => {
    setSleepTimerActive(true);
    setSleepTimeRemaining(settings.sleepTimerDuration * 60); // Convert to seconds
  };

  const stopSleepTimer = () => {
    setSleepTimerActive(false);
    setSleepTimeRemaining(0);
  };

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    }
    return `${minutes}m ${secs}s`;
  };

  if (!isVisible) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
      className="p-4 space-y-6"
    >
      <div className="flex items-center gap-3 mb-6">
        <SettingsIcon className="w-8 h-8 text-blue-400" />
        <h1 className="text-3xl font-bold text-white">Settings</h1>
      </div>

      <Tabs defaultValue="audio" className="w-full">
        <TabsList className="grid w-full grid-cols-3 md:grid-cols-6 bg-gray-800/50 border border-gray-700/50 gap-1">
          <TabsTrigger value="audio" className="data-[state=active]:bg-blue-600/50">Audio</TabsTrigger>
          <TabsTrigger value="rfid" className="data-[state=active]:bg-blue-600/50">RFID</TabsTrigger>
          <TabsTrigger value="timer" className="data-[state=active]:bg-blue-600/50">Timer</TabsTrigger>
          <TabsTrigger value="system" className="data-[state=active]:bg-blue-600/50">System</TabsTrigger>
          <TabsTrigger value="network" className="data-[state=active]:bg-blue-600/50">Network</TabsTrigger>
          <TabsTrigger value="library" className="data-[state=active]:bg-blue-600/50">Library</TabsTrigger>
        </TabsList>

        {/* Audio Settings */}
        <TabsContent value="audio" className="space-y-6 mt-8">
          <Card className="bg-gray-900/50 border-gray-700/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-blue-400">
                <Volume2 className="w-5 h-5" />
                Audio Output
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label className="text-gray-300 mb-3 block">Output Mode</Label>
                <RadioGroup
                  value={settings.audioOutputMode}
                  onValueChange={(value) => updateSetting('audioOutputMode', value)}
                  className="space-y-2"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="browser" id="browser" />
                    <Label htmlFor="browser" className="flex items-center gap-2 text-gray-300">
                      <Monitor className="w-4 h-4" />
                      Browser Only
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="hardware" id="hardware" />
                    <Label htmlFor="hardware" className="flex items-center gap-2 text-gray-300">
                      <Headphones className="w-4 h-4" />
                      Hardware Only
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="both" id="both" />
                    <Label htmlFor="both" className="flex items-center gap-2 text-gray-300">
                      <Volume2 className="w-4 h-4" />
                      Both (Synchronized)
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              <Separator className="bg-gray-700/50" />

              <div>
                <Label className="text-gray-300 mb-3 block">Default Volume: {settings.defaultVolume}%</Label>
                <Slider
                  value={[settings.defaultVolume]}
                  onValueChange={([value]) => updateSetting('defaultVolume', value)}
                  max={100}
                  step={1}
                  className="w-full"
                />
              </div>

              <div>
                <Label className="text-gray-300 mb-3 block">Startup Volume: {settings.startupVolume}%</Label>
                <p className="text-sm text-gray-400 mb-3">Volume level to use when system starts up (prevents loud blasts after reboot)</p>
                <Slider
                  value={[settings.startupVolume]}
                  onValueChange={([value]) => updateSetting('startupVolume', value)}
                  max={100}
                  step={1}
                  className="w-full"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-300 mb-2 block">Fade In (seconds)</Label>
                  <Input
                    type="number"
                    value={settings.fadeInDuration}
                    onChange={(e) => updateSetting('fadeInDuration', parseInt(e.target.value))}
                    min={0}
                    max={10}
                    className="bg-gray-800/50 border-gray-600/50"
                  />
                </div>
                <div>
                  <Label className="text-gray-300 mb-2 block">Fade Out (seconds)</Label>
                  <Input
                    type="number"
                    value={settings.fadeOutDuration}
                    onChange={(e) => updateSetting('fadeOutDuration', parseInt(e.target.value))}
                    min={0}
                    max={10}
                    className="bg-gray-800/50 border-gray-600/50"
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-gray-300">Gapless Playback</Label>
                  <Switch
                    checked={settings.enableGaplessPlayback}
                    onCheckedChange={(checked) => updateSetting('enableGaplessPlayback', checked)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-gray-300">Equalizer</Label>
                  <Switch
                    checked={settings.enableEqualizer}
                    onCheckedChange={(checked) => updateSetting('enableEqualizer', checked)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
          
          {/* Equalizer */}
          <Equalizer 
            audioEnhancementService={audioEnhancementService}
            onSettingsChange={async (eqSettings) => {
              // Handle audio initialization request
              if (eqSettings.initializeAudio && onInitializeAudio) {
                await onInitializeAudio();
                return;
              }
              
              // Update the main settings when equalizer changes
              if (eqSettings.enabled !== undefined) {
                updateSetting('enableEqualizer', eqSettings.enabled);
              }
            }}
          />
        </TabsContent>

        {/* RFID Settings */}
        <TabsContent value="rfid" className="space-y-6 mt-8">
          <Card className="bg-gray-900/50 border-gray-700/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-blue-400">
                <CreditCard className="w-5 h-5" />
                RFID Card Behavior
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label className="text-gray-300 mb-3 block">When Same Card is Tapped Again</Label>
                <RadioGroup
                  value={settings.rfidSameCardBehavior}
                  onValueChange={(value) => updateSetting('rfidSameCardBehavior', value as 'nothing' | 'pause' | 'stop' | 'restart')}
                  className="space-y-2"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="nothing" id="nothing" />
                    <Label htmlFor="nothing" className="text-gray-300">
                      Do Nothing
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="pause" id="pause" />
                    <Label htmlFor="pause" className="flex items-center gap-2 text-gray-300">
                      <Pause className="w-4 h-4" />
                      Pause/Resume
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="stop" id="stop" />
                    <Label htmlFor="stop" className="flex items-center gap-2 text-gray-300">
                      <Square className="w-4 h-4" />
                      Stop
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="restart" id="restart" />
                    <Label htmlFor="restart" className="flex items-center gap-2 text-gray-300">
                      <RefreshCw className="w-4 h-4" />
                      Restart from Beginning
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              <Separator className="bg-gray-700/50" />

              <div>
                <Label className="text-gray-300 mb-3 block">Card Scan Debounce: {settings.rfidCardDebounceMs}ms</Label>
                <Slider
                  value={[settings.rfidCardDebounceMs]}
                  onValueChange={([value]) => updateSetting('rfidCardDebounceMs', value)}
                  min={100}
                  max={2000}
                  step={100}
                  className="w-full"
                />
                <p className="text-sm text-gray-500 mt-2">
                  Minimum time between card scans to prevent duplicate reads
                </p>
              </div>

              <div>
                <Label className="text-gray-300 mb-3 block">Volume Step: {settings.rfidVolumeStep}%</Label>
                <Slider
                  value={[settings.rfidVolumeStep]}
                  onValueChange={([value]) => updateSetting('rfidVolumeStep', value)}
                  min={5}
                  max={25}
                  step={5}
                  className="w-full"
                />
                <p className="text-sm text-gray-500 mt-2">
                  Volume change amount for volume control cards
                </p>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-gray-300">Auto-play on Card Scan</Label>
                  <Switch
                    checked={settings.rfidAutoPlayOnScan}
                    onCheckedChange={(checked) => updateSetting('rfidAutoPlayOnScan', checked)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-gray-300">Enable Volume Control Cards</Label>
                  <Switch
                    checked={settings.rfidVolumeCards}
                    onCheckedChange={(checked) => updateSetting('rfidVolumeCards', checked)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Sleep Timer Settings */}
        <TabsContent value="timer" className="space-y-6 mt-8">
          <Card className="bg-gray-900/50 border-gray-700/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-blue-400">
                <Clock className="w-5 h-5" />
                Sleep Timer
                {sleepTimerActive && (
                  <Badge variant="secondary" className="bg-green-600/20 text-green-300">
                    Active
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {sleepTimerActive && (
                <div className="bg-green-600/10 border border-green-600/30 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-green-300 font-medium">Sleep timer active</p>
                      <p className="text-green-200/70 text-sm">Time remaining: {formatTime(sleepTimeRemaining)}</p>
                    </div>
                    <Button 
                      onClick={stopSleepTimer}
                      variant="outline"
                      size="sm"
                      className="border-red-600/50 text-red-300 hover:bg-red-600/20"
                    >
                      <VolumeX className="w-4 h-4 mr-2" />
                      Stop Timer
                    </Button>
                  </div>
                </div>
              )}

              <div>
                <Label className="text-gray-300 mb-3 block">Duration: {settings.sleepTimerDuration} minutes</Label>
                <Slider
                  value={[settings.sleepTimerDuration]}
                  onValueChange={([value]) => updateSetting('sleepTimerDuration', value)}
                  min={5}
                  max={120}
                  step={5}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>5 min</span>
                  <span>60 min</span>
                  <span>120 min</span>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-gray-300">Fade volume on sleep</Label>
                  <Switch
                    checked={settings.fadeVolumeOnSleep}
                    onCheckedChange={(checked) => updateSetting('fadeVolumeOnSleep', checked)}
                  />
                </div>

                {settings.fadeVolumeOnSleep && (
                  <div>
                    <Label className="text-gray-300 mb-2 block">Fade duration: {settings.fadeVolumeDuration}s</Label>
                    <Slider
                      value={[settings.fadeVolumeDuration]}
                      onValueChange={([value]) => updateSetting('fadeVolumeDuration', value)}
                      min={5}
                      max={60}
                      step={5}
                      className="w-full"
                    />
                  </div>
                )}
              </div>

              <Button 
                onClick={startSleepTimer}
                disabled={sleepTimerActive}
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                <Timer className="w-4 h-4 mr-2" />
                Start Sleep Timer
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* System Settings */}
        <TabsContent value="system" className="space-y-6 mt-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* System Info */}
            <Card className="bg-gray-900/50 border-gray-700/50 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-blue-400">
                  <Cpu className="w-5 h-5" />
                  System Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-400">Platform</p>
                    <p className="text-white">{systemInfo.platform}</p>
                  </div>
                  <div>
                    <p className="text-gray-400">Version</p>
                    <p className="text-white">{systemInfo.version}</p>
                  </div>
                  <div>
                    <p className="text-gray-400">Uptime</p>
                    <p className="text-white">{systemInfo.uptime}</p>
                  </div>
                  <div>
                    <p className="text-gray-400">Temperature</p>
                    <p className="text-white flex items-center gap-1">
                      <Thermometer className="w-3 h-3" />
                      {systemInfo.temperature}°C
                    </p>
                  </div>
                </div>
                
                <Separator className="bg-gray-700/50" />
                
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-400">CPU Usage</span>
                      <span className="text-white">{systemInfo.cpuUsage}%</span>
                    </div>
                    <div className="w-full bg-gray-700/50 rounded-full h-2">
                      <div 
                        className="bg-blue-500 h-2 rounded-full transition-all"
                        style={{ width: `${systemInfo.cpuUsage}%` }}
                      />
                    </div>
                  </div>
                  
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-400">Memory Usage</span>
                      <span className="text-white">{systemInfo.memoryUsage}%</span>
                    </div>
                    <div className="w-full bg-gray-700/50 rounded-full h-2">
                      <div 
                        className="bg-green-500 h-2 rounded-full transition-all"
                        style={{ width: `${systemInfo.memoryUsage}%` }}
                      />
                    </div>
                  </div>
                  
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-400">Disk Usage</span>
                      <span className="text-white">{systemInfo.diskUsage}%</span>
                    </div>
                    <div className="w-full bg-gray-700/50 rounded-full h-2">
                      <div 
                        className="bg-orange-500 h-2 rounded-full transition-all"
                        style={{ width: `${systemInfo.diskUsage}%` }}
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* System Controls */}
            <Card className="bg-gray-900/50 border-gray-700/50 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-blue-400">
                  <Power className="w-5 h-5" />
                  System Controls
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-gray-300">Auto-start on boot</Label>
                    <Switch
                      checked={settings.autoStartOnBoot}
                      onCheckedChange={(checked) => updateSetting('autoStartOnBoot', checked)}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <Label className="text-gray-300">Enable logging</Label>
                    <Switch
                      checked={settings.enableLogging}
                      onCheckedChange={(checked) => updateSetting('enableLogging', checked)}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label className="text-gray-300">Send telemetry</Label>
                    <Switch
                      checked={settings.enableTelemetry}
                      onCheckedChange={(checked) => updateSetting('enableTelemetry', checked)}
                    />
                  </div>
                </div>

                <Separator className="bg-gray-700/50" />

                <div className="space-y-3">
                  <Button
                    onClick={handleSystemUpdate}
                    disabled={isUpdating}
                    className="w-full bg-green-600 hover:bg-green-700"
                  >
                    {isUpdating ? (
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Download className="w-4 h-4 mr-2" />
                    )}
                    {isUpdating ? 'Updating...' : 'Check for Updates'}
                  </Button>

                  <Button
                    onClick={handleSystemReboot}
                    variant="destructive"
                    className="w-full"
                  >
                    <Power className="w-4 h-4 mr-2" />
                    Reboot System
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Network Settings */}
        <TabsContent value="network" className="space-y-6 mt-8">
          <Card className="bg-gray-900/50 border-gray-700/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-blue-400">
                <Wifi className="w-5 h-5" />
                Network Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label className="text-gray-300 mb-2 block">WiFi Network</Label>
                <Input
                  value={settings.wifiSSID}
                  onChange={(e) => updateSetting('wifiSSID', e.target.value)}
                  placeholder="Enter WiFi network name"
                  className="bg-gray-800/50 border-gray-600/50"
                />
              </div>

              <Separator className="bg-gray-700/50" />

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-gray-300">Enable Hotspot Mode</Label>
                    <p className="text-gray-500 text-sm">Create WiFi hotspot for direct connection</p>
                  </div>
                  <Switch
                    checked={settings.enableHotspot}
                    onCheckedChange={(checked) => updateSetting('enableHotspot', checked)}
                  />
                </div>

                {settings.enableHotspot && (
                  <div>
                    <Label className="text-gray-300 mb-2 block">Hotspot Name</Label>
                    <Input
                      value={settings.hotspotName}
                      onChange={(e) => updateSetting('hotspotName', e.target.value)}
                      className="bg-gray-800/50 border-gray-600/50"
                    />
                  </div>
                )}
              </div>

              <Separator className="bg-gray-700/50" />

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-gray-300">Enable SSH Access</Label>
                    <p className="text-gray-500 text-sm">Allow remote terminal access</p>
                  </div>
                  <Switch
                    checked={settings.enableSSH}
                    onCheckedChange={(checked) => updateSetting('enableSSH', checked)}
                  />
                </div>

                {settings.enableSSH && (
                  <div>
                    <Label className="text-gray-300 mb-2 block">SSH Port</Label>
                    <Input
                      type="number"
                      value={settings.sshPort}
                      onChange={(e) => updateSetting('sshPort', parseInt(e.target.value))}
                      min={1}
                      max={65535}
                      className="bg-gray-800/50 border-gray-600/50"
                    />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Library Settings */}
        <TabsContent value="library" className="space-y-6 mt-8">
          <Card className="bg-gray-900/50 border-gray-700/50 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-blue-400">
                <Music className="w-5 h-5" />
                Library Management
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label className="text-gray-300 mb-2 block">Library Path</Label>
                <div className="flex gap-2">
                  <Input
                    value={settings.libraryPath}
                    onChange={(e) => updateSetting('libraryPath', e.target.value)}
                    className="bg-gray-800/50 border-gray-600/50 flex-1"
                  />
                  <Button variant="outline" size="icon">
                    <HardDrive className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div>
                <Label className="text-gray-300 mb-3 block">Preferred Audio Quality</Label>
                <Select
                  value={settings.preferredAudioQuality}
                  onValueChange={(value) => updateSetting('preferredAudioQuality', value)}
                >
                  <SelectTrigger className="bg-gray-800/50 border-gray-600/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low (64kbps)</SelectItem>
                    <SelectItem value="medium">Medium (128kbps)</SelectItem>
                    <SelectItem value="high">High (320kbps)</SelectItem>
                    <SelectItem value="lossless">Lossless</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Separator className="bg-gray-700/50" />

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-gray-300">Auto metadata lookup</Label>
                    <p className="text-gray-500 text-sm">Automatically enrich metadata on upload</p>
                  </div>
                  <Switch
                    checked={settings.autoMetadataLookup}
                    onCheckedChange={(checked) => updateSetting('autoMetadataLookup', checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-gray-300">Auto download album art</Label>
                    <p className="text-gray-500 text-sm">Download artwork during metadata lookup</p>
                  </div>
                  <Switch
                    checked={settings.autoDownloadAlbumArt}
                    onCheckedChange={(checked) => updateSetting('autoDownloadAlbumArt', checked)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}