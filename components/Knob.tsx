"use client";

import React, { useState } from 'react';
import { motion } from 'framer-motion';

type KnobProps = {
  value?: number;
  onChange?: (v: number) => void;
  tone?: 'A' | 'B';
};

export default function Knob({ value = 0.5, onChange, tone = 'A' }: KnobProps) {
  const [isActive, setIsActive] = useState(false);
  const angle = value * 270 - 135; // -135deg to 135deg sweep
  const accent = tone === 'A' ? '#b45bff' : '#4fd1ff';
  const accentLight = tone === 'A' ? 'rgba(180,91,255,0.3)' : 'rgba(79,209,255,0.3)';
  const track = 'rgba(255,255,255,0.08)';

  return (
    <div className="relative h-16 w-16 flex items-center justify-center select-none group">
      {/* Outer glow on active */}
      {isActive && (
        <motion.div
          className="absolute inset-[-8px] rounded-full pointer-events-none"
          style={{
            background: `radial-gradient(circle, ${accentLight} 0%, transparent 70%)`,
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
        />
      )}
      
      {/* Main knob background with conic gradient */}
      <div
        className="absolute inset-0 rounded-full shadow-lg"
        style={{
          background: `conic-gradient(${accent} ${value * 270}deg, ${track} ${value * 270}deg 360deg)`,
          boxShadow: `0 8px 20px rgba(0,0,0,0.5), inset 0 -2px 8px rgba(0,0,0,0.3)`,
        }}
      />
      
      {/* Inner circle with border */}
      <div className="h-12 w-12 rounded-full bg-gradient-to-b from-slate-800 to-slate-900 border border-white/15 relative flex items-center justify-center shadow-inner">
        {/* Indicator line */}
        <motion.div
          className="absolute w-0.5 h-4 rounded-full"
          style={{
            background: '#fff',
            boxShadow: `0 0 8px ${accent}`,
            transform: `rotate(${angle}deg) translateY(-7px)`,
            transformOrigin: 'center 10px',
          }}
        />
        
        {/* Center dot */}
        <div className="h-1.5 w-1.5 rounded-full bg-white/40" />
      </div>
      
      {/* Hidden input for interaction */}
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={value}
        onChange={(e) => onChange?.(parseFloat(e.target.value))}
        onMouseDown={() => setIsActive(true)}
        onMouseUp={() => setIsActive(false)}
        onTouchStart={() => setIsActive(true)}
        onTouchEnd={() => setIsActive(false)}
        className="absolute inset-0 opacity-0 cursor-pointer"
        aria-label="EQ knob"
      />
      
      {/* Value indicator text (only on hover/active) */}
      <motion.div
        className="absolute -bottom-6 text-xs text-center whitespace-nowrap"
        initial={{ opacity: 0, y: -2 }}
        animate={{ opacity: isActive ? 1 : 0, y: isActive ? 0 : -2 }}
        pointer-events-none
        style={{ color: accent }}
      >
        {((value - 0.5) * 24).toFixed(0)} dB
      </motion.div>
    </div>
  );
}
