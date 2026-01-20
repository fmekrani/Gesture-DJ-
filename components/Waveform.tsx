"use client";

import React, { useEffect, useRef } from 'react';

type LoopRegion = { start: number; end: number } | null;

type WaveformProps = {
  peaks: Float32Array | null;
  duration: number | null;
  currentTime?: number;
  onSeek?: (time: number) => void;
  loop?: LoopRegion;
  height?: number;
};

function formatTime(s: number | undefined) {
  if (!s || !isFinite(s) || s < 0) return '0:00';
  const m = Math.floor(s / 60);
  const ss = Math.floor(s % 60)
    .toString()
    .padStart(2, '0');
  return `${m}:${ss}`;
}

export default function Waveform({ peaks, duration = null, currentTime = 0, onSeek, loop = null, height = 96 }: WaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!peaks || !canvasRef.current) return;
    draw(peaks, duration || 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [peaks, currentTime, loop, duration]);

  function draw(peaks: Float32Array, dur: number) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = height;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(255,255,255,0.02)';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(168,85,247,0.85)';
    const mid = h / 2;
    for (let i = 0; i < peaks.length; i++) {
      const x = (i / peaks.length) * w;
      const p = peaks[i] * (h * 0.9);
      ctx.fillRect(x, mid - p / 2, Math.max(1, w / peaks.length), p);
    }

    if (loop && dur > 0) {
      const sx = (loop.start / dur) * w;
      const ex = (loop.end / dur) * w;
      ctx.fillStyle = 'rgba(255, 0, 128, 0.12)';
      ctx.fillRect(sx, 0, Math.max(1, ex - sx), h);
      ctx.strokeStyle = 'rgba(255,0,128,0.5)';
      ctx.lineWidth = 2;
      ctx.strokeRect(sx, 1, Math.max(1, ex - sx), h - 2);
    }

    if (dur > 0) {
      const px = (currentTime % dur) / dur * w;
      ctx.fillStyle = '#9b5cff';
      ctx.fillRect(px - 1, 0, 2, h);
      ctx.fillStyle = 'rgba(155,92,255,0.08)';
      ctx.fillRect(px - 8, 0, 16, h);
    }
  }

  function handleClick(e: React.MouseEvent) {
    if (!onSeek || !canvasRef.current || !duration) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const t = (x / rect.width) * duration;
    onSeek(t);
  }

  return (
    <div className="w-full">
      <div className="relative rounded-md overflow-hidden">
        <canvas ref={canvasRef} onClick={handleClick} className="w-full block cursor-pointer" style={{ height }} />
      </div>
      <div className="mt-2 flex items-center justify-between text-xs text-gray-400">
        <div> {formatTime(currentTime)} </div>
        <div> {duration ? `-${formatTime(Math.max(0, duration - (currentTime || 0)))}` : '-:--'} </div>
      </div>
    </div>
  );
}

