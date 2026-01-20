"use client";

import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import Meter from './Meter';
import audioEngine from '../lib/audio/engineInstance';

export default function Crossfader({ value = 0.5, onChange }: { value?: number; onChange?: (v: number) => void }) {
  const [masterLevel, setMasterLevel] = useState(0);
  const rafRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function tick() {
      const lvl = audioEngine.getMasterLevel();
      setMasterLevel(lvl);
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // keyboard handling when the crossfader container has focus
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    function handleKey(e: KeyboardEvent) {
      const step = 0.02;
      let v = Number(value ?? 0.5);
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        v = Math.max(0, v - step);
        onChange?.(parseFloat(v.toFixed(3)));
        e.preventDefault();
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        v = Math.min(1, v + step);
        onChange?.(parseFloat(v.toFixed(3)));
        e.preventDefault();
      } else if (e.key === 'Home') {
        onChange?.(0);
        e.preventDefault();
      } else if (e.key === 'End') {
        onChange?.(1);
        e.preventDefault();
      } else if (e.key === '0') {
        onChange?.(0.5);
        e.preventDefault();
      }
    }

    el.addEventListener('keydown', handleKey as any);
    return () => el.removeEventListener('keydown', handleKey as any);
  }, [value, onChange]);

  return (
    <motion.div
      ref={containerRef}
      tabIndex={0}
      aria-label="Crossfader control. Use left/right arrows to adjust."
      className="p-4 rounded-xl glass border border-white/5 w-full focus:outline-none"
      initial={{ y: 6, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.35 }}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm text-gray-300">Crossfader</div>
        <div className="flex items-center gap-2">
          <div className="text-xs text-gray-400">Master</div>
          <div className="w-12">
            <Meter level={masterLevel} />
          </div>
        </div>
      </div>

      <motion.input
        role="slider"
        aria-valuemin={0}
        aria-valuemax={1}
        aria-valuenow={Number(value)}
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={value}
        onChange={(e) => onChange?.(parseFloat(e.target.value))}
        className="w-full"
        whileTap={{ scale: 0.995 }}
      />

      <div className="mt-2 text-xs text-gray-400">Keyboard: ← / → to nudge, Home/End to jump</div>
    </motion.div>
  );
}
