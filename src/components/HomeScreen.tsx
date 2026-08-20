import React, { useMemo, useState } from 'react';
import { CircleHelp, Play, Volume2, VolumeX } from 'lucide-react';
import { GameMode, GameSettings } from '../types';
import { soundManager } from '../utils/audio';

interface HomeScreenProps {
  onStartGame: (mode: GameMode) => void;
  settings: GameSettings;
  onUpdateSettings: (updates: Partial<GameSettings>) => void;
  bestKills: number;
  bestWave: number;
  allTimeKills: number;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  onStartGame,
  settings,
  onUpdateSettings,
  bestKills,
  bestWave,
  allTimeKills,
}) => {
  const [showHowToPlay, setShowHowToPlay] = useState(false);
  const stats = useMemo(() => [
    { label: 'Best wave', value: bestWave },
    { label: 'Best kills', value: bestKills },
    { label: 'Total kills', value: allTimeKills },
  ], [allTimeKills, bestKills, bestWave]);

  const startGame = () => {
    soundManager.playGunshot();
    onStartGame('PLAY');
  };

  return (
    <div id="home-screen" className="relative h-full w-full overflow-hidden bg-[#080909] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_38%,rgba(255,255,255,0.045),transparent_42%),linear-gradient(180deg,#151515_0%,#090909_58%,#030303_100%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-25 [background-image:repeating-linear-gradient(0deg,transparent_0,transparent_3px,rgba(255,255,255,0.035)_4px)]" />
      <header className="relative z-10 flex h-12 items-center justify-between border-b border-white/10 bg-black/35 px-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))]">
        <button onClick={() => setShowHowToPlay(true)} className="flex h-8 items-center gap-2 border border-zinc-600 bg-[#111] px-3 font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-300 active:scale-95">
          <CircleHelp className="h-3.5 w-3.5 text-zinc-400" />
          How to play
        </button>
        <button
          onClick={() => onUpdateSettings({ soundEnabled: !settings.soundEnabled })}
          className="grid h-8 w-8 place-items-center border border-zinc-600 bg-[#171818] text-zinc-200 active:scale-95"
          title={settings.soundEnabled ? 'Mute sound' : 'Turn on sound'}
          aria-label={settings.soundEnabled ? 'Mute sound' : 'Turn on sound'}
        >
          {settings.soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
        </button>
      </header>

      <main className="relative z-10 mx-auto flex h-[calc(100%-3rem)] w-full max-w-3xl flex-col justify-center px-[max(1.25rem,env(safe-area-inset-left))] pb-[max(1rem,env(safe-area-inset-bottom))] pr-[max(1.25rem,env(safe-area-inset-right))]">
        <section className="bg-black/20 py-2">
          <h1 className="font-display text-5xl leading-none tracking-[0.04em] text-[#ff6600] sm:text-6xl">OUTBREAK</h1>
          <p className="mt-3 font-mono text-xs text-zinc-300">Find ammo. Stop the zombies. Stay alive.</p>
        </section>

        <section className="mt-8 border border-zinc-700 bg-[#0c0c0c]/90">
          <div className="grid grid-cols-3">
            {stats.map((stat, index) => (
              <div key={stat.label} className={`min-w-0 px-2 py-4 text-center sm:px-4 ${index ? 'border-l border-zinc-700' : ''}`}>
                <div className="font-display text-2xl leading-none text-[#ff6600] sm:text-3xl">{stat.value.toLocaleString()}</div>
                <div className="mt-2 font-mono text-[8px] uppercase tracking-[0.08em] text-zinc-500 sm:text-[9px]">{stat.label}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-7">
          <button onClick={startGame} className="flex min-h-14 w-full items-center justify-center gap-2 bg-[#ff6600] px-4 text-black transition-transform active:scale-[0.98]">
            <Play className="h-5 w-5 fill-current" />
            <span className="font-display text-xl uppercase">Play</span>
          </button>
        </section>
      </main>

      {showHowToPlay && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/85 p-5">
          <div className="w-full max-w-sm border border-zinc-600 bg-[#101010] p-5 text-left shadow-[0_18px_48px_rgba(0,0,0,0.7)]">
            <h2 className="font-display text-2xl uppercase text-[#ff6600]">How to play</h2>
            <p className="mt-3 font-mono text-xs leading-6 text-zinc-300">Move with the left stick. Aim by rotating phone. Walk into an ammo cache to reload. Keep moving and clear each wave.</p>
            <button onClick={() => setShowHowToPlay(false)} className="mt-5 min-h-11 w-full border border-zinc-600 bg-[#171717] font-display text-base uppercase text-zinc-100 active:scale-[0.98]">Close</button>
          </div>
        </div>
      )}
    </div>
  );
};
