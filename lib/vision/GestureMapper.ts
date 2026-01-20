/**
 * GestureMapper
 * - provides calibration capture for finger Y ranges
 * - EMA smoothing for live values
 * - localStorage persistence under `gesturedj:calibration`
 * - hold detection (300ms) for gestures
 */

import { clamp } from '../utils/clamp';

export type FingerRanges = {
  thumb: { min: number; max: number } | null;
  index: { min: number; max: number } | null;
  middle: { min: number; max: number } | null;
  ring: { min: number; max: number } | null;
};

export type Calibration = {
  sampleCount: number;
  ranges: FingerRanges;
  timestamp: number;
};

const STORAGE_KEY = 'gesturedj:calibration';

export default class GestureMapper {
  private calibration: Calibration | null = null;
  private smoothingAlpha = 0.15; // EMA alpha
  private lastSmoothed: Record<string, number> = {};
  private holdTimers: Record<string, number | null> = {};
  private lastAssigned: Record<number, 'A' | 'B' | null> = {};

  // hysteresis thresholds for assignment
  private leftThresh = 0.45;
  private rightThresh = 0.55;

  constructor() {
    this.load();
  }

  startCalibration() {
    // reset running capture state
    const ranges: FingerRanges = { thumb: null, index: null, middle: null, ring: null };
    this.calibration = { sampleCount: 0, ranges, timestamp: Date.now() };
  }

  absorbSample(landmarks: Array<{ x: number; y: number; z?: number }>) {
    if (!this.calibration) return;
    // landmarks expected in MediaPipe order; use finger tips: thumb=4,index=8,middle=12,ring=16
    const mapping = { thumb: 4, index: 8, middle: 12, ring: 16 } as Record<string, number>;
    const keys: Array<keyof FingerRanges> = ['thumb', 'index', 'middle', 'ring'];

    keys.forEach((k) => {
      const idx = mapping[k];
      const lm = landmarks[idx];
      if (!lm) return;
      const v = lm.y; // normalized [0,1] top-left origin
      const prev = this.calibration!.ranges[k];
      if (!prev) {
        this.calibration!.ranges[k] = { min: v, max: v };
      } else {
        prev.min = Math.min(prev.min, v);
        prev.max = Math.max(prev.max, v);
      }
    });

    this.calibration.sampleCount += 1;
  }

  finishCalibration() {
    if (!this.calibration) return null;
    this.calibration.timestamp = Date.now();
    const out = this.calibration;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(out));
    } catch (e) {}
    this.calibration = null;
    return out;
  }

  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        this.calibration = JSON.parse(raw) as Calibration;
      }
    } catch (e) {
      this.calibration = null;
    }
  }

  getCalibration(): Calibration | null {
    return this.calibration;
  }

  getSaved(): Calibration | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as Calibration;
    } catch (e) {
      return null;
    }
  }

  // map a finger Y value using calibration to a 0..1 control (0=top,1=bottom) with smoothing
  mapFingerY(finger: 'thumb' | 'index' | 'middle' | 'ring', y: number) {
    const saved = this.getSaved();
    const key = `${finger}`;
    let mapped = 0.5;
    if (saved && saved.ranges && saved.ranges[finger]) {
      const r = saved.ranges[finger] as { min: number; max: number };
      // invert Y so that top (small y) is 1.0 if desired; we'll map 0..1 between min and max
      const t = r.max === r.min ? 0.5 : (y - r.min) / (r.max - r.min);
      mapped = clamp(1 - t, 0, 1); // invert so higher hand = larger control
    } else {
      mapped = clamp(1 - y, 0, 1);
    }

    const prev = this.lastSmoothed[key] ?? mapped;
    const sm = prev + this.smoothingAlpha * (mapped - prev);
    this.lastSmoothed[key] = sm;
    return sm;
  }

  // hold detection: call when condition starts/continues, returns true when held for >= ms
  checkHold(id: string, condition: boolean, ms = 300) {
    if (condition) {
      if (!this.holdTimers[id]) {
        this.holdTimers[id] = Date.now();
        return false;
      } else {
        const started = this.holdTimers[id] as number;
        return Date.now() - started >= ms;
      }
    } else {
      this.holdTimers[id] = null;
      return false;
    }
  }

  resetHolds() {
    this.holdTimers = {};
  }

  // Decide deck assignment for a hand (centroid x). Uses hysteresis and previous assignment.
  private decideDeckForHand(handIndex: number, centroidX: number) {
    const prev = this.lastAssigned[handIndex] ?? null;
    if (centroidX <= this.leftThresh) {
      this.lastAssigned[handIndex] = 'A';
      return 'A';
    }
    if (centroidX >= this.rightThresh) {
      this.lastAssigned[handIndex] = 'B';
      return 'B';
    }
    // in middle zone, keep previous if exists, otherwise choose nearest
    if (prev) return prev;
    return centroidX < 0.5 ? 'A' : 'B';
  }

  // Auto-calibrate if no saved calibration exists (uses reasonable defaults)
  ensureCalibration() {
    if (this.getSaved()) return;
    // fallback calibration: assume fingers span from ~0.3 (top) to ~0.8 (bottom)
    const fallback: Calibration = {
      sampleCount: 1,
      ranges: {
        thumb: { min: 0.3, max: 0.8 },
        index: { min: 0.3, max: 0.8 },
        middle: { min: 0.3, max: 0.8 },
        ring: { min: 0.3, max: 0.8 },
      },
      timestamp: Date.now(),
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(fallback));
    } catch (e) {}
  }

  // Map detected hands to deck controls. Returns controls for decks A and B.
  mapHandsToControls(hands: Array<Array<{ x: number; y: number; z?: number }>>, handedness?: any) {
    const controls: Record<'A' | 'B', { assigned: boolean; volume: number; eq: { low: number; mid: number; high: number }; scrubDelta: number }> = {
      A: { assigned: false, volume: 0.5, eq: { low: 0, mid: 0, high: 0 }, scrubDelta: 0 },
      B: { assigned: false, volume: 0.5, eq: { low: 0, mid: 0, high: 0 }, scrubDelta: 0 },
    };

    hands.forEach((landmarks, i) => {
      if (!landmarks || landmarks.length === 0) return;
      // compute centroid x
      const centroidX = landmarks.reduce((s, p) => s + p.x, 0) / landmarks.length;
      const deck = this.decideDeckForHand(i, centroidX);

      // finger tip indices
      const idx = landmarks[8];
      const mid = landmarks[12];
      const ring = landmarks[16];
      const thumb = landmarks[4];

      const volume = idx ? this.mapFingerY('index', idx.y) : 0.5;
      // map other fingers to EQ gains (-12..+12 dB)
      const high = thumb ? (this.mapFingerY('thumb', thumb.y) * 2 - 1) * 12 : 0;
      const low = mid ? (this.mapFingerY('middle', mid.y) * 2 - 1) * 12 : 0;
      const midG = ring ? (this.mapFingerY('ring', ring.y) * 2 - 1) * 12 : 0;

      controls[deck].assigned = true;
      controls[deck].volume = volume;
      controls[deck].eq = { low, mid: midG, high };
      // scrubDelta placeholder (requires palm rotation calc) — left as 0 for now
      controls[deck].scrubDelta = 0;
    });

    return controls;
  }
}
