"use client";

import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import HandTracker from '../lib/vision/HandTracker';
import GestureMapper from '../lib/vision/GestureMapper';
import audioEngine from '../lib/audio/engineInstance';

const HAND_CONNECTIONS: Array<[number, number]> = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  [0, 5],
  [5, 6],
  [6, 7],
  [7, 8],
  [5, 9],
  [9, 10],
  [10, 11],
  [11, 12],
  [9, 13],
  [13, 14],
  [14, 15],
  [15, 16],
  [13, 17],
  [17, 18],
  [18, 19],
  [19, 20],
  [0, 17],
];

export default function CameraHUD() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const trackerRef = useRef<HandTracker | null>(null);
  const mapperRef = useRef<GestureMapper | null>(null);
  const [running, setRunning] = useState(false);
  const lastAngleRef = useRef<Record<number, number>>({});
  const holdTriggeredRef = useRef<Record<string, boolean>>({});
  const [calProgress, setCalProgress] = useState(0);
  const [mappedControls, setMappedControls] = useState<any | null>(null);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }

      const tracker = new HandTracker();
      trackerRef.current = tracker;

      mapperRef.current = new GestureMapper();
      tracker.start(
        videoRef.current as HTMLVideoElement,
        (hands, handedness) => {
          // draw overlay
          drawHands(hands as any[]);

          if (!mapperRef.current) return;

          // absorb calibration samples if active
          if (hands && hands[0] && mapperRef.current.getCalibration()) {
            mapperRef.current.absorbSample(hands[0] as any);
          }

          // compute mapped controls
          let controls: any = null;
          try {
            controls = mapperRef.current.mapHandsToControls(hands as any[], handedness);
            setMappedControls(controls);
            (canvasRef.current as HTMLCanvasElement | null)?.setAttribute('data-controls', JSON.stringify(controls));
          } catch (e) {
            controls = null;
          }

          // Apply controls and gestures per-hand
          hands.forEach((landmarks, i) => {
            if (!landmarks || landmarks.length === 0) return;
            const centroidX = landmarks.reduce((s, p) => s + p.x, 0) / landmarks.length;
            const deck: 'A' | 'B' = centroidX < 0.5 ? 'A' : 'B';

            // play/pause via fist (low spread)
            const wrist = landmarks[0];
            const tips = [4, 8, 12, 16, 20].map((idx) => landmarks[idx]).filter(Boolean as any) as any[];
            const spread = tips.reduce((s, p) => s + Math.hypot(p.x - wrist.x, p.y - wrist.y), 0) / tips.length;
            const isFist = spread < 0.08;
            const fistId = `fist_${i}_${deck}`;
            const heldFist = mapperRef.current!.checkHold(fistId, isFist, 300);
            if (heldFist && !holdTriggeredRef.current[fistId]) {
              const info = audioEngine.getDeckInfo(deck);
              if (info.isPlaying) audioEngine.pauseDeck(deck);
              else audioEngine.playDeck(deck);
              holdTriggeredRef.current[fistId] = true;
            }
            if (!isFist) holdTriggeredRef.current[fistId] = false;

            // pinch (thumb-index) -> loop short region
            const thumb = landmarks[4];
            const index = landmarks[8];
            let pinch = false;
            if (thumb && index) {
              const d = Math.hypot(thumb.x - index.x, thumb.y - index.y);
              pinch = d < 0.04;
            }
            const pinchId = `pinch_${i}_${deck}`;
            const heldPinch = mapperRef.current!.checkHold(pinchId, pinch, 300);
            if (heldPinch && !holdTriggeredRef.current[pinchId]) {
              audioEngine.setDeckLoop(deck, true, 2);
              holdTriggeredRef.current[pinchId] = true;
            }
            if (!pinch) holdTriggeredRef.current[pinchId] = false;

            // palm rotation -> jog
            const midMcp = landmarks[9];
            if (wrist && midMcp) {
              const dx = midMcp.x - wrist.x;
              const dy = midMcp.y - wrist.y;
              let angle = Math.atan2(dy, dx);
              const last = lastAngleRef.current[i] ?? angle;
              let delta = angle - last;
              while (delta > Math.PI) delta -= Math.PI * 2;
              while (delta < -Math.PI) delta += Math.PI * 2;
              lastAngleRef.current[i] = angle;
              const sensitivity = 2.5; // seconds per radian
              const scrubDelta = delta * sensitivity;
              if (Math.abs(scrubDelta) > 0.0001) audioEngine.jogDeck(deck, scrubDelta);
            }
          });

          // apply mapped global controls
          if (controls) {
            (['A', 'B'] as Array<'A' | 'B'>).forEach((d) => {
              const c = controls[d];
              if (!c || !c.assigned) return;
              audioEngine.setDeckVolume(d, c.volume);
              audioEngine.setDeckEQ(d, { low: c.eq.low, mid: c.eq.mid, high: c.eq.high });
            });
          }
        }
      );

      setRunning(true);
    } catch (e) {
      console.error('Camera error', e);
    }
  }

  function stopCamera() {
    setRunning(false);
    try {
      trackerRef.current?.stop();
    } catch (e) {}
    trackerRef.current = null;
    const v = videoRef.current;
    if (v && v.srcObject) {
      const s = v.srcObject as MediaStream;
      s.getTracks().forEach((t) => t.stop());
      v.srcObject = null;
    }
    const c = canvasRef.current;
    if (c) {
      const ctx = c.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, c.width, c.height);
    }
  }

  function drawHands(hands: Array<Array<{ x: number; y: number }>>) {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width = video.videoWidth || 320;
    const h = canvas.height = video.videoHeight || 240;

    ctx.clearRect(0, 0, w, h);
    ctx.lineWidth = 2;

    hands.forEach((landmarks, hi) => {
      // draw connections
      ctx.strokeStyle = hi === 0 ? 'rgba(99,102,241,0.9)' : 'rgba(236,72,153,0.9)';
      HAND_CONNECTIONS.forEach(([a, b]) => {
        const pA = landmarks[a];
        const pB = landmarks[b];
        if (!pA || !pB) return;
        ctx.beginPath();
        ctx.moveTo(pA.x * w, pA.y * h);
        ctx.lineTo(pB.x * w, pB.y * h);
        ctx.stroke();
      });

      // draw landmarks
      landmarks.forEach((p, i) => {
        ctx.fillStyle = 'white';
        ctx.beginPath();
        ctx.arc(p.x * w, p.y * h, 3, 0, Math.PI * 2);
        ctx.fill();
      });
    });
  }

  // expose simple calibration controls on the camera HUD for testing
  async function startCalibrationFlow() {
    if (!mapperRef.current) mapperRef.current = new GestureMapper();
    mapperRef.current.startCalibration();
    // show a quick 3s capture
    const start = Date.now();
    const duration = 3000;
    let lastProgress = 0;
    const interval = setInterval(() => {
      const elapsed = Date.now() - start;
      const p = Math.min(1, elapsed / duration);
      // update local progress state for overlay
      setCalProgress(p);
      if (elapsed >= duration) {
        clearInterval(interval);
        const out = mapperRef.current!.finishCalibration();
        setCalProgress(0);
        console.log('Calibration finished', out);
      } else if (Math.floor(p * 100) !== lastProgress) {
        lastProgress = Math.floor(p * 100);
      }
    }, 100);
  }

  return (
    <motion.div initial={{ scale: 0.98, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.35 }} className="w-80 h-60 sm:w-96 sm:h-64 md:w-[480px] md:h-[320px] bg-black/30 rounded overflow-hidden border border-white/5 relative neon-shadow">
      <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />
      <div className="p-2 absolute bottom-2 left-2 flex gap-2">
        {!running ? (
          <button onClick={startCamera} className="px-2 py-1 bg-white/6 rounded text-sm">
            Start Camera
          </button>
        ) : (
          <>
            <button onClick={stopCamera} className="px-2 py-1 bg-red-600/80 rounded text-sm text-white">
              Stop Camera
            </button>
            <button onClick={startCalibrationFlow} className="px-2 py-1 bg-gradient-to-r from-green-500 to-teal-400 rounded text-sm text-white">
              Calibrate
            </button>
          </>
        )}
      </div>
      {/* Calibration progress and mapped controls overlay */}
      {calProgress > 0 && (
        <div className="absolute top-2 left-2 bg-white/6 px-2 py-1 rounded text-xs">
          Calibrating: {(calProgress * 100).toFixed(0)}%
        </div>
      )}
      {mappedControls && (
        <div className="absolute top-2 right-2 bg-black/60 text-white text-xs p-2 rounded w-44">
          <div className="font-medium">Mapped</div>
          <div className="mt-1">A: {mappedControls.A?.assigned ? `vol ${mappedControls.A.volume.toFixed(2)}` : '—'}</div>
          <div>B: {mappedControls.B?.assigned ? `vol ${mappedControls.B.volume.toFixed(2)}` : '—'}</div>
        </div>
      )}
    </motion.div>
  );
}
