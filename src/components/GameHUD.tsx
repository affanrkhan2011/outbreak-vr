import React from 'react';
import { Crosshair, Pause, Play, RefreshCw, Volume2, VolumeX } from 'lucide-react';
import { DirectionalWarning, GameMode, GameSettings, PlayerStats } from '../types';

interface GameHUDProps {
  mode: GameMode;
  stats: PlayerStats;
  settings: GameSettings;
  isPaused: boolean;
  isDamaged: boolean;
  warnings: DirectionalWarning[];
  waveBonusMessage: string | null;
  onTogglePause: () => void;
  onUpdateSettings: (updates: Partial<GameSettings>) => void;
  onRestartGame: () => void;
  onExitHome: () => void;
  onResetPracticeTargets?: () => void;
  onRecenterGyro?: () => void;
}

export const GameHUD: React.FC<GameHUDProps> = ({
  mode, stats, settings, isPaused, isDamaged, warnings, waveBonusMessage,
  onTogglePause, onUpdateSettings, onRestartGame, onExitHome, onResetPracticeTargets, onRecenterGyro,
}) => {
  const hpPercent = Math.max(0, Math.min(100, (stats.hp / stats.maxHp) * 100));
  const closeZombies = warnings.filter((warning) => warning.distance < 4);
  const behindThreat = closeZombies.some((warning) => warning.direction === 'BACK');
  const leftThreat = closeZombies.some((warning) => warning.direction === 'LEFT');
  const rightThreat = closeZombies.some((warning) => warning.direction === 'RIGHT');
  const isDead = stats.hp <= 0 && mode === 'PLAY';

  return (
    <div id="game-hud-overlay" className="pointer-events-none absolute inset-0 z-10 flex select-none flex-col justify-between px-[max(1.25rem,env(safe-area-inset-left))] pb-[max(0.8rem,env(safe-area-inset-bottom))] pr-[max(1.25rem,env(safe-area-inset-right))] pt-[max(0.8rem,env(safe-area-inset-top))]">
      {isDamaged && <div className="pointer-events-none absolute inset-0 bg-red-600/45 mix-blend-screen animate-pulse" />}
      {waveBonusMessage && <div className="pointer-events-none absolute left-1/2 top-[30%] -translate-x-1/2 border-y border-[#ff6600]/60 bg-black/70 px-5 py-2 text-center font-mono"><div className="text-xl uppercase text-white">Wave Cleared</div><div className="text-[11px] uppercase tracking-[0.14em] text-[#ff6600]">{waveBonusMessage}</div></div>}
      {mode === 'PLAY' && !isPaused && <div className="pointer-events-none absolute left-1/2 top-20 -translate-x-1/2 font-mono text-[11px] uppercase tracking-[0.14em]">{behindThreat ? <span className="animate-pulse text-red-300">[ Behind You ]</span> : leftThreat ? <span className="text-white">[ Left Threat ]</span> : rightThreat ? <span className="text-white">[ Right Threat ]</span> : null}</div>}
      {mode === 'PLAY' && !isPaused && <div className="pointer-events-none absolute left-1/2 top-28 -translate-x-1/2 font-mono text-center">
        {stats.reloadTimeInZone > 0 && stats.ammo < stats.maxAmmo && <div className="border border-[#b8c98f]/80 bg-[#172019]/95 px-4 py-2"><div className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#e6efcb]">Ammo Cache // Reloading</div><div className="mt-2 h-1.5 w-44 overflow-hidden border border-[#71815c] bg-black/60"><div className="h-full bg-[#d8e6a8]" style={{ width: `${(stats.reloadTimeInZone / 2) * 100}%` }} /></div></div>}
        {stats.ammo === 0 && stats.reloadTimeInZone === 0 && <div className="border border-[#ff6600]/80 bg-black/85 px-4 py-2 text-[11px] uppercase text-[#ff7a1a]">Out of ammo // Find a lit ammo cache</div>}
      </div>}

      <div className="pointer-events-auto flex items-start justify-between gap-3 font-mono">
        <div className="w-[min(27vw,220px)] border border-white/10 bg-black/55 p-2 backdrop-blur-sm"><div className="flex items-end justify-between"><span className="text-[10px] uppercase text-[#ff6600]">HP</span><span className={`text-lg leading-none ${stats.hp <= 30 ? 'animate-pulse text-red-300' : 'text-white'}`}>{stats.hp}</span></div><div className="mt-1 h-1 bg-zinc-900"><div className={`h-full ${stats.hp <= 30 ? 'bg-red-500' : 'bg-white'}`} style={{ width: `${hpPercent}%` }} /></div><div className="mt-2 flex items-end justify-between"><span className="text-[9px] uppercase text-emerald-400">Ammo</span><span className={`text-sm font-bold leading-none ${stats.ammo === 0 ? 'text-red-300' : 'text-emerald-400'}`}>{stats.ammo} / {stats.maxAmmo}</span></div><div className="mt-1 h-1 bg-zinc-900"><div className={`h-full ${stats.ammo === 0 ? 'bg-red-500' : 'bg-emerald-400'}`} style={{ width: `${(stats.ammo / stats.maxAmmo) * 100}%` }} /></div></div>
        <div className="flex items-start gap-3"><div className="flex gap-3 border border-white/10 bg-black/55 px-3 py-2 backdrop-blur-sm"><div><div className="text-[8px] uppercase text-zinc-500">Wave</div><div className="text-xl leading-none text-white">{mode === 'PLAY' ? stats.wave : stats.practiceScore}</div></div><div><div className="text-[8px] uppercase text-zinc-500">{mode === 'PLAY' ? 'Kills' : 'Hits'}</div><div className="text-xl leading-none text-[#ff6600]">{mode === 'PLAY' ? stats.kills : stats.practiceTargetsHit}</div></div></div><div className="flex gap-1">{onRecenterGyro && <button onClick={onRecenterGyro} className="grid h-9 w-9 place-items-center border border-white/10 bg-black/65 text-zinc-300 active:scale-95" title="Recenter aim"><Crosshair className="h-4 w-4" /></button>}{mode === 'PRACTICE' && onResetPracticeTargets && <button onClick={onResetPracticeTargets} className="grid h-9 w-9 place-items-center border border-white/10 bg-black/65 text-zinc-300"><RefreshCw className="h-4 w-4" /></button>}<button onClick={() => onUpdateSettings({ soundEnabled: !settings.soundEnabled })} className="grid h-9 w-9 place-items-center border border-white/10 bg-black/65 text-zinc-300" title="Toggle sound">{settings.soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}</button><button onClick={onTogglePause} className="grid h-9 w-9 place-items-center border border-[#ff6600]/45 bg-black/65 text-[#ff8a3d]" title="Pause"><Pause className="h-4 w-4" /></button></div></div>
      </div>

      {(isPaused || isDead) && <div className="pointer-events-auto absolute inset-0 z-50 flex items-center justify-center bg-[#090909]/95 p-4"><div className="w-full max-w-md border border-zinc-700 bg-[#151515] p-6 text-center"><h2 className="font-display text-4xl uppercase text-[#ff6600]">{isDead ? 'Dead' : 'Paused'}</h2><div className="mx-auto mt-5 grid grid-cols-2 border border-zinc-700 bg-[#101010] font-mono"><div className="py-3"><div className="text-xl text-white">{stats.wave}</div><div className="mt-1 text-[8px] uppercase text-zinc-500">Wave</div></div><div className="border-l border-zinc-700 py-3"><div className="text-xl text-[#ff6600]">{stats.kills}</div><div className="mt-1 text-[8px] uppercase text-zinc-500">Kills</div></div></div><div className="mt-5 grid grid-cols-2 gap-3">{isPaused && !isDead ? <button onClick={onTogglePause} className="flex min-h-14 items-center justify-center gap-2 bg-[#ff6600] font-display text-lg uppercase text-black active:scale-[0.98]"><Play className="h-4 w-4 fill-current" />Resume</button> : <button onClick={onRestartGame} className="min-h-14 bg-[#ff6600] font-display text-lg uppercase text-black active:scale-[0.98]">Retry</button>}<button onClick={onExitHome} className="min-h-14 border border-zinc-600 bg-[#181818] font-display text-lg uppercase text-zinc-200 active:scale-[0.98]">Menu</button></div></div></div>}
    </div>
  );
};
