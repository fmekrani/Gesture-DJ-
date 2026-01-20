"use client";

import React from 'react';

type KnobProps = {
  value?: number;
  onChange?: (v: number) => void;
};

export default function Knob({ value = 0.5, onChange }: KnobProps) {
  return (
    <input
      type="range"
      min={0}
      max={1}
      step={0.01}
      value={value}
      onChange={(e) => onChange?.(parseFloat(e.target.value))}
      className="w-24"
    />
  );
}
