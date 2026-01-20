/**
 * Minimal MediaPipe Hands wrapper scaffold.
 * Actual model loading will be done client-side and dynamically.
 */

export type HandLandmarks = Array<{ x: number; y: number; z?: number }>;

export default class HandTracker {
  private running = false;
  private hands: any = null;
  private rafId: number | null = null;
  private videoEl?: HTMLVideoElement;
  private onResultsCb?: (hands: HandLandmarks[], handedness?: any) => void;
  private fpsLimit = 30;
  private lastProcessTime = 0;

  constructor() {}

  async start(video: HTMLVideoElement, onResults?: (hands: HandLandmarks[], handedness?: any) => void, options?: {
    maxNumHands?: number;
    modelComplexity?: number;
    minDetectionConfidence?: number;
    minTrackingConfidence?: number;
  }) {
    if (this.running) return;
    this.videoEl = video;
    this.onResultsCb = onResults;

    const { Hands } = await import('@mediapipe/hands');

    this.hands = new Hands({
      locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
    });

    this.hands.setOptions({
      maxNumHands: options?.maxNumHands ?? 2,
      modelComplexity: options?.modelComplexity ?? 1,
      minDetectionConfidence: options?.minDetectionConfidence ?? 0.7,
      minTrackingConfidence: options?.minTrackingConfidence ?? 0.5,
    });

    this.hands.onResults((results: any) => {
      const multi = results.multiHandLandmarks || [];
      const hands = multi.map((lm: any) => lm.map((p: any) => ({ x: p.x, y: p.y, z: p.z } as { x: number; y: number; z?: number })));
      try {
        this.onResultsCb?.(hands, results.multiHandedness);
      } catch (e) {
        console.error('HandTracker onResults callback error', e);
      }
    });

    this.running = true;

    // allow optional fps throttle via options
    if (options && (options as any).fpsLimit) this.fpsLimit = (options as any).fpsLimit;

    const process = async () => {
      if (!this.running) return;
      const now = performance.now();
      const minDelta = 1000 / this.fpsLimit;
      if (this.videoEl && this.videoEl.readyState >= 2 && now - this.lastProcessTime >= minDelta) {
        try {
          await this.hands.send({ image: this.videoEl });
        } catch (e) {
          // non-fatal
        }
        this.lastProcessTime = now;
      }
      this.rafId = requestAnimationFrame(process);
    };

    process();
  }

  stop() {
    this.running = false;
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    try {
      this.hands?.close?.();
    } catch (e) {}
  }

  isRunning() {
    return this.running;
  }
}
