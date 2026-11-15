/**
 * Audio Hardware & Speech Manager
 * Supports Gemini AI Neural Human Voice (via /api/tts),
 * single shared microphone stream, real-time VU visualizer,
 * Web Speech API recognition, Web Audio chimes, and fallback SpeechSynthesis.
 */

export type MicStatus = 'idle' | 'requesting' | 'active' | 'denied' | 'unsupported';
export type SpeechState = 'idle' | 'listening' | 'recognizing' | 'speaking';

export interface AudioFrequencyData {
  db: number;
  rms: number;
  isVoice: boolean;
  bands: number[]; // 16 normalized frequency bands (0-100)
}

class AudioHardwareManager {
  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private outputAnalyser: AnalyserNode | null = null;
  private currentBufferSource: AudioBufferSourceNode | null = null;
  private micStream: MediaStream | null = null;
  private micStatus: MicStatus = 'idle';
  private micStatusListeners: Set<(status: MicStatus) => void> = new Set();
  private audioDataListeners: Set<(data: AudioFrequencyData) => void> = new Set();
  private voiceDetectedListeners: Set<() => void> = new Set();
  private transcriptListeners: Set<(text: string, isFinal: boolean) => void> = new Set();
  private speechStateListeners: Set<(state: SpeechState) => void> = new Set();

  private recognition: any = null;
  private isRecognitionRunning = false;
  private isSpeaking = false;
  private activeUtterance: SpeechSynthesisUtterance | null = null;
  private currentAudioElement: HTMLAudioElement | null = null;
  private speechKeepAliveInterval: any = null;
  private monitorAnimationId: number | null = null;
  private currentLanguage = 'en-US';
  private handsFreeEnabled = true;
  private cachedVoices: SpeechSynthesisVoice[] = [];
  private speakSeqId = 0;

  constructor() {
    this.setupGlobalUnlock();
    this.initVoices();
    this.startAudioMonitoring();
  }

  // Preload and cache speech synthesis voices across browser life-cycle
  private initVoices() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.cachedVoices = window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () => {
        this.cachedVoices = window.speechSynthesis.getVoices();
      };
    }
  }

  // Attach global unlock listener so first user interaction unlocks AudioContext and Speech
  private setupGlobalUnlock() {
    if (typeof window === 'undefined') return;

    const unlock = () => {
      this.unlockAudioContext();
      if ('speechSynthesis' in window) {
        try {
          window.speechSynthesis.resume();
        } catch {
          // ignore
        }
      }
    };

    window.addEventListener('pointerdown', unlock, { once: false });
    window.addEventListener('keydown', unlock, { once: false });
    window.addEventListener('touchstart', unlock, { once: false });
  }

  public getMicStatus(): MicStatus {
    return this.micStatus;
  }

  public subscribeMicStatus(listener: (status: MicStatus) => void): () => void {
    this.micStatusListeners.add(listener);
    listener(this.micStatus);
    return () => this.micStatusListeners.delete(listener);
  }

  public subscribeAudioData(listener: (data: AudioFrequencyData) => void): () => void {
    this.audioDataListeners.add(listener);
    return () => this.audioDataListeners.delete(listener);
  }

  public subscribeVoiceDetected(listener: () => void): () => void {
    this.voiceDetectedListeners.add(listener);
    return () => this.voiceDetectedListeners.delete(listener);
  }

  public subscribeTranscript(listener: (text: string, isFinal: boolean) => void): () => void {
    this.transcriptListeners.add(listener);
    return () => this.transcriptListeners.delete(listener);
  }

  public subscribeSpeechState(listener: (state: SpeechState) => void): () => void {
    this.speechStateListeners.add(listener);
    return () => this.speechStateListeners.delete(listener);
  }

  private setMicStatus(status: MicStatus) {
    this.micStatus = status;
    this.micStatusListeners.forEach((l) => l(status));
  }

  private setSpeechState(state: SpeechState) {
    this.speechStateListeners.forEach((l) => l(state));
  }

  public setLanguage(lang: string) {
    const nextLang = lang || 'en-US';
    const changed = nextLang !== this.currentLanguage;
    this.currentLanguage = nextLang;
    if (changed && this.isRecognitionRunning) {
      // Restart SpeechRecognition so Android/Chrome picks up the new language immediately (e.g., sl-SI)
      this.stopRecognition();
      if (this.handsFreeEnabled && this.micStatus === 'active' && !this.isSpeaking) {
        setTimeout(() => this.startRecognition(), 180);
      }
    }
  }

  private getRecognitionLang(): string {
    if (this.currentLanguage && this.currentLanguage !== 'auto') {
      return this.currentLanguage;
    }
    return navigator.language || 'en-US';
  }

  public setHandsFree(enabled: boolean) {
    this.handsFreeEnabled = enabled;
    if (!enabled && this.isRecognitionRunning) {
      this.stopRecognition();
    } else if (enabled && !this.isRecognitionRunning && !this.isSpeaking) {
      this.startRecognition();
    }
  }

  public unlockAudioContext(): AudioContext | null {
    try {
      if (!this.audioCtx) {
        const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtxClass) {
          this.audioCtx = new AudioCtxClass();
        }
      }
      if (this.audioCtx && this.audioCtx.state === 'suspended') {
        this.audioCtx.resume().catch(() => {});
      }
      if (this.audioCtx && !this.outputAnalyser) {
        this.outputAnalyser = this.audioCtx.createAnalyser();
        this.outputAnalyser.fftSize = 256;
        this.outputAnalyser.smoothingTimeConstant = 0.72;
        this.outputAnalyser.connect(this.audioCtx.destination);
      }
      return this.audioCtx;
    } catch {
      return null;
    }
  }

  // Request & Start Microphone Stream (Shared singleton)
  public async requestMicrophone(): Promise<boolean> {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      this.setMicStatus('unsupported');
      return false;
    }

    if (this.micStream && this.micStream.active && this.micStatus === 'active') {
      return true;
    }

    this.setMicStatus('requesting');

    try {
      this.unlockAudioContext();

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: false,
          autoGainControl: true,
        },
      });

      this.micStream = stream;

      if (!this.audioCtx) {
        this.unlockAudioContext();
      }

      if (this.audioCtx) {
        const source = this.audioCtx.createMediaStreamSource(stream);
        this.analyser = this.audioCtx.createAnalyser();
        this.analyser.fftSize = 256;
        this.analyser.smoothingTimeConstant = 0.6;
        source.connect(this.analyser);
      }

      this.setMicStatus('active');
      this.startAudioMonitoring();

      if (this.handsFreeEnabled) {
        this.startRecognition();
      }

      return true;
    } catch (err: any) {
      this.setMicStatus('denied');
      return false;
    }
  }

  // Continuous Audio VU Level & Frequency Bands Monitoring
  // Handles real output audio from Maya when speaking AND input from microphone when listening
  private startAudioMonitoring() {
    if (this.monitorAnimationId) {
      cancelAnimationFrame(this.monitorAnimationId);
      this.monitorAnimationId = null;
    }

    const freqData = new Uint8Array(128);
    let lastNotify = 0;

    const monitorLoop = (timestamp: number) => {
      // Refresh ~30 times per second for smooth, organic visualizer animation
      if (timestamp - lastNotify > 32) {
        lastNotify = timestamp;

        let activeAnalyser: AnalyserNode | null = null;
        if (this.isSpeaking && this.outputAnalyser) {
          activeAnalyser = this.outputAnalyser;
        } else if (this.micStatus === 'active' && this.analyser) {
          activeAnalyser = this.analyser;
        }

        const bandCount = 16;
        const bands: number[] = [];
        let totalEnergy = 0;
        let db = 28;
        let rms = 0.04;
        let isVoice = false;

        if (activeAnalyser) {
          activeAnalyser.getByteFrequencyData(freqData);
          const binStep = Math.max(1, Math.floor(freqData.length / bandCount));

          for (let b = 0; b < bandCount; b++) {
            let sum = 0;
            const start = b * binStep;
            const end = Math.min(start + binStep, freqData.length);
            for (let i = start; i < end; i++) {
              sum += freqData[i];
            }
            const avg = end > start ? sum / (end - start) : 0;
            totalEnergy += avg;
            bands.push(Math.round((avg / 255) * 100));
          }

          const overallAvg = totalEnergy / bandCount;
          rms = Math.min(1, Math.max(0, overallAvg / 180));
          db = Math.round(28 + rms * 64);
          isVoice = this.isSpeaking || (db >= 38 && overallAvg > 12);
        } else if (this.isSpeaking) {
          // Dynamic harmonic vocal cadence simulation for fallback speech synthesis
          const t = timestamp * 0.006;
          const syllableSwell = Math.max(0, Math.sin(t * 1.7) * Math.cos(t * 0.8) + 0.3);
          rms = Math.min(1, 0.2 + 0.65 * syllableSwell);
          db = Math.round(44 + rms * 38);
          isVoice = true;

          for (let b = 0; b < bandCount; b++) {
            const formant = Math.sin(((b + 1) / (bandCount + 1)) * Math.PI);
            const ripple = Math.sin(t * 3.5 + b * 0.8) * 18;
            const level = Math.max(10, Math.min(100, Math.round(formant * rms * 95 + ripple)));
            bands.push(level);
          }
        } else {
          // Ambient quiet baseline with organic gentle micro-undulation
          for (let b = 0; b < bandCount; b++) {
            const ambient = Math.max(4, Math.round(Math.sin(timestamp * 0.002 + b * 0.4) * 3 + 8));
            bands.push(ambient);
          }
          db = 30;
          rms = 0.05;
          isVoice = false;
        }

        const data: AudioFrequencyData = {
          db,
          rms,
          isVoice,
          bands,
        };

        this.audioDataListeners.forEach((l) => l(data));

        if (isVoice && !this.isSpeaking) {
          this.voiceDetectedListeners.forEach((l) => l());
        }
      }

      this.monitorAnimationId = requestAnimationFrame(monitorLoop);
    };

    this.monitorAnimationId = requestAnimationFrame(monitorLoop);
  }

  // Web Speech API Continuous Recognition
  public startRecognition() {
    if (typeof window === 'undefined' || this.isRecognitionRunning || this.isSpeaking) return;
    // Guard: Only start recognition when microphone permission is active and granted
    if (this.micStatus !== 'active') return;

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      return;
    }

    try {
      if (this.recognition) {
        try {
          this.recognition.abort();
        } catch {
          // ignore
        }
      }

      const rec = new SpeechRecognition();
      rec.continuous = true;
      rec.interimResults = true;
      rec.maxAlternatives = 1;
      rec.lang = this.getRecognitionLang();

      rec.onstart = () => {
        this.isRecognitionRunning = true;
        this.setSpeechState('listening');
      };

      rec.onresult = (event: any) => {
        if (this.isSpeaking) return;

        const current = event.resultIndex;
        if (!event.results[current]) return;

        const resultText = event.results[current][0].transcript;
        const isFinal = event.results[current].isFinal;

        this.setSpeechState('recognizing');
        this.transcriptListeners.forEach((l) => l(resultText, isFinal));
      };

      rec.onerror = (event: any) => {
        this.isRecognitionRunning = false;

        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          this.setMicStatus('denied');
          return;
        }

        if (event.error === 'aborted') {
          return;
        }

        // Silent auto-recover on Android no-speech / network flutter ONLY if mic is truly active
        if (this.micStatus === 'active' && this.handsFreeEnabled && !this.isSpeaking) {
          setTimeout(() => {
            if (this.micStatus === 'active' && this.handsFreeEnabled && !this.isSpeaking && !this.isRecognitionRunning) {
              this.startRecognition();
            }
          }, event.error === 'no-speech' ? 400 : 1000);
        }
      };

      rec.onend = () => {
        this.isRecognitionRunning = false;
        this.setSpeechState(this.isSpeaking ? 'speaking' : 'idle');

        // Immediately keep listening hands-free when not speaking ONLY if mic is truly active
        if (this.micStatus === 'active' && this.handsFreeEnabled && !this.isSpeaking) {
          setTimeout(() => {
            if (this.micStatus === 'active' && this.handsFreeEnabled && !this.isSpeaking && !this.isRecognitionRunning) {
              this.startRecognition();
            }
          }, 350);
        }
      };

      this.recognition = rec;
      rec.start();
    } catch {
      this.isRecognitionRunning = false;
    }
  }

  public stopRecognition() {
    this.isRecognitionRunning = false;
    if (this.recognition) {
      try {
        this.recognition.abort();
      } catch {
        // ignore
      }
      this.recognition = null;
    }
    this.setSpeechState(this.isSpeaking ? 'speaking' : 'idle');
  }

  // Pleasant Web Audio Chimes
  public playAcousticChime(type: 'wake' | 'test' | 'confirm' | 'dismiss') {
    try {
      const ctx = this.unlockAudioContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      const gain = ctx.createGain();
      gain.connect(ctx.destination);

      if (type === 'test') {
        const notes = [523.25, 659.25, 783.99];
        notes.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const noteGain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now + idx * 0.1);
          noteGain.gain.setValueAtTime(0.09, now + idx * 0.1);
          noteGain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.1 + 0.35);
          osc.connect(noteGain);
          noteGain.connect(gain);
          osc.start(now + idx * 0.1);
          osc.stop(now + idx * 0.1 + 0.35);
        });
      } else if (type === 'wake') {
        [523.25, 659.25].forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const noteGain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now + i * 0.08);
          noteGain.gain.setValueAtTime(0.08, now + i * 0.08);
          noteGain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.3);
          osc.connect(noteGain);
          noteGain.connect(gain);
          osc.start(now + i * 0.08);
          osc.stop(now + i * 0.08 + 0.3);
        });
      } else if (type === 'confirm') {
        const osc = ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(659.25, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.15);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
        osc.connect(gain);
        osc.start(now);
        osc.stop(now + 0.3);
      } else {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(330, now + 0.2);
        gain.gain.setValueAtTime(0.06, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
        osc.connect(gain);
        osc.start(now);
        osc.stop(now + 0.25);
      }
    } catch (e) {
      console.warn('Audio chime error:', e);
    }
  }

  // Primary: Lifelike Human AI Voice Generation (Gemini Neural TTS)
  // Calls /api/tts to produce real human sound, falling back to tuned native synthesis if offline
  public async speakHuman(
    text: string,
    langHint?: string,
    onStart?: () => void,
    onEnd?: () => void
  ): Promise<boolean> {
    this.stopSpeaking();
    this.stopRecognition();
    this.unlockAudioContext();
    const requestSeq = ++this.speakSeqId;

    const cleanText = text
      .replace(/```action[\s\S]*?```/g, '')
      .replace(/[*#_~`\[\]]/g, '')
      .trim();

    if (!cleanText) {
      if (onEnd) onEnd();
      return false;
    }

    try {
      // Step 1: Request natural human speech audio from Gemini 3.8 Flash TTS
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: cleanText,
          lang: langHint || this.currentLanguage,
          voice: 'Kore',
        }),
      });

      if (requestSeq !== this.speakSeqId) {
        return false;
      }

      if (res.ok) {
        const data = await res.json();
        if (requestSeq !== this.speakSeqId) {
          return false;
        }
        if (data.success && data.audio) {
          const ctx = this.unlockAudioContext();

          // Try pristine Web Audio API decoding so outputAnalyser gets true live amplitude
          if (ctx) {
            try {
              const binaryString = window.atob(data.audio);
              const len = binaryString.length;
              const bytes = new Uint8Array(len);
              for (let i = 0; i < len; i++) {
                bytes[i] = binaryString.charCodeAt(i);
              }

              const audioBuffer = await ctx.decodeAudioData(bytes.buffer.slice(0));
              if (requestSeq !== this.speakSeqId) {
                return false;
              }

              if (!this.outputAnalyser) {
                this.outputAnalyser = ctx.createAnalyser();
                this.outputAnalyser.fftSize = 256;
                this.outputAnalyser.smoothingTimeConstant = 0.72;
                this.outputAnalyser.connect(ctx.destination);
              }

              const sourceNode = ctx.createBufferSource();
              sourceNode.buffer = audioBuffer;
              sourceNode.connect(this.outputAnalyser);

              this.currentBufferSource = sourceNode;
              this.isSpeaking = true;
              this.setSpeechState('speaking');
              if (onStart) onStart();

              sourceNode.onended = () => {
                if (this.currentBufferSource === sourceNode) {
                  this.currentBufferSource = null;
                }
                this.isSpeaking = false;
                this.setSpeechState('idle');
                if (onEnd) onEnd();
                if (this.handsFreeEnabled && this.micStatus === 'active') {
                  setTimeout(() => this.startRecognition(), 250);
                }
              };

              sourceNode.start(0);
              return true;
            } catch {
              // Gracefully fall back to HTMLAudio without logging warning
            }
          }

          // HTMLAudio fallback if decodeAudioData encounters an issue
          const audioSrc = `data:${data.mimeType || 'audio/wav'};base64,${data.audio}`;
          const audio = new Audio(audioSrc);
          this.currentAudioElement = audio;

          this.isSpeaking = true;
          this.setSpeechState('speaking');
          if (onStart) onStart();

          audio.onended = () => {
            this.isSpeaking = false;
            this.currentAudioElement = null;
            this.setSpeechState('idle');
            if (onEnd) onEnd();
            if (this.handsFreeEnabled && this.micStatus === 'active') {
              setTimeout(() => this.startRecognition(), 250);
            }
          };

          audio.onerror = () => {
            this.currentAudioElement = null;
            this.speakFallback(cleanText, langHint, onStart, onEnd);
          };

          try {
            await audio.play();
            return true;
          } catch {
            this.currentAudioElement = null;
            return this.speakFallback(cleanText, langHint, onStart, onEnd);
          }
        }
      }
    } catch {
      // Graceful fallback to client device speech synthesis
    }

    // Step 2: Fallback to device speech synthesis
    return this.speakFallback(cleanText, langHint, onStart, onEnd);
  }

  // Fallback: Tuned Device SpeechSynthesis with Natural Voice selection
  private speakFallback(
    cleanText: string,
    langHint?: string,
    onStart?: () => void,
    onEnd?: () => void
  ): boolean {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      this.playAcousticChime('confirm');
      if (onEnd) onEnd();
      return false;
    }

    const synth = window.speechSynthesis;

    try {
      synth.cancel();
      if (synth.paused) {
        synth.resume();
      }
    } catch {
      // ignore
    }

    const utterance = new SpeechSynthesisUtterance(cleanText);
    this.activeUtterance = utterance;

    let targetLang = langHint || (this.currentLanguage !== 'auto' ? this.currentLanguage : 'en-US');
    if (/[čšžđć]|danes|jutri|vreme|opravil|nalog|urnik|kako|kaj|hvala|prosim|živjo|zdravo|lep|slišim|lahko|vesela|sem|si|maja|novic/i.test(cleanText)) {
      targetLang = 'sl-SI';
    } else if (/[äöüß]|guten|morgen|wetter|aufgabe|schön|danke|bitte|heute/i.test(cleanText)) {
      targetLang = 'de-DE';
    } else if (/¿|¡|hola|gracias|tiempo|tarea|buenos/i.test(cleanText)) {
      targetLang = 'es-ES';
    } else if (/bonjour|merci|temps|tâche|bonne/i.test(cleanText)) {
      targetLang = 'fr-FR';
    } else if (/ciao|grazie|tempo|compito|buongiorno/i.test(cleanText)) {
      targetLang = 'it-IT';
    }

    utterance.lang = targetLang;

    if (!this.cachedVoices || this.cachedVoices.length === 0) {
      this.cachedVoices = synth.getVoices();
    }

    const chosenVoice = this.selectVoiceForLanguage(targetLang, this.cachedVoices);
    if (chosenVoice) {
      utterance.voice = chosenVoice;
    }

    utterance.pitch = 1.0;
    utterance.rate = 0.98;
    utterance.volume = 1.0;

    const cleanup = () => {
      if (this.speechKeepAliveInterval) {
        clearInterval(this.speechKeepAliveInterval);
        this.speechKeepAliveInterval = null;
      }
      this.isSpeaking = false;
      this.activeUtterance = null;
      this.setSpeechState('idle');
      if (onEnd) onEnd();

      if (this.handsFreeEnabled) {
        setTimeout(() => {
          this.startRecognition();
        }, 250);
      }
    };

    utterance.onstart = () => {
      this.isSpeaking = true;
      this.setSpeechState('speaking');
      if (onStart) onStart();

      if (this.speechKeepAliveInterval) clearInterval(this.speechKeepAliveInterval);
      this.speechKeepAliveInterval = setInterval(() => {
        if (synth.speaking && synth.paused) {
          synth.resume();
        }
      }, 250);
    };

    utterance.onend = cleanup;
    utterance.onerror = cleanup;

    synth.speak(utterance);
    return true;
  }

  private selectVoiceForLanguage(targetLang: string, allVoices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
    if (!allVoices || allVoices.length === 0) return null;

    const langCode = targetLang.toLowerCase();
    const primaryCode = langCode.split('-')[0];

    // Always keep consistent female voice persona (Maya)
    const femaleVoiceRegex = /female|woman|samantha|karen|victoria|zira|nina|anna|clara|helena|petra|mojca|alva|fiona|natural.*female|google.*female/i;

    const exactLangVoices = allVoices.filter(
      (v) => v.lang.toLowerCase() === langCode || v.lang.toLowerCase().replace('_', '-') === langCode
    );
    const exactFemale = exactLangVoices.find((v) => femaleVoiceRegex.test(v.name));
    if (exactFemale) return exactFemale;

    const prefixLangVoices = allVoices.filter((v) => v.lang.toLowerCase().startsWith(primaryCode));
    const prefixFemale = prefixLangVoices.find((v) => femaleVoiceRegex.test(v.name));
    if (prefixFemale) return prefixFemale;

    // Slavic fallback if Slovenian
    if (primaryCode === 'sl') {
      const slavicVoice = allVoices.find(
        (v) => (v.lang.toLowerCase().startsWith('hr') || v.lang.toLowerCase().startsWith('sr')) && femaleVoiceRegex.test(v.name)
      );
      if (slavicVoice) return slavicVoice;
    }

    // High quality English female voice fallback
    const enFemale = allVoices.find((v) => v.lang.toLowerCase().startsWith('en') && femaleVoiceRegex.test(v.name));
    if (enFemale) return enFemale;

    return exactLangVoices[0] || prefixLangVoices[0] || allVoices.find((v) => femaleVoiceRegex.test(v.name)) || allVoices[0] || null;
  }

  public stopSpeaking() {
    this.speakSeqId++;
    if (this.currentBufferSource) {
      try {
        this.currentBufferSource.stop();
        this.currentBufferSource.disconnect();
      } catch {
        // ignore
      }
      this.currentBufferSource = null;
    }

    if (this.currentAudioElement) {
      try {
        this.currentAudioElement.pause();
        this.currentAudioElement.currentTime = 0;
      } catch {
        // ignore
      }
      this.currentAudioElement = null;
    }

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // ignore
      }
    }
    if (this.speechKeepAliveInterval) {
      clearInterval(this.speechKeepAliveInterval);
      this.speechKeepAliveInterval = null;
    }
    this.isSpeaking = false;
    this.activeUtterance = null;
    this.setSpeechState('idle');

    if (this.handsFreeEnabled) {
      setTimeout(() => {
        this.startRecognition();
      }, 200);
    }
  }

  public isCurrentlySpeaking(): boolean {
    return this.isSpeaking;
  }
}

export const audioManager = new AudioHardwareManager();
