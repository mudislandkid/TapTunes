import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Volume2, RotateCcw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Switch } from './ui/switch';
import { Slider } from './ui/slider';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { AudioEnhancementService, EQUALIZER_PRESETS } from '../services/audioEnhancement';

interface EqualizerSettings {
  enabled: boolean;
  preset: string;
  bands: {
    frequency: number;
    gain: number;
  }[];
}

interface EqualizerProps {
  audioEnhancementService: AudioEnhancementService | null;
  onSettingsChange?: (settings: any) => void;
}

export default function Equalizer({ audioEnhancementService, onSettingsChange }: EqualizerProps) {
  const [equalizerSettings, setEqualizerSettings] = useState<EqualizerSettings>({
    enabled: false,
    preset: 'flat',
    bands: EQUALIZER_PRESETS.flat.bands.map(band => ({ ...band }))
  });

  useEffect(() => {
    if (audioEnhancementService) {
      const settings = audioEnhancementService.getSettings();
      setEqualizerSettings(settings.equalizer);
    }
  }, [audioEnhancementService]);

  const handleEnabledChange = (enabled: boolean) => {
    const newSettings = { ...equalizerSettings, enabled };
    setEqualizerSettings(newSettings);
    
    if (audioEnhancementService) {
      audioEnhancementService.setEqualizerEnabled(enabled);
    }
    
    onSettingsChange?.(newSettings);
  };

  const handlePresetChange = (presetName: string) => {
    if (!audioEnhancementService) return;
    
    const preset = EQUALIZER_PRESETS[presetName as keyof typeof EQUALIZER_PRESETS];
    if (preset) {
      const newSettings = {
        ...equalizerSettings,
        preset: presetName,
        bands: preset.bands.map(band => ({ ...band }))
      };
      
      setEqualizerSettings(newSettings);
      audioEnhancementService.setEqualizerPreset(presetName);
      onSettingsChange?.(newSettings);
    }
  };

  const handleBandChange = (bandIndex: number, gain: number) => {
    const newBands = [...equalizerSettings.bands];
    newBands[bandIndex] = { ...newBands[bandIndex], gain };
    
    const newSettings = {
      ...equalizerSettings,
      preset: 'custom',
      bands: newBands
    };
    
    setEqualizerSettings(newSettings);
    
    if (audioEnhancementService) {
      audioEnhancementService.setEqualizerBand(bandIndex, gain);
    }
    
    onSettingsChange?.(newSettings);
  };

  const resetToFlat = () => {
    handlePresetChange('flat');
  };

  const formatFrequency = (freq: number): string => {
    if (freq >= 1000) {
      return `${(freq / 1000).toFixed(freq % 1000 === 0 ? 0 : 1)}k`;
    }
    return `${freq}`;
  };

  const formatGain = (gain: number): string => {
    return `${gain > 0 ? '+' : ''}${gain.toFixed(1)}dB`;
  };

  const handleInitializeAudio = async () => {
    if (onSettingsChange) {
      // Trigger audio initialization by playing a silent sound
      try {
        // Create a temporary audio context to trigger user interaction
        const tempContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        if (tempContext.state === 'suspended') {
          await tempContext.resume();
        }
        
        // Create a very short silent audio to satisfy user interaction requirement
        const oscillator = tempContext.createOscillator();
        const gainNode = tempContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(tempContext.destination);
        
        gainNode.gain.setValueAtTime(0, tempContext.currentTime);
        oscillator.frequency.setValueAtTime(440, tempContext.currentTime);
        
        oscillator.start(tempContext.currentTime);
        oscillator.stop(tempContext.currentTime + 0.01);
        
        setTimeout(() => {
          tempContext.close();
        }, 100);
        
        // Notify parent to reinitialize the service
        onSettingsChange({ initializeAudio: true });
      } catch (error) {
        console.error('Failed to initialize audio:', error);
      }
    }
  };

  if (!audioEnhancementService) {
    return (
      <Card className="bg-gray-900/50 border-gray-700/50 backdrop-blur-sm">
        <CardContent className="p-6">
          <div className="text-center text-gray-400">
            <Volume2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p className="mb-2">Equalizer not available</p>
            <p className="text-sm mb-4">Audio enhancement service not initialized</p>
            <Button 
              onClick={handleInitializeAudio}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              Initialize Audio Enhancement
            </Button>
            <p className="text-xs text-gray-500 mt-2">
              Click to enable audio processing features
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gray-900/50 border-gray-700/50 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-blue-400">
          <div className="flex items-center gap-2">
            <Volume2 className="w-5 h-5" />
            Equalizer
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={resetToFlat}
              className="border-gray-600/50 text-gray-300 hover:bg-gray-600/20"
            >
              <RotateCcw className="w-3 h-3 mr-1" />
              Reset
            </Button>
            <Switch
              checked={equalizerSettings.enabled}
              onCheckedChange={handleEnabledChange}
            />
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Preset Selection */}
        <div>
          <Label className="text-gray-300 mb-2 block">Preset</Label>
          <Select
            value={equalizerSettings.preset}
            onValueChange={handlePresetChange}
            disabled={!equalizerSettings.enabled}
          >
            <SelectTrigger className="bg-gray-800/50 border-gray-600/50">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(EQUALIZER_PRESETS).map(([key, preset]) => (
                <SelectItem key={key} value={key}>
                  {preset.name}
                </SelectItem>
              ))}
              {equalizerSettings.preset === 'custom' && (
                <SelectItem value="custom">Custom</SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>

        {/* Equalizer Bands */}
        <div className="space-y-4">
          <Label className="text-gray-300">Frequency Bands</Label>
          
          <div className="grid grid-cols-5 gap-3 lg:grid-cols-10">
            {equalizerSettings.bands.map((band, index) => (
              <motion.div
                key={`${band.frequency}-${index}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="flex flex-col items-center space-y-2"
              >
                {/* Frequency Label */}
                <Label className="text-xs text-gray-400 text-center min-h-[2rem] flex items-center">
                  {formatFrequency(band.frequency)}Hz
                </Label>
                
                {/* Vertical Slider */}
                <div className="h-32 flex items-center">
                  <Slider
                    orientation="vertical"
                    value={[band.gain]}
                    onValueChange={([value]) => handleBandChange(index, value)}
                    min={-12}
                    max={12}
                    step={0.5}
                    disabled={!equalizerSettings.enabled}
                    className="h-full"
                  />
                </div>
                
                {/* Gain Value */}
                <Label className="text-xs text-gray-400 text-center min-h-[1rem]">
                  {formatGain(band.gain)}
                </Label>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Frequency Response Visualization */}
        <div className="bg-gray-800/30 rounded-lg p-4">
          <Label className="text-gray-300 mb-2 block text-sm">Frequency Response</Label>
          <div className="h-16 relative">
            <svg
              width="100%"
              height="100%"
              viewBox="0 0 400 64"
              className="border border-gray-600/30 rounded bg-gray-900/30"
            >
              {/* Grid lines */}
              <defs>
                <pattern id="grid" width="40" height="16" patternUnits="userSpaceOnUse">
                  <path d="M 40 0 L 0 0 0 16" fill="none" stroke="#374151" strokeWidth="0.5" opacity="0.3"/>
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#grid)" />
              
              {/* Zero line */}
              <line x1="0" y1="32" x2="400" y2="32" stroke="#6B7280" strokeWidth="1" opacity="0.5" />
              
              {/* Frequency response curve */}
              <polyline
                points={equalizerSettings.bands.map((band, index) => {
                  const x = (index / (equalizerSettings.bands.length - 1)) * 400;
                  const y = 32 - (band.gain / 12) * 24; // Scale gain to fit in 48px height
                  return `${x},${y}`;
                }).join(' ')}
                fill="none"
                stroke={equalizerSettings.enabled ? "#3B82F6" : "#6B7280"}
                strokeWidth="2"
                opacity={equalizerSettings.enabled ? 0.8 : 0.4}
              />
              
              {/* Data points */}
              {equalizerSettings.bands.map((band, index) => {
                const x = (index / (equalizerSettings.bands.length - 1)) * 400;
                const y = 32 - (band.gain / 12) * 24;
                return (
                  <circle
                    key={index}
                    cx={x}
                    cy={y}
                    r="2"
                    fill={equalizerSettings.enabled ? "#3B82F6" : "#6B7280"}
                    opacity={equalizerSettings.enabled ? 1 : 0.5}
                  />
                );
              })}
            </svg>
          </div>
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>60Hz</span>
            <span>1kHz</span>
            <span>16kHz</span>
          </div>
        </div>

        {!equalizerSettings.enabled && (
          <div className="text-center text-gray-500 text-sm">
            Enable equalizer to adjust frequency bands
          </div>
        )}
      </CardContent>
    </Card>
  );
}