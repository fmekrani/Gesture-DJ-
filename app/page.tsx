"use client";

import { motion } from 'framer-motion';
import { useEffect, useState, useRef } from 'react';
import Deck from '../components/Deck';
import type { DeckHandle } from '../components/Deck';
import Crossfader from '../components/Crossfader';
import CameraHUD from '../components/CameraHUD';
import Settings from '../components/Settings';
import audioEngine from '../lib/audio/engineInstance';

export default function Page() {
  const [started, setStarted] = useState(false);
  const [cf, setCf] = useState(0.5);
  const deckARef = useRef<DeckHandle>(null);
  const deckBRef = useRef<DeckHandle>(null);

  function handleStart() {
    setStarted(true);
    audioEngine.getOrCreateContext();
  }

  function onCrossfade(v: number) {
    setCf(v);
    audioEngine.setCrossfade(v);
  }

  // Pass deck refs to CameraHUD via context or callback
  useEffect(() => {
    (window as any).__deckRefs = { A: deckARef, B: deckBRef };
  }, []);

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
    <div className="px-4 sm:px-6 md:px-8 py-6 max-w-7xl mx-auto">
      <header className="flex items-center justify-between mb-8">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-gray-400">Live Gesture Deck</p>
          <h1 className="text-3xl font-semibold leading-tight">GestureDJ</h1>
        </div>
        <div className="space-x-3 flex items-center">
          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={handleStart}
            className="bg-gradient-to-r from-purple-500 via-pink-500 to-orange-400 px-4 py-2 rounded-lg text-white shadow-lg glow-ring"
          >
            Start DJ Mode
          </motion.button>
          <div className="ml-2">
            <Settings />
          </div>
        </div>
      </header>

      <section className="grid gap-5 md:grid-cols-[1fr,minmax(320px,420px),1fr] items-start">
        <div className="col-span-1"><Deck ref={deckARef} id="A" /></div>
        <div className="col-span-1 flex flex-col items-center gap-4">
          <Crossfader value={cf} onChange={onCrossfade} />
        </div>
        <div className="col-span-1"><Deck ref={deckBRef} id="B" /></div>
      </section>

      <div className="mt-8 flex justify-center">
        <CameraHUD />
      </div>

      <footer className="mt-10 text-sm text-gray-400 text-center">Camera and audio permissions will be requested when entering DJ Mode.</footer>
    </div>
  );
}
