"use client";

import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import Waveform from './Waveform';
import Knob from './Knob';
import Meter from './Meter';
import audioEngine from '../lib/audio/engineInstance';

type DeckProps = {
  id: 'A' | 'B';
  className?: string;
};

export default function Deck({ id, className = '' }: DeckProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [peaks, setPeaks] = useState<Float32Array | null>(null);
  const [duration, setDuration] = useState<number | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [rms, setRms] = useState<number | null>(null);

  // EQ local state (0..1) mapped to -12..+12 dB
  const [low, setLow] = useState(0.5);
  const [mid, setMid] = useState(0.5);
  const [high, setHigh] = useState(0.5);

  // FX & Loop state
  const [fxOn, setFxOn] = useState(false);
  const [fxWet, setFxWet] = useState(0.2);
  const loopLengths = [1, 2, 4, 8];
  const [loopOn, setLoopOn] = useState(false);
  const [loopIndex, setLoopIndex] = useState(2); // default 4s

  useEffect(() => {
    let raf = 0;
    function tick() {
      const info = audioEngine.getDeckInfo(id as 'A' | 'B');
      if (info.duration) setDuration(info.duration);
      if (info.peaks) setPeaks(info.peaks as Float32Array);
      if (info.rms !== undefined && info.rms !== null) setRms(info.rms as number);
      setIsPlaying(Boolean(info.isPlaying));
      setCurrentTime(audioEngine.getCurrentTime(id as 'A' | 'B'));
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [id]);

  // sync EQ state to engine
  useEffect(() => {
    const eq = { low: (low - 0.5) * 24, mid: (mid - 0.5) * 24, high: (high - 0.5) * 24 };
    audioEngine.setDeckEQ(id as 'A' | 'B', eq);
  }, [low, mid, high, id]);

  useEffect(() => {
    audioEngine.setDeckFX(id as 'A' | 'B', { wet: fxOn ? fxWet : 0 });
  }, [fxOn, fxWet, id]);

  useEffect(() => {
    audioEngine.setDeckLoop(id as 'A' | 'B', loopOn, loopLengths[loopIndex]);
  }, [loopOn, loopIndex, id]);

  function onLoadClick() {
    inputRef.current?.click();
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    await audioEngine.loadDeckFromFile(id as 'A' | 'B', f);
    const info = audioEngine.getDeckInfo(id as 'A' | 'B');
    if (info.peaks) setPeaks(info.peaks as Float32Array);
    if (info.duration) setDuration(info.duration as number);
    if (info.rms !== undefined && info.rms !== null) setRms(info.rms as number);
  }

  function handlePlayPause() {
    if (isPlaying) audioEngine.pauseDeck(id as 'A' | 'B');
    else audioEngine.playDeck(id as 'A' | 'B');
  }

  function handleSeek(t: number) {
    audioEngine.seekDeck(id as 'A' | 'B', t);
  }

  function toggleLoopHold() {
    setLoopOn((s) => !s);
  }

  function cycleLoopLength() {
    setLoopIndex((i) => (i + 1) % loopLengths.length);
  }

  return (
    <motion.div initial={{ y: 8, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.45 }} className={`p-4 rounded-xl border border-white/5 glass-strong neon-outline ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-medium">Deck {id}</h2>
        <div className="flex items-center gap-2">
          <button onClick={onLoadClick} className="px-2 py-1 bg-white/6 rounded">Load</button>
          <input ref={inputRef} className="hidden" type="file" accept="audio/*" onChange={onFile} />
        </div>
      </div>

      <div className="mb-3">
        <Waveform peaks={peaks} duration={duration} currentTime={currentTime} onSeek={handleSeek} loop={loopOn && duration ? { start: 0, end: loopLengths[loopIndex] } : null} />
      </div>

      <div className="flex gap-4 items-center">
        <button onClick={handlePlayPause} className="px-3 py-2 bg-gradient-to-r from-purple-600 to-pink-500 rounded text-white">
          {isPlaying ? 'Pause' : 'Play'}
        </button>

        <div className="flex-1">
          <div className="flex gap-2 items-center mb-2">
            <span className="text-sm text-gray-400">Low</span>
            <Knob value={low} onChange={(v: number) => setLow(v)} />
          </div>
          <div className="flex gap-2 items-center mb-2">
            <span className="text-sm text-gray-400">Mid</span>
            <Knob value={mid} onChange={(v: number) => setMid(v)} />
          </div>
          <div className="flex gap-2 items-center">
            <span className="text-sm text-gray-400">High</span>
            <Knob value={high} onChange={(v: number) => setHigh(v)} />
          </div>
        </div>

        <div className="w-20">
          <Meter level={rms ? Math.min(1, rms * 5) : 0} />
        </div>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <button onClick={() => setFxOn((s) => !s)} className={`px-3 py-1 rounded ${fxOn ? 'bg-pink-500 text-white' : 'bg-white/6'}`}>
          FX {fxOn ? 'On' : 'Off'}
        </button>
        <input type="range" min={0} max={1} step={0.01} value={fxWet} onChange={(e) => setFxWet(parseFloat(e.target.value))} className="w-36" />

        <button onClick={toggleLoopHold} className={`px-3 py-1 rounded ${loopOn ? 'bg-pink-500 text-white' : 'bg-white/6'}`}>
          Loop {loopOn ? `(${loopLengths[loopIndex]}s)` : 'Off'}
        </button>
        <button onClick={cycleLoopLength} className="px-2 py-1 bg-white/6 rounded">Cycle Length</button>
      </div>
    </motion.div>
  );
}
