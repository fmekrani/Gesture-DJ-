"use client";

import React from 'react';

export default function Meter({ level = 0 }: { level?: number }) {
  const pct = Math.max(0, Math.min(1, level));
  return (
    <div className="h-24 w-8 bg-black/20 rounded flex items-end p-1">
      <div
        className="w-full bg-gradient-to-t from-red-500 via-yellow-400 to-green-400 rounded"
        style={{ height: `${pct * 100}%` }}
      />
    </div>
  );
}
