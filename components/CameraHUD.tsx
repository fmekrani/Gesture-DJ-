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
  const [gestureStatus, setGestureStatus] = useState<string>('Ready');
  const gestureTimeoutRef = useRef<number | null>(null);

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

      const mapper = new GestureMapper();
      mapperRef.current = mapper;
      mapper.ensureCalibration(); // auto-calibrate if needed
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

            // play/pause via palm open/close: open palm → play, closed palm → pause
            const wrist = landmarks[0];
            const tips = [4, 8, 12, 16, 20].map((idx) => landmarks[idx]).filter(Boolean as any) as any[];
            const spread = tips.reduce((s, p) => s + Math.hypot(p.x - wrist.x, p.y - wrist.y), 0) / tips.length;
            
            // Detect open palm (fingers spread)
            const isOpenPalm = spread > 0.25; // open hand threshold
            const openPalmId = `openPalm_${i}_${deck}`;
            const heldOpenPalm = mapperRef.current!.checkHold(openPalmId, isOpenPalm, 300);
            if (heldOpenPalm && !holdTriggeredRef.current[openPalmId]) {
              audioEngine.playDeck(deck);
              setGestureStatus(`▶️ Play — Deck ${deck}`);
              if (gestureTimeoutRef.current) clearTimeout(gestureTimeoutRef.current);
              gestureTimeoutRef.current = window.setTimeout(() => setGestureStatus('Ready'), 1500);
              holdTriggeredRef.current[openPalmId] = true;
            }
            if (!isOpenPalm) {
              holdTriggeredRef.current[openPalmId] = false;
            }

            // Detect closed palm/fist (fingers closed)
            const isFist = spread < 0.15; // closed hand threshold
            const fistId = `fist_${i}_${deck}`;
            const heldFist = mapperRef.current!.checkHold(fistId, isFist, 300);
            if (heldFist && !holdTriggeredRef.current[fistId]) {
              audioEngine.pauseDeck(deck);
              setGestureStatus(`⏸️ Pause — Deck ${deck}`);
              if (gestureTimeoutRef.current) clearTimeout(gestureTimeoutRef.current);
              gestureTimeoutRef.current = window.setTimeout(() => setGestureStatus('Ready'), 1500);
              holdTriggeredRef.current[fistId] = true;
            }
            if (!isFist) {
              holdTriggeredRef.current[fistId] = false;
            }

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
              if (Math.abs(scrubDelta) > 0.0001) {
                audioEngine.jogDeck(deck, scrubDelta);
                setGestureStatus(`🎚 Jog — Deck ${deck}`);
                if (gestureTimeoutRef.current) clearTimeout(gestureTimeoutRef.current);
                gestureTimeoutRef.current = window.setTimeout(() => setGestureStatus('Ready'), 800);
              }
            }
          });

          // apply mapped global controls
          if (controls) {
            (['A', 'B'] as Array<'A' | 'B'>).forEach((d) => {
              const c = controls[d];
              if (!c || !c.assigned) return;
              audioEngine.setDeckVolume(d, c.volume);
              audioEngine.setDeckEQ(d, { low: c.eq.low, mid: c.eq.mid, high: c.eq.high });
              setGestureStatus(`Deck ${d} EQ / Volume`);
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

    // Get video dimensions and set canvas to match
    const videoWidth = video.videoWidth || 640;
    const videoHeight = video.videoHeight || 480;
    
    // Set canvas resolution to video resolution for accurate pixel mapping
    canvas.width = videoWidth;
    canvas.height = videoHeight;

    ctx.clearRect(0, 0, videoWidth, videoHeight);
    ctx.lineWidth = 2.5;

    hands.forEach((landmarks, hi) => {
      // draw connections
      ctx.strokeStyle = hi === 0 ? 'rgba(180,91,255,0.95)' : 'rgba(79,209,255,0.95)';
      ctx.shadowColor = hi === 0 ? 'rgba(180,91,255,0.5)' : 'rgba(79,209,255,0.5)';
      ctx.shadowBlur = 10;
      HAND_CONNECTIONS.forEach(([a, b]) => {
        const pA = landmarks[a];
        const pB = landmarks[b];
        if (!pA || !pB) return;
        ctx.beginPath();
        ctx.moveTo(pA.x * videoWidth, pA.y * videoHeight);
        ctx.lineTo(pB.x * videoWidth, pB.y * videoHeight);
        ctx.stroke();
      });
      ctx.shadowBlur = 0;

      // draw landmarks with slightly larger dots
      landmarks.forEach((p, i) => {
        ctx.fillStyle = '#e9eef7';
        ctx.beginPath();
        ctx.arc(p.x * videoWidth, p.y * videoHeight, 4, 0, Math.PI * 2);
        ctx.fill();
        
        // add small ring around landmark for clarity
        ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(p.x * videoWidth, p.y * videoHeight, 6, 0, Math.PI * 2);
        ctx.stroke();
      });
    });
  }

  // expose simple calibration controls on the camera HUD for testing
  async function startCalibrationFlow() {
    if (!mapperRef.current) {
      const mapper = new GestureMapper();
      mapperRef.current = mapper;
    }
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
    <motion.div
      initial={{ y: 12, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.35, type: 'spring', stiffness: 140, damping: 18 }}
      className="relative w-full max-w-2xl h-[320px] sm:h-[360px] md:h-[380px] rounded-2xl overflow-hidden border border-white/8 glass-strong neon-shadow"
    >
      <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" style={{ display: 'block' }} />

      <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-black/55 backdrop-blur-md px-3 py-2 rounded-lg flex items-center gap-2 text-xs text-white border border-white/10 shadow-lg">
        <span className="text-base">✋</span>
        <div>
          <div className="text-[11px] uppercase tracking-[0.18em] text-gray-300">Gesture Status</div>
          <div className="text-sm font-medium">{gestureStatus}</div>
        </div>
      </div>

      <div className="p-2 absolute bottom-2 left-2 flex gap-2">
        {!running ? (
          <motion.button
            whileTap={{ scale: 0.94 }}
            onClick={startCamera}
            className="px-3 py-2 bg-gradient-to-r from-purple-500 via-pink-500 to-fuchsia-500 rounded-lg text-sm text-white shadow-lg"
          >
            Start Camera
          </motion.button>
        ) : (
          <>
            <motion.button
              whileTap={{ scale: 0.94 }}
              onClick={stopCamera}
              className="px-3 py-2 bg-red-600/80 rounded-lg text-sm text-white shadow-lg"
            >
              Stop
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.94 }}
              onClick={startCalibrationFlow}
              className="px-3 py-2 bg-gradient-to-r from-green-500 to-teal-400 rounded-lg text-sm text-white shadow-lg"
            >
              Calibrate
            </motion.button>
          </>
        )}
      </div>
      {/* Calibration progress and mapped controls overlay */}
      {calProgress > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute top-16 left-2 bg-black/60 backdrop-blur-md px-3 py-2 rounded-lg text-xs text-white border border-white/10 shadow-lg"
        >
          <div className="font-medium mb-1">Calibrating: {(calProgress * 100).toFixed(0)}%</div>
          <div className="w-40 h-1 bg-white/10 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${calProgress * 100}%` }}
              className="h-full bg-gradient-to-r from-green-500 to-teal-400"
            />
          </div>
        </motion.div>
      )}
      {mappedControls && (
        <motion.div
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          className="absolute top-3 right-3 bg-black/55 backdrop-blur-md text-white text-[11px] p-3 rounded-lg border border-white/10 shadow-lg space-y-1"
        >
          <div className="font-semibold text-xs">Active Controls</div>
          <div className="text-gray-300">Deck A: {mappedControls.A?.assigned ? `${(mappedControls.A.volume * 100).toFixed(0)}%` : '—'}</div>
          <div className="text-gray-300">Deck B: {mappedControls.B?.assigned ? `${(mappedControls.B.volume * 100).toFixed(0)}%` : '—'}</div>
        </motion.div>
      )}
    </motion.div>
  );
}
