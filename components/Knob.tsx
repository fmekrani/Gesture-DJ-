"use client";

import React from 'react';

type KnobProps = {
  value?: number;
  onChange?: (v: number) => void;
  tone?: 'A' | 'B';
};

export default function Knob({ value = 0.5, onChange, tone = 'A' }: KnobProps) {
  const angle = value * 270 - 135; // -135deg to 135deg sweep
  const accent = tone === 'A' ? '#b45bff' : '#4fd1ff';
  const track = 'rgba(255,255,255,0.08)';

  return (
    <div className="relative h-14 w-14 flex items-center justify-center select-none">
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: `conic-gradient(${accent} ${value * 270}deg, ${track} ${value * 270}deg 360deg)`,
          boxShadow: '0 6px 16px rgba(0,0,0,0.35)'
        }}
      />
      <div className="h-11 w-11 rounded-full bg-[#0f1527] border border-white/10 relative flex items-center justify-center">
        <div
          className="absolute w-[2px] h-3 rounded-full"
          style={{
            background: '#fff',
            transform: `rotate(${angle}deg) translateY(-5px)`,
            transformOrigin: 'center 10px'
          }}
        />
      </div>
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={value}
        onChange={(e) => onChange?.(parseFloat(e.target.value))}
        className="absolute inset-0 opacity-0 cursor-pointer"
        aria-label="EQ knob"
      />
    </div>
  );
}
