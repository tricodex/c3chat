import { useState, useEffect } from "react";
import { Mic, MicOff, Volume2, VolumeX, Settings, Play, Pause } from "lucide-react";
import { useVoiceInput, useVoiceOutput, useVoiceSettings } from "../lib/voice-service";
import { toast } from "sonner";

interface VoiceControlsProps {
  onTranscript: (text: string) => void;
  currentMessage?: string;
  className?: string;
}

export function VoiceControls({ onTranscript, currentMessage, className = '' }: VoiceControlsProps) {
  const [showSettings, setShowSettings] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const {
    isListening,
    transcript,
    error: voiceError,
    startListening,
    stopListening,
    canUseVoice,
  } = useVoiceInput((text, isFinal) => {
    if (isFinal) {
      onTranscript(text);
      setIsProcessing(false);
    } else {
      setIsProcessing(true);
    }
  });

  const {
    isSpeaking,
    isPaused,
    speak,
    stop: stopSpeaking,
    pause,
    resume,
    canUseVoice: canSpeak,
  } = useVoiceOutput();

  const { settings, voices, updateSettings } = useVoiceSettings();

  useEffect(() => {
    if (voiceError) {
      toast.error(`Voice error: ${voiceError}`);
    }
  }, [voiceError]);

  // Auto-speak new messages if enabled
  useEffect(() => {
    if (settings.autoSpeak && currentMessage && !isSpeaking) {
      // Extract only the latest assistant message
      const messages = currentMessage.split('\n\n');
      const lastMessage = messages[messages.length - 1];
      if (lastMessage && !lastMessage.startsWith('You:')) {
        speak(lastMessage);
      }
    }
  }, [currentMessage, settings.autoSpeak, isSpeaking, speak]);

  const handleVoiceToggle = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const handleSpeakToggle = () => {
    if (isSpeaking) {
      if (isPaused) {
        resume();
      } else {
        pause();
      }
    } else if (currentMessage) {
      speak(currentMessage);
    }
  };

  if (!canUseVoice && !canSpeak) {
    return null;
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* Voice Input Button */}
      {canUseVoice && (
        <button
          onClick={handleVoiceToggle}
          className={`p-2 rounded-lg transition-all ${
            isListening 
              ? 'bg-red-500 text-white animate-pulse' 
              : 'bg-[var(--c3-surface-secondary)] hover:bg-[var(--c3-surface-hover)] text-[var(--c3-text-secondary)]'
          }`}
          title={isListening ? 'Stop recording' : 'Start voice input'}
        >
          {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
        </button>
      )}

      {/* Voice Output Controls */}
      {canSpeak && currentMessage && (
        <button
          onClick={handleSpeakToggle}
          className={`p-2 rounded-lg transition-all ${
            isSpeaking 
              ? 'bg-[var(--c3-primary)] text-white' 
              : 'bg-[var(--c3-surface-secondary)] hover:bg-[var(--c3-surface-hover)] text-[var(--c3-text-secondary)]'
          }`}
          title={isSpeaking ? (isPaused ? 'Resume' : 'Pause') : 'Read aloud'}
        >
          {isSpeaking ? (
            isPaused ? <Play className="w-5 h-5" /> : <Pause className="w-5 h-5" />
          ) : (
            <Volume2 className="w-5 h-5" />
          )}
        </button>
      )}

      {/* Stop Speaking */}
      {isSpeaking && (
        <button
          onClick={stopSpeaking}
          className="p-2 rounded-lg bg-[var(--c3-surface-secondary)] hover:bg-[var(--c3-surface-hover)] text-[var(--c3-text-secondary)]"
          title="Stop speaking"
        >
          <VolumeX className="w-5 h-5" />
        </button>
      )}

      {/* Voice Settings */}
      <button
        onClick={() => setShowSettings(!showSettings)}
        className="p-2 rounded-lg bg-[var(--c3-surface-secondary)] hover:bg-[var(--c3-surface-hover)] text-[var(--c3-text-secondary)]"
        title="Voice settings"
      >
        <Settings className="w-5 h-5" />
      </button>

      {/* Processing Indicator */}
      {isProcessing && (
        <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-[var(--c3-primary)]/10 text-[var(--c3-primary)] text-sm">
          <div className="flex gap-1">
            <div className="w-1 h-1 bg-current rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-1 h-1 bg-current rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-1 h-1 bg-current rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
          <span>Listening...</span>
        </div>
      )}

      {/* Transcript Preview */}
      {transcript && !isProcessing && (
        <div className="flex-1 px-3 py-1 rounded-lg bg-[var(--c3-surface-secondary)] text-[var(--c3-text-secondary)] text-sm italic">
          "{transcript}"
        </div>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowSettings(false)}
          />
          <div className="absolute bottom-full right-0 mb-2 w-80 rounded-xl bg-[var(--c3-surface-primary)] border border-[var(--c3-border)] shadow-xl z-50">
            <div className="p-4 border-b border-[var(--c3-border-subtle)]">
              <h3 className="text-sm font-semibold text-[var(--c3-text-primary)]">
                Voice Settings
              </h3>
            </div>

            <div className="p-4 space-y-4">
              {/* Language Selection */}
              <div>
                <label className="text-xs text-[var(--c3-text-secondary)] mb-1 block">
                  Language
                </label>
                <select
                  value={settings.language}
                  onChange={(e) => updateSettings({ language: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-[var(--c3-surface-secondary)] border border-[var(--c3-border-subtle)] text-sm"
                >
                  <option value="en-US">English (US)</option>
                  <option value="en-GB">English (UK)</option>
                  <option value="es-ES">Spanish</option>
                  <option value="fr-FR">French</option>
                  <option value="de-DE">German</option>
                  <option value="it-IT">Italian</option>
                  <option value="pt-BR">Portuguese (Brazil)</option>
                  <option value="ru-RU">Russian</option>
                  <option value="zh-CN">Chinese (Simplified)</option>
                  <option value="ja-JP">Japanese</option>
                  <option value="ko-KR">Korean</option>
                </select>
              </div>

              {/* Voice Selection */}
              {voices.length > 0 && (
                <div>
                  <label className="text-xs text-[var(--c3-text-secondary)] mb-1 block">
                    Voice
                  </label>
                  <select
                    value={settings.voice}
                    onChange={(e) => updateSettings({ voice: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-[var(--c3-surface-secondary)] border border-[var(--c3-border-subtle)] text-sm"
                  >
                    <option value="">Default</option>
                    {voices
                      .filter(v => v.lang.startsWith(settings.language.split('-')[0]))
                      .map(voice => (
                        <option key={voice.name} value={voice.name}>
                          {voice.name} {voice.localService ? '(Local)' : '(Online)'}
                        </option>
                      ))}
                  </select>
                </div>
              )}

              {/* Speech Rate */}
              <div>
                <label className="text-xs text-[var(--c3-text-secondary)] mb-1 block">
                  Speed: {settings.rate}x
                </label>
                <input
                  type="range"
                  min="0.5"
                  max="2"
                  step="0.1"
                  value={settings.rate}
                  onChange={(e) => updateSettings({ rate: parseFloat(e.target.value) })}
                  className="w-full"
                />
              </div>

              {/* Pitch */}
              <div>
                <label className="text-xs text-[var(--c3-text-secondary)] mb-1 block">
                  Pitch: {settings.pitch}
                </label>
                <input
                  type="range"
                  min="0.5"
                  max="2"
                  step="0.1"
                  value={settings.pitch}
                  onChange={(e) => updateSettings({ pitch: parseFloat(e.target.value) })}
                  className="w-full"
                />
              </div>

              {/* Volume */}
              <div>
                <label className="text-xs text-[var(--c3-text-secondary)] mb-1 block">
                  Volume: {Math.round(settings.volume * 100)}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={settings.volume}
                  onChange={(e) => updateSettings({ volume: parseFloat(e.target.value) })}
                  className="w-full"
                />
              </div>

              {/* Auto-speak Toggle */}
              <div className="flex items-center justify-between">
                <label className="text-sm text-[var(--c3-text-primary)]">
                  Auto-speak responses
                </label>
                <button
                  onClick={() => updateSettings({ autoSpeak: !settings.autoSpeak })}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    settings.autoSpeak ? 'bg-[var(--c3-primary)]' : 'bg-[var(--c3-surface-tertiary)]'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      settings.autoSpeak ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* Test Voice Button */}
              <button
                onClick={() => speak('Hello! This is a test of the voice settings.')}
                className="w-full px-4 py-2 rounded-lg bg-[var(--c3-primary)] text-white text-sm font-medium hover:opacity-90 transition-opacity"
              >
                Test Voice
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
