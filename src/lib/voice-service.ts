/**
 * Voice Input/Output System for C3Chat
 * 
 * Provides speech-to-text and text-to-speech capabilities
 * for a more natural conversation experience
 */

interface VoiceSettings {
  enabled: boolean;
  language: string;
  voice: string;
  rate: number;
  pitch: number;
  volume: number;
  autoSpeak: boolean;
}

class VoiceService {
  private recognition: any;
  private synthesis: SpeechSynthesis;
  private isListening: boolean = false;
  private voices: SpeechSynthesisVoice[] = [];
  private settings: VoiceSettings;

  constructor() {
    // Initialize speech synthesis
    this.synthesis = window.speechSynthesis;
    
    // Initialize speech recognition
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = false;
      this.recognition.interimResults = true;
      this.recognition.lang = 'en-US';
    }

    // Load voices
    this.loadVoices();
    
    // Default settings
    this.settings = {
      enabled: true,
      language: 'en-US',
      voice: '',
      rate: 1.0,
      pitch: 1.0,
      volume: 1.0,
      autoSpeak: false,
    };

    // Load saved settings
    const savedSettings = localStorage.getItem('c3chat_voice_settings');
    if (savedSettings) {
      this.settings = { ...this.settings, ...JSON.parse(savedSettings) };
    }
  }

  private loadVoices() {
    this.voices = this.synthesis.getVoices();
    
    // Chrome loads voices asynchronously
    if (this.voices.length === 0) {
      this.synthesis.addEventListener('voiceschanged', () => {
        this.voices = this.synthesis.getVoices();
      });
    }
  }

  public getAvailableVoices(): SpeechSynthesisVoice[] {
    return this.voices;
  }

  public getVoicesByLanguage(lang: string): SpeechSynthesisVoice[] {
    return this.voices.filter(voice => voice.lang.startsWith(lang));
  }

  public updateSettings(settings: Partial<VoiceSettings>) {
    this.settings = { ...this.settings, ...settings };
    localStorage.setItem('c3chat_voice_settings', JSON.stringify(this.settings));
    
    if (this.recognition && settings.language) {
      this.recognition.lang = settings.language;
    }
  }

  public getSettings(): VoiceSettings {
    return this.settings;
  }

  public startListening(
    onResult: (transcript: string, isFinal: boolean) => void,
    onError: (error: any) => void
  ): void {
    if (!this.recognition) {
      onError(new Error('Speech recognition not supported'));
      return;
    }

    if (this.isListening) {
      return;
    }

    this.isListening = true;
    
    this.recognition.onresult = (event: any) => {
      const last = event.results.length - 1;
      const transcript = event.results[last][0].transcript;
      const isFinal = event.results[last].isFinal;
      
      onResult(transcript, isFinal);
    };

    this.recognition.onerror = (event: any) => {
      this.isListening = false;
      onError(event.error);
    };

    this.recognition.onend = () => {
      this.isListening = false;
    };

    try {
      this.recognition.start();
    } catch (error) {
      this.isListening = false;
      onError(error);
    }
  }

  public stopListening(): void {
    if (this.recognition && this.isListening) {
      this.recognition.stop();
      this.isListening = false;
    }
  }

  public isCurrentlyListening(): boolean {
    return this.isListening;
  }

  public speak(
    text: string,
    onEnd?: () => void,
    onError?: (error: any) => void
  ): void {
    if (!this.settings.enabled) {
      return;
    }

    // Cancel any ongoing speech
    this.synthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    
    // Apply settings
    utterance.lang = this.settings.language;
    utterance.rate = this.settings.rate;
    utterance.pitch = this.settings.pitch;
    utterance.volume = this.settings.volume;
    
    // Set voice if specified
    if (this.settings.voice) {
      const selectedVoice = this.voices.find(v => v.name === this.settings.voice);
      if (selectedVoice) {
        utterance.voice = selectedVoice;
      }
    }

    utterance.onend = () => {
      if (onEnd) onEnd();
    };

    utterance.onerror = (event) => {
      if (onError) onError(event);
    };

    this.synthesis.speak(utterance);
  }

  public stopSpeaking(): void {
    this.synthesis.cancel();
  }

  public isSpeaking(): boolean {
    return this.synthesis.speaking;
  }

  public pauseSpeaking(): void {
    this.synthesis.pause();
  }

  public resumeSpeaking(): void {
    this.synthesis.resume();
  }

  public isPaused(): boolean {
    return this.synthesis.paused;
  }

  public canUseSpeechRecognition(): boolean {
    return !!this.recognition;
  }

  public canUseSpeechSynthesis(): boolean {
    return 'speechSynthesis' in window;
  }
}

// Create singleton instance
export const voiceService = new VoiceService();

// React hooks for voice functionality
import { useState, useCallback, useEffect } from 'react';

export function useVoiceInput(
  onTranscript: (text: string, isFinal: boolean) => void
) {
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState('');

  const startListening = useCallback(() => {
    setError(null);
    setTranscript('');
    
    voiceService.startListening(
      (text, isFinal) => {
        setTranscript(text);
        onTranscript(text, isFinal);
      },
      (err) => {
        setError(err.message || 'Speech recognition error');
        setIsListening(false);
      }
    );
    
    setIsListening(true);
  }, [onTranscript]);

  const stopListening = useCallback(() => {
    voiceService.stopListening();
    setIsListening(false);
  }, []);

  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  useEffect(() => {
    return () => {
      voiceService.stopListening();
    };
  }, []);

  return {
    isListening,
    transcript,
    error,
    startListening,
    stopListening,
    toggleListening,
    canUseVoice: voiceService.canUseSpeechRecognition(),
  };
}

export function useVoiceOutput() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const speak = useCallback((text: string) => {
    setError(null);
    setIsSpeaking(true);
    setIsPaused(false);
    
    voiceService.speak(
      text,
      () => {
        setIsSpeaking(false);
        setIsPaused(false);
      },
      (err) => {
        setError(err.message || 'Speech synthesis error');
        setIsSpeaking(false);
        setIsPaused(false);
      }
    );
  }, []);

  const stop = useCallback(() => {
    voiceService.stopSpeaking();
    setIsSpeaking(false);
    setIsPaused(false);
  }, []);

  const pause = useCallback(() => {
    voiceService.pauseSpeaking();
    setIsPaused(true);
  }, []);

  const resume = useCallback(() => {
    voiceService.resumeSpeaking();
    setIsPaused(false);
  }, []);

  useEffect(() => {
    return () => {
      voiceService.stopSpeaking();
    };
  }, []);

  return {
    isSpeaking,
    isPaused,
    error,
    speak,
    stop,
    pause,
    resume,
    canUseVoice: voiceService.canUseSpeechSynthesis(),
  };
}

export function useVoiceSettings() {
  const [settings, setSettingsState] = useState(voiceService.getSettings());
  const [voices, setVoices] = useState(voiceService.getAvailableVoices());

  useEffect(() => {
    // Load voices when they become available
    const loadVoices = () => {
      const availableVoices = voiceService.getAvailableVoices();
      setVoices(availableVoices);
    };

    loadVoices();
    
    // Chrome loads voices asynchronously
    window.speechSynthesis?.addEventListener('voiceschanged', loadVoices);
    
    return () => {
      window.speechSynthesis?.removeEventListener('voiceschanged', loadVoices);
    };
  }, []);

  const updateSettings = useCallback((newSettings: Partial<VoiceSettings>) => {
    voiceService.updateSettings(newSettings);
    setSettingsState(voiceService.getSettings());
  }, []);

  return {
    settings,
    voices,
    updateSettings,
    getVoicesByLanguage: voiceService.getVoicesByLanguage.bind(voiceService),
  };
}
