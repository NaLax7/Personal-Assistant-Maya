/**
 * Real-Time Gemini Live API Client (gemini-3.8-live)
 * Streams 16kHz PCM mic audio to /live WebSocket and plays 24kHz PCM audio output seamlessly.
 */

export type LiveConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface LiveVoiceCallbacks {
  onStateChange?: (state: LiveConnectionState) => void;
  onInputTranscript?: (text: string) => void;
  onOutputTranscript?: (text: string) => void;
  onTurnComplete?: () => void;
  onSpeakingChange?: (speaking: boolean) => void;
  onAudioAmplitude?: (rms: number, bands: number[], db: number) => void;
  onError?: (message: string) => void;
}

function float32ToInt16Base64(float32: Float32Array, inputSampleRate = 16000): string {
  const targetRate = 16000;
  let samples = float32;

  if (inputSampleRate > 0 && Math.abs(inputSampleRate - targetRate) > 100) {
    const ratio = inputSampleRate / targetRate;
    const newLength = Math.max(1, Math.round(float32.length / ratio));
    const resampled = new Float32Array(newLength);
    for (let i = 0; i < newLength; i++) {
      const srcIdx = i * ratio;
      const idx0 = Math.floor(srcIdx);
      const idx1 = Math.min(float32.length - 1, idx0 + 1);
      const frac = srcIdx - idx0;
      resampled[i] = float32[idx0] * (1 - frac) + float32[idx1] * frac;
    }
    samples = resampled;
  }

  const int16 = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  const bytes = new Uint8Array(int16.buffer);
  let binary = '';
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const slice = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
    binary += String.fromCharCode(...slice);
  }
  return window.btoa(binary);
}

function base64ToInt16Array(base64: string): Int16Array {
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Int16Array(bytes.buffer);
}

class LiveVoiceClient {
  private ws: WebSocket | null = null;
  private inputAudioCtx: AudioContext | null = null;
  private outputAudioCtx: AudioContext | null = null;
  private outputAnalyser: AnalyserNode | null = null;
  private micStream: MediaStream | null = null;
  private processor: ScriptProcessorNode | null = null;
  private muteGainNode: GainNode | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private activeSources: Set<AudioBufferSourceNode> = new Set();
  private nextStartTime = 0;
  private state: LiveConnectionState = 'disconnected';
  private callbacks: LiveVoiceCallbacks = {};
  private rafId: number | null = null;
  private freqBuffer = new Uint8Array(128);

  public getState(): LiveConnectionState {
    return this.state;
  }

  private setState(next: LiveConnectionState) {
    this.state = next;
    this.callbacks.onStateChange?.(next);
  }

  public sendText(text: string): boolean {
    const trimmed = text.trim();
    if (!trimmed || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return false;
    }
    this.ws.send(JSON.stringify({ text: trimmed }));
    return true;
  }

  public async connect(
    params: { userName: string; lang: string; mode?: string; city?: string; weather?: string },
    callbacks: LiveVoiceCallbacks
  ): Promise<boolean> {
    if (this.state === 'connected' || this.state === 'connecting') {
      return true;
    }

    this.callbacks = callbacks;
    this.setState('connecting');

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Microphone requires HTTPS or localhost in this browser.');
      }

      // Request microphone stream with echo cancellation
      this.micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
        },
      });

      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      this.inputAudioCtx = new AudioCtxClass({ sampleRate: 16000 });
      this.outputAudioCtx = new AudioCtxClass({ sampleRate: 24000 });

      if (this.inputAudioCtx.state === 'suspended') {
        await this.inputAudioCtx.resume();
      }
      if (this.outputAudioCtx.state === 'suspended') {
        await this.outputAudioCtx.resume();
      }

      this.outputAnalyser = this.outputAudioCtx.createAnalyser();
      this.outputAnalyser.fftSize = 256;
      this.outputAnalyser.smoothingTimeConstant = 0.72;
      this.outputAnalyser.connect(this.outputAudioCtx.destination);

      this.nextStartTime = this.outputAudioCtx.currentTime;

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const query = new URLSearchParams({
        name: params.userName || 'Friend',
        lang: params.lang || 'auto',
        mode: params.mode || 'standard',
      });
      if (params.city) query.set('city', params.city);
      if (params.weather) query.set('weather', params.weather);

      const ws = new WebSocket(`${protocol}//${window.location.host}/live?${query.toString()}`);
      this.ws = ws;
      let didOpen = false;
      let sessionReady = false;

      ws.onopen = () => {
        didOpen = true;
        this.startAmplitudeLoop();
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.ready) {
            if (!sessionReady) {
              sessionReady = true;
              this.startMicStreaming();
            }
            this.setState('connected');
          }
          if (msg.audio) {
            this.enqueueOutputAudio(msg.audio);
          }
          if (msg.inputTranscript) {
            this.callbacks.onInputTranscript?.(msg.inputTranscript);
          }
          if (msg.outputTranscript) {
            this.callbacks.onOutputTranscript?.(msg.outputTranscript);
          }
          if (msg.turnComplete) {
            this.callbacks.onTurnComplete?.();
          }
          if (msg.interrupted) {
            this.clearOutputQueue();
          }
          if (msg.error) {
            this.callbacks.onError?.(msg.error);
          }
        } catch {
          // ignore invalid frame
        }
      };

      ws.onerror = () => {
        this.callbacks.onError?.(
          didOpen ? 'Live voice connection interrupted.' : 'Could not open Live Voice WebSocket.'
        );
        this.disconnect();
      };

      ws.onclose = () => {
        this.disconnect();
      };

      return true;
    } catch (err: any) {
      this.callbacks.onError?.(err?.message || 'Microphone access needed for Live Voice');
      this.setState('error');
      this.disconnect();
      return false;
    }
  }

  private startMicStreaming() {
    if (!this.inputAudioCtx || !this.micStream || !this.ws) return;

    this.sourceNode = this.inputAudioCtx.createMediaStreamSource(this.micStream);
    this.processor = this.inputAudioCtx.createScriptProcessor(4096, 1, 1);
    // Zero-gain node keeps ScriptProcessor active without looping mic audio back to speakers
    this.muteGainNode = this.inputAudioCtx.createGain();
    this.muteGainNode.gain.value = 0;

    this.sourceNode.connect(this.processor);
    this.processor.connect(this.muteGainNode);
    this.muteGainNode.connect(this.inputAudioCtx.destination);

    const actualRate = this.inputAudioCtx.sampleRate || 16000;

    this.processor.onaudioprocess = (e) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
      const channelData = e.inputBuffer.getChannelData(0);
      const base64 = float32ToInt16Base64(channelData, actualRate);
      this.ws.send(JSON.stringify({ audio: base64 }));
    };
  }

  private enqueueOutputAudio(base64Pcm: string) {
    if (!this.outputAudioCtx || !this.outputAnalyser) return;

    const int16 = base64ToInt16Array(base64Pcm);
    if (int16.length === 0) return;

    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) {
      float32[i] = int16[i] / 32768;
    }

    const buffer = this.outputAudioCtx.createBuffer(1, float32.length, 24000);
    buffer.copyToChannel(float32, 0);

    const source = this.outputAudioCtx.createBufferSource();
    source.buffer = buffer;
    source.connect(this.outputAnalyser);

    const now = this.outputAudioCtx.currentTime;
    if (this.nextStartTime < now) {
      this.nextStartTime = now + 0.02;
    }

    this.activeSources.add(source);
    this.callbacks.onSpeakingChange?.(true);

    source.onended = () => {
      this.activeSources.delete(source);
      if (this.activeSources.size === 0) {
        this.callbacks.onSpeakingChange?.(false);
      }
    };

    source.start(this.nextStartTime);
    this.nextStartTime += buffer.duration;
  }

  private clearOutputQueue() {
    this.activeSources.forEach((src) => {
      try {
        src.stop();
        src.disconnect();
      } catch {
        // ignore
      }
    });
    this.activeSources.clear();
    if (this.outputAudioCtx) {
      this.nextStartTime = this.outputAudioCtx.currentTime;
    }
    this.callbacks.onSpeakingChange?.(false);
  }

  private startAmplitudeLoop() {
    if (this.rafId) cancelAnimationFrame(this.rafId);

    const loop = () => {
      if (this.outputAnalyser && this.activeSources.size > 0) {
        this.outputAnalyser.getByteFrequencyData(this.freqBuffer);
        const bandCount = 16;
        const step = Math.max(1, Math.floor(this.freqBuffer.length / bandCount));
        const bands: number[] = [];
        let total = 0;
        for (let b = 0; b < bandCount; b++) {
          let sum = 0;
          for (let i = b * step; i < (b + 1) * step && i < this.freqBuffer.length; i++) {
            sum += this.freqBuffer[i];
          }
          const avg = sum / step;
          total += avg;
          bands.push(Math.round((avg / 255) * 100));
        }
        const rms = Math.min(1, total / bandCount / 160);
        const db = Math.round(36 + rms * 52);
        this.callbacks.onAudioAmplitude?.(rms, bands, db);
      }
      this.rafId = requestAnimationFrame(loop);
    };

    this.rafId = requestAnimationFrame(loop);
  }

  public disconnect() {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    this.clearOutputQueue();

    if (this.processor) {
      try {
        this.processor.disconnect();
      } catch {
        // ignore
      }
      this.processor = null;
    }

    if (this.muteGainNode) {
      try {
        this.muteGainNode.disconnect();
      } catch {
        // ignore
      }
      this.muteGainNode = null;
    }

    if (this.sourceNode) {
      try {
        this.sourceNode.disconnect();
      } catch {
        // ignore
      }
      this.sourceNode = null;
    }

    if (this.micStream) {
      this.micStream.getTracks().forEach((t) => t.stop());
      this.micStream = null;
    }

    if (this.inputAudioCtx) {
      this.inputAudioCtx.close().catch(() => {});
      this.inputAudioCtx = null;
    }

    if (this.outputAudioCtx) {
      this.outputAudioCtx.close().catch(() => {});
      this.outputAudioCtx = null;
    }

    this.outputAnalyser = null;

    if (this.ws) {
      try {
        this.ws.close();
      } catch {
        // ignore
      }
      this.ws = null;
    }

    this.callbacks.onSpeakingChange?.(false);
    if (this.state !== 'disconnected') {
      this.setState('disconnected');
    }
  }
}

export const liveVoiceClient = new LiveVoiceClient();
