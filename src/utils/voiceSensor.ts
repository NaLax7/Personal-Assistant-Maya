/**
 * Tablet Voice Sensor & Audio Characteristics Recognition
 * Analyzes pitch, room decibel level, and voice signature to build user profile.
 */

export interface VoiceAnalysisResult {
  pitchHz: number;
  pitchClassification: string;
  roomNoiseDb: number;
  speechEnergy: number;
  timbreDescription: string;
}

export interface UserProfile {
  name: string;
  voiceSampled: boolean;
  voicePitchHz: number;
  vocalRange: string;
  roomNoiseLevel: number;
  preferences: string[];
  createdAt: string;
  notes: string;
  language?: string;
}

const DEFAULT_PROFILE: UserProfile = {
  name: 'Friend',
  voiceSampled: false,
  voicePitchHz: 125,
  vocalRange: 'Warm Baritone',
  roomNoiseLevel: 36,
  preferences: ['Morning focus routine', 'Gentle reminders', 'Calm conversational style'],
  createdAt: new Date().toISOString(),
  notes: 'Tablet owner and daily companion partner.',
  language: 'auto',
};

export class VoiceSensor {
  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private micStream: MediaStream | null = null;
  private isListening: boolean = false;

  public getStoredProfile(): UserProfile {
    const raw =
      localStorage.getItem('maya_user_profile') ||
      localStorage.getItem('aura_user_profile');
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed.name === 'string') {
          return { ...DEFAULT_PROFILE, ...parsed };
        }
      } catch {
        // Fallback cleanly to defaults
      }
    }
    return DEFAULT_PROFILE;
  }

  public saveProfile(profile: UserProfile): void {
    try {
      localStorage.setItem('maya_user_profile', JSON.stringify(profile));
    } catch {
      // ignore storage quota errors
    }
  }

  public async startSensor(stream: MediaStream): Promise<void> {
    try {
      this.micStream = stream;
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      this.audioCtx = new AudioCtxClass();
      if (this.audioCtx.state === 'suspended') {
        await this.audioCtx.resume();
      }

      const source = this.audioCtx.createMediaStreamSource(stream);
      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 2048;
      source.connect(this.analyser);
      this.isListening = true;
    } catch {
      this.isListening = false;
    }
  }

  public stopSensor(): void {
    this.isListening = false;
    if (this.audioCtx) {
      this.audioCtx.close().catch(() => {});
      this.audioCtx = null;
    }
    this.analyser = null;
  }

  // Analyze voice characteristics while user is speaking
  public analyzeCurrentAudio(): VoiceAnalysisResult {
    if (!this.analyser || !this.audioCtx || !this.isListening) {
      return {
        pitchHz: 125,
        pitchClassification: 'Warm Baritone',
        roomNoiseDb: 35,
        speechEnergy: 0.1,
        timbreDescription: 'Calm & Grounded',
      };
    }

    const bufferLength = this.analyser.fftSize;
    const timeData = new Float32Array(bufferLength);
    this.analyser.getFloatTimeDomainData(timeData);

    // Compute RMS and Decibel Level
    let sumSquares = 0;
    for (let i = 0; i < bufferLength; i++) {
      sumSquares += timeData[i] * timeData[i];
    }
    const rms = Math.sqrt(sumSquares / bufferLength);
    // Estimated dB SPL scale: 20*log10(rms) + 90
    const db = Math.max(25, Math.min(95, Math.round(20 * Math.log10(rms + 1e-6) + 94)));

    // Autocorrelation Pitch Detection
    const sampleRate = this.audioCtx.sampleRate;
    const pitch = this.autoCorrelate(timeData, sampleRate);
    const validPitch = pitch > 60 && pitch < 500 ? Math.round(pitch) : 125;

    let classification = 'Warm Baritone';
    let timbre = 'Warm, grounded timbre';
    if (validPitch < 110) {
      classification = 'Deep Bass';
      timbre = 'Resonant and steady';
    } else if (validPitch < 145) {
      classification = 'Warm Baritone';
      timbre = 'Balanced and rich';
    } else if (validPitch < 185) {
      classification = 'Clear Tenor';
      timbre = 'Bright and articulate';
    } else if (validPitch < 250) {
      classification = 'Gentle Alto';
      timbre = 'Melodic and soft';
    } else {
      classification = 'Soprano';
      timbre = 'High and light';
    }

    return {
      pitchHz: validPitch,
      pitchClassification: classification,
      roomNoiseDb: db,
      speechEnergy: rms,
      timbreDescription: timbre,
    };
  }

  // Update profile from speech analysis
  public recordVoiceSample(result: VoiceAnalysisResult): UserProfile {
    const current = this.getStoredProfile();
    const updated: UserProfile = {
      ...current,
      voiceSampled: true,
      voicePitchHz: Math.round((current.voicePitchHz + result.pitchHz) / 2),
      vocalRange: result.pitchClassification,
      roomNoiseLevel: result.roomNoiseDb,
    };
    this.saveProfile(updated);
    return updated;
  }

  // Detect user's name from spoken text
  public detectNameInText(text: string): string | null {
    const namePatterns = [
      /(?:my name is|i am|call me|i'm called|this is)\s+([A-Z][a-z]+)/i,
      /(?:name's)\s+([A-Z][a-z]+)/i,
    ];

    for (const pattern of namePatterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        const potentialName = match[1].trim();
        // Ignore common filler words
        if (!['here', 'ready', 'tired', 'good', 'happy', 'back', 'just'].includes(potentialName.toLowerCase())) {
          return potentialName.charAt(0).toUpperCase() + potentialName.slice(1).toLowerCase();
        }
      }
    }
    return null;
  }

  private autoCorrelate(buffer: Float32Array, sampleRate: number): number {
    let size = buffer.length;
    let maxSamples = Math.floor(size / 2);
    let bestOffset = -1;
    let bestCorrelation = 0;
    let rms = 0;

    for (let i = 0; i < size; i++) {
      let val = buffer[i];
      rms += val * val;
    }
    rms = Math.sqrt(rms / size);
    if (rms < 0.01) return -1; // Not enough signal

    let lastCorrelation = 1;
    for (let offset = 0; offset < maxSamples; offset++) {
      let correlation = 0;
      for (let i = 0; i < maxSamples; i++) {
        correlation += Math.abs(buffer[i] - buffer[i + offset]);
      }
      correlation = 1 - correlation / maxSamples;
      if (correlation > 0.9 && correlation > lastCorrelation) {
        if (correlation > bestCorrelation) {
          bestCorrelation = correlation;
          bestOffset = offset;
        }
      }
      lastCorrelation = correlation;
    }

    if (bestCorrelation > 0.01 && bestOffset !== -1) {
      return sampleRate / bestOffset;
    }
    return -1;
  }
}

export const tabletVoiceSensor = new VoiceSensor();
