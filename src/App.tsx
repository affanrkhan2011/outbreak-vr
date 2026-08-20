import React, { useEffect, useState } from 'react';
import { DirectionalWarning, GameMode, GameSettings, PlayerStats } from './types';
import { HomeScreen } from './components/HomeScreen';
import { GameCanvas } from './components/GameCanvas';
import { GameHUD } from './components/GameHUD';
import { soundManager } from './utils/audio';
import { isDesktopInputDevice } from './utils/device';

const createStats = (): PlayerStats => ({
  hp: 150,
  maxHp: 150,
  ammo: 30,
  maxAmmo: 30,
  reloadTimeInZone: 0,
  kills: 0,
  wave: 1,
  score: 0,
  shotsFired: 0,
  shotsHit: 0,
  headshots: 0,
  practiceScore: 0,
  practiceTargetsHit: 0,
});

export default function App() {
  const [mode, setMode] = useState<GameMode>('HOME');
  const [stats, setStats] = useState<PlayerStats>(createStats);
  const [settings, setSettings] = useState<GameSettings>({
    soundEnabled: true,
    gyroEnabled: true,
    sensitivity: 1.2,
    flashlightOn: true,
    vrStereoMode: false,
    laserColor: '#3b82f6',
  });
  const [isPaused, setIsPaused] = useState(false);
  const [isDamaged, setIsDamaged] = useState(false);
  const [warnings, setWarnings] = useState<DirectionalWarning[]>([]);
  const [waveBonusMessage, setWaveBonusMessage] = useState<string | null>(null);
  const [recenterSignal, setRecenterSignal] = useState(0);
  const [gameRunId, setGameRunId] = useState(0);
  const [isDesktopInput, setIsDesktopInput] = useState(isDesktopInputDevice);
  const [bestKills, setBestKills] = useState(() => parseInt(localStorage.getItem('zombie_best_kills') || localStorage.getItem('zombie_high_kills') || '0', 10));
  const [bestWave, setBestWave] = useState(() => parseInt(localStorage.getItem('zombie_best_wave') || localStorage.getItem('zombie_max_wave') || '1', 10));
  const [allTimeKills, setAllTimeKills] = useState(() => parseInt(localStorage.getItem('zombie_all_time_kills') || '0', 10));

  useEffect(() => {
    soundManager.setMuted(!settings.soundEnabled);
  }, [settings.soundEnabled]);

  useEffect(() => {
    const updateInputMode = () => setIsDesktopInput(isDesktopInputDevice());
    updateInputMode();
    window.addEventListener('resize', updateInputMode);
    return () => window.removeEventListener('resize', updateInputMode);
  }, []);

  useEffect(() => {
    const handleEscapePause = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || mode === 'HOME' || stats.hp <= 0) return;
      event.preventDefault();
      setIsPaused((value) => !value);
    };

    window.addEventListener('keydown', handleEscapePause);
    return () => window.removeEventListener('keydown', handleEscapePause);
  }, [mode, stats.hp]);

  const requestGyroPermission = async () => {
    try {
      const orientation = DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> };
      if (typeof orientation.requestPermission === 'function') await orientation.requestPermission();
      const motion = DeviceMotionEvent as unknown as { requestPermission?: () => Promise<string> };
      if (typeof motion.requestPermission === 'function') await motion.requestPermission();
    } catch (error) {
      console.warn('Gyro permission request:', error);
    }
  };

  const handleStartGame = (selectedMode: GameMode) => {
    void requestGyroPermission();
    setMode(selectedMode);
    setIsPaused(false);
    setWarnings([]);
    setWaveBonusMessage(null);
    setRecenterSignal((value) => value + 1);
    setGameRunId((value) => value + 1);
    setStats(createStats());
  };

  const handlePlayerHit = (damage: number) => {
    setIsDamaged(true);
    window.setTimeout(() => setIsDamaged(false), 250);
    setStats((current) => ({ ...current, hp: Math.max(0, current.hp - damage) }));
  };

  const handleZombieKill = (_zombieId: string, isHeadshot: boolean) => {
    setStats((current) => {
      const kills = current.kills + 1;
      if (kills > bestKills) {
        setBestKills(kills);
        localStorage.setItem('zombie_best_kills', String(kills));
        localStorage.setItem('zombie_high_kills', String(kills));
      }
      const totalKills = allTimeKills + 1;
      setAllTimeKills(totalKills);
      localStorage.setItem('zombie_all_time_kills', String(totalKills));
      return {
        ...current,
        kills,
        headshots: current.headshots + (isHeadshot ? 1 : 0),
        hp: Math.min(current.maxHp, current.hp + (isHeadshot ? 2 : 1)),
        score: current.score + (isHeadshot ? 250 : 100),
      };
    });
  };

  const handleTargetHit = (_targetId: string, isBullseye: boolean) => {
    setStats((current) => ({
      ...current,
      practiceTargetsHit: current.practiceTargetsHit + 1,
      practiceScore: current.practiceScore + (isBullseye ? 200 : 100),
    }));
  };

  const handleShotFired = (hitSomething: boolean) => {
    setStats((current) => ({
      ...current,
      ammo: Math.max(0, current.ammo - 1),
      shotsFired: current.shotsFired + 1,
      shotsHit: current.shotsHit + (hitSomething ? 1 : 0),
    }));
  };

  const handleReloadProgress = (progressTime: number, isRefilled: boolean) => {
    setStats((current) => ({
      ...current,
      reloadTimeInZone: progressTime,
      ammo: isRefilled ? current.maxAmmo : current.ammo,
    }));
  };

  const handleWaveClear = () => {
    setWaveBonusMessage('+5 HP WAVE BONUS RESTORED!');
    setStats((current) => {
      const nextWave = current.wave + 1;
      if (nextWave > bestWave) {
        setBestWave(nextWave);
        localStorage.setItem('zombie_best_wave', String(nextWave));
        localStorage.setItem('zombie_max_wave', String(nextWave));
      }
      return { ...current, wave: nextWave, hp: Math.min(current.maxHp, current.hp + 5) };
    });
    window.setTimeout(() => setWaveBonusMessage(null), 2800);
  };

  return (
    <div className="relative h-screen w-screen select-none overflow-hidden bg-black font-sans text-white">
      {mode === 'HOME' ? (
        <HomeScreen
          onStartGame={handleStartGame}
          settings={settings}
          onUpdateSettings={(updates) => setSettings((current) => ({ ...current, ...updates }))}
          bestKills={bestKills}
          bestWave={bestWave}
          allTimeKills={allTimeKills}
        />
      ) : (
        <div className="relative h-full w-full">
          <GameCanvas
            key={`${mode}-${gameRunId}`}
            mode={mode}
            settings={settings}
            isDesktopInput={isDesktopInput}
            isPaused={isPaused}
            wave={stats.wave}
            hp={stats.hp}
            ammo={stats.ammo}
            recenterSignal={recenterSignal}
            onPlayerHit={handlePlayerHit}
            onZombieKill={handleZombieKill}
            onTargetHit={handleTargetHit}
            onShotFired={handleShotFired}
            onReloadProgress={handleReloadProgress}
            onDirectionalUpdate={setWarnings}
            onWaveClear={handleWaveClear}
          />
          <GameHUD
            mode={mode}
            stats={stats}
            settings={settings}
            isDesktopInput={isDesktopInput}
            isPaused={isPaused}
            isDamaged={isDamaged}
            warnings={warnings}
            waveBonusMessage={waveBonusMessage}
            onTogglePause={() => setIsPaused((value) => !value)}
            onUpdateSettings={(updates) => setSettings((current) => ({ ...current, ...updates }))}
            onRestartGame={() => handleStartGame(mode)}
            onExitHome={() => setMode('HOME')}
            onRecenterGyro={() => setRecenterSignal((value) => value + 1)}
          />
        </div>
      )}
    </div>
  );
}
