export type GameMode = 'HOME' | 'PLAY' | 'PRACTICE';

export type ZombieType = 'STANDING' | 'CRAWLER' | 'BOSS' | 'RUNNER' | 'BRUTE' | 'SPITTER' | 'SCREAMER' | 'EXPLODER' | 'STALKER';

export interface Zombie {
  id: string;
  type: ZombieType;
  position: [number, number, number];
  health: number;
  maxHealth: number;
  speed: number;
  damage: number;
  radius: number;
  rotationY: number;
  attackCooldown: number;
  isAttacking: boolean;
  hitFlashTime: number;
  healthBarShown?: boolean;
  glowColor: string;
  isDead?: boolean;
  deathTime?: number;
}

export interface Target {
  id: string;
  position: [number, number, number];
  radius: number;
  points: number;
  isHit: boolean;
  hitTime: number;
  speed: number;
  axis: 'x' | 'y' | 'z';
  minRange: number;
  maxRange: number;
  direction: number;
}

export interface Particle {
  id: string;
  position: [number, number, number];
  velocity: [number, number, number];
  color: string;
  size: number;
  life: number;
  maxLife: number;
}

export interface PlayerStats {
  hp: number;
  maxHp: number;
  ammo: number;
  maxAmmo: number;
  reloadTimeInZone: number;
  kills: number;
  wave: number;
  score: number;
  shotsFired: number;
  shotsHit: number;
  headshots: number;
  practiceScore: number;
  practiceTargetsHit: number;
}

export interface WeaponDefinition {
  id: 'SERVICE_9' | 'VANGUARD_SMG' | 'BREACHER_12' | 'ARCHIVIST_AR' | 'OBSIDIAN_MAGNUM';
  name: string;
  className: string;
  damage: number;
  headshotMultiplier: number;
  magazineSize: number;
  fireInterval: number;
  spread: number;
  automatic: boolean;
  reloadSeconds: number;
  accent: string;
  description: string;
}
export interface GameSettings {
  soundEnabled: boolean;
  gyroEnabled: boolean;
  sensitivity: number;
  flashlightOn: boolean;
  vrStereoMode: boolean;
  laserColor: string;
  graphicsQuality?: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface DirectionalWarning {
  direction: 'FRONT' | 'BACK' | 'LEFT' | 'RIGHT';
  angle: number;
  distance: number;
}
