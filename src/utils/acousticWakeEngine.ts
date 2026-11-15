/**
 * Acoustic Voice Presence & Wake Engine
 * Integrates with audioManager to detect human voice/sound presence
 * and coordinate screen wake and sleep cycles.
 */

import { audioManager, AudioFrequencyData } from './audioHardwareManager';

export class AcousticWakeEngine {
  private isRunning: boolean = false;
  private onVoiceDetectedCallback: (() => void) | null = null;
  private onSoundLevelCallback: ((db: number, isVoice: boolean) => void) | null = null;
  private sensitivityThresholdDb: number = 42;
  private unsubscribeAudio: (() => void) | null = null;
  private unsubscribeVoice: (() => void) | null = null;

  public isEnabled(): boolean {
    return this.isRunning;
  }

  public setSensitivity(db: number) {
    this.sensitivityThresholdDb = Math.max(30, Math.min(75, db));
  }

  public async start(
    onVoiceDetected: () => void,
    onSoundLevel?: (db: number, isVoice: boolean) => void,
    requestMicImmediately: boolean = false
  ): Promise<boolean> {
    this.onVoiceDetectedCallback = onVoiceDetected;
    this.onSoundLevelCallback = onSoundLevel || null;
    this.isRunning = true;

    // Listen to unified audio data
    if (this.unsubscribeAudio) this.unsubscribeAudio();
    if (this.unsubscribeVoice) this.unsubscribeVoice();

    this.unsubscribeAudio = audioManager.subscribeAudioData((data: AudioFrequencyData) => {
      if (!this.isRunning) return;
      const isSpeechVoice = data.db >= this.sensitivityThresholdDb && data.isVoice;
      if (this.onSoundLevelCallback) {
        this.onSoundLevelCallback(data.db, isSpeechVoice);
      }
    });

    this.unsubscribeVoice = audioManager.subscribeVoiceDetected(() => {
      if (!this.isRunning) return;
      if (this.onVoiceDetectedCallback) {
        this.onVoiceDetectedCallback();
      }
    });

    // Only request microphone if explicitly instructed or already permitted
    if (requestMicImmediately && audioManager.getMicStatus() === 'idle') {
      return await audioManager.requestMicrophone();
    }
    return audioManager.getMicStatus() === 'active';
  }

  public stop() {
    this.isRunning = false;
    if (this.unsubscribeAudio) {
      this.unsubscribeAudio();
      this.unsubscribeAudio = null;
    }
    if (this.unsubscribeVoice) {
      this.unsubscribeVoice();
      this.unsubscribeVoice = null;
    }
  }
}

export const acousticWakeEngine = new AcousticWakeEngine();
