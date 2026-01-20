"use client";

import React from 'react';

export default function Settings() {
  return (
    <div className="p-4 rounded-xl glass border border-white/5">
      <h3 className="text-sm font-medium mb-2">Calibration</h3>
      <div className="flex gap-2">
        <button className="px-3 py-1 bg-gradient-to-r from-purple-600 to-pink-500 rounded text-white text-sm">Calibrate</button>
        <button className="px-3 py-1 bg-white/6 rounded text-sm">Reset</button>
      </div>
    </div>
  );
}
