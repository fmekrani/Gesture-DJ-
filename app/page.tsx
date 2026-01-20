"use client";

import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import Deck from '../components/Deck';
import Crossfader from '../components/Crossfader';
import CameraHUD from '../components/CameraHUD';
import Settings from '../components/Settings';
import audioEngine from '../lib/audio/engineInstance';

export default function Page() {
  const [started, setStarted] = useState(false);
  const [cf, setCf] = useState(0.5);

  function handleStart() {
    setStarted(true);
    audioEngine.getOrCreateContext();
  }

  function onCrossfade(v: number) {
    setCf(v);
    audioEngine.setCrossfade(v);
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (document.activeElement && (document.activeElement as HTMLElement).tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.code === 'Space') {
        // toggle both decks: if either playing, pause both; otherwise play both
        const a = audioEngine.getDeckInfo('A').isPlaying;
        const b = audioEngine.getDeckInfo('B').isPlaying;
        if (a || b) {
          audioEngine.pauseDeck('A');
          audioEngine.pauseDeck('B');
        } else {
          audioEngine.playDeck('A');
          audioEngine.playDeck('B');
        }
        e.preventDefault();
      } else if (e.key === '1') {
        const info = audioEngine.getDeckInfo('A');
        if (info.isPlaying) audioEngine.pauseDeck('A'); else audioEngine.playDeck('A');
      } else if (e.key === '2') {
        const info = audioEngine.getDeckInfo('B');
        if (info.isPlaying) audioEngine.pauseDeck('B'); else audioEngine.playDeck('B');
      } else if (e.key === 'ArrowLeft') {
        const nv = Math.max(0, cf - 0.05);
        setCf(nv); audioEngine.setCrossfade(nv);
      } else if (e.key === 'ArrowRight') {
        const nv = Math.min(1, cf + 0.05);
        setCf(nv); audioEngine.setCrossfade(nv);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [cf]);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <header className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-semibold">GestureDJ</h1>
        <div className="space-x-3 flex items-center">
          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={handleStart}
            className="bg-gradient-to-r from-purple-600 to-pink-500 px-4 py-2 rounded-lg text-white shadow-lg"
          >
            Start DJ Mode
          </motion.button>
          <div className="ml-4">
            <Settings />
          </div>
        </div>
      </header>

      <section className="grid grid-cols-3 gap-6">
        <div className="col-span-1"><Deck id="A" /></div>
        <div className="col-span-1 flex flex-col items-center gap-4">
          <Crossfader value={cf} onChange={onCrossfade} />
          <CameraHUD />
        </div>
        <div className="col-span-1"><Deck id="B" /></div>
      </section>

      <footer className="mt-8 text-sm text-gray-400">Camera and audio permissions will be requested when entering DJ Mode.</footer>
    </div>
  );
}
