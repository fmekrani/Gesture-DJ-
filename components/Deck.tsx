"use client";

import React, { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import { motion } from 'framer-motion';
import Waveform from './Waveform';
import Knob from './Knob';
import Meter from './Meter';
import audioEngine from '../lib/audio/engineInstance';

type DeckProps = {
  id: 'A' | 'B';
  className?: string;
};

export type DeckHandle = {
  updateEQFromGesture: (band: 'low' | 'mid' | 'high', gainDb: number) => void;
};

const Deck = forwardRef<DeckHandle, DeckProps>(({ id, className = '' }, ref) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [peaks, setPeaks] = useState<Float32Array | null>(null);
  const [duration, setDuration] = useState<number | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [rms, setRms] = useState<number | null>(null);

  const [volume, setVolume] = useState(0.82);
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

  // Expose updateEQFromGesture via ref
  useImperativeHandle(ref, () => ({
    updateEQFromGesture(band: 'low' | 'mid' | 'high', gainDb: number) {
      const normalizedValue = (gainDb / 24) + 0.5;
      const clamped = Math.max(0, Math.min(1, normalizedValue));
      if (band === 'low') setLow(clamped);
      else if (band === 'mid') setMid(clamped);
      else if (band === 'high') setHigh(clamped);
    }
  }), []);

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
    audioEngine.setDeckVolume(id as 'A' | 'B', volume);
  }, [volume, id]);

  useEffect(() => {
    audioEngine.setDeckFX(id as 'A' | 'B', { wet: fxOn ? fxWet : 0 });
  }, [fxOn, fxWet, id]);

  useEffect(() => {
    audioEngine.setDeckLoop(id as 'A' | 'B', loopOn, loopLengths[loopIndex]);
  }, [loopOn, loopIndex, id, loopLengths]);

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

  function formatTime(s: number | undefined) {
    if (!s || !isFinite(s) || s < 0) return '0:00';
    const m = Math.floor(s / 60);
    const ss = Math.floor(s % 60)
      .toString()
      .padStart(2, '0');
    return `${m}:${ss}`;
  }

  const accentGradient = id === 'A' ? 'from-purple-500 via-pink-500 to-fuchsia-500' : 'from-cyan-400 via-blue-500 to-indigo-500';
  const accentText = id === 'A' ? 'text-purple-200' : 'text-cyan-200';
  const accentBorder = id === 'A' ? 'border-purple-500/30' : 'border-cyan-400/30';

  return (
    <motion.div
      initial={{ y: 10, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4, type: 'spring', stiffness: 120, damping: 18 }}
      className={`card-surface neon-outline p-4 rounded-2xl ${className}`}
    >
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className={`text-xs uppercase tracking-[0.18em] text-gray-400 ${accentText}`}>Deck {id}</div>
          <div className="text-sm text-gray-300">Upload a track to start</div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onLoadClick} className={`px-3 py-1.5 rounded-lg bg-gradient-to-r ${accentGradient} text-white text-sm shadow-lg`}>Load</button>
          <input ref={inputRef} className="hidden" type="file" accept="audio/*" onChange={onFile} />
        </div>
      </div>

      <div className="mb-4">
        <Waveform
          peaks={peaks}
          duration={duration}
          currentTime={currentTime}
          onSeek={handleSeek}
          loop={loopOn && duration ? { start: 0, end: loopLengths[loopIndex] } : null}
          height={140}
          playing={isPlaying}
        />
      </div>

      <div className="grid grid-cols-[80px,1fr,96px] gap-4 items-center">
        <div className="flex flex-col items-center gap-2">
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={handlePlayPause}
            className={`w-full px-3 py-2 rounded-lg text-sm font-semibold text-white shadow-lg bg-gradient-to-r ${accentGradient}`}
          >
            {isPlaying ? 'Pause' : 'Play'}
          </motion.button>
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <span>Loop</span>
            <button onClick={toggleLoopHold} className={`px-2 py-1 rounded-md border ${loopOn ? accentBorder + ' text-white bg-white/10' : 'border-white/10 text-gray-300'}`}>
              {loopOn ? `${loopLengths[loopIndex]}s` : 'Off'}
            </button>
            <button onClick={cycleLoopLength} className="px-2 py-1 rounded-md border border-white/10 text-gray-300">Cycle</button>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-4 gap-4">
            <div className="flex flex-col items-center gap-1">
              <span className="text-xs text-gray-400">Vol</span>
              <div className="h-28 w-10 flex items-end">
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={volume}
                  onChange={(e) => setVolume(parseFloat(e.target.value))}
                  className="w-full h-28 appearance-none bg-transparent rotate-[-90deg] origin-bottom"
                  style={{ accentColor: id === 'A' ? '#b45bff' : '#4fd1ff' }}
                />
              </div>
              <span className="text-[11px] text-gray-400">{Math.round(volume * 100)}%</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <span className="text-xs text-gray-400">Low</span>
              <Knob tone={id} value={low} onChange={(v: number) => setLow(v)} />
              <span className="text-[11px] text-gray-500">{((low - 0.5) * 24).toFixed(1)} dB</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <span className="text-xs text-gray-400">Mid</span>
              <Knob tone={id} value={mid} onChange={(v: number) => setMid(v)} />
              <span className="text-[11px] text-gray-500">{((mid - 0.5) * 24).toFixed(1)} dB</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <span className="text-xs text-gray-400">High</span>
              <Knob tone={id} value={high} onChange={(v: number) => setHigh(v)} />
              <span className="text-[11px] text-gray-500">{((high - 0.5) * 24).toFixed(1)} dB</span>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs text-gray-300">
            <button
              onClick={() => setFxOn((s) => !s)}
              className={`px-3 py-1.5 rounded-md border ${fxOn ? accentBorder + ' text-white bg-white/10' : 'border-white/10 text-gray-200'}`}
            >
              FX {fxOn ? 'On' : 'Off'}
            </button>
            <div className="flex items-center gap-2 w-48">
              <div className="text-xs text-gray-400 w-10">Wet</div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={fxWet}
                onChange={(e) => setFxWet(parseFloat(e.target.value))}
                className="w-full"
                style={{ accentColor: id === 'A' ? '#b45bff' : '#4fd1ff' }}
              />
              <div className="w-10 text-right text-[11px] text-gray-400">{Math.round(fxWet * 100)}%</div>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center justify-between gap-2 h-full">
          <div className="text-xs text-gray-400">Level</div>
          <div className="w-12">
            <Meter level={rms ? Math.min(1, rms * 5) : 0} />
          </div>
          <div className="text-[11px] text-gray-500">{duration ? formatTime(duration - currentTime) : '-:--'}</div>
        </div>
      </div>
    </motion.div>
  );
});

Deck.displayName = 'Deck';
export default Deck;
