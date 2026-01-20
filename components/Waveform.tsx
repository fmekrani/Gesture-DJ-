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
  playing?: boolean;
};

function formatTime(s: number | undefined) {
  if (!s || !isFinite(s) || s < 0) return '0:00';
  const m = Math.floor(s / 60);
  const ss = Math.floor(s % 60)
    .toString()
    .padStart(2, '0');
  return `${m}:${ss}`;
}

export default function Waveform({ peaks, duration = null, currentTime = 0, onSeek, loop = null, height = 96, playing = false }: WaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!peaks || !canvasRef.current) return;
    draw(peaks, duration || 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [peaks, currentTime, loop, duration, playing]);

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

    // base glow
    ctx.fillStyle = 'rgba(255,255,255,0.03)';
    ctx.fillRect(0, 0, w, h);

    const grad = ctx.createLinearGradient(0, 0, w, 0);
    grad.addColorStop(0, '#b45bff');
    grad.addColorStop(0.5, '#ff4fbf');
    grad.addColorStop(1, '#45c9ff');
    ctx.fillStyle = grad;
    ctx.shadowColor = playing ? 'rgba(110,80,255,0.35)' : 'transparent';
    ctx.shadowBlur = playing ? 16 : 0;
    const mid = h / 2;
    const barWidth = Math.max(1, w / peaks.length);
    for (let i = 0; i < peaks.length; i++) {
      const x = (i / peaks.length) * w;
      const p = peaks[i] * (h * 0.9);
      ctx.fillRect(x, mid - p / 2, barWidth, p);
    }
    ctx.shadowBlur = 0;

    if (loop && dur > 0) {
      const sx = (loop.start / dur) * w;
      const ex = (loop.end / dur) * w;
      ctx.fillStyle = 'rgba(255, 79, 191, 0.12)';
      ctx.fillRect(sx, 0, Math.max(1, ex - sx), h);
      ctx.strokeStyle = 'rgba(255,79,191,0.4)';
      ctx.lineWidth = 2;
      ctx.strokeRect(sx, 1, Math.max(1, ex - sx), h - 2);
    }

    if (dur > 0) {
      const px = (currentTime % dur) / dur * w;
      ctx.fillStyle = '#9b5cff';
      ctx.fillRect(px - 1, 0, 2, h);
      ctx.fillStyle = 'rgba(155,92,255,0.12)';
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
      <div className={`relative rounded-lg overflow-hidden wave-glow ${playing ? 'shadow-[0_0_0_1px_rgba(180,91,255,0.18)]' : ''}`}>
        <canvas ref={canvasRef} onClick={handleClick} className="w-full block cursor-pointer" style={{ height }} />
      </div>
      <div className="mt-2 flex items-center justify-between text-[11px] text-gray-400">
        <div>{formatTime(currentTime)}</div>
        <div>{duration ? `-${formatTime(Math.max(0, duration - (currentTime || 0)))}` : '-:--'}</div>
      </div>
    </div>
  );
}

