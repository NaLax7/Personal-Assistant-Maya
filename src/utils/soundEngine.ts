/**
 * Web Audio Ambient Sound Generator
 * Generates continuous soothing soundscapes locally without external media dependencies.
 */

class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  public analyser: AnalyserNode | null = null;
  private currentTrack: string | null = null;
  private activeNodes: (AudioNode | number)[] = [];
  private isMuted: boolean = false;
  private volumeLevel: number = 0.5;

  private initContext() {
    if (!this.ctx) {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioContextClass();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.volumeLevel, this.ctx.currentTime);

      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 64;

      this.masterGain.connect(this.analyser);
      this.analyser.connect(this.ctx.destination);
    }

    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public setVolume(val: number) {
    this.volumeLevel = Math.max(0, Math.min(1, val));
    if (this.masterGain && this.ctx && !this.isMuted) {
      this.masterGain.gain.setTargetAtTime(this.volumeLevel, this.ctx.currentTime, 0.05);
    }
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (this.masterGain && this.ctx) {
      const target = this.isMuted ? 0 : this.volumeLevel;
      this.masterGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.05);
    }
    return this.isMuted;
  }

  public stop() {
    this.activeNodes.forEach((node) => {
      if (typeof node === 'number') {
        window.clearInterval(node);
      } else {
        try {
          if ('stop' in node && typeof (node as AudioScheduledSourceNode).stop === 'function') {
            (node as AudioScheduledSourceNode).stop();
          }
          node.disconnect();
        } catch {
          // already stopped
        }
      }
    });
    this.activeNodes = [];
    this.currentTrack = null;
  }

  public play(trackId: 'lofi' | 'rain' | 'forest' | 'whitenoise' | 'fireplace') {
    this.initContext();
    if (!this.ctx || !this.masterGain) return;

    if (this.currentTrack === trackId) {
      return;
    }

    this.stop();
    this.currentTrack = trackId;

    switch (trackId) {
      case 'rain':
        this.playRain();
        break;
      case 'fireplace':
        this.playFireplace();
        break;
      case 'whitenoise':
        this.playBrownNoise();
        break;
      case 'forest':
        this.playForest();
        break;
      case 'lofi':
      default:
        this.playLofiChords();
        break;
    }
  }

  private playBrownNoise() {
    if (!this.ctx || !this.masterGain) return;
    const bufferSize = this.ctx.sampleRate * 2;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    let lastOut = 0.0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      output[i] = (lastOut + 0.02 * white) / 1.02;
      lastOut = output[i];
      output[i] *= 2.5; // Gain compensation
    }

    const whiteNoise = this.ctx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;
    whiteNoise.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 400;

    whiteNoise.connect(filter);
    filter.connect(this.masterGain);
    whiteNoise.start();

    this.activeNodes.push(whiteNoise, filter);
  }

  private playRain() {
    if (!this.ctx || !this.masterGain) return;
    const bufferSize = this.ctx.sampleRate * 2;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      output[i] = (b0 + b1 + b2) * 0.3;
    }

    const rainSource = this.ctx.createBufferSource();
    rainSource.buffer = noiseBuffer;
    rainSource.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 900;

    rainSource.connect(filter);
    filter.connect(this.masterGain);
    rainSource.start();

    this.activeNodes.push(rainSource, filter);
  }

  private playFireplace() {
    if (!this.ctx || !this.masterGain) return;
    // Base low rumble
    const bufferSize = this.ctx.sampleRate * 2;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    let lastOut = 0.0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      output[i] = (lastOut + 0.015 * white) / 1.015;
      lastOut = output[i];
    }
    const rumble = this.ctx.createBufferSource();
    rumble.buffer = noiseBuffer;
    rumble.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 250;

    const rumbleGain = this.ctx.createGain();
    rumbleGain.gain.value = 1.2;

    rumble.connect(filter);
    filter.connect(rumbleGain);
    rumbleGain.connect(this.masterGain);
    rumble.start();

    this.activeNodes.push(rumble, filter, rumbleGain);

    // Crackle pops
    const interval = window.setInterval(() => {
      if (!this.ctx || !this.masterGain) return;
      if (Math.random() > 0.4) {
        const pop = this.ctx.createOscillator();
        const popGain = this.ctx.createGain();
        pop.type = 'triangle';
        pop.frequency.setValueAtTime(300 + Math.random() * 800, this.ctx.currentTime);
        pop.frequency.exponentialRampToValueAtTime(80, this.ctx.currentTime + 0.04);

        popGain.gain.setValueAtTime(0.08 + Math.random() * 0.1, this.ctx.currentTime);
        popGain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.05);

        pop.connect(popGain);
        popGain.connect(this.masterGain);
        pop.start();
        pop.stop(this.ctx.currentTime + 0.06);
      }
    }, 180);

    this.activeNodes.push(interval);
  }

  private playForest() {
    if (!this.ctx || !this.masterGain) return;
    // Gentle wind breeze
    const bufferSize = this.ctx.sampleRate * 2;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = (Math.random() * 2 - 1) * 0.1;
    }
    const wind = this.ctx.createBufferSource();
    wind.buffer = noiseBuffer;
    wind.loop = true;

    const windFilter = this.ctx.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.value = 500;
    windFilter.Q.value = 1.2;

    wind.connect(windFilter);
    windFilter.connect(this.masterGain);
    wind.start();
    this.activeNodes.push(wind, windFilter);

    // Soft bird chimes
    const interval = window.setInterval(() => {
      if (!this.ctx || !this.masterGain) return;
      if (Math.random() > 0.6) {
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        const baseFreq = [1800, 2100, 2400, 2700][Math.floor(Math.random() * 4)];
        osc.type = 'sine';
        osc.frequency.setValueAtTime(baseFreq, this.ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(baseFreq + 200, this.ctx.currentTime + 0.1);
        osc.frequency.linearRampToValueAtTime(baseFreq - 100, this.ctx.currentTime + 0.2);

        g.gain.setValueAtTime(0.03, this.ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.25);

        osc.connect(g);
        g.connect(this.masterGain);
        osc.start();
        osc.stop(this.ctx.currentTime + 0.28);
      }
    }, 1200);

    this.activeNodes.push(interval);
  }

  private playLofiChords() {
    if (!this.ctx || !this.masterGain) return;
    // Ambient evolving Rhodes/Lofi pad
    const chords = [
      [261.63, 329.63, 392.00, 493.88], // Cmaj7
      [220.00, 261.63, 329.63, 392.00], // Am7
      [174.61, 220.00, 261.63, 329.63], // Fmaj7
      [196.00, 246.94, 293.66, 349.23], // G7
    ];
    let chordIdx = 0;

    const playChordStep = () => {
      if (!this.ctx || !this.masterGain || this.currentTrack !== 'lofi') return;
      const notes = chords[chordIdx % chords.length];
      chordIdx++;

      notes.forEach((freq) => {
        if (!this.ctx || !this.masterGain) return;
        const osc = this.ctx.createOscillator();
        const filter = this.ctx.createBiquadFilter();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.value = freq;

        filter.type = 'lowpass';
        filter.frequency.value = 600;

        const now = this.ctx.currentTime;
        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(0.06, now + 1.5);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 4.8);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);

        osc.start(now);
        osc.stop(now + 5.0);
      });
    };

    playChordStep();
    const interval = window.setInterval(playChordStep, 4500);
    this.activeNodes.push(interval);
  }
}

export const ambientSoundEngine = new SoundEngine();
