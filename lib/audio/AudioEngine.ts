/**
 * Minimal AudioEngine scaffold.
 * This class intentionally keeps nodes reusable and creates the AudioContext lazily.
 */

import { computePeaks, computeRMS } from './TrackAnalyzer';

export type EQSettings = { low: number; mid: number; high: number };

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

type FXSettings = {
  delayTime: number; // seconds
  delayFeedback: number; // 0..0.6
  lowpassCutoff: number; // Hz
  reverbWet: number; // 0..1
  wet: number; // general wet/dry mix 0..1
};

class Deck {
  id: 'A' | 'B';
  engine: AudioEngine;
  buffer: AudioBuffer | null = null;
  // analysis
  public peaks: Float32Array | null = null;
  public rms: number | null = null;
  public duration: number | null = null;

  // nodes
  private gain: GainNode | null = null;
  private dryGain: GainNode | null = null;
  private wetGain: GainNode | null = null;
  private lowEQ: BiquadFilterNode | null = null;
  private midEQ: BiquadFilterNode | null = null;
  private highEQ: BiquadFilterNode | null = null;

  // FX
  private delay: DelayNode | null = null;
  private delayFeedbackGain: GainNode | null = null;
  private fxLowpass: BiquadFilterNode | null = null;
  private convolver: ConvolverNode | null = null;

  // playback
  private source: AudioBufferSourceNode | null = null;
  private isPlaying = false;
  private position = 0; // seconds (when not playing)
  private startTime = 0; // audioCtx.currentTime when started
  private restartTimer: number | null = null;

  // looping
  private loopEnabled = false;
  private loopStart = 0;
  private loopEnd = 0;

  // settings
  private volumeVal = 1;
  private eq: EQSettings = { low: 0, mid: 0, high: 0 };
  private fx: FXSettings = { delayTime: 0.25, delayFeedback: 0.2, lowpassCutoff: 8000, reverbWet: 0, wet: 0.2 };

  constructor(engine: AudioEngine, id: 'A' | 'B') {
    this.engine = engine;
    this.id = id;
    this.initNodes();
  }

  private ensureCtx() {
    if (!this.engine.audioCtx) throw new Error('AudioContext not initialized');
    return this.engine.audioCtx;
  }

  private initNodes() {
    const ctx = this.engine.getOrCreateContext();

    this.gain = ctx.createGain();
    this.dryGain = ctx.createGain();
    this.wetGain = ctx.createGain();

    // EQ nodes
    this.lowEQ = ctx.createBiquadFilter();
    this.lowEQ.type = 'lowshelf';
    this.midEQ = ctx.createBiquadFilter();
    this.midEQ.type = 'peaking';
    this.highEQ = ctx.createBiquadFilter();
    this.highEQ.type = 'highshelf';

    // FX nodes
    this.delay = ctx.createDelay(5.0);
    this.delay.delayTime.value = this.fx.delayTime;
    this.delayFeedbackGain = ctx.createGain();
    this.delayFeedbackGain.gain.value = clamp(this.fx.delayFeedback, 0, 0.6);
    this.fxLowpass = ctx.createBiquadFilter();
    this.fxLowpass.type = 'lowpass';
    this.fxLowpass.frequency.value = this.fx.lowpassCutoff;

    // Convolver (reverb) generated impulse
    this.convolver = ctx.createConvolver();
    this.convolver.buffer = this.engine.createReverbImpulse(0.5);

    // routing: source -> EQ -> dryGain -> master
    // and source -> wetGain chain (delay -> filter -> convolver -> wetGain)

    // connect EQ chain to dry/wet
    this.lowEQ.connect(this.midEQ);
    this.midEQ.connect(this.highEQ);
    this.highEQ.connect(this.dryGain!);

    // delay feedback loop
    this.delay.connect(this.delayFeedbackGain);
    this.delayFeedbackGain.connect(this.delay);
    this.delay.connect(this.fxLowpass!);
    this.fxLowpass!.connect(this.convolver);
    this.convolver.connect(this.wetGain!);

    // final connects
    this.dryGain!.connect(this.gain!);
    this.wetGain!.connect(this.gain!);
    this.gain!.connect(this.engine.masterGain!);

    // set initial fades
    this.dryGain!.gain.value = 1 - this.fx.wet;
    this.wetGain!.gain.value = this.fx.wet;
    this.gain!.gain.value = this.volumeVal;
  }

  async loadBuffer(buffer: AudioBuffer) {
    this.buffer = buffer;
    this.position = 0;
    this.stopSourceIfAny();
    // compute peaks and RMS for UI/visuals
    try {
      this.peaks = computePeaks(buffer, 2048);
      this.rms = computeRMS(buffer);
      this.duration = buffer.duration;
    } catch (e) {
      this.peaks = null;
      this.rms = null;
      this.duration = buffer.duration || null;
    }
  }

  private stopSourceIfAny() {
    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }

    if (this.source) {
      try {
        this.source.onended = null;
        this.source.stop();
      } catch (e) {
        // ignore
      }
      this.source.disconnect();
      this.source = null;
    }
    this.isPlaying = false;
  }

  private createSource(offset = 0) {
    const ctx = this.ensureCtx();
    if (!this.buffer) return;
    // caller should manage fades; stop any existing source before creating new
    this.stopSourceIfAny();
    const src = ctx.createBufferSource();
    src.buffer = this.buffer;
    src.loop = this.loopEnabled;
    if (this.loopEnabled) {
      src.loopStart = this.loopStart;
      src.loopEnd = this.loopEnd || this.loopStart + 1;
    }
    // connect into EQ chain
    src.connect(this.lowEQ!);

    this.source = src;
  }

  private restartWithFade(offset: number, fadeMs?: number) {
    const fade = typeof fadeMs === 'number' ? fadeMs : this.engine.fadeMs;
    const ctx = this.ensureCtx();
    const now = ctx.currentTime;
    if (!this.gain) {
      this.stopSourceIfAny();
      this.createSource(offset);
      if (this.source) {
        this.startTime = ctx.currentTime - offset;
        this.source.start(0, offset);
        this.isPlaying = true;
      }
      return;
    }

    try {
      this.gain.gain.cancelScheduledValues(now);
      const cur = this.gain.gain.value;
      this.gain.gain.setValueAtTime(cur, now);
      this.gain.gain.linearRampToValueAtTime(0, now + fade);
    } catch (e) {}

    const ms = Math.max(1, Math.floor(fade * 1000));
    if (this.restartTimer) clearTimeout(this.restartTimer);
    this.restartTimer = window.setTimeout(() => {
      this.stopSourceIfAny();
      this.createSource(offset);
      if (!this.source) return;
      const nnow = this.ensureCtx().currentTime;
      try {
        this.gain!.gain.setValueAtTime(0, nnow);
      } catch (e) {}
      this.source!.start(0, offset);
      this.startTime = nnow - offset;
      this.isPlaying = true;
      try {
        this.gain!.gain.linearRampToValueAtTime(this.volumeVal, nnow + fade);
      } catch (e) {
        this.gain!.gain.setValueAtTime(this.volumeVal, nnow);
      }
      this.restartTimer = null;
    }, ms);
  }

  play() {
    const ctx = this.ensureCtx();
    if (!this.buffer) return;
    if (this.isPlaying) return;
    const startAt = this.position % this.buffer.duration;
    // normal start without fade
    this.createSource(startAt);
    if (!this.source) return;
    this.startTime = ctx.currentTime - startAt;
    try {
      // ensure gain at desired volume
      this.gain && this.gain.gain.setValueAtTime(this.volumeVal, ctx.currentTime);
      this.source.start(0, startAt);
      this.isPlaying = true;
    } catch (e) {
      console.warn('Source start error', e);
    }
  }

  pause() {
    const ctx = this.ensureCtx();
    if (!this.isPlaying) return;
    // update position
    this.position = ctx.currentTime - this.startTime;
    if (this.position < 0) this.position = 0;
    this.stopSourceIfAny();
  }

  seek(timeSec: number) {
    const ctx = this.ensureCtx();
    if (!this.buffer) return;
    const t = clamp(timeSec, 0, this.buffer.duration || timeSec);
    this.position = t;
    if (this.isPlaying) {
      // restart with micro-fade to avoid clicks
      this.restartWithFade(t);
    }
  }

  jog(deltaSec: number) {
    // small local seeking for jog/scratch feel
    if (!this.buffer) return;
    // clamp velocity so no jumps
    const maxStep = 5; // seconds per call
    const step = clamp(deltaSec, -maxStep, maxStep);
    const newPos = clamp((this.isPlaying ? this.engine.getCurrentTime(this.id) : this.position) + step, 0, this.buffer.duration);
    if (this.isPlaying) this.restartWithFade(newPos);
    else this.seek(newPos);
  }

  setVolume(v: number) {
    this.volumeVal = clamp(v, 0, 1);
    if (this.gain) this.gain.gain.setValueAtTime(this.volumeVal, this.ensureCtx().currentTime);
  }

  // called by AudioEngine.setCrossfade
  setGainValue(v: number) {
    if (this.gain) this.gain.gain.setValueAtTime(clamp(v, 0, 1), this.ensureCtx().currentTime);
    else this.volumeVal = clamp(v, 0, 1);
  }

  setEQ({ low, mid, high }: EQSettings) {
    // clamp in dB
    const l = clamp(low, -12, 12);
    const m = clamp(mid, -12, 12);
    const h = clamp(high, -12, 12);
    this.eq = { low: l, mid: m, high: h };
    if (this.lowEQ) this.lowEQ.gain.value = l;
    if (this.midEQ) {
      this.midEQ.gain.value = m;
      this.midEQ.Q.value = 1;
      this.midEQ.frequency.value = 1000;
    }
    if (this.highEQ) this.highEQ.gain.value = h;
  }

  setFX(s: Partial<FXSettings>) {
    this.fx = { ...this.fx, ...s };
    if (this.delay) this.delay.delayTime.value = clamp(this.fx.delayTime, 0, 5);
    if (this.delayFeedbackGain) this.delayFeedbackGain.gain.value = clamp(this.fx.delayFeedback, 0, 0.6);
    if (this.fxLowpass) this.fxLowpass.frequency.value = clamp(this.fx.lowpassCutoff, 40, 20000);
    if (this.wetGain) this.wetGain.gain.value = clamp(this.fx.wet, 0, 1);
    if (this.dryGain) this.dryGain.gain.value = 1 - clamp(this.fx.wet, 0, 1);
  }

  setLoop(on: boolean, lengthSec?: number) {
    this.loopEnabled = on;
    if (on) {
      const cur = this.engine.getCurrentTime(this.id);
      this.loopStart = cur;
      this.loopEnd = cur + (lengthSec || 1);
      if (this.buffer && this.loopEnd > this.buffer.duration) this.loopEnd = this.buffer.duration;
    }
    // if playing, recreate source to apply loop flags
    if (this.isPlaying) {
      const playPos = this.engine.getCurrentTime(this.id);
      this.createSource(playPos);
      if (this.source) {
        this.startTime = this.ensureCtx().currentTime - playPos;
        this.source.start(0, playPos);
      }
    }
  }

  getPosition() {
    if (!this.engine.audioCtx) return this.position;
    if (this.isPlaying) return this.engine.audioCtx.currentTime - this.startTime;
    return this.position;
  }
}

export default class AudioEngine {
  audioCtx: AudioContext | null = null;
  masterGain: GainNode | null = null;
  private decks: Record<'A' | 'B', Deck> | null = null;
  private masterAnalyser: AnalyserNode | null = null;

  // default micro-fade in seconds
  fadeMs = 0.008;

  constructor() {
    // lazy setup
  }

  getOrCreateContext() {
    if (!this.audioCtx) {
      this.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.masterGain = this.audioCtx.createGain();
      this.masterGain.gain.value = 1;
      // create analyser for master level monitoring
      this.masterAnalyser = this.audioCtx.createAnalyser();
      this.masterAnalyser.fftSize = 2048;
      this.masterAnalyser.smoothingTimeConstant = 0.3;
      // route: masterGain -> analyser -> destination
      this.masterGain.connect(this.masterAnalyser);
      this.masterAnalyser.connect(this.audioCtx.destination);
      // create decks
      this.decks = { A: new Deck(this, 'A'), B: new Deck(this, 'B') };
    }
    return this.audioCtx;
  }

  async resumeIfNeeded() {
    const ctx = this.getOrCreateContext();
    if (ctx.state === 'suspended') await ctx.resume();
  }

  async decodeFile(file: File) {
    const ctx = this.getOrCreateContext();
    const array = await file.arrayBuffer();
    return await ctx.decodeAudioData(array);
  }

  async loadDeckFromFile(deckId: 'A' | 'B', file: File) {
    const buf = await this.decodeFile(file);
    if (!this.decks) this.getOrCreateContext();
    this.decks![deckId].loadBuffer(buf);
  }

  playDeck(deckId: 'A' | 'B') {
    this.getOrCreateContext();
    this.decks![deckId].play();
  }

  pauseDeck(deckId: 'A' | 'B') {
    this.getOrCreateContext();
    this.decks![deckId].pause();
  }

  seekDeck(deckId: 'A' | 'B', seconds: number) {
    this.getOrCreateContext();
    this.decks![deckId].seek(seconds);
  }

  setDeckVolume(deckId: 'A' | 'B', v: number) {
    this.getOrCreateContext();
    this.decks![deckId].setVolume(v);
  }

  setDeckEQ(deckId: 'A' | 'B', eq: EQSettings) {
    this.getOrCreateContext();
    this.decks![deckId].setEQ(eq);
  }

  setDeckFX(deckId: 'A' | 'B', fx: Partial<FXSettings>) {
    this.getOrCreateContext();
    this.decks![deckId].setFX(fx);
  }

  setDeckLoop(deckId: 'A' | 'B', on: boolean, lengthSec?: number) {
    this.getOrCreateContext();
    this.decks![deckId].setLoop(on, lengthSec);
  }

  jogDeck(deckId: 'A' | 'B', deltaSec: number) {
    this.getOrCreateContext();
    this.decks![deckId].jog(deltaSec);
  }

  setCrossfade(x: number) {
    // equal-power crossfade: leftGain = cos(x*pi/2), rightGain = cos((1-x)*pi/2)
    if (!this.decks) return;
    const t = clamp(x, 0, 1);
    const leftGain = Math.cos(t * Math.PI * 0.5);
    const rightGain = Math.cos((1 - t) * Math.PI * 0.5);
    // use Deck API
    (this.decks.A as any).setGainValue?.(leftGain);
    (this.decks.B as any).setGainValue?.(rightGain);
  }

  getCurrentTime(deckId: 'A' | 'B') {
    if (!this.decks) return 0;
    return this.decks[deckId].getPosition();
  }

  getMasterLevel() {
    if (!this.masterAnalyser || !this.audioCtx) return 0;
    const size = this.masterAnalyser.fftSize;
    const buf = new Float32Array(size);
    try {
      this.masterAnalyser.getFloatTimeDomainData(buf);
    } catch (e) {
      return 0;
    }
    let sum = 0;
    for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
    const rms = Math.sqrt(sum / buf.length);
    // normalize roughly: typical rms max ~0.3-0.7 depending on levels; clamp to 1
    return Math.min(1, rms * 3);
  }

  getDeckInfo(deckId: 'A' | 'B') {
    if (!this.decks) return { peaks: null, rms: null, duration: null };
    const d = this.decks[deckId] as any;
    return {
      peaks: d.peaks ?? null,
      rms: d.rms ?? null,
      duration: d.duration ?? null,
      isPlaying: d.isPlaying ?? false
    };
  }

  createReverbImpulse(duration = 1, decay = 2) {
    const ctx = this.getOrCreateContext();
    const rate = ctx.sampleRate;
    const length = rate * duration;
    const impulse = ctx.createBuffer(2, length, rate);
    for (let i = 0; i < 2; i++) {
      const channel = impulse.getChannelData(i);
      for (let j = 0; j < length; j++) {
        channel[j] = (Math.random() * 2 - 1) * Math.pow(1 - j / length, decay);
      }
    }
    return impulse;
  }
}

