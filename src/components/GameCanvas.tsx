import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GameMode, Zombie, ZombieType, Target, GameSettings, DirectionalWarning, WeaponDefinition } from '../types';
import { soundManager } from '../utils/audio';

const DEFAULT_WEAPON: WeaponDefinition = {
  id: 'SERVICE_9', name: 'Service 9', className: 'Sidearm', damage: 58,
  headshotMultiplier: 2.35, magazineSize: 30, fireInterval: 290,
  spread: 0.002, automatic: false, reloadSeconds: 2,
  accent: '#ff8a3d', description: 'Standard sidearm',
};
const BULLET_TRACER_GEOMETRY = new THREE.CylinderGeometry(0.012, 0.02, 1, 6);
const BULLET_TRACER_MATERIAL = new THREE.MeshBasicMaterial({
  color: 0xffd08a,
  transparent: true,
  opacity: 0.92,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
});
const IMPACT_PARTICLE_GEOMETRY = new THREE.BoxGeometry(1, 1, 1);
// --- THREE.JS DEVICE ORIENTATION MATHEMATICS ---
const zee = new THREE.Vector3(0, 0, 1);
const tempEuler = new THREE.Euler();
const q0 = new THREE.Quaternion();
const q1 = new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5)); // -90 deg X rotation

const computeDeviceQuaternion = (alpha: number, beta: number, gamma: number, orient: number): THREE.Quaternion => {
  const alphaRad = alpha ? THREE.MathUtils.degToRad(alpha) : 0;
  const betaRad = beta ? THREE.MathUtils.degToRad(beta) : 0;
  const gammaRad = gamma ? THREE.MathUtils.degToRad(gamma) : 0;
  const orientRad = orient ? THREE.MathUtils.degToRad(orient) : 0;

  tempEuler.set(betaRad, alphaRad, -gammaRad, 'YXZ');
  const q = new THREE.Quaternion();
  q.setFromEuler(tempEuler);
  q.multiply(q1); // Orient camera looking down -Z axis
  q.multiply(q0.setFromAxisAngle(zee, -orientRad)); // Screen orientation compensation
  return q;
};

// RED ZOMBIE SPAWN POINTS - expanded library wings and side corridors
const RED_ZOMBIE_SPAWNS = [
  { x: -18, z: -16 },
  { x: -7, z: -17 },
  { x: 8, z: -17 },
  { x: 18, z: -15 },
  { x: -19, z: -2 },
  { x: 19, z: 1 },
  { x: -16, z: 15 },
  { x: -4, z: 18 },
  { x: 9, z: 17 },
  { x: 18, z: 13 },
];

// ORANGE BOSS SPAWN POINT
const ORANGE_BOSS_SPAWN = { x: -19, z: 0 };

// BLUE PLAYER SPAWN POINT
const BLUE_PLAYER_SPAWN = { x: 1, y: 1.6, z: -2 };

interface MapWall {
  x: number;
  z: number;
  width: number;
  depth: number;
  rotY?: number;
}

// Wider museum-library layout. Every corridor is kept comfortably wider than player and zombie collision radii.
const MAP_WALLS: MapWall[] = [
  { x: -11.5, z: -10.5, width: 8.5, depth: 0.55 },
  { x: -7.5, z: -6.5, width: 0.55, depth: 6.2 },
  { x: 8.5, z: -10.5, width: 8.5, depth: 0.55 },
  { x: 12.5, z: -6.0, width: 0.55, depth: 6.8 },
  { x: 0, z: -5.2, width: 5.0, depth: 0.55 },
  { x: -13.0, z: 1.5, width: 0.55, depth: 8.0 },
  { x: -4.0, z: 1.5, width: 6.0, depth: 0.55 },
  { x: 6.0, z: 1.4, width: 6.4, depth: 0.55 },
  { x: 14.0, z: 3.0, width: 0.55, depth: 8.0 },
  { x: -10.5, z: 10.0, width: 8.5, depth: 0.55 },
  { x: -6.3, z: 13.7, width: 0.55, depth: 5.5 },
  { x: 7.0, z: 10.2, width: 8.0, depth: 0.55 },
  { x: 2.0, z: 14.5, width: 0.55, depth: 5.4 },
];

// The dressed shelves and desks now use the same physical footprint as their visual model.
// Bosses can remove only a fixture they make contact with; every other actor treats it as solid.
const SCENERY_SOLIDS: Array<MapWall & { id: string }> = [
  { id: 'edge-shelf-0', x: -15.4, z: -19.65, width: 6.6, depth: 0.46 },
  { id: 'edge-shelf-1', x: 1.8, z: -19.65, width: 6.2, depth: 0.46 },
  { id: 'edge-shelf-2', x: 14.7, z: -19.65, width: 5.4, depth: 0.46 },
  { id: 'edge-shelf-3', x: -14.8, z: 19.65, width: 5.7, depth: 0.46, rotY: Math.PI },
  { id: 'edge-shelf-4', x: 10.6, z: 19.65, width: 7.2, depth: 0.46, rotY: Math.PI },
  { id: 'edge-shelf-5', x: -19.65, z: -10.2, width: 5.6, depth: 0.46, rotY: Math.PI / 2 },
  { id: 'edge-shelf-6', x: -19.65, z: 10.5, width: 5.8, depth: 0.46, rotY: Math.PI / 2 },
  { id: 'edge-shelf-7', x: 19.65, z: -7.6, width: 5.2, depth: 0.46, rotY: -Math.PI / 2 },
  { id: 'edge-shelf-8', x: 19.65, z: 9.0, width: 5.8, depth: 0.46, rotY: -Math.PI / 2 },
  { id: 'desk-0', x: 0.35, z: -5.8, width: 3.55, depth: 1.55, rotY: 0.02 },
  { id: 'desk-1', x: -15, z: -5, width: 2.4, depth: 1.25, rotY: 0.35 },
  { id: 'desk-2', x: 15, z: -4, width: 2.4, depth: 1.25, rotY: -0.28 },
  { id: 'desk-3', x: -1, z: 11.5, width: 2.4, depth: 1.25, rotY: 0.18 },
  { id: 'desk-4', x: -17.4, z: -6.4, width: 2.4, depth: 1.25, rotY: Math.PI / 2 },
  { id: 'desk-5', x: 17.1, z: 7.2, width: 2.4, depth: 1.25, rotY: -Math.PI / 2 },
  { id: 'desk-6', x: -9.8, z: 17.6, width: 2.4, depth: 1.25, rotY: Math.PI },
  { id: 'desk-7', x: 9.4, z: -17.6, width: 2.4, depth: 1.25 },
];
const SOLID_FIXTURES: Array<MapWall & { id: string }> = [
  ...MAP_WALLS.map((wall, index) => ({ ...wall, id: `shelf-${index}` })),
  ...SCENERY_SOLIDS,
];

// Multiple reload zones, each kept clear from shelf collision.
const makeTexture = (size: number, draw: (ctx: CanvasRenderingContext2D, size: number) => void, repeatX = 1, repeatY = 1) => {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) draw(ctx, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeatX, repeatY);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 2;
  return texture;
};

const makeWeatheredWoodTexture = (repeatX = 1, repeatY = 1) => makeTexture(512, (ctx, size) => {
  const gradient = ctx.createLinearGradient(0, 0, size, 0);
  gradient.addColorStop(0, '#2a160c');
  gradient.addColorStop(0.24, '#5b3219');
  gradient.addColorStop(0.52, '#3a2114');
  gradient.addColorStop(0.78, '#704522');
  gradient.addColorStop(1, '#211109');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  for (let x = 0; x < size; x += 5) {
    const shade = 18 + (x * 17) % 42;
    ctx.strokeStyle = 'rgba(' + shade + ',' + Math.floor(shade * 0.58) + ',22,0.22)';
    ctx.lineWidth = 1 + (x % 4);
    ctx.beginPath();
    ctx.moveTo(x + Math.sin(x) * 4, 0);
    for (let y = 0; y <= size; y += 24) ctx.lineTo(x + Math.sin((x + y) * 0.035) * 10, y);
    ctx.stroke();
  }
  for (let i = 0; i < 180; i++) {
    const x = (i * 47) % size;
    const y = (i * 89) % size;
    ctx.fillStyle = i % 3 === 0 ? 'rgba(0,0,0,0.28)' : 'rgba(190,126,63,0.16)';
    ctx.fillRect(x, y, 1 + (i % 9), 1 + (i % 3));
  }
}, repeatX, repeatY);

const makeCarpetTexture = () => makeTexture(512, (ctx, size) => {
  ctx.fillStyle = '#4b5550';
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 1400; i++) {
    const shade = 18 + ((i * 37) % 32);
    ctx.fillStyle = 'rgba(' + shade + ',' + (shade + 8) + ',' + (shade + 4) + ',' + (0.08 + (i % 5) * 0.025) + ')';
    ctx.fillRect((i * 71) % size, (i * 131) % size, 1 + (i % 3), 1 + ((i * 3) % 3));
  }
  for (let i = 0; i < 36; i++) {
    const x = (i * 97) % size;
    const y = (i * 53) % size;
    const radius = 8 + (i % 7) * 5;
    const stain = ctx.createRadialGradient(x, y, 0, x, y, radius);
    stain.addColorStop(0, i % 3 === 0 ? 'rgba(45,18,16,0.22)' : 'rgba(5,7,6,0.2)');
    stain.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = stain;
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }
}, 7, 7);
const makeWallTexture = () => makeTexture(512, (ctx, size) => {
  ctx.fillStyle = '#1c211d';
  ctx.fillRect(0, 0, size, size);
  for (let y = 0; y < size; y += 18) {
    ctx.fillStyle = 'rgba(74,83,73,0.16)';
    ctx.fillRect(0, y, size, 2);
  }
  for (let i = 0; i < 260; i++) {
    const alpha = 0.05 + (i % 6) * 0.025;
    ctx.fillStyle = i % 2 === 0 ? 'rgba(0,0,0,' + alpha + ')' : 'rgba(123,132,112,' + alpha + ')';
    ctx.fillRect((i * 61) % size, (i * 29) % size, 2 + (i % 32), 1 + (i % 13));
  }
}, 3, 2);

const makeMetalTexture = (repeatX = 1, repeatY = 1) => makeTexture(256, (ctx, size) => {
  ctx.fillStyle = '#31383a';
  ctx.fillRect(0, 0, size, size);
  for (let y = 0; y < size; y += 4) {
    ctx.fillStyle = y % 12 === 0 ? 'rgba(184,190,184,0.18)' : 'rgba(0,0,0,0.2)';
    ctx.fillRect(0, y, size, 1);
  }
  for (let i = 0; i < 100; i++) {
    ctx.fillStyle = i % 3 === 0 ? 'rgba(116,32,23,0.28)' : 'rgba(218,218,201,0.12)';
    ctx.fillRect((i * 37) % size, (i * 71) % size, 1 + (i % 16), 1 + (i % 4));
  }
}, repeatX, repeatY);

const makeLeatherTexture = (hex: string) => makeTexture(128, (ctx, size) => {
  ctx.fillStyle = hex;
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 80; i++) {
    ctx.fillStyle = i % 2 === 0 ? 'rgba(0,0,0,0.2)' : 'rgba(230,194,124,0.12)';
    ctx.fillRect((i * 19) % size, (i * 41) % size, 1 + (i % 8), 1);
  }
}, 1, 1);

const makeBookRowTexture = (seed: number) => makeTexture(512, (ctx, size) => {
  const colors = ['#6f3027', '#40584b', '#675334', '#473e5c', '#774426', '#7a6a3d', '#343a39'];
  ctx.fillStyle = '#17130f';
  ctx.fillRect(0, 0, size, size);
  let x = 0;
  let index = seed;
  while (x < size) {
    const width = 13 + ((index * 17) % 18);
    const top = 10 + ((index * 29) % 42);
    ctx.fillStyle = colors[index % colors.length];
    ctx.fillRect(x, top, width, size - top);
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.fillRect(x, top, 2, size - top);
    ctx.fillStyle = 'rgba(225,188,107,0.52)';
    if (index % 3 === 0) ctx.fillRect(x + 4, top + 70, Math.max(3, width - 8), 4);
    if (index % 4 === 0) ctx.fillRect(x + 4, size - 48, Math.max(3, width - 8), 3);
    x += width + 2;
    index += 1;
  }
}, 1, 1);

let zombieSkinTexture: THREE.CanvasTexture | null = null;
let zombieFabricTexture: THREE.CanvasTexture | null = null;

const getZombieSkinTexture = () => {
  if (zombieSkinTexture) return zombieSkinTexture;
  zombieSkinTexture = makeTexture(256, (ctx, size) => {
    ctx.fillStyle = '#a79a86';
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 520; i++) {
      const shade = 42 + ((i * 31) % 70);
      ctx.fillStyle = `rgba(${shade},${Math.floor(shade * 0.88)},${Math.floor(shade * 0.74)},0.13)`;
      ctx.fillRect((i * 73) % size, (i * 41) % size, 1 + (i % 3), 1 + ((i * 5) % 3));
    }
    ctx.strokeStyle = 'rgba(52,71,59,0.3)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 11; i++) {
      ctx.beginPath();
      ctx.moveTo((i * 37) % size, 0);
      ctx.bezierCurveTo((i * 61) % size, 80, (i * 19) % size, 170, (i * 83) % size, size);
      ctx.stroke();
    }
    for (let i = 0; i < 18; i++) {
      const x = (i * 89) % size;
      const y = (i * 47) % size;
      ctx.fillStyle = 'rgba(76,18,15,0.55)';
      ctx.beginPath();
      ctx.ellipse(x, y, 4 + (i % 9), 2 + (i % 5), i * 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  return zombieSkinTexture;
};

const getZombieFabricTexture = () => {
  if (zombieFabricTexture) return zombieFabricTexture;
  zombieFabricTexture = makeTexture(256, (ctx, size) => {
    ctx.fillStyle = '#4a4842';
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < size; i += 4) {
      ctx.fillStyle = i % 8 === 0 ? 'rgba(255,255,255,0.045)' : 'rgba(0,0,0,0.07)';
      ctx.fillRect(0, i, size, 1);
      ctx.fillRect(i, 0, 1, size);
    }
    for (let i = 0; i < 34; i++) {
      ctx.fillStyle = 'rgba(40,12,10,0.22)';
      ctx.fillRect((i * 71) % size, (i * 43) % size, 8 + (i % 24), 2 + (i % 5));
    }
  });
  return zombieFabricTexture;
};
// Static particles sell the lamp volume without the fill-rate cost of a volumetric post-process.
const createDustMotes = (count = 36) => {
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const angle = i * 2.399963229728653;
    const radius = 0.25 + ((i * 37) % 100) / 100 * 5.4;
    positions[i * 3] = 0.35 + Math.cos(angle) * radius;
    positions[i * 3 + 1] = 0.2 + ((i * 29) % 100) / 100 * 3.9;
    positions[i * 3 + 2] = -5.8 + Math.sin(angle) * radius * 0.38;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    color: 0xffd7a0, size: 0.025, transparent: true, opacity: 0.35,
    depthWrite: false, blending: THREE.AdditiveBlending,
  });
  return new THREE.Points(geometry, material);
};
const GREEN_RELOAD_ZONES = [
  { x: 15.5, z: 8.8, radius: 2.25 },
  { x: -16.0, z: 8.5, radius: 2.1 },
  { x: 0.0, z: 16.2, radius: 2.0 },
];
const GREEN_ZONE_CENTER = GREEN_RELOAD_ZONES[0];
const GREEN_ZONE_RADIUS = GREEN_RELOAD_ZONES[0].radius;
const ROOM_HALF_SIZE = 21;

const isInGreenZone = (px: number, pz: number) => {
  return GREEN_RELOAD_ZONES.some(zone => {
    const dx = px - zone.x;
    const dz = pz - zone.z;
    return (dx * dx + dz * dz) <= (zone.radius * zone.radius);
  });
};

const checkCollision = (pos: { x: number; z: number }, radius: number = 0.5, ignoredFixtures?: ReadonlySet<string>): boolean => {
  for (const w of SOLID_FIXTURES) {
    if (ignoredFixtures?.has(w.id)) continue;
    let px = pos.x - w.x;
    let pz = pos.z - w.z;

    if (w.rotY) {
      const cos = Math.cos(-w.rotY);
      const sin = Math.sin(-w.rotY);
      const rx = px * cos - pz * sin;
      const rz = px * sin + pz * cos;
      px = rx;
      pz = rz;
    }

    const halfW = w.width / 2;
    const halfD = w.depth / 2;
    const closestX = THREE.MathUtils.clamp(px, -halfW, halfW);
    const closestZ = THREE.MathUtils.clamp(pz, -halfD, halfD);

    const dx = px - closestX;
    const dz = pz - closestZ;
    if ((dx * dx + dz * dz) < radius * radius) {
      return true;
    }
  }

  return false;
};

// Helper function to resolve player/zombie collisions against solid interior walls
const resolveMapCollisions = (pos: { x: number; z: number }, radius: number = 0.5, ignoredFixtures?: ReadonlySet<string>) => {
  SOLID_FIXTURES.forEach(w => {
    if (ignoredFixtures?.has(w.id)) return;
    let px = pos.x - w.x;
    let pz = pos.z - w.z;

    if (w.rotY) {
      const cos = Math.cos(-w.rotY);
      const sin = Math.sin(-w.rotY);
      const rx = px * cos - pz * sin;
      const rz = px * sin + pz * cos;
      px = rx;
      pz = rz;
    }

    const halfW = w.width / 2;
    const halfD = w.depth / 2;
    const minX = -halfW;
    const maxX = halfW;
    const minZ = -halfD;
    const maxZ = halfD;

    const closestX = THREE.MathUtils.clamp(px, minX, maxX);
    const closestZ = THREE.MathUtils.clamp(pz, minZ, maxZ);

    const dx = px - closestX;
    const dz = pz - closestZ;
    const distSq = dx * dx + dz * dz;

    if (distSq < radius * radius) {
      const dist = Math.sqrt(distSq);
      let pushX = 0;
      let pushZ = 0;
      if (dist > 0.0001) {
        const overlap = radius - dist;
        pushX = (dx / dist) * overlap;
        pushZ = (dz / dist) * overlap;
      } else {
        pushX = radius;
      }

      if (w.rotY) {
        const cos = Math.cos(w.rotY);
        const sin = Math.sin(w.rotY);
        const rx = pushX * cos - pushZ * sin;
        const rz = pushX * sin + pushZ * cos;
        pushX = rx;
        pushZ = rz;
      }

      pos.x += pushX;
      pos.z += pushZ;
    }
  });

};

const isInsideZone = (pos: { x: number; z: number }, radius: number, zone: typeof GREEN_RELOAD_ZONES[number]) => {
  const dx = pos.x - zone.x;
  const dz = pos.z - zone.z;
  const protectedRadius = zone.radius + radius;
  return (dx * dx + dz * dz) < protectedRadius * protectedRadius;
};

const touchesFixture = (pos: { x: number; z: number }, radius: number, fixture: MapWall) => {
  let px = pos.x - fixture.x;
  let pz = pos.z - fixture.z;
  if (fixture.rotY) {
    const cos = Math.cos(-fixture.rotY);
    const sin = Math.sin(-fixture.rotY);
    const rx = px * cos - pz * sin;
    pz = px * sin + pz * cos;
    px = rx;
  }
  const dx = px - THREE.MathUtils.clamp(px, -fixture.width / 2, fixture.width / 2);
  const dz = pz - THREE.MathUtils.clamp(pz, -fixture.depth / 2, fixture.depth / 2);
  return (dx * dx + dz * dz) < radius * radius;
};

interface GameCanvasProps {
  mode: GameMode;
  settings: GameSettings;
  weapon?: WeaponDefinition;
  abilityId?: 'ADRENALINE' | 'EMP';
  abilitySignal?: number;
  isPaused: boolean;
  wave: number;
  hp: number;
  ammo: number;
  maxAmmo?: number;
  recenterSignal?: number;
  onPlayerHit: (damage: number) => void;
  onZombieKill: (zombieId: string, isHeadshot: boolean, type: ZombieType) => void;
  onTargetHit: (targetId: string, isBullseye: boolean) => void;
  onShotFired: (hitSomething: boolean) => void;
  onReloadProgress: (progressTime: number, isRefilled: boolean) => void;
  onDirectionalUpdate: (warnings: DirectionalWarning[]) => void;
  onWaveClear: () => void;
}

export const GameCanvas: React.FC<GameCanvasProps> = ({
  mode,
  settings,
  weapon = DEFAULT_WEAPON,
  abilityId = 'ADRENALINE',
  abilitySignal = 0,
  isPaused,
  wave,
  hp,
  ammo,
  maxAmmo = 30,
  recenterSignal = 0,
  onPlayerHit,
  onZombieKill,
  onTargetHit,
  onShotFired,
  onReloadProgress,
  onDirectionalUpdate,
  onWaveClear,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);

  // References for Three.js state
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);

  // Gun and ballistic effects
  const gunGroupRef = useRef<THREE.Group | null>(null);
  const bulletTracersRef = useRef<{ mesh: THREE.Mesh; start: THREE.Vector3; end: THREE.Vector3; life: number; duration: number }[]>([]);
  const muzzleFlashLightRef = useRef<THREE.PointLight | null>(null);
  const muzzleFlashMeshRef = useRef<THREE.Mesh | null>(null);
  const flashlightRef = useRef<THREE.SpotLight | null>(null);

  // Environment Refs
  const envMaterialsRef = useRef<{
    floor: THREE.MeshStandardMaterial;
    ceiling: THREE.MeshStandardMaterial;
    wall: THREE.MeshStandardMaterial;
  } | null>(null);

  const lightsRef = useRef<{
    ambient: THREE.AmbientLight;
    emergency: THREE.PointLight;
    corner1: THREE.PointLight;
    corner2: THREE.PointLight;
  } | null>(null);

  const environmentMeshesRef = useRef<THREE.Mesh[]>([]);
  const breakableFixturesRef = useRef<Map<string, THREE.Group>>(new Map());
  const brokenFixturesRef = useRef<Set<string>>(new Set());
  const bossShockwavesRef = useRef<{ mesh: THREE.Mesh; life: number }[]>([]);

  // Game state refs inside loop
  const zombiesRef = useRef<Zombie[]>([]);
  const zombieMeshesRef = useRef<Map<string, THREE.Group>>(new Map());
  const targetsRef = useRef<Target[]>([]);
  const targetMeshesRef = useRef<Map<string, THREE.Group>>(new Map());
  const particlesRef = useRef<{ mesh: THREE.Mesh; vel: THREE.Vector3; life: number; maxLife: number }[]>([]);

  // Camera rotation & Gyro state
  const yawRef = useRef<number>(-Math.PI / 2);
  const pitchRef = useRef<number>(0);
  const recoilRef = useRef<number>(0);

  // Device orientation / Gyro refs
  const deviceQuatRef = useRef<THREE.Quaternion>(new THREE.Quaternion());
  const initialYawOffsetRef = useRef<number | null>(null);
  const hasGyroSensorRef = useRef<boolean>(false);
  const desktopMouseLookRef = useRef<boolean>(false);

  // Wave & Spawning
  const lastSpawnTimeRef = useRef<number>(0);
  const totalWaveZombiesRef = useRef<number>(0);
  const spawnedWaveZombiesRef = useRef<number>(0);
  const killedWaveZombiesRef = useRef<number>(0);
  const bossesSpawnedInWaveRef = useRef<number>(0);
  const targetBossesInWaveRef = useRef<number>(0);
  const heartbeatTimerRef = useRef<number>(0);
  const lastSpatialGroanTimeRef = useRef<number>(0);
  const lastBridgeUpdateRef = useRef<number>(0);

  // Reload Zone state
  const reloadTimeRef = useRef<number>(0);
  const lastShotTimeRef = useRef<number>(0);
  const triggerHeldRef = useRef<boolean>(false);
  const adrenalineUntilRef = useRef<number>(0);
  const empUntilRef = useRef<number>(0);

  // Player Position & Walking Movement
  const walkDistanceRef = useRef<number>(0);
  const keysPressedRef = useRef<{ [key: string]: boolean }>({});

  // Virtual Joystick State for Walking Movement
  const [joystickPos, setJoystickPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isJoystickActive, setIsJoystickActive] = useState<boolean>(false);
  const joystickVectorRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const joystickTouchIdRef = useRef<number | null>(null);
  const joystickOriginRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const JOYSTICK_MAX_RADIUS = 40;

  const applyMouseLookDelta = (movementX: number, movementY: number) => {
    const sens = (settings.sensitivity || 1.2) * 0.003;
    yawRef.current -= movementX * sens;
    pitchRef.current -= movementY * sens;
    pitchRef.current = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, pitchRef.current));
  };

  const handleJoystickPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    joystickTouchIdRef.current = e.pointerId;
    joystickOriginRef.current = { x: e.clientX, y: e.clientY };
    setIsJoystickActive(true);
    setJoystickPos({ x: 0, y: 0 });
    joystickVectorRef.current = { x: 0, y: 0 };
  };

  const handleJoystickPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isJoystickActive || joystickTouchIdRef.current !== e.pointerId) return;
    e.stopPropagation();

    const dx = e.clientX - joystickOriginRef.current.x;
    const dy = e.clientY - joystickOriginRef.current.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    let clampedDx = dx;
    let clampedDy = dy;
    if (dist > JOYSTICK_MAX_RADIUS) {
      clampedDx = (dx / dist) * JOYSTICK_MAX_RADIUS;
      clampedDy = (dy / dist) * JOYSTICK_MAX_RADIUS;
    }

    setJoystickPos({ x: clampedDx, y: clampedDy });
    joystickVectorRef.current = {
      x: clampedDx / JOYSTICK_MAX_RADIUS,
      y: clampedDy / JOYSTICK_MAX_RADIUS,
    };
  };

  const handleJoystickPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (joystickTouchIdRef.current === e.pointerId) {
      e.stopPropagation();
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {}
      joystickTouchIdRef.current = null;
      setIsJoystickActive(false);
      setJoystickPos({ x: 0, y: 0 });
      joystickVectorRef.current = { x: 0, y: 0 };
    }
  };

  // Keyboard Movement Event Listeners
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keysPressedRef.current[e.key.toLowerCase()] = true;
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressedRef.current[e.key.toLowerCase()] = false;
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // 1. Initialize Three.js Scene
  useEffect(() => {
    if (!mountRef.current) return;

    // SCENE
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b0f10);
    scene.fog = new THREE.FogExp2(0x101718, 0.021);
    sceneRef.current = scene;

    // CAMERA
    const camera = new THREE.PerspectiveCamera(
      75,
      mountRef.current.clientWidth / mountRef.current.clientHeight,
      0.1,
      100
    );
    camera.position.set(BLUE_PLAYER_SPAWN.x, BLUE_PLAYER_SPAWN.y, BLUE_PLAYER_SPAWN.z);
    cameraRef.current = camera;

    // RENDERER
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    desktopMouseLookRef.current = !isMobile && (!window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints === 0);
    const getFullHdPixelRatio = () => {
      const width = Math.max(1, mountRef.current?.clientWidth || window.innerWidth);
      const height = Math.max(1, mountRef.current?.clientHeight || window.innerHeight);
      return Math.max(0.75, Math.min(window.devicePixelRatio || 1, 1920 / width, 1080 / height));
    };
    const renderer = new THREE.WebGLRenderer({
      antialias: !isMobile,
      alpha: false,
      depth: true,
      stencil: false,
      powerPreference: 'high-performance',
    });
    renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    renderer.setPixelRatio(getFullHdPixelRatio());
    renderer.shadowMap.enabled = false;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.48;
    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // --- ENVIRONMENT & MAP BUILD ---
    buildRoomEnvironment(scene);

    // --- LIGHTS ---
    const ambientLight = new THREE.AmbientLight(0xd7e0dc, 1.02);
    scene.add(ambientLight);

    const fillLight = new THREE.HemisphereLight(0xc5d4d1, 0x3d3128, 0.82);
    scene.add(fillLight);

    const emergencyLight = new THREE.PointLight(0x91bdc6, 0.9, 22);
    emergencyLight.position.set(12, 5.4, -13);
    scene.add(emergencyLight);

    const cornerLight1 = new THREE.PointLight(0x90aaa3, 0.72, 18);
    cornerLight1.position.set(-8, 3, -8);
    scene.add(cornerLight1);

    const cornerLight2 = new THREE.PointLight(0xb18a64, 0.65, 18);
    cornerLight2.position.set(8, 3, 8);
    scene.add(cornerLight2);

    lightsRef.current = {
      ambient: ambientLight,
      emergency: emergencyLight,
      corner1: cornerLight1,
      corner2: cornerLight2
    };

    // Always-on headlamp: parented to the camera so its warm beam follows aim exactly.
    const flashlight = new THREE.SpotLight(0xffcc58, 8.4, 44, Math.PI / 3.8, 0.48, 1.12);
    flashlight.position.set(0, 0.04, 0.06);
    flashlight.target.position.set(0, 0.02, -1);
    flashlight.castShadow = false;
    camera.add(flashlight);
    camera.add(flashlight.target);
    flashlightRef.current = flashlight;

    const playerFill = new THREE.PointLight(0xd9e4df, 1.2, 12, 1.8);
    playerFill.position.set(0, 0, 0);
    camera.add(playerFill);

    // --- GUN MODEL ---
    const gunGroup = createGunModel();
    gunGroup.position.set(0.18, -0.22, -0.42);
    camera.add(gunGroup);
    scene.add(camera);
    gunGroupRef.current = gunGroup;


    // Muzzle Flash
    const muzzleLight = new THREE.PointLight(0xffaa22, 0, 5);
    gunGroup.add(muzzleLight);
    muzzleFlashLightRef.current = muzzleLight;

    const muzzleFlashGeo = new THREE.SphereGeometry(0.06, 8, 8);
    const muzzleFlashMat = new THREE.MeshBasicMaterial({ color: 0xffff88, transparent: true, opacity: 0 });
    const muzzleFlashMesh = new THREE.Mesh(muzzleFlashGeo, muzzleFlashMat);
    muzzleFlashMesh.position.set(0, 0.05, -0.55);
    gunGroup.add(muzzleFlashMesh);
    muzzleFlashMeshRef.current = muzzleFlashMesh;

    // Resize Handler
    const handleResize = () => {
      if (!mountRef.current || !renderer || !camera) return;
      camera.aspect = mountRef.current.clientWidth / mountRef.current.clientHeight;
      camera.updateProjectionMatrix();

      renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
      renderer.setPixelRatio(getFullHdPixelRatio());
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (rendererRef.current && rendererRef.current.domElement) {
        rendererRef.current.domElement.remove();
      }
    };
  }, []);

  useEffect(() => {
    soundManager.setMuted(!settings.soundEnabled);
  }, [settings.soundEnabled]);

  useEffect(() => {
    const renderer = rendererRef.current;
    const scene = sceneRef.current;
    if (renderer) {
      const width = Math.max(1, mountRef.current?.clientWidth || window.innerWidth);
      const height = Math.max(1, mountRef.current?.clientHeight || window.innerHeight);
      const fullHdRatio = Math.max(0.75, Math.min(window.devicePixelRatio || 1, 1920 / width, 1080 / height));
      renderer.setPixelRatio(fullHdRatio);
      renderer.shadowMap.enabled = false;
    }
    if (scene && scene.fog instanceof THREE.FogExp2) {
      scene.fog.density = 0.021;
    }
  }, [settings.graphicsQuality]);

  useEffect(() => {
    if (!abilitySignal || !cameraRef.current) return;
    const now = performance.now();
    if (abilityId === 'EMP') {
      empUntilRef.current = now + 4500;
      createExplosionParticles(cameraRef.current.position.clone().setY(1.1), '#42d987', 48);
    } else {
      adrenalineUntilRef.current = now + 6500;
      createExplosionParticles(cameraRef.current.position.clone().setY(1.1), '#ff8a3d', 32);
    }
  }, [abilityId, abilitySignal]);

  // Setup / Reset Wave (Resets Player to Blue Spawn Point)
  useEffect(() => {
    // Reset Player to Blue Spawn Point after every wave
    if (cameraRef.current) {
      cameraRef.current.position.set(BLUE_PLAYER_SPAWN.x, BLUE_PLAYER_SPAWN.y, BLUE_PLAYER_SPAWN.z);
    }

    // Clear existing objects
    zombiesRef.current.forEach(z => removeZombieMesh(z.id));
    zombiesRef.current = [];
    targetsRef.current.forEach(t => removeTargetMesh(t.id));
    targetsRef.current = [];
    breakableFixturesRef.current.forEach(fixture => { fixture.visible = true; });
    brokenFixturesRef.current.clear();
    bossShockwavesRef.current.forEach(({ mesh }) => sceneRef.current?.remove(mesh));
    bossShockwavesRef.current = [];

    spawnedWaveZombiesRef.current = 0;
    killedWaveZombiesRef.current = 0;
    bossesSpawnedInWaveRef.current = 0;
    reloadTimeRef.current = 0;

    if (mode === 'PLAY') {
      const isBossWave = wave % 3 === 0;
      const numBosses = isBossWave ? 1 : 0;
      targetBossesInWaveRef.current = numBosses;
      const baseZombies = Math.min(18, 5 + wave * 3);
      totalWaveZombiesRef.current = baseZombies + numBosses;
    } else if (mode === 'PRACTICE') {
      spawnPracticeTargets();
    }
  }, [mode, wave]);

  // Recenter signal trigger from HUD
  useEffect(() => {
    initialYawOffsetRef.current = null;
  }, [recenterSignal]);

  // Handle Gyroscope Orientation
  useEffect(() => {
    if (desktopMouseLookRef.current) return;

    const handleOrientation = (e: DeviceOrientationEvent) => {
      if (!settings.gyroEnabled) return;
      if (e.alpha === null && e.beta === null && e.gamma === null) return;

      hasGyroSensorRef.current = true;

      const alpha = e.alpha || 0;
      const beta = e.beta || 0;
      const gamma = e.gamma || 0;
      const orient = (window.orientation as number) || (screen.orientation ? screen.orientation.angle : 0) || 0;

      const qRaw = computeDeviceQuaternion(alpha, beta, gamma, orient);

      const forwardVec = new THREE.Vector3(0, 0, -1).applyQuaternion(qRaw);
      const heading = Math.atan2(forwardVec.x, -forwardVec.z);

      if (initialYawOffsetRef.current === null) {
        initialYawOffsetRef.current = heading;
      }

      const yawOffset = initialYawOffsetRef.current;
      const yawOffsetQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -yawOffset);

      deviceQuatRef.current.copy(yawOffsetQuat).multiply(qRaw);
    };

    window.addEventListener('deviceorientation', handleOrientation, true);
    return () => {
      window.removeEventListener('deviceorientation', handleOrientation, true);
    };
  }, [settings.gyroEnabled]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!desktopMouseLookRef.current || isPaused) return;
      if (document.pointerLockElement !== mountRef.current) return;
      applyMouseLookDelta(e.movementX, e.movementY);
    };

    document.addEventListener('mousemove', handleMouseMove);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      if (document.pointerLockElement === mountRef.current) document.exitPointerLock();
    };
  }, [isPaused, settings.sensitivity]);

  // --- ROOM BUILDER ---
  const buildRoomEnvironment = (scene: THREE.Scene) => {
    const roomSize = ROOM_HALF_SIZE * 2;
    const roomHeight = 7;
    environmentMeshesRef.current = [];

    const carpetTexture = makeCarpetTexture();
    const floorGeo = new THREE.PlaneGeometry(roomSize, roomSize);
    const floorMat = new THREE.MeshLambertMaterial({ map: carpetTexture, color: 0x949d98 });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);
    environmentMeshesRef.current.push(floor);


    const wallMat = new THREE.MeshLambertMaterial({ map: makeWallTexture(), color: 0x58564d });
    const ceilingMat = new THREE.MeshLambertMaterial({ color: 0x34332d });
    const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(roomSize, roomSize), ceilingMat);
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.y = roomHeight;
    ceiling.receiveShadow = true;
    scene.add(ceiling);

    const wallGeos = [
      { pos: [0, roomHeight / 2, -roomSize / 2], rot: [0, 0, 0] },
      { pos: [0, roomHeight / 2, roomSize / 2], rot: [0, Math.PI, 0] },
      { pos: [-roomSize / 2, roomHeight / 2, 0], rot: [0, Math.PI / 2, 0] },
      { pos: [roomSize / 2, roomHeight / 2, 0], rot: [0, -Math.PI / 2, 0] },
    ];

    wallGeos.forEach((w, wallIndex) => {
      const wall = new THREE.Mesh(new THREE.PlaneGeometry(roomSize, roomHeight), wallMat);
      wall.position.set(w.pos[0], w.pos[1], w.pos[2]);
      wall.rotation.set(w.rot[0], w.rot[1], w.rot[2]);
      wall.receiveShadow = true;
      scene.add(wall);
      environmentMeshesRef.current.push(wall);

      const wallGroup = new THREE.Group();
      wallGroup.position.set(w.pos[0], w.pos[1], w.pos[2]);
      wallGroup.rotation.set(w.rot[0], w.rot[1], w.rot[2]);
      [-7.4, -2.4, 3.6, 8.4].forEach((x, i) => {
        const frame = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.25 + (i % 2) * 0.35, 0.08), new THREE.MeshStandardMaterial({ color: 0x21150d, roughness: 0.84 }));
        frame.position.set(x, 0.1 + (i % 2) * 0.35, 0.05);
        frame.castShadow = true;
        wallGroup.add(frame);
        const canvas = new THREE.Mesh(new THREE.PlaneGeometry(1.58, 1.0 + (i % 2) * 0.3), new THREE.MeshStandardMaterial({ color: wallIndex % 2 === 0 ? 0x5d4e38 : 0x2d3f3e, roughness: 0.92 }));
        canvas.position.set(x, 0.1 + (i % 2) * 0.35, 0.1);
        wallGroup.add(canvas);
      });
      scene.add(wallGroup);
    });


    const woodGrain = makeWeatheredWoodTexture(3, 1);
    const shelfGrain = makeWeatheredWoodTexture(2, 2);
    const woodMat = new THREE.MeshLambertMaterial({ map: woodGrain, color: 0x8d6d4b });
    const darkWoodMat = new THREE.MeshLambertMaterial({ map: shelfGrain, color: 0x68492f });
    const bookGeometry = new THREE.BoxGeometry(1, 1, 1);
    const bookMaterial = new THREE.MeshStandardMaterial({
      map: makeLeatherTexture('#a79a82'),
      color: 0xffffff,
      roughness: 0.86,
      metalness: 0.015,
    });
    const bookPalette = [0x612f2a, 0x344f43, 0x624d2f, 0x3f3854, 0x744329, 0x75643a, 0x303637];
    const cobwebMat = new THREE.LineBasicMaterial({ color: 0xc8d0c6, transparent: true, opacity: 0.28 });

    const makeCobweb = (x: number, y: number, z: number, width: number, height: number, rotY = 0) => {
      const points: number[] = [];
      for (let i = 0; i < 9; i++) {
        points.push(0, 0, 0, width * (i / 8), height * (0.25 + (i % 3) * 0.18), 0);
      }
      for (let i = 0; i < 5; i++) {
        points.push(width * (i / 4), height * 0.15, 0, width * (1 - i / 4), height * 0.72, 0);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
      const web = new THREE.LineSegments(geo, cobwebMat);
      web.position.set(x, y, z);
      web.rotation.y = rotY;
      scene.add(web);
    };

    MAP_WALLS.forEach((w, wallIndex) => {
      const shelfGroup = new THREE.Group();
      shelfGroup.position.set(w.x, 0, w.z);
      if (w.rotY) shelfGroup.rotation.y = w.rotY;
      const cabinetHeight = 3.8;
      const mainBox = new THREE.Mesh(new THREE.BoxGeometry(w.width, cabinetHeight, w.depth), darkWoodMat);
      mainBox.position.y = cabinetHeight / 2;
      mainBox.castShadow = true;
      mainBox.receiveShadow = true;
      shelfGroup.add(mainBox);
      environmentMeshesRef.current.push(mainBox);

      const isLongWidth = w.width >= w.depth;
      const span = isLongWidth ? w.width : w.depth;
      const thickness = isLongWidth ? w.depth : w.width;
      const bookRows = [0.55, 1.4, 2.25, 3.1];

      [-1, 1].forEach(sideMultiplier => {
        const backPanel = new THREE.Mesh(
          isLongWidth ? new THREE.BoxGeometry(span - 0.18, cabinetHeight - 0.2, 0.035) : new THREE.BoxGeometry(0.035, cabinetHeight - 0.2, span - 0.18),
          darkWoodMat
        );
        if (isLongWidth) backPanel.position.set(0, cabinetHeight / 2, sideMultiplier * (thickness / 2 - 0.03));
        else backPanel.position.set(sideMultiplier * (thickness / 2 - 0.03), cabinetHeight / 2, 0);
        shelfGroup.add(backPanel);
      });

      const booksPerRow = Math.max(12, Math.floor(span * 4.8));
      const instancedBooks = new THREE.InstancedMesh(
        bookGeometry,
        bookMaterial,
        booksPerRow * bookRows.length * 2
      );
      const bookMatrix = new THREE.Matrix4();
      const bookPosition = new THREE.Vector3();
      const bookScale = new THREE.Vector3();
      const bookRotation = new THREE.Quaternion();
      const bookEuler = new THREE.Euler();
      let bookIndex = 0;

      bookRows.forEach((shelfY, shelfIndex) => {
        const shelfBoard = new THREE.Mesh(new THREE.BoxGeometry(w.width - 0.08, 0.09, w.depth - 0.08), woodMat);
        shelfBoard.position.y = shelfY;
        shelfGroup.add(shelfBoard);

        const step = (span - 0.52) / booksPerRow;
        [-1, 1].forEach(sideMultiplier => {
          for (let i = 0; i < booksPerRow; i++) {
            const width = step * (0.7 + ((i * 17 + shelfIndex) % 5) * 0.055);
            const height = 0.49 + ((i * 13 + wallIndex) % 7) * 0.035;
            const depth = 0.28 + ((i + shelfIndex) % 4) * 0.018;
            const offset = -span / 2 + 0.26 + step * (i + 0.5);
            const lean = (((i + wallIndex + shelfIndex) % 7) - 3) * 0.018;

            if (isLongWidth) {
              bookPosition.set(offset, shelfY + height / 2 + 0.045, sideMultiplier * (thickness / 2 - 0.055));
              bookScale.set(width, height, depth);
              bookEuler.set(0, 0, lean);
            } else {
              bookPosition.set(sideMultiplier * (thickness / 2 - 0.055), shelfY + height / 2 + 0.045, offset);
              bookScale.set(depth, height, width);
              bookEuler.set(lean, 0, 0);
            }

            bookRotation.setFromEuler(bookEuler);
            bookMatrix.compose(bookPosition, bookRotation, bookScale);
            instancedBooks.setMatrixAt(bookIndex, bookMatrix);
            instancedBooks.setColorAt(bookIndex, new THREE.Color(bookPalette[(i + shelfIndex + wallIndex) % bookPalette.length]));
            bookIndex += 1;
          }
        });
      });
      instancedBooks.instanceMatrix.needsUpdate = true;
      if (instancedBooks.instanceColor) instancedBooks.instanceColor.needsUpdate = true;
      instancedBooks.computeBoundingSphere();
      shelfGroup.add(instancedBooks);
      scene.add(shelfGroup);
      breakableFixturesRef.current.set(`shelf-${wallIndex}`, shelfGroup);
      if (wallIndex % 2 === 0) makeCobweb(w.x - 0.4, 3.85, w.z + 0.25, 1.2, 0.75, w.rotY || 0);
    });

    const tableMat = new THREE.MeshStandardMaterial({ map: makeWeatheredWoodTexture(2, 1), color: 0x5e4329, roughness: 0.58, metalness: 0.03 });
    const brassMat = new THREE.MeshStandardMaterial({ map: makeMetalTexture(2, 2), color: 0x74624a, roughness: 0.4, metalness: 0.82 });
    const lampGlassMat = new THREE.MeshStandardMaterial({ color: 0xffd6a0, emissive: 0xffae57, emissiveIntensity: 1.35, roughness: 0.25, transparent: true, opacity: 0.9 });

    const makePerimeterShelf = (id: string, x: number, z: number, rotY: number, width: number) => {
      const shelf = new THREE.Group();
      shelf.position.set(x, 0, z);
      shelf.rotation.y = rotY;
      const height = 3.45;
      const depth = 0.46;
      const shell = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), darkWoodMat);
      shell.position.y = height / 2;
      shelf.add(shell);
      const back = new THREE.Mesh(new THREE.BoxGeometry(width - 0.12, height - 0.12, 0.04), darkWoodMat);
      back.position.set(0, height / 2, depth / 2 + 0.015);
      shelf.add(back);
      const rows = [0.45, 1.18, 1.91, 2.64];
      const booksPerRow = Math.max(10, Math.floor(width * 3.6));
      const books = new THREE.InstancedMesh(bookGeometry, bookMaterial, rows.length * booksPerRow);
      const matrix = new THREE.Matrix4();
      const position = new THREE.Vector3();
      const scale = new THREE.Vector3();
      const rotation = new THREE.Quaternion();
      const euler = new THREE.Euler();
      let instance = 0;
      rows.forEach((rowY, row) => {
        const board = new THREE.Mesh(new THREE.BoxGeometry(width - 0.08, 0.075, depth - 0.04), woodMat);
        board.position.y = rowY;
        shelf.add(board);
        const step = (width - 0.32) / booksPerRow;
        for (let i = 0; i < booksPerRow; i++) {
          const bookWidth = step * (0.7 + ((i + row) % 4) * 0.08);
          const bookHeight = 0.43 + ((i * 5 + row) % 5) * 0.055;
          position.set(-width / 2 + 0.16 + step * (i + 0.5), rowY + bookHeight / 2 + 0.04, -depth / 2 - 0.015);
          scale.set(bookWidth, bookHeight, 0.22);
          euler.set(0, 0, (((i + row) % 5) - 2) * 0.022);
          rotation.setFromEuler(euler);
          matrix.compose(position, rotation, scale);
          books.setMatrixAt(instance, matrix);
          books.setColorAt(instance, new THREE.Color(bookPalette[(i * 3 + row) % bookPalette.length]));
          instance += 1;
        }
      });
      books.instanceMatrix.needsUpdate = true;
      if (books.instanceColor) books.instanceColor.needsUpdate = true;
      shelf.add(books);
      scene.add(shelf);
      breakableFixturesRef.current.set(id, shelf);
    };

    [
      { x: -15.4, z: -19.65, rot: 0, width: 6.6 }, { x: 1.8, z: -19.65, rot: 0, width: 6.2 }, { x: 14.7, z: -19.65, rot: 0, width: 5.4 },
      { x: -14.8, z: 19.65, rot: Math.PI, width: 5.7 }, { x: 10.6, z: 19.65, rot: Math.PI, width: 7.2 },
      { x: -19.65, z: -10.2, rot: Math.PI / 2, width: 5.6 }, { x: -19.65, z: 10.5, rot: Math.PI / 2, width: 5.8 },
      { x: 19.65, z: -7.6, rot: -Math.PI / 2, width: 5.2 }, { x: 19.65, z: 9.0, rot: -Math.PI / 2, width: 5.8 },
    ].forEach((shelf, index) => makePerimeterShelf(`edge-shelf-${index}`, shelf.x, shelf.z, shelf.rot, shelf.width));
    const makeDesk = (id: string, x: number, z: number, rotY = 0, hero = false) => {
      const desk = new THREE.Group();
      desk.position.set(x, 0, z);
      desk.rotation.y = rotY;
      const top = new THREE.Mesh(new THREE.BoxGeometry(hero ? 3.55 : 2.4, 0.16, hero ? 1.55 : 1.25), tableMat);
      top.position.y = 0.9;
      top.castShadow = true;
      top.receiveShadow = true;
      desk.add(top);
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(pos => {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.1, 0.9, 10), tableMat);
        leg.position.set(pos[0] * (hero ? 1.55 : 1.0), 0.45, pos[1] * (hero ? 0.58 : 0.48));
        leg.castShadow = true;
        desk.add(leg);
      });
      const lampBase = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.07, 24), brassMat);
      lampBase.position.set(0, 1.01, 0);
      desk.add(lampBase);
      const lampPole = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.44, 16), brassMat);
      lampPole.position.set(0, 1.25, 0);
      desk.add(lampPole);
      const lampShade = new THREE.Mesh(new THREE.SphereGeometry(0.24, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), lampGlassMat);
      lampShade.position.set(0, 1.48, 0);
      lampShade.scale.set(1.25, 0.48, 1.25);
      desk.add(lampShade);
      const lampLight = new THREE.PointLight(0xffb66c, hero ? 3.1 : 0.18, hero ? 8 : 2.5, 2);
      lampLight.position.set(0, 1.36, 0);
      lampLight.castShadow = hero;
      if (hero) {
        lampLight.shadow.mapSize.set(512, 512);
        lampLight.shadow.bias = -0.0008;
        const shaft = new THREE.Mesh(
          new THREE.CylinderGeometry(0.12, 1.18, 2.25, 20, 1, true),
          new THREE.MeshBasicMaterial({ color: 0xffb66c, transparent: true, opacity: 0.055, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })
        );
        shaft.position.set(0, 0.22, 0);
        desk.add(shaft);
      }
      desk.add(lampLight);
      for (let i = 0; i < (hero ? 8 : 3); i++) {
        const paper = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.015, 0.26), new THREE.MeshStandardMaterial({ color: 0xafa17f, roughness: 1 }));
        paper.position.set(-1.2 + i * 0.34, 1.0 + i * 0.003, 0.37 + (i % 2) * 0.1);
        paper.rotation.y = -0.42 + i * 0.17;
        desk.add(paper);
      }
      scene.add(desk);
      breakableFixturesRef.current.set(id, desk);
      return desk;
    };

    makeDesk('desk-0', 0.35, -5.8, 0.02, true);
    makeDesk('desk-1', -15, -5, 0.35);
    makeDesk('desk-2', 15, -4, -0.28);
    makeDesk('desk-3', -1, 11.5, 0.18);
    makeDesk('desk-4', -17.4, -6.4, Math.PI / 2);
    makeDesk('desk-5', 17.1, 7.2, -Math.PI / 2);
    makeDesk('desk-6', -9.8, 17.6, Math.PI);
    makeDesk('desk-7', 9.4, -17.6, 0);

    scene.add(createDustMotes(36));
    const metalMat = new THREE.MeshStandardMaterial({ map: makeMetalTexture(2, 1), color: 0x82908c, roughness: 0.72, metalness: 0.78 });
    const crateDarkMat = new THREE.MeshStandardMaterial({ map: makeMetalTexture(1, 1), color: 0x3d4744, roughness: 0.9, metalness: 0.65 });
    const ammoTextMat = new THREE.MeshBasicMaterial({ color: 0xcbd9b8, transparent: true, opacity: 0.88 });

    const makeSupplyStation = (x: number, z: number, rotation: number, warm: boolean) => {
      const station = new THREE.Group();
      station.position.set(x, 0, z);
      station.rotation.y = rotation;
      const crate = new THREE.Mesh(new THREE.BoxGeometry(1.08, 0.62, 0.62), crateDarkMat);
      crate.position.set(0.55, 0.31, -0.35);
      crate.castShadow = true;
      crate.receiveShadow = true;
      station.add(crate);
      [-0.19, 0.19].forEach(zBand => {
        const strap = new THREE.Mesh(new THREE.BoxGeometry(1.13, 0.05, 0.045), metalMat);
        strap.position.set(0.55, 0.48, -0.35 + zBand);
        station.add(strap);
      });
      for (let i = 0; i < 8; i++) {
        const rivet = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6), metalMat);
        rivet.position.set(0.05 + (i % 4) * 0.32, 0.57, -0.67 + Math.floor(i / 4) * 0.64);
        station.add(rivet);
      }
      const label = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.16), ammoTextMat);
      label.position.set(0.55, 0.43, -0.675);
      station.add(label);
      const lantern = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.34, 16), metalMat);
      lantern.position.set(-0.48, 0.58, -0.08);
      station.add(lantern);
      const practical = new THREE.PointLight(warm ? 0xffc27b : 0xc8e99d, warm ? 1.7 : 2.0, 6.5);
      practical.position.set(-0.48, 0.88, -0.08);
      station.add(practical);
      scene.add(station);
    };

    const makeWorldLabel = (label: string, x: number, z: number) => {
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 128;
      const context = canvas.getContext('2d');
      if (!context) return;
      context.fillStyle = 'rgba(6, 8, 7, 0.72)';
      context.fillRect(10, 18, 492, 88);
      context.strokeStyle = '#d8e8ad';
      context.lineWidth = 3;
      context.strokeRect(10, 18, 492, 88);
      context.fillStyle = '#f5f6d6';
      context.font = 'bold 36px Arial';
      context.textAlign = 'center';
      context.fillText(label, 256, 64);
      context.fillStyle = '#b9c995';
      context.font = '20px Arial';
      context.fillText('HOLD TO RESTOCK AMMO', 256, 92);
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: false, transparent: true }));
      sprite.position.set(x, 2.45, z);
      sprite.scale.set(3.1, 0.78, 1);
      scene.add(sprite);
    };

    GREEN_RELOAD_ZONES.forEach((zone, idx) => {
      const floorCue = new THREE.Mesh(
        new THREE.RingGeometry(zone.radius + 0.06, zone.radius + 0.13, 64),
        new THREE.MeshBasicMaterial({ color: 0xb3c98e, transparent: true, opacity: 0.24, side: THREE.DoubleSide })
      );
      floorCue.rotation.x = -Math.PI / 2;
      floorCue.position.set(zone.x, 0.032 + idx * 0.003, zone.z);
      scene.add(floorCue);
      makeSupplyStation(zone.x, zone.z, idx * 0.7, false);
      makeWorldLabel('AMMO CACHE', zone.x, zone.z);
    });

    const ventFrameMat = new THREE.MeshStandardMaterial({ color: 0x222826, roughness: 0.82, metalness: 0.68, emissive: 0x0a0402, emissiveIntensity: 0.05 });
    const ventVoidMat = new THREE.MeshStandardMaterial({ color: 0x010202, roughness: 1, metalness: 0 });
    const ventRustMat = new THREE.MeshStandardMaterial({ color: 0x6b2d1c, roughness: 0.92, metalness: 0.35, emissive: 0x170502, emissiveIntensity: 0.1 });
    const makeSpawnVent = (x: number, z: number, index: number) => {
      const vent = new THREE.Group();
      vent.position.set(x, roomHeight - 0.13, z);
      vent.rotation.y = index % 2 === 0 ? 0 : Math.PI / 2;

      const recess = new THREE.Mesh(new THREE.BoxGeometry(2.05, 0.16, 1.34), ventVoidMat);
      recess.position.y = -0.06;
      vent.add(recess);
      const framePieces = [
        { x: 0, z: -0.65, w: 2.18, d: 0.1 }, { x: 0, z: 0.65, w: 2.18, d: 0.1 },
        { x: -1.04, z: 0, w: 0.1, d: 1.38 }, { x: 1.04, z: 0, w: 0.1, d: 1.38 },
      ];
      framePieces.forEach((piece, pieceIndex) => {
        const frame = new THREE.Mesh(new THREE.BoxGeometry(piece.w, 0.12, piece.d), pieceIndex === 2 ? ventRustMat : ventFrameMat);
        frame.position.set(piece.x, -0.16, piece.z);
        vent.add(frame);
      });
      for (let slatIndex = 0; slatIndex < 7; slatIndex++) {
        const slat = new THREE.Mesh(new THREE.BoxGeometry(1.78, 0.045, 0.08), slatIndex === 4 ? ventRustMat : ventFrameMat);
        slat.position.set(0, -0.25, -0.43 + slatIndex * 0.145);
        slat.rotation.x = 0.3;
        vent.add(slat);
      }
      [[-0.86, -0.48], [0.86, -0.48], [-0.86, 0.48], [0.86, 0.48]].forEach(([boltX, boltZ]) => {
        const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.035, 8), ventRustMat);
        bolt.position.set(boltX, -0.24, boltZ);
        bolt.rotation.x = Math.PI / 2;
        vent.add(bolt);
      });
      const brokenLouver = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.72, 0.06), ventRustMat);
      brokenLouver.position.set(index % 2 === 0 ? -0.65 : 0.65, -0.52, 0.28);
      brokenLouver.rotation.z = index % 2 === 0 ? 0.54 : -0.54;
      vent.add(brokenLouver);
      const redGlow = new THREE.PointLight(0x8e2a19, 0.5, 5.2);
      redGlow.position.set(0, -0.6, 0);
      vent.add(redGlow);
      scene.add(vent);
    };

    RED_ZOMBIE_SPAWNS.forEach((spawn, index) => makeSpawnVent(spawn.x, spawn.z, index));

    const makeBossBreach = () => {
      const breach = new THREE.Group();
      breach.position.set(-ROOM_HALF_SIZE + 0.18, 0, ORANGE_BOSS_SPAWN.z);
      breach.rotation.y = Math.PI / 2;

      const voidPlane = new THREE.Mesh(
        new THREE.PlaneGeometry(8.2, 5.8),
        new THREE.MeshBasicMaterial({ color: 0x010101, side: THREE.DoubleSide })
      );
      voidPlane.position.set(0, 2.85, 0.02);
      breach.add(voidPlane);

      const jaggedEdgeMat = new THREE.MeshStandardMaterial({ color: 0x342f29, roughness: 0.98, metalness: 0.02, emissive: 0x070201, emissiveIntensity: 0.03 });
      const edgeChunks = [
        [-3.9, 5.45, 1.15, 0.82, -0.34], [-2.55, 5.72, 1.42, 0.68, 0.2], [-0.95, 5.58, 1.55, 0.78, -0.12],
        [0.82, 5.68, 1.5, 0.62, 0.24], [2.45, 5.48, 1.28, 0.9, -0.26], [3.75, 4.92, 0.86, 1.55, 0.18],
        [-4.05, 3.58, 0.78, 1.85, 0.1], [4.1, 3.18, 0.92, 2.05, -0.16], [-3.62, 1.12, 1.22, 0.85, 0.26],
        [-2.12, 0.42, 1.48, 0.6, -0.18], [-0.28, 0.34, 1.72, 0.52, 0.14], [1.72, 0.48, 1.44, 0.64, -0.28],
        [3.08, 0.82, 1.12, 0.92, 0.2]
      ];
      edgeChunks.forEach(([z, y, width, height, tilt]) => {
        const chunk = new THREE.Mesh(new THREE.BoxGeometry(0.22, height, width), jaggedEdgeMat);
        chunk.position.set(0.015, y, z);
        chunk.rotation.set(tilt, 0.04, tilt * 0.35);
        chunk.castShadow = true;
        chunk.receiveShadow = true;
        breach.add(chunk);
      });

      const breachLight = new THREE.PointLight(0xd13a22, 2.25, 13);
      breachLight.position.set(0.9, 2.25, 0);
      breach.add(breachLight);
      const backGlow = new THREE.Mesh(
        new THREE.PlaneGeometry(6.8, 4.6),
        new THREE.MeshBasicMaterial({ color: 0x7d160e, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false })
      );
      backGlow.position.set(0.04, 2.75, 0.015);
      breach.add(backGlow);
      scene.add(breach);
    };

    makeBossBreach();
    const debrisMat = new THREE.MeshStandardMaterial({ color: 0x4e3928, roughness: 0.95 });
    const paperMat = new THREE.MeshStandardMaterial({ color: 0x918263, roughness: 1 });
    const debrisLocations = [
      { x: -2.6, z: -8.2, r: 0.3 }, { x: 4.4, z: -7.6, r: -0.45 }, { x: -9.8, z: 5.6, r: 0.55 },
      { x: 10.2, z: 6.6, r: -0.25 }, { x: -3.5, z: 7.8, r: 0.8 }, { x: 5.7, z: 13.4, r: -0.62 },
      { x: 1.7, z: -4.0, r: 0.2 }, { x: -1.9, z: -4.4, r: -0.8 },
      { x: -17.1, z: -13.4, r: 0.35 }, { x: 16.6, z: -12.2, r: -0.45 }, { x: -16.8, z: 12.4, r: 0.7 }, { x: 16.4, z: 13.8, r: -0.3 },
      { x: -10.2, z: -18.0, r: 0.18 }, { x: 11.6, z: -18.2, r: -0.58 }, { x: -8.4, z: 18.1, r: 0.46 }, { x: 14.4, z: 17.7, r: -0.22 },
    ];
    debrisLocations.forEach((spot, i) => {
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.75 + (i % 2) * 0.28, 0.38, 0.55), debrisMat);
      box.position.set(spot.x, 0.19, spot.z);
      box.rotation.y = spot.r;
      box.castShadow = true;
      scene.add(box);
      for (let p = 0; p < 5; p++) {
        const paper = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.012, 0.2), paperMat);
        paper.position.set(spot.x + (p - 2) * 0.18, 0.035 + p * 0.002, spot.z + 0.44 + (p % 2) * 0.14);
        paper.rotation.set(0, spot.r + p * 0.42, p * 0.08);
        scene.add(paper);
      }
    });

    const shatteredGlassMat = new THREE.MeshStandardMaterial({ color: 0xb7c4bb, roughness: 0.18, metalness: 0.2, transparent: true, opacity: 0.42 });
    const brokenProps = [{ x: -5.4, z: 5.2, r: 0.72 }, { x: 7.8, z: -2.8, r: -0.6 }, { x: 2.9, z: 8.6, r: 0.25 }, { x: -0.85, z: -6.65, r: 0.9 }];
    brokenProps.forEach((spot, index) => {
      const fallenChair = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.7, 0.5), debrisMat);
      fallenChair.position.set(spot.x, 0.28, spot.z);
      fallenChair.rotation.set(0.18, spot.r, Math.PI / 2.8);
      fallenChair.castShadow = true;
      scene.add(fallenChair);
      for (let shard = 0; shard < 7; shard++) {
        const glass = new THREE.Mesh(new THREE.ConeGeometry(0.06 + (shard % 2) * 0.025, 0.008, 3), shatteredGlassMat);
        glass.position.set(spot.x + 0.34 - shard * 0.1, 0.024, spot.z + 0.32 + (shard % 3) * 0.08);
        glass.rotation.y = index + shard;
        scene.add(glass);
      }
    });

    makeCobweb(-1.1, 1.03, -5.0, 1.7, 0.85, 0.1);
    makeCobweb(2.2, 3.15, -5.8, 1.5, 0.8, -0.2);
    makeCobweb(14.8, 2.9, 8.5, 1.4, 0.9, Math.PI / 2);
    makeCobweb(-15.8, 2.8, 8.2, 1.4, 0.9, -Math.PI / 2);

    envMaterialsRef.current = { floor: floorMat, ceiling: ceilingMat, wall: wallMat };
  };
  // --- GUN MODEL GENERATOR ---
  const createGunModel = (): THREE.Group => {
    const gun = new THREE.Group();

    const darkMetal = new THREE.MeshStandardMaterial({ map: makeMetalTexture(2, 2), color: 0x343a3e, roughness: 0.38, metalness: 0.86, emissive: 0x07090a, emissiveIntensity: 0.28 });
    const wornSteel = new THREE.MeshStandardMaterial({ map: makeMetalTexture(3, 1), color: 0x92999b, roughness: 0.34, metalness: 0.9, emissive: 0x0b0c0d, emissiveIntensity: 0.16 });
    const blackMetal = new THREE.MeshStandardMaterial({ map: makeMetalTexture(2, 1), color: 0x1c2023, roughness: 0.56, metalness: 0.8, emissive: 0x050606, emissiveIntensity: 0.22 });
    const gripMat = new THREE.MeshStandardMaterial({ map: makeLeatherTexture('#181a1b'), color: 0x111315, roughness: 0.86, metalness: 0.06 });
    const sightMat = new THREE.MeshBasicMaterial({ color: 0x63e6ad });

    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.105, 0.13, 0.46), darkMetal);
    frame.position.set(0, 0.01, -0.08);
    frame.castShadow = true;
    gun.add(frame);

    const slide = new THREE.Mesh(new THREE.BoxGeometry(0.115, 0.085, 0.5), wornSteel);
    slide.position.set(0, 0.105, -0.12);
    slide.castShadow = true;
    gun.add(slide);

    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.029, 0.43, 18), blackMetal);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.082, -0.43);
    barrel.castShadow = true;
    gun.add(barrel);

    const muzzle = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.012, 16), new THREE.MeshBasicMaterial({ color: 0x020202 }));
    muzzle.rotation.x = Math.PI / 2;
    muzzle.position.set(0, 0.082, -0.65);
    muzzle.name = 'muzzle';
    gun.add(muzzle);

    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.29, 0.145), gripMat);
    grip.position.set(0, -0.18, 0.12);
    grip.rotation.x = -0.34;
    grip.castShadow = true;
    gun.add(grip);

    for (let i = 0; i < 6; i++) {
      const groove = new THREE.Mesh(new THREE.BoxGeometry(0.094, 0.012, 0.13), blackMetal);
      groove.position.set(0, -0.085 - i * 0.036, 0.06 + i * 0.012);
      groove.rotation.x = -0.34;
      gun.add(groove);
    }

    const magazineBase = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.035, 0.15), blackMetal);
    magazineBase.position.set(0, -0.33, 0.17);
    magazineBase.rotation.x = -0.34;
    gun.add(magazineBase);

    const triggerGuard = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.006, 8, 18), blackMetal);
    triggerGuard.scale.set(0.72, 1.05, 0.32);
    triggerGuard.rotation.x = Math.PI / 2;
    triggerGuard.position.set(0, -0.09, 0.005);
    gun.add(triggerGuard);

    const trigger = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.055, 0.018), blackMetal);
    trigger.position.set(0, -0.095, 0.025);
    trigger.rotation.x = 0.25;
    gun.add(trigger);

    for (let i = 0; i < 7; i++) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.014, 0.018), darkMetal);
      rail.position.set(0, 0.155, -0.32 + i * 0.055);
      gun.add(rail);
    }

    const rearSight = new THREE.Mesh(new THREE.BoxGeometry(0.072, 0.028, 0.03), blackMetal);
    rearSight.position.set(0, 0.17, 0.06);
    gun.add(rearSight);

    const frontSight = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.035, 0.018), blackMetal);
    frontSight.position.set(0, 0.17, -0.54);
    gun.add(frontSight);

    const sightDot = new THREE.Mesh(new THREE.SphereGeometry(0.008, 8, 8), sightMat);
    sightDot.position.set(0, 0.193, -0.54);
    gun.add(sightDot);

    const ejectionPort = new THREE.Mesh(
      new THREE.BoxGeometry(0.074, 0.012, 0.12),
      new THREE.MeshStandardMaterial({ color: 0x080909, roughness: 0.46, metalness: 0.85 })
    );
    ejectionPort.position.set(0.055, 0.145, -0.14);
    ejectionPort.rotation.z = Math.PI / 2;
    gun.add(ejectionPort);

    const takedownPin = new THREE.Mesh(
      new THREE.CylinderGeometry(0.012, 0.012, 0.122, 12),
      blackMetal
    );
    takedownPin.rotation.z = Math.PI / 2;
    takedownPin.position.set(0, 0.015, -0.03);
    gun.add(takedownPin);

    const gripPanel = new THREE.Mesh(new THREE.BoxGeometry(0.084, 0.205, 0.115), gripMat);
    gripPanel.position.set(0, -0.19, 0.105);
    gripPanel.rotation.x = -0.34;
    gun.add(gripPanel);

    // The selected armory weapon changes the first-person silhouette as well as its handling.
    if (weapon.id === 'VANGUARD_SMG' || weapon.id === 'ARCHIVIST_AR') {
      const shoulderStock = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.11, weapon.id === 'ARCHIVIST_AR' ? 0.52 : 0.36), gripMat);
      shoulderStock.position.set(0, -0.05, 0.36);
      gun.add(shoulderStock);
      const extendedMagazine = new THREE.Mesh(new THREE.BoxGeometry(0.105, 0.34, 0.13), blackMetal);
      extendedMagazine.position.set(0, -0.22, 0.12);
      extendedMagazine.rotation.x = -0.18;
      gun.add(extendedMagazine);
    }
    if (weapon.id === 'BREACHER_12') {
      const secondBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.035, 0.68, 18), wornSteel);
      secondBarrel.rotation.x = Math.PI / 2;
      secondBarrel.position.set(0, 0.035, -0.5);
      gun.add(secondBarrel);
      const pump = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.1, 0.24), gripMat);
      pump.position.set(0, 0.025, -0.42);
      gun.add(pump);
    }
    if (weapon.id === 'OBSIDIAN_MAGNUM') {
      const cylinder = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.14, 12), wornSteel);
      cylinder.rotation.z = Math.PI / 2;
      cylinder.position.set(0, 0.02, -0.08);
      gun.add(cylinder);
      const longBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.031, 0.7, 18), blackMetal);
      longBarrel.rotation.x = Math.PI / 2;
      longBarrel.position.set(0, 0.085, -0.54);
      gun.add(longBarrel);
    }

    gun.rotation.set(-0.02, -0.05, 0.01);
    return gun;
  };
  // --- ZOMBIE 3D MODEL GENERATOR (Includes BIG PURPLE BOSS ZOMBIE!) ---
  const createZombieMesh = (zombie: Zombie): THREE.Group => {
    const group = new THREE.Group();

    let bodyColor = 0x8c806d;
    let clothesColor = 0x34302c;
    let scale = 1.0;
    const isCrawler = zombie.type === 'CRAWLER';

    if (zombie.type === 'BOSS') {
      bodyColor = 0x6f665e;
      clothesColor = 0x211f22;
      scale = 2.2;
    } else if (isCrawler) {
      bodyColor = 0x8b7868;
      clothesColor = 0x292b28;
      scale = 1.06;
    } else if (zombie.type === 'RUNNER') {
      bodyColor = 0x967361;
      clothesColor = 0x412822;
      scale = 0.82;
    } else if (zombie.type === 'BRUTE') {
      bodyColor = 0x5b675e;
      clothesColor = 0x2b3034;
      scale = 1.45;
    } else if (zombie.type === 'SPITTER') {
      bodyColor = 0x78906b;
      clothesColor = 0x29312a;
      scale = 1.03;
    } else if (zombie.type === 'SCREAMER') {
      bodyColor = 0xa78e7b;
      clothesColor = 0x493d3b;
      scale = 0.96;
    } else if (zombie.type === 'EXPLODER') {
      bodyColor = 0x74553e;
      clothesColor = 0x332a22;
      scale = 1.15;
    } else if (zombie.type === 'STALKER') {
      bodyColor = 0x36413d;
      clothesColor = 0x171a1b;
      scale = 1.06;
    }

    const bodyMat = new THREE.MeshStandardMaterial({
      map: getZombieSkinTexture(),
      color: bodyColor,
      roughness: 0.76,
      emissive: new THREE.Color(bodyColor),
      emissiveIntensity: zombie.type === 'BOSS' ? 0.25 : 0.02,
    });

    const clothesMat = new THREE.MeshStandardMaterial({
      map: getZombieFabricTexture(),
      color: clothesColor,
      roughness: 0.88,
      emissive: new THREE.Color(clothesColor),
      emissiveIntensity: zombie.type === 'BOSS' ? 0.2 : 0.02,
    });


    // Torso
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.31 * scale, 0.34 * scale, 4, 10), clothesMat);
    torso.position.y = 1.0 * scale;
    torso.name = 'torso';
    torso.castShadow = true;
    group.add(torso);

    // Head and face
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.25 * scale, 16, 12), bodyMat);
    head.position.y = 1.65 * scale;
    head.scale.set(0.94, 1.12, 0.9);
    head.name = 'head';
    group.add(head);

    const eyeColor = zombie.type === 'BOSS' ? 0xff6b3d : zombie.type === 'CRAWLER' ? 0x62d8ff : 0xffbd58;
    const eyeMat = new THREE.MeshBasicMaterial({ color: eyeColor, transparent: true, opacity: 0.96 });
    const socketMat = new THREE.MeshStandardMaterial({ color: 0x100b09, roughness: 1 });
    const pupilMat = new THREE.MeshBasicMaterial({ color: 0x030303 });
    const woundMat = new THREE.MeshStandardMaterial({ color: 0x35110e, roughness: 0.92, side: THREE.DoubleSide });
    const toothMat = new THREE.MeshStandardMaterial({ color: 0xb8ab82, roughness: 0.8 });

    [-1, 1].forEach(side => {
      const socket = new THREE.Mesh(new THREE.SphereGeometry(0.057 * scale, 10, 8), socketMat);
      socket.position.set(side * 0.092 * scale, 0.035 * scale, -0.205 * scale);
      socket.scale.set(1.15, 0.78, 0.42);
      socket.name = 'head';
      head.add(socket);

      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.031 * scale, 10, 8), eyeMat);
      eye.position.set(side * 0.092 * scale, 0.035 * scale, -0.232 * scale);
      eye.scale.set(1.18, 0.9, 0.56);
      eye.name = 'head';
      head.add(eye);

      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.012 * scale, 8, 6), pupilMat);
      pupil.position.set(side * 0.092 * scale, 0.035 * scale, -0.25 * scale);
      pupil.scale.z = 0.35;
      pupil.name = 'head';
      head.add(pupil);

      const ear = new THREE.Mesh(new THREE.SphereGeometry(0.055 * scale, 8, 6), bodyMat);
      ear.position.set(side * 0.235 * scale, -0.005 * scale, 0);
      ear.scale.set(0.45, 0.9, 0.72);
      ear.name = 'head';
      head.add(ear);
    });

    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.035 * scale, 0.105 * scale, 6), bodyMat);
    nose.position.set(0, -0.025 * scale, -0.245 * scale);
    nose.rotation.x = -Math.PI / 2;
    nose.name = 'head';
    head.add(nose);

    const jaw = new THREE.Mesh(new THREE.SphereGeometry(0.17 * scale, 12, 8), bodyMat);
    jaw.position.set(0.018 * scale, -0.17 * scale, -0.015 * scale);
    jaw.scale.set(0.86, 0.55, 0.82);
    jaw.rotation.z = zombie.type === 'CRAWLER' ? 0.08 : -0.05;
    jaw.name = 'head';
    head.add(jaw);

    const mouth = new THREE.Mesh(new THREE.PlaneGeometry(0.16 * scale, 0.052 * scale), socketMat);
    mouth.position.set(0.018 * scale, -0.17 * scale, -0.218 * scale);
    mouth.rotation.z = -0.07;
    mouth.name = 'head';
    head.add(mouth);

    for (let toothIndex = 0; toothIndex < 4; toothIndex++) {
      const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.022 * scale, 0.032 * scale, 0.012 * scale), toothMat);
      tooth.position.set((-0.055 + toothIndex * 0.037) * scale, -0.158 * scale, -0.226 * scale);
      tooth.rotation.z = (toothIndex - 1.5) * 0.06;
      tooth.name = 'head';
      head.add(tooth);
    }

    const templeWound = new THREE.Mesh(new THREE.CircleGeometry(0.075 * scale, 10), woundMat);
    templeWound.position.set(0.17 * scale, 0.07 * scale, -0.17 * scale);
    templeWound.rotation.y = -0.48;
    templeWound.name = 'head';
    head.add(templeWound);

    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.252 * scale, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.48), new THREE.MeshStandardMaterial({ color: 0x171513, roughness: 0.98 }));
    hair.position.y = 0.035 * scale;
    hair.name = 'head';
    head.add(hair);

    // Arms
    const leftArm = new THREE.Mesh(new THREE.CylinderGeometry(0.09 * scale, 0.11 * scale, 0.72 * scale, 8), bodyMat);
    leftArm.position.set(-0.42 * scale, 1.0 * scale, -0.2 * scale);
    leftArm.rotation.x = -Math.PI / 3;
    leftArm.name = 'leftArm';
    group.add(leftArm);

    const rightArm = new THREE.Mesh(new THREE.CylinderGeometry(0.09 * scale, 0.11 * scale, 0.72 * scale, 8), bodyMat);
    rightArm.position.set(0.42 * scale, 1.0 * scale, -0.2 * scale);
    rightArm.rotation.x = -Math.PI / 3;
    rightArm.name = 'rightArm';
    group.add(rightArm);

    // Legs
    const leftLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.11 * scale, 0.14 * scale, 0.82 * scale, 8), clothesMat);
    leftLeg.position.set(-0.18 * scale, 0.4 * scale, 0);
    leftLeg.name = 'leftLeg';
    group.add(leftLeg);

    const rightLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.11 * scale, 0.14 * scale, 0.82 * scale, 8), clothesMat);
    rightLeg.position.set(0.18 * scale, 0.4 * scale, 0);
    rightLeg.name = 'rightLeg';
    group.add(rightLeg);

    // Torn shirt panel and a loose tie make the silhouette feel like a trapped library patron.
    const chestWound = new THREE.Mesh(new THREE.PlaneGeometry(0.12 * scale, 0.19 * scale), woundMat);
    chestWound.position.set(0.1 * scale, 1.02 * scale, -0.35 * scale);
    chestWound.rotation.z = -0.38;
    group.add(chestWound);
    const shirtPanel = new THREE.Mesh(new THREE.PlaneGeometry(0.22 * scale, 0.36 * scale), new THREE.MeshStandardMaterial({ color: 0x776c5a, roughness: 0.95, side: THREE.DoubleSide }));
    shirtPanel.position.set(0, 1.08 * scale, -0.36 * scale);
    group.add(shirtPanel);
    const tie = new THREE.Mesh(new THREE.ConeGeometry(0.045 * scale, 0.26 * scale, 4), new THREE.MeshStandardMaterial({ color: 0x241c19, roughness: 0.9 }));
    tie.position.set(0, 1.18 * scale, -0.38 * scale);
    tie.rotation.x = Math.PI / 2;
    group.add(tie);

    if (zombie.type === 'BRUTE') {
      const armor = new THREE.Mesh(new THREE.BoxGeometry(0.78 * scale, 0.78 * scale, 0.26 * scale), new THREE.MeshStandardMaterial({ map: makeMetalTexture(2, 2), color: 0x364146, roughness: 0.55, metalness: 0.76 }));
      armor.position.set(0, 1.06 * scale, -0.28 * scale);
      armor.castShadow = true;
      group.add(armor);
    }
    if (zombie.type === 'BOSS') {
      const plateMat = new THREE.MeshStandardMaterial({ map: makeMetalTexture(2, 2), color: 0x3a3537, roughness: 0.48, metalness: 0.82 });
      const coreMat = new THREE.MeshStandardMaterial({ color: 0x7c170f, emissive: 0xff3b1a, emissiveIntensity: 1.3, roughness: 0.35, metalness: 0.18 });
      [-1, 1].forEach(side => {
        const shoulder = new THREE.Mesh(new THREE.SphereGeometry(0.27 * scale, 12, 8), plateMat);
        shoulder.position.set(side * 0.48 * scale, 1.35 * scale, -0.05 * scale);
        shoulder.scale.set(1.2, 0.62, 0.85);
        group.add(shoulder);
        const spike = new THREE.Mesh(new THREE.ConeGeometry(0.07 * scale, 0.33 * scale, 6), plateMat);
        spike.position.set(side * 0.63 * scale, 1.47 * scale, -0.04 * scale);
        spike.rotation.z = side * Math.PI / 2;
        group.add(spike);
      });
      const chestCore = new THREE.Mesh(new THREE.SphereGeometry(0.13 * scale, 14, 10), coreMat);
      chestCore.position.set(0, 1.1 * scale, -0.39 * scale);
      group.add(chestCore);
      const jawPlate = new THREE.Mesh(new THREE.BoxGeometry(0.31 * scale, 0.12 * scale, 0.11 * scale), plateMat);
      jawPlate.position.set(0.01 * scale, 1.45 * scale, -0.26 * scale);
      group.add(jawPlate);
    }
    if (zombie.type === 'SPITTER' || zombie.type === 'EXPLODER') {
      const sac = new THREE.Mesh(new THREE.SphereGeometry(0.22 * scale, 16, 12), new THREE.MeshStandardMaterial({ color: zombie.type === 'SPITTER' ? 0x78d447 : 0x8f3a22, emissive: zombie.type === 'SPITTER' ? 0x255e18 : 0x4a1208, emissiveIntensity: 0.55, roughness: 0.72 }));
      sac.position.set(0, 0.94 * scale, -0.35 * scale);
      group.add(sac);
    }
    if (zombie.type === 'SCREAMER') {
      const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.2 * scale, 0.14 * scale, 0.12 * scale), socketMat);
      jaw.position.set(0, 1.49 * scale, -0.23 * scale);
      group.add(jaw);
    }
    if (zombie.type === 'STALKER') {
      const veil = new THREE.Mesh(new THREE.SphereGeometry(0.42 * scale, 12, 10), new THREE.MeshBasicMaterial({ color: 0x263433, transparent: true, opacity: 0.22, side: THREE.DoubleSide }));
      veil.position.set(0, 1.12 * scale, 0);
      group.add(veil);
    }

    if (isCrawler) {
      torso.rotation.x = -Math.PI / 2;
      torso.position.set(0, 0.38, -0.04);
      // The model front is -Z, so its prone head must stay forward of the torso.
      head.position.set(0, 0.43, -0.48);
      leftArm.position.set(-0.34, 0.25, -0.18);
      rightArm.position.set(0.34, 0.25, -0.18);
      leftArm.rotation.x = -Math.PI / 2;
      rightArm.rotation.x = -Math.PI / 2;
      leftLeg.position.set(-0.22, 0.25, -0.28);
      rightLeg.position.set(0.22, 0.25, -0.28);
      leftLeg.rotation.x = Math.PI / 2;
      rightLeg.rotation.x = Math.PI / 2;
      chestWound.position.set(0.1, 0.42, 0.31);
      chestWound.rotation.z = -0.38;
      shirtPanel.position.set(0, 0.42, 0.32);
      tie.visible = false;
    }
    // 3D Floating Health Bar above head
    const healthBarGroup = new THREE.Group();
    healthBarGroup.name = 'healthBarGroup';
    healthBarGroup.position.set(0, 2.15 * scale, 0);

    const isBoss = zombie.type === 'BOSS';
    healthBarGroup.visible = Boolean(zombie.healthBarShown);
    const numBlocks = isBoss ? 20 : 3;
    const totalBarWidth = isBoss ? 2.4 * scale : 0.96 * scale;
    const barHeight = 0.28 * scale;

    const barBgMat = new THREE.MeshBasicMaterial({ color: 0x0a0c10, side: THREE.DoubleSide });
    const barBg = new THREE.Mesh(new THREE.PlaneGeometry(totalBarWidth, barHeight), barBgMat);
    healthBarGroup.add(barBg);

    const barBorderMat = new THREE.MeshBasicMaterial({ color: isBoss ? 0x9900ff : 0x383b4a, side: THREE.DoubleSide });
    const barBorder = new THREE.Mesh(new THREE.PlaneGeometry(totalBarWidth + 0.06 * scale, barHeight + 0.06 * scale), barBorderMat);
    barBorder.position.z = -0.001;
    healthBarGroup.add(barBorder);

    // Discrete Blocks for Health Bar (20 blocks for BOSS, 3 blocks for normal)
    const blockWidth = (totalBarWidth / numBlocks) * 0.82;
    const blockHeight = 0.18 * scale;
    const blockGap = (totalBarWidth / numBlocks) * 0.18;
    const startX = -totalBarWidth / 2 + blockWidth / 2 + blockGap / 2;

    for (let i = 0; i < numBlocks; i++) {
      const blockGeo = new THREE.PlaneGeometry(blockWidth, blockHeight);
      const blockMat = new THREE.MeshBasicMaterial({ color: isBoss ? 0xcc00ff : 0x00ff66, side: THREE.DoubleSide });
      const blockMesh = new THREE.Mesh(blockGeo, blockMat);
      blockMesh.name = `healthBlock_${i}`;
      blockMesh.position.set(startX + i * (blockWidth + blockGap), 0, 0.002);
      healthBarGroup.add(blockMesh);
    }

    group.add(healthBarGroup);
    if (isCrawler) healthBarGroup.position.set(0, 0.98, 0);
    group.position.set(zombie.position[0], zombie.position[1], zombie.position[2]);
    return group;
  };

  // --- PRACTICE TARGETS GENERATOR ---
  const spawnPracticeTargets = () => {
    const scene = sceneRef.current;
    if (!scene) return;

    targetsRef.current.forEach(t => removeTargetMesh(t.id));
    targetsRef.current = [];

    const targetConfigs: { pos: [number, number, number]; speed?: number; axis?: 'x' | 'y' | 'z'; points: number }[] = [
      { pos: [0, 1.8, -8], points: 100 },
      { pos: [6, 2.2, -6], speed: 1.5, axis: 'x', points: 150 },
      { pos: [-7, 1.5, -5], speed: 1.2, axis: 'y', points: 150 },
      { pos: [9, 2.0, 0], points: 100 },
      { pos: [-8, 2.5, 2], speed: 2.0, axis: 'x', points: 200 },
      { pos: [0, 1.8, 8], speed: 1.8, axis: 'x', points: 150 },
      { pos: [-6, 2.0, 7], points: 100 },
      { pos: [7, 1.6, 6], speed: 2.2, axis: 'z', points: 200 },
    ];

    targetConfigs.forEach((cfg, idx) => {
      const id = `target_${idx}_${Date.now()}`;
      const targetData: Target = {
        id,
        position: cfg.pos,
        radius: 0.6,
        points: cfg.points,
        isHit: false,
        hitTime: 0,
        speed: cfg.speed || 0,
        axis: cfg.axis || 'x',
        minRange: cfg.pos[0] - 3,
        maxRange: cfg.pos[0] + 3,
        direction: 1,
      };

      targetsRef.current.push(targetData);

      const targetGroup = new THREE.Group();

      const outerRing = new THREE.Mesh(
        new THREE.CylinderGeometry(0.6, 0.6, 0.08, 24),
        new THREE.MeshStandardMaterial({ color: 0xcc1122, roughness: 0.4 })
      );
      outerRing.rotation.x = Math.PI / 2;
      targetGroup.add(outerRing);

      const midRing = new THREE.Mesh(
        new THREE.CylinderGeometry(0.4, 0.4, 0.1, 24),
        new THREE.MeshStandardMaterial({ color: 0xf0f0f0, roughness: 0.4 })
      );
      midRing.rotation.x = Math.PI / 2;
      targetGroup.add(midRing);

      const bullseye = new THREE.Mesh(
        new THREE.CylinderGeometry(0.2, 0.2, 0.12, 24),
        new THREE.MeshStandardMaterial({ color: 0xffcc00, roughness: 0.2 })
      );
      bullseye.rotation.x = Math.PI / 2;
      bullseye.name = 'bullseye';
      targetGroup.add(bullseye);

      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.05, 0.05, cfg.pos[1], 12),
        new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.8 })
      );
      post.position.y = -cfg.pos[1] / 2;
      targetGroup.add(post);

      targetGroup.position.set(cfg.pos[0], cfg.pos[1], cfg.pos[2]);
      targetGroup.lookAt(0, cfg.pos[1], 0);

      scene.add(targetGroup);
      targetMeshesRef.current.set(id, targetGroup);
    });
  };

  const removeZombieMesh = (id: string) => {
    const mesh = zombieMeshesRef.current.get(id);
    if (mesh && sceneRef.current) {
      sceneRef.current.remove(mesh);
      zombieMeshesRef.current.delete(id);
    }
  };

  const removeTargetMesh = (id: string) => {
    const mesh = targetMeshesRef.current.get(id);
    if (mesh && sceneRef.current) {
      sceneRef.current.remove(mesh);
      targetMeshesRef.current.delete(id);
    }
  };

  // --- ZOMBIE SPAWNING (Standard Red Dots & Boss at Orange Star every 3 waves) ---
  const spawnZombieInWave = () => {
    if (spawnedWaveZombiesRef.current >= totalWaveZombiesRef.current) return;

    const isBossToSpawn = bossesSpawnedInWaveRef.current < targetBossesInWaveRef.current;
    if (isBossToSpawn) bossesSpawnedInWaveRef.current++;

    let x = 0;
    let z = 0;
    let type: ZombieType = 'STANDING';
    let speed = 1.28 + wave * 0.09;
    let maxHealth = 140 + wave * 8;
    let damage = 10;

    if (isBossToSpawn) {
      const offset = (bossesSpawnedInWaveRef.current - 1) * 2;
      x = ORANGE_BOSS_SPAWN.x + offset;
      z = ORANGE_BOSS_SPAWN.z;
      type = 'BOSS';
      speed = 0.98 + wave * 0.035;
      maxHealth = 1350 + wave * 140;
      damage = 28;
    } else {
      const ventSpawn = RED_ZOMBIE_SPAWNS[Math.floor(Math.random() * RED_ZOMBIE_SPAWNS.length)];
      x = ventSpawn.x;
      z = ventSpawn.z;
      if (Math.random() < 0.42) {
        type = 'CRAWLER';
        speed = 2.35 + wave * 0.12;
        maxHealth = 120 + wave * 4;
        damage = 8;
      }
    }

    const id = `zombie_${Date.now()}_${Math.random()}`;
    const zombie: Zombie = {
      id, type, position: [x, 0, z], health: maxHealth, maxHealth, speed, damage, healthBarShown: false,
      radius: type === 'BOSS' ? 1.8 : type === 'CRAWLER' ? 0.62 : 0.7,
      rotationY: 0, attackCooldown: 0, isAttacking: false, hitFlashTime: 0,
      glowColor: type === 'BOSS' ? '#aa00ff' : type === 'CRAWLER' ? '#c68a55' : '#00ff66',
    };

    zombiesRef.current.push(zombie);
    spawnedWaveZombiesRef.current++;
    if (sceneRef.current) {
      const mesh = createZombieMesh(zombie);
      sceneRef.current.add(mesh);
      zombieMeshesRef.current.set(id, mesh);
    }
  };

  // --- PARTICLES ---
  const createExplosionParticles = (pos: THREE.Vector3, color: string, count: number = 12) => {
    const scene = sceneRef.current;
    if (!scene) return;
    const particleBudget = 36;
    const available = Math.max(0, particleBudget - particlesRef.current.length);
    const spawnCount = Math.min(count, available);

    for (let i = 0; i < spawnCount; i++) {
      const isDust = color === '#ffffff' || color === '#e2e8f0' || color === '#c7b89c';
      const size = isDust ? 0.08 + Math.random() * 0.08 : 0.045 + Math.random() * 0.035;
      const pMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(color), transparent: true, opacity: 0.9 });
      const pMesh = new THREE.Mesh(IMPACT_PARTICLE_GEOMETRY, pMat);
      pMesh.scale.setScalar(size);
      pMesh.position.copy(pos);
      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 5,
        (Math.random() - 0.15) * 4.6,
        (Math.random() - 0.5) * 5
      );

      scene.add(pMesh);
      particlesRef.current.push({
        mesh: pMesh,
        vel,
        life: 0,
        maxLife: isDust ? 0.55 + Math.random() * 0.45 : 0.32 + Math.random() * 0.25,
      });
    }
  };

  const createBossShockwave = (position: THREE.Vector3) => {
    const scene = sceneRef.current;
    if (!scene) return;
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.18, 0.28, 28),
      new THREE.MeshBasicMaterial({ color: 0xff7a3d, transparent: true, opacity: 0.82, side: THREE.DoubleSide, depthWrite: false })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.copy(position).setY(0.035);
    scene.add(ring);
    bossShockwavesRef.current.push({ mesh: ring, life: 0 });
  };

  const breakFixture = (fixtureId: string) => {
    if (brokenFixturesRef.current.has(fixtureId)) return;
    const fixture = breakableFixturesRef.current.get(fixtureId);
    if (!fixture) return;
    brokenFixturesRef.current.add(fixtureId);
    fixture.visible = false;
    const debrisPoint = fixture.position.clone();
    debrisPoint.y = 0.72;
    createExplosionParticles(debrisPoint, '#c7b89c', 20);
    createBossShockwave(debrisPoint);
  };

  const finalizeZombieRemoval = (zId: string) => {
    removeZombieMesh(zId);
    const idx = zombiesRef.current.findIndex(z => z.id === zId);
    if (idx !== -1) {
      zombiesRef.current.splice(idx, 1);
      killedWaveZombiesRef.current++;
    }
    if (
      killedWaveZombiesRef.current >= totalWaveZombiesRef.current &&
      zombiesRef.current.length === 0
    ) {
      onWaveClear();
    }
  };

  const createBulletTracer = (start: THREE.Vector3, end: THREE.Vector3) => {
    const scene = sceneRef.current;
    if (!scene) return;

    const direction = end.clone().sub(start);
    const distance = direction.length();
    if (distance < 0.1) return;
    direction.normalize();

    const mesh = new THREE.Mesh(BULLET_TRACER_GEOMETRY, BULLET_TRACER_MATERIAL.clone());
    mesh.scale.set(1, Math.min(0.75, Math.max(0.28, distance * 0.035)), 1);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
    mesh.position.copy(start);
    mesh.renderOrder = 8;
    scene.add(mesh);

    bulletTracersRef.current.push({
      mesh,
      start: start.clone(),
      end: end.clone(),
      life: 0,
      duration: THREE.MathUtils.clamp(distance / 180, 0.075, 0.14),
    });
  };
  // --- SHOOTING MECHANIC (Respects 30 ammo limit & Boss Headshot -2 HP rule) ---
  const handleShoot = () => {
    if (isPaused || !cameraRef.current || !sceneRef.current) return;
    const shotTime = performance.now();
    if (shotTime - lastShotTimeRef.current < weapon.fireInterval) return;

    // GREEN ZONE CHECK: Do NOT allow shooting while standing in the Circular Green Reload Zone
    if (cameraRef.current) {
      const px = cameraRef.current.position.x;
      const pz = cameraRef.current.position.z;
      if (isInGreenZone(px, pz)) {
        return;
      }
    }

    // AMMO CHECK: If 0 ammo, play empty click sound & refuse to shoot!
    if (ammo <= 0) {
      return;
    }

    lastShotTimeRef.current = shotTime;

    // Audio FX & Recoil
    soundManager.playGunshot();
    recoilRef.current = 0.12;

    // Muzzle Flash
    if (muzzleFlashLightRef.current && muzzleFlashMeshRef.current) {
      muzzleFlashLightRef.current.intensity = 4;
      (muzzleFlashMeshRef.current.material as THREE.MeshBasicMaterial).opacity = 1;
      setTimeout(() => {
        if (muzzleFlashLightRef.current) muzzleFlashLightRef.current.intensity = 0;
        if (muzzleFlashMeshRef.current) {
          (muzzleFlashMeshRef.current.material as THREE.MeshBasicMaterial).opacity = 0;
        }
      }, 50);
    }

    // Raycast from Camera Center
    const raycaster = new THREE.Raycaster();
    const aimDrift = weapon.spread > 0 ? new THREE.Vector2((Math.random() - 0.5) * weapon.spread, (Math.random() - 0.5) * weapon.spread) : new THREE.Vector2();
    raycaster.setFromCamera(aimDrift, cameraRef.current);
    const tracerEnd = raycaster.ray.origin.clone().addScaledVector(raycaster.ray.direction, 30);

    let hitSomething = false;

    if (mode === 'PLAY') {
      let closestHitDist = Infinity;
      let hitZombieId: string | null = null;
      let isHeadshot = false;
      let hitPoint: THREE.Vector3 | null = null;

      zombiesRef.current.forEach(z => {
        if (z.isDead) return;
        const meshGroup = zombieMeshesRef.current.get(z.id);
        if (!meshGroup) return;

        const intersects = raycaster.intersectObjects(meshGroup.children, true);
        if (intersects.length > 0) {
          const hit = intersects[0];
          if (hit.distance < closestHitDist) {
            closestHitDist = hit.distance;
            hitZombieId = z.id;
            hitPoint = hit.point;
            isHeadshot = hit.object.name === 'head';
          }
        }
      });

      if (!hitZombieId && settings.autoAssist) {
        const forward = new THREE.Vector3();
        cameraRef.current.getWorldDirection(forward);
        let bestAlignment = 0.978;
        zombiesRef.current.forEach((candidate) => {
          if (candidate.isDead) return;
          const candidateMesh = zombieMeshesRef.current.get(candidate.id);
          if (!candidateMesh) return;
          const targetPoint = candidateMesh.position.clone().add(new THREE.Vector3(0, candidate.type === 'CRAWLER' ? 0.42 : 1.15, 0));
          const toTarget = targetPoint.sub(cameraRef.current!.position);
          const distance = toTarget.length();
          if (distance > 26) return;
          const alignment = forward.dot(toTarget.normalize());
          if (alignment > bestAlignment) {
            bestAlignment = alignment;
            hitZombieId = candidate.id;
            hitPoint = candidateMesh.position.clone().add(new THREE.Vector3(0, candidate.type === 'CRAWLER' ? 0.42 : 1.1, 0));
            isHeadshot = alignment > 0.994;
          }
        });
      }

      if (hitZombieId && hitPoint) {
        hitSomething = true;
        const zIndex = zombiesRef.current.findIndex(z => z.id === hitZombieId);
        if (zIndex !== -1) {
          const z = zombiesRef.current[zIndex];
          if (!z.isDead) {
            // The boss armour covers its head: every boss shot uses body damage.
            if (z.type === 'BOSS') isHeadshot = false;
            const damageBoost = performance.now() < adrenalineUntilRef.current ? 1.35 : 1;
            let damage = weapon.damage * damageBoost * (isHeadshot ? weapon.headshotMultiplier : 1);
            // Base infected still reward deliberate headshots; elites and bosses retain health pools.
            if (isHeadshot && !['BOSS', 'BRUTE', 'EXPLODER'].includes(z.type)) damage = z.maxHealth + 1;

            z.health -= damage;
            z.hitFlashTime = Date.now();
            z.healthBarShown = true;
            const healthBar = zombieMeshesRef.current.get(z.id)?.getObjectByName('healthBarGroup');
            if (healthBar) healthBar.visible = true;

            createExplosionParticles(hitPoint, isHeadshot ? '#CC5200' : '#e2e8f0', isHeadshot ? 14 : 8);

            if (z.health <= 0) {
              z.health = 0;
              z.isDead = true;

              createExplosionParticles(hitPoint, z.type === 'BOSS' ? '#aa00ff' : isHeadshot ? '#CC5200' : '#ffffff', 20);
              onZombieKill(z.id, isHeadshot, z.type);
              finalizeZombieRemoval(z.id);
            }
          }
        }
      }
    } else if (mode === 'PRACTICE') {
      let closestHitDist = Infinity;
      let hitTargetId: string | null = null;
      let isBullseye = false;
      let hitPoint: THREE.Vector3 | null = null;

      targetsRef.current.forEach(t => {
        const meshGroup = targetMeshesRef.current.get(t.id);
        if (!meshGroup) return;

        const intersects = raycaster.intersectObjects(meshGroup.children, true);
        if (intersects.length > 0) {
          const hit = intersects[0];
          if (hit.distance < closestHitDist) {
            closestHitDist = hit.distance;
            hitTargetId = t.id;
            hitPoint = hit.point;
            isBullseye = hit.object.name === 'bullseye';
          }
        }
      });

      if (hitTargetId && hitPoint) {
        hitSomething = true;
        createExplosionParticles(hitPoint, isBullseye ? '#ffcc00' : '#ffffff', 20);
        onTargetHit(hitTargetId, isBullseye);

        const targetGroup = targetMeshesRef.current.get(hitTargetId);
        if (targetGroup) {
          targetGroup.rotation.x += Math.PI / 4;
          setTimeout(() => {
            if (targetGroup) targetGroup.rotation.x = 0;
          }, 300);
        }
      }
    }

    if (!hitSomething && environmentMeshesRef.current.length > 0) {
      const envIntersects = raycaster.intersectObjects(environmentMeshesRef.current, true);
      if (envIntersects.length > 0) {
        hitSomething = true;
        const hit = envIntersects[0];
        tracerEnd.copy(hit.point);
        createExplosionParticles(hit.point, '#c7b89c', 8);
      }
    }

    const muzzle = gunGroupRef.current?.getObjectByName('muzzle');
    const tracerStart = new THREE.Vector3();
    if (muzzle) muzzle.getWorldPosition(tracerStart);
    else tracerStart.copy(raycaster.ray.origin).addScaledVector(raycaster.ray.direction, 0.5);
    createBulletTracer(tracerStart, tracerEnd);

    onShotFired(hitSomething);
  };

  // --- DESKTOP FALLBACK LOOK ---
  const handlePointerMove = (e: React.PointerEvent) => {
    if (desktopMouseLookRef.current && document.pointerLockElement === mountRef.current) return;
    if (hasGyroSensorRef.current && settings.gyroEnabled) return;

    if (e.buttons === 1 || e.pointerType === 'mouse') {
      applyMouseLookDelta(e.movementX, e.movementY);
    }
  };

  // --- MAIN GAME LOOP (fixed 30 FPS for stable full-HD pacing) ---
  useEffect(() => {
    let animationFrameId: number;
    let lastTime = performance.now();
    const targetFrameMs = 1000 / 30;

    const animate = (currentTime: number) => {
      animationFrameId = requestAnimationFrame(animate);

      const elapsed = currentTime - lastTime;
      if (elapsed < targetFrameMs) return;
      const delta = Math.min(elapsed / 1000, 0.067);
      lastTime = currentTime - (elapsed % targetFrameMs);

      if (isPaused) return;

      const camera = cameraRef.current;
      const scene = sceneRef.current;
      const renderer = rendererRef.current;
      if (!camera || !scene || !renderer) return;

      // Practical lights fail irregularly, but their baseline keeps the play space readable.
      const practicalLights = lightsRef.current;
      if (practicalLights) {
        const pulse = 0.84 + Math.sin(currentTime * 0.009) * 0.12;
        const dropout = Math.sin(currentTime * 0.0017) > 0.965 ? 0.3 : 1;
        practicalLights.corner1.intensity = 0.95 + 0.45 * pulse * dropout;
        practicalLights.corner2.intensity = 0.75 + 0.35 * (0.9 + Math.sin(currentTime * 0.013) * 0.1) * dropout;
        practicalLights.emergency.intensity = 0.7 + (Math.sin(currentTime * 0.018) > 0.92 ? 0.35 : 0);
      }

      // 1. UPDATE CAMERA ROTATION
      if (!desktopMouseLookRef.current && hasGyroSensorRef.current && settings.gyroEnabled) {
        camera.quaternion.copy(deviceQuatRef.current);

        const lookDir = new THREE.Vector3();
        camera.getWorldDirection(lookDir);
        yawRef.current = Math.atan2(-lookDir.x, -lookDir.z);
        pitchRef.current = Math.asin(THREE.MathUtils.clamp(lookDir.y, -0.98, 0.98));
      } else {
        const euler = new THREE.Euler(0, 0, 0, 'YXZ');
        euler.x = pitchRef.current;
        euler.y = yawRef.current;
        camera.quaternion.setFromEuler(euler);
      }

      // 1.5 PLAYER WALKING MOVEMENT
      const jx = joystickVectorRef.current.x;
      const jy = joystickVectorRef.current.y;

      const moveFwdKey = keysPressedRef.current['w'] || keysPressedRef.current['arrowup'];
      const moveBackKey = keysPressedRef.current['s'] || keysPressedRef.current['arrowdown'];
      const moveLeftKey = keysPressedRef.current['a'] || keysPressedRef.current['arrowleft'];
      const moveRightKey = keysPressedRef.current['d'] || keysPressedRef.current['arrowright'];

      let fwdInput = -jy;
      if (moveFwdKey) fwdInput += 1;
      if (moveBackKey) fwdInput -= 1;

      let strafeInput = jx;
      if (moveRightKey) strafeInput += 1;
      if (moveLeftKey) strafeInput -= 1;

      fwdInput = THREE.MathUtils.clamp(fwdInput, -1, 1);
      strafeInput = THREE.MathUtils.clamp(strafeInput, -1, 1);

      if (Math.abs(fwdInput) > 0.05 || Math.abs(strafeInput) > 0.05) {
        const moveSpeed = currentTime < adrenalineUntilRef.current ? 5.65 : 3.8;
        const forwardDir = new THREE.Vector3();
        camera.getWorldDirection(forwardDir);
        forwardDir.y = 0;
        forwardDir.normalize();

        const rightDir = new THREE.Vector3().crossVectors(forwardDir, new THREE.Vector3(0, 1, 0)).normalize();

        const moveVec = new THREE.Vector3()
          .addScaledVector(forwardDir, fwdInput)
          .addScaledVector(rightDir, strafeInput);

        if (moveVec.length() > 1) moveVec.normalize();

        camera.position.addScaledVector(moveVec, moveSpeed * delta);

        walkDistanceRef.current += delta * moveSpeed * moveVec.length();
        const headBob = Math.sin(walkDistanceRef.current * 10) * 0.04;
        camera.position.y = 1.6 + headBob;
      } else {
        camera.position.y = THREE.MathUtils.lerp(camera.position.y, 1.6, 0.1);
      }

      // Prevent player from walking through interior map walls & crates
      resolveMapCollisions(camera.position, 0.5);

      // Outer room boundaries
      camera.position.x = THREE.MathUtils.clamp(camera.position.x, -ROOM_HALF_SIZE + 1.2, ROOM_HALF_SIZE - 1.2);
      camera.position.z = THREE.MathUtils.clamp(camera.position.z, -ROOM_HALF_SIZE + 1.2, ROOM_HALF_SIZE - 1.2);

      // 1.8 GREEN RELOAD ZONE LOGIC (Circular Zone)
      if (mode === 'PLAY') {
        const px = camera.position.x;
        const pz = camera.position.z;
        if (isInGreenZone(px, pz)) {
          if (ammo < maxAmmo) {
            reloadTimeRef.current += delta;
            if (reloadTimeRef.current >= weapon.reloadSeconds) {
              onReloadProgress(weapon.reloadSeconds, true);
              reloadTimeRef.current = 0;
            } else {
              onReloadProgress(reloadTimeRef.current, false);
            }
          } else {
            reloadTimeRef.current = 0;
            onReloadProgress(0, false);
          }
        } else {
          if (reloadTimeRef.current > 0) {
            reloadTimeRef.current = 0;
            onReloadProgress(0, false);
          }
        }
      }

      // Recoil Recovery
      if (recoilRef.current > 0) {
        pitchRef.current += recoilRef.current * 0.3;
        recoilRef.current = Math.max(0, recoilRef.current - delta * 1.5);
      }

      // 3. PLAY MODE: ZOMBIE AI & SPAWNING
      if (mode === 'PLAY') {
        if (
          spawnedWaveZombiesRef.current < totalWaveZombiesRef.current &&
          currentTime - lastSpawnTimeRef.current > Math.max(1650, 3400 - wave * 220)
        ) {
          spawnZombieInWave();
          lastSpawnTimeRef.current = currentTime;
        }

        const playerPos = camera.position.clone();
        playerPos.y = 0;
        const occupiedReloadZones = GREEN_RELOAD_ZONES.filter(zone => isInsideZone(playerPos, 0, zone));
        const warnings: DirectionalWarning[] = [];
        const idsToRemove: string[] = [];
        let minZombieDist = Infinity;
        let closestDx = 0;
        let closestDz = 0;

        zombiesRef.current.forEach(z => {
          const meshGroup = zombieMeshesRef.current.get(z.id);
          if (!meshGroup) return;

          if (z.isDead) {
            idsToRemove.push(z.id);
            return;
          }

          // Reload caches become safe only while occupied. Infected already inside are
          // moved just outside the edge, ready to enter again once the player leaves.
          const occupiedZone = occupiedReloadZones.find(zone => isInsideZone({ x: z.position[0], z: z.position[2] }, z.radius, zone));
          if (occupiedZone) {
            const escapeDirection = new THREE.Vector3(z.position[0] - occupiedZone.x, 0, z.position[2] - occupiedZone.z);
            if (escapeDirection.lengthSq() < 0.001) escapeDirection.set(z.position[0] - playerPos.x, 0, z.position[2] - playerPos.z);
            if (escapeDirection.lengthSq() < 0.001) escapeDirection.set(1, 0, 0);
            escapeDirection.normalize().multiplyScalar(occupiedZone.radius + z.radius + 0.65);
            z.position[0] = occupiedZone.x + escapeDirection.x;
            z.position[2] = occupiedZone.z + escapeDirection.z;
            const teleportedPosition = { x: z.position[0], z: z.position[2] };
            resolveMapCollisions(teleportedPosition, z.radius, z.type === 'BOSS' ? brokenFixturesRef.current : undefined);
            z.position[0] = teleportedPosition.x;
            z.position[2] = teleportedPosition.z;
            meshGroup.position.set(z.position[0], z.type === 'CRAWLER' ? 0.055 : 0, z.position[2]);
            return;
          }

          const zPos = new THREE.Vector3(z.position[0], 0, z.position[2]);
          const dirToPlayer = new THREE.Vector3().subVectors(playerPos, zPos).normalize();
          const distToPlayer = zPos.distanceTo(playerPos);

          const dx = z.position[0] - camera.position.x;
          const dz = z.position[2] - camera.position.z;

          if (distToPlayer < minZombieDist) {
            minZombieDist = distToPlayer;
            closestDx = dx;
            closestDz = dz;
          }

          meshGroup.lookAt(playerPos.x, meshGroup.position.y, playerPos.z);
          meshGroup.rotateY(Math.PI);

          if (z.type === 'EXPLODER' && distToPlayer < 2.35) {
            z.isDead = true;
            onPlayerHit(z.damage);
            createExplosionParticles(meshGroup.position, '#ff8a3d', 24);
            idsToRemove.push(z.id);
          } else if (z.type === 'SPITTER' && distToPlayer > 3.6 && distToPlayer < 10 && currentTime - z.attackCooldown > 2350) {
            z.attackCooldown = currentTime;
            onPlayerHit(z.damage);
            createExplosionParticles(playerPos.clone().setY(1.1), '#9dff83', 12);
          } else if (distToPlayer > z.radius) {
            const step = z.speed * delta;
            const baseAngle = Math.atan2(dirToPlayer.x, dirToPlayer.z);
            const angles = [0, 0.55, -0.55, 1.1, -1.1];
            let bestDir = dirToPlayer.clone();
            let minDstToPlayer = Infinity;

            for (const aOffset of angles) {
              const testAngle = baseAngle + aOffset;
              const testDir = new THREE.Vector3(Math.sin(testAngle), 0, Math.cos(testAngle));
              const testPos = {
                x: z.position[0] + testDir.x * step,
                z: z.position[2] + testDir.z * step,
              };

              const ignoredFixtures = z.type === 'BOSS' ? brokenFixturesRef.current : undefined;
              if (z.type === 'BOSS' && checkCollision(testPos, z.radius, ignoredFixtures)) {
                const touchedFixture = SOLID_FIXTURES.find(fixture =>
                  !brokenFixturesRef.current.has(fixture.id) && touchesFixture(testPos, z.radius, fixture)
                );
                if (touchedFixture) breakFixture(touchedFixture.id);
              }
              const entersProtectedZone = occupiedReloadZones.some(zone => isInsideZone(testPos, z.radius, zone));
              if (!entersProtectedZone && !checkCollision(testPos, z.radius, ignoredFixtures)) {
                const dToPlayer = Math.hypot(testPos.x - playerPos.x, testPos.z - playerPos.z);
                if (dToPlayer < minDstToPlayer) {
                  minDstToPlayer = dToPlayer;
                  bestDir = testDir;
                }
              }
            }

            z.position[0] += bestDir.x * step;
            z.position[2] += bestDir.z * step;

            const tempPos = { x: z.position[0], z: z.position[2] };
            resolveMapCollisions(tempPos, z.radius, z.type === 'BOSS' ? brokenFixturesRef.current : undefined);
            z.position[0] = tempPos.x;
            z.position[2] = tempPos.z;

            const time = currentTime * 0.006 * z.speed;
            const isCrawler = z.type === 'CRAWLER';
            meshGroup.position.set(
              z.position[0],
              isCrawler ? 0.055 + Math.abs(Math.sin(time)) * 0.025 : 0,
              z.position[2]
            );

            const leftArm = meshGroup.getObjectByName('leftArm');
            const rightArm = meshGroup.getObjectByName('rightArm');
            const leftLeg = meshGroup.getObjectByName('leftLeg');
            const rightLeg = meshGroup.getObjectByName('rightLeg');

            if (isCrawler) {
              if (leftArm) leftArm.rotation.x = -Math.PI / 2 + Math.sin(time) * 0.38;
              if (rightArm) rightArm.rotation.x = -Math.PI / 2 - Math.sin(time) * 0.38;
              if (leftLeg) leftLeg.rotation.x = Math.PI / 2 - Math.sin(time) * 0.34;
              if (rightLeg) rightLeg.rotation.x = Math.PI / 2 + Math.sin(time) * 0.34;
            } else {
              if (leftArm) leftArm.rotation.x = -Math.PI / 3 + Math.sin(time) * 0.3;
              if (rightArm) rightArm.rotation.x = -Math.PI / 3 - Math.sin(time) * 0.3;
              if (leftLeg) leftLeg.rotation.x = Math.sin(time) * 0.4;
              if (rightLeg) rightLeg.rotation.x = -Math.sin(time) * 0.4;
            }
          } else {
            if (currentTime - z.attackCooldown > 1200) {
              z.attackCooldown = currentTime;
              onPlayerHit(z.damage);

              createExplosionParticles(meshGroup.position, '#CC5200', 12);
              if (z.type === 'BOSS') createBossShockwave(meshGroup.position);
            }
          }


          // Billboard 3D floating Health Bar to face camera
          const healthBar = meshGroup.getObjectByName('healthBarGroup');
          if (healthBar?.visible && cameraRef.current) {
            healthBar.lookAt(cameraRef.current.position);

            const numBlocks = z.type === 'BOSS' ? 20 : 3;
            const blocksLeft = Math.max(0, Math.min(numBlocks, Math.ceil((z.health / z.maxHealth) * numBlocks)));

            let colorHex = z.type === 'BOSS' ? 0xcc00ff : 0x00ff66;
            if (blocksLeft <= numBlocks / 3) colorHex = 0xff2200;
            else if (blocksLeft <= (numBlocks * 2) / 3) colorHex = 0xffcc00;
            if (blocksLeft === 0) colorHex = 0x555566;

            for (let i = 0; i < numBlocks; i++) {
              const blockMesh = healthBar.getObjectByName(`healthBlock_${i}`) as THREE.Mesh;
              if (blockMesh) {
                const mat = blockMesh.material as THREE.MeshBasicMaterial;
                if (blocksLeft === 0) {
                  blockMesh.visible = true;
                  mat.color.setHex(0x555566);
                } else if (i < blocksLeft) {
                  blockMesh.visible = true;
                  mat.color.setHex(colorHex);
                } else {
                  blockMesh.visible = true;
                  mat.color.setHex(0x22222a);
                }
              }
            }
          }

          const angleToZombie = Math.atan2(dx, -dz);
          let relAngle = angleToZombie - yawRef.current;
          while (relAngle > Math.PI) relAngle -= Math.PI * 2;
          while (relAngle < -Math.PI) relAngle += Math.PI * 2;

          let dirName: 'FRONT' | 'BACK' | 'LEFT' | 'RIGHT' = 'FRONT';
          if (Math.abs(relAngle) < Math.PI / 4) dirName = 'FRONT';
          else if (Math.abs(relAngle) > (Math.PI * 3) / 4) dirName = 'BACK';
          else if (relAngle < 0) dirName = 'LEFT';
          else dirName = 'RIGHT';

          warnings.push({ direction: dirName, angle: relAngle, distance: distToPlayer });
        });

        idsToRemove.forEach(id => finalizeZombieRemoval(id));
        if (currentTime - lastBridgeUpdateRef.current > 200) {
          lastBridgeUpdateRef.current = currentTime;
          onDirectionalUpdate(warnings);
        }

      }

      // 4. PRACTICE MODE
      if (mode === 'PRACTICE') {
        targetsRef.current.forEach(t => {
          const meshGroup = targetMeshesRef.current.get(t.id);
          if (!meshGroup || t.speed === 0) return;

          if (t.axis === 'x') {
            t.position[0] += t.speed * t.direction * delta;
            if (t.position[0] > t.maxRange) t.direction = -1;
            if (t.position[0] < t.minRange) t.direction = 1;
          } else if (t.axis === 'y') {
            t.position[1] += t.speed * t.direction * delta;
            if (t.position[1] > 3.2) t.direction = -1;
            if (t.position[1] < 1.0) t.direction = 1;
          } else if (t.axis === 'z') {
            t.position[2] += t.speed * t.direction * delta;
            if (t.position[2] > 9) t.direction = -1;
            if (t.position[2] < 3) t.direction = 1;
          }

          meshGroup.position.set(t.position[0], t.position[1], t.position[2]);
        });
      }

      // 5. UPDATE BULLET TRACERS
      for (let i = bulletTracersRef.current.length - 1; i >= 0; i--) {
        const tracer = bulletTracersRef.current[i];
        tracer.life += delta;
        const progress = THREE.MathUtils.clamp(tracer.life / tracer.duration, 0, 1);
        tracer.mesh.position.lerpVectors(tracer.start, tracer.end, progress);
        const material = tracer.mesh.material as THREE.MeshBasicMaterial;
        material.opacity = Math.max(0, 0.92 * (1 - progress * 0.55));
        if (progress >= 1) {
          scene.remove(tracer.mesh);
          (tracer.mesh.material as THREE.Material).dispose();
          bulletTracersRef.current.splice(i, 1);
        }
      }

      for (let i = bossShockwavesRef.current.length - 1; i >= 0; i--) {
        const shockwave = bossShockwavesRef.current[i];
        shockwave.life += delta;
        const progress = Math.min(1, shockwave.life / 0.52);
        shockwave.mesh.scale.setScalar(1 + progress * 11);
        (shockwave.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.82 * (1 - progress));
        if (progress >= 1) {
          scene.remove(shockwave.mesh);
          (shockwave.mesh.material as THREE.Material).dispose();
          shockwave.mesh.geometry.dispose();
          bossShockwavesRef.current.splice(i, 1);
        }
      }

      // 6. UPDATE PARTICLES
      for (let i = particlesRef.current.length - 1; i >= 0; i--) {
        const p = particlesRef.current[i];
        p.life += delta;
        p.mesh.position.addScaledVector(p.vel, delta);
        p.vel.y -= 9.8 * delta;

        if (p.life >= p.maxLife) {
          scene.remove(p.mesh);
          (p.mesh.material as THREE.Material).dispose();
          particlesRef.current.splice(i, 1);
        }
      }

      if (triggerHeldRef.current && weapon.automatic && mode === 'PLAY' && hp > 0) handleShoot();

      // 7. RENDER SCENE
      renderer.render(scene, camera);
    };

    animationFrameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrameId);
  }, [mode, isPaused, wave, hp, ammo]);

  return (
    <div
      ref={mountRef}
      id="game-canvas-container"
      className="relative w-full h-full touch-none select-none overflow-hidden cursor-crosshair bg-black"
      onPointerDown={(e) => {
        e.stopPropagation();
        if (desktopMouseLookRef.current && e.pointerType === 'mouse' && document.pointerLockElement !== e.currentTarget) {
          e.currentTarget.requestPointerLock();
        }
        triggerHeldRef.current = true;
        handleShoot();
      }}
      onPointerUp={() => { triggerHeldRef.current = false; }}
      onPointerCancel={() => { triggerHeldRef.current = false; }}
      onPointerLeave={() => { triggerHeldRef.current = false; }}
      onPointerMove={handlePointerMove}
    >



      {/* Click To Fire Crosshair Overlay */}
      <div className="absolute inset-0 pointer-events-none z-[1] bg-[radial-gradient(ellipse_at_50%_48%,transparent_35%,rgba(0,8,12,0.24)_72%,rgba(0,0,0,0.76)_100%)] mix-blend-multiply" />
      <div className="absolute inset-0 pointer-events-none z-[1] opacity-[0.10] bg-[repeating-linear-gradient(0deg,rgba(255,255,255,0.22)_0_1px,transparent_1px_3px)] mix-blend-overlay" />

      <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-\[#CC5200\]/60 rounded-full flex items-center justify-center animate-pulse">
          <div className="w-1.5 h-1.5 bg-\[#CC5200\] rounded-full"></div>
        </div>
      </div>

      {/* VIRTUAL JOYSTICK (BOTTOM LEFT) */}
      {!isPaused && hp > 0 && (
        <div
          className="absolute bottom-12 left-10 z-30 pointer-events-auto touch-none select-none flex items-center justify-center p-2"
          onPointerDown={handleJoystickPointerDown}
          onPointerMove={handleJoystickPointerMove}
          onPointerUp={handleJoystickPointerUp}
          onPointerCancel={handleJoystickPointerUp}
        >
          <div className={`relative w-28 h-28 rounded-full border-2 ${isJoystickActive ? 'border-[#CC5200] bg-black/80 shadow-[0_0_20px_rgba(204,82,0,0.4)]' : 'border-white/40 bg-black/60'} backdrop-blur-md flex items-center justify-center shadow-2xl transition-colors`}>

            <div
              className={`w-12 h-12 rounded-full ${isJoystickActive ? 'bg-[#CC5200] shadow-[0_0_15px_#CC5200]' : 'bg-white/90'} border-2 border-white transition-transform duration-75 ease-out flex items-center justify-center pointer-events-none`}
              style={{
                transform: `translate(${joystickPos.x}px, ${joystickPos.y}px)`,
              }}
            >
              <div className="w-3.5 h-3.5 rounded-full bg-black/60" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
