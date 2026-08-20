// Web Audio API Synthesizer for Zombie VR Game
import type { ZombieType } from '../types';

class SoundManager {
  private ctx: AudioContext | null = null;
  private outputGain: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private noiseBuffers = new Map<string, AudioBuffer>();
  private isMuted: boolean = false;
  private ambientGain: GainNode | null = null;
  private ambientOsc1: OscillatorNode | null = null;
  private ambientOsc2: OscillatorNode | null = null;
  private ambientLfo: OscillatorNode | null = null;
  private heartbeatInterval: number | null = null;

  // Proximity Zombie Buzz Audio Nodes
  private buzzOsc1: OscillatorNode | null = null;
  private buzzOsc2: OscillatorNode | null = null;
  private buzzLfo: OscillatorNode | null = null;
  private buzzLfoGain: GainNode | null = null;
  private buzzGain: GainNode | null = null;
  private buzzFilter: BiquadFilterNode | null = null;
  private buzzPanner: AudioNode | null = null;

  constructor() {
    // The audio context starts only when a retained effect is played.
  }

  public startBGM() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx || this.ambientOsc1) return;

    const now = this.ctx.currentTime;
    const scoreGain = this.ctx.createGain();
    scoreGain.gain.setValueAtTime(0.0001, now);
    scoreGain.gain.exponentialRampToValueAtTime(0.075, now + 1.8);

    const scoreFilter = this.ctx.createBiquadFilter();
    scoreFilter.type = 'lowpass';
    scoreFilter.frequency.value = 360;
    scoreFilter.Q.value = 0.35;

    const lowPad = this.ctx.createOscillator();
    lowPad.type = 'sine';
    lowPad.frequency.value = 43.65;
    const highPad = this.ctx.createOscillator();
    highPad.type = 'triangle';
    highPad.frequency.value = 65.41;
    highPad.detune.value = -8;
    const motion = this.ctx.createOscillator();
    motion.type = 'sine';
    motion.frequency.value = 0.075;
    const motionDepth = this.ctx.createGain();
    motionDepth.gain.value = 5;

    lowPad.connect(scoreFilter);
    highPad.connect(scoreFilter);
    motion.connect(motionDepth);
    motionDepth.connect(highPad.detune);
    scoreFilter.connect(scoreGain);
    scoreGain.connect(this.getOutput());

    lowPad.start(now);
    highPad.start(now);
    motion.start(now);
    this.ambientGain = scoreGain;
    this.ambientOsc1 = lowPad;
    this.ambientOsc2 = highPad;
    this.ambientLfo = motion;
  }

  public stopBGM() {
    this.stopAmbientDrone();
  }

  private initCtx() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx({ latencyHint: 'interactive' });
        this.outputGain = this.ctx.createGain();
        this.outputGain.gain.value = 0.82;
        this.compressor = this.ctx.createDynamicsCompressor();
        this.compressor.threshold.value = -13;
        this.compressor.knee.value = 8;
        this.compressor.ratio.value = 4;
        this.compressor.attack.value = 0.003;
        this.compressor.release.value = 0.18;
        this.outputGain.connect(this.compressor);
        this.compressor.connect(this.ctx.destination);
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  private getOutput(): AudioNode {
    if (!this.ctx) throw new Error('Audio context is unavailable');
    return this.outputGain || this.ctx.destination;
  }

  private getNoiseBuffer(duration: number, gritty: boolean = false): AudioBuffer {
    if (!this.ctx) throw new Error('Audio context is unavailable');
    const key = `${Math.round(duration * 1000)}:${gritty ? 1 : 0}`;
    const cached = this.noiseBuffers.get(key);
    if (cached) return cached;

    const length = Math.max(1, Math.floor(this.ctx.sampleRate * duration));
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      const impulse = gritty && i % 47 === 0 ? 1.8 : 1;
      data[i] = (Math.random() * 2 - 1) * impulse;
    }
    this.noiseBuffers.set(key, buffer);
    return buffer;
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (this.ambientGain) {
      this.ambientGain.gain.value = muted ? 0 : 0.075;
    }
    if (!muted) this.startBGM();
  }

  // Layered mechanical crack, body and short indoor reflection.
  public playGunshot() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    const ctx = this.ctx;
    const now = ctx.currentTime;
    const blast = ctx.createBufferSource();
    blast.buffer = this.getNoiseBuffer(0.32);
    const blastFilter = ctx.createBiquadFilter();
    blastFilter.type = 'bandpass';
    blastFilter.frequency.setValueAtTime(1700, now);
    blastFilter.Q.value = 0.62;
    const blastGain = ctx.createGain();
    blastGain.gain.setValueAtTime(0.92, now);
    blastGain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
    blast.connect(blastFilter);
    blastFilter.connect(blastGain);
    blastGain.connect(this.getOutput());

    const crack = ctx.createOscillator();
    crack.type = 'sawtooth';
    crack.frequency.setValueAtTime(1450, now);
    crack.frequency.exponentialRampToValueAtTime(180, now + 0.045);
    const crackGain = ctx.createGain();
    crackGain.gain.setValueAtTime(0.16, now);
    crackGain.gain.exponentialRampToValueAtTime(0.001, now + 0.055);
    crack.connect(crackGain);
    crackGain.connect(this.getOutput());

    const body = ctx.createOscillator();
    body.type = 'sine';
    body.frequency.setValueAtTime(145, now);
    body.frequency.exponentialRampToValueAtTime(42, now + 0.13);
    const bodyGain = ctx.createGain();
    bodyGain.gain.setValueAtTime(0.68, now);
    bodyGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    body.connect(bodyGain);
    bodyGain.connect(this.getOutput());

    const reflection = ctx.createBufferSource();
    reflection.buffer = blast.buffer;
    const reflectionFilter = ctx.createBiquadFilter();
    reflectionFilter.type = 'lowpass';
    reflectionFilter.frequency.value = 780;
    const reflectionGain = ctx.createGain();
    reflectionGain.gain.setValueAtTime(0.11, now + 0.048);
    reflectionGain.gain.exponentialRampToValueAtTime(0.001, now + 0.31);
    reflection.connect(reflectionFilter);
    reflectionFilter.connect(reflectionGain);
    reflectionGain.connect(this.getOutput());

    blast.start(now);
    reflection.start(now + 0.048);
    crack.start(now);
    body.start(now);
    blast.stop(now + 0.32);
    reflection.stop(now + 0.37);
    crack.stop(now + 0.06);
    body.stop(now + 0.16);
  }

  // Broken duct rattle used when an infected drops from a ceiling vent.
  public playVentRattle(pitch: number = 1) {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const noise = ctx.createBufferSource();
    noise.buffer = this.getNoiseBuffer(0.34, true);
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(980 * pitch, now);
    filter.Q.value = 2.8;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.32);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.getOutput());
    noise.start(now);
    noise.stop(now + 0.34);

    [0, 0.11, 0.22].forEach((delay, index) => {
      const clank = ctx.createOscillator();
      clank.type = 'square';
      clank.frequency.setValueAtTime((260 - index * 44) * pitch, now + delay);
      const clankGain = ctx.createGain();
      clankGain.gain.setValueAtTime(0.12, now + delay);
      clankGain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.07);
      clank.connect(clankGain);
      clankGain.connect(this.getOutput());
      clank.start(now + delay);
      clank.stop(now + delay + 0.08);
    });
  }

  public playEnvironmentImpact() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const impact = ctx.createBufferSource();
    impact.buffer = this.getNoiseBuffer(0.16, true);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1200;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
    impact.connect(filter);
    filter.connect(gain);
    gain.connect(this.getOutput());
    impact.start(now);
    impact.stop(now + 0.16);
  }
  // Zombie Groan / Screech
  public playZombieGroan(pitchMultiplier: number = 1.0) {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const duration = 0.8;

    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(90 * pitchMultiplier, now);
    osc.frequency.linearRampToValueAtTime(140 * pitchMultiplier, now + 0.3);
    osc.frequency.linearRampToValueAtTime(60 * pitchMultiplier, now + duration);

    // LFO for scary pitch tremor
    const lfo = this.ctx.createOscillator();
    lfo.frequency.setValueAtTime(12, now);
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 15;
    lfo.connect(osc.frequency);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(400, now);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.01, now);
    gain.gain.linearRampToValueAtTime(0.4, now + 0.1);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.getOutput());

    lfo.start(now);
    osc.start(now);
    lfo.stop(now + duration);
    osc.stop(now + duration);
  }

  // Zombie Attack / Bite sound
  public playZombieAttack() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;

    // Crunch noise
    const buffer = this.getNoiseBuffer(0.2, true);

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.8, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);

    noise.connect(gain);
    gain.connect(this.getOutput());

    noise.start(now);
  }

  // Empty Magazine Click Sound
  public playEmptyClick() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(150, now + 0.05);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

    osc.connect(gain);
    gain.connect(this.getOutput());

    osc.start(now);
    osc.stop(now + 0.05);
  }

  // Magazine seating and slide movement at the start of a reload.
  public playReloadStart() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    [0, 0.18].forEach((delay, index) => {
      const osc = this.ctx!.createOscillator();
      osc.type = index === 0 ? 'square' : 'triangle';
      osc.frequency.setValueAtTime(index === 0 ? 440 : 720, now + delay);
      osc.frequency.exponentialRampToValueAtTime(index === 0 ? 120 : 260, now + delay + 0.075);
      const gain = this.ctx!.createGain();
      gain.gain.setValueAtTime(index === 0 ? 0.22 : 0.14, now + delay);
      gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.09);
      osc.connect(gain);
      gain.connect(this.getOutput());
      osc.start(now + delay);
      osc.stop(now + delay + 0.1);
    });
  }
  // Ammo Reload Complete Sound
  public playReloadComplete() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;

    // First rack click
    const osc1 = this.ctx.createOscillator();
    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(600, now);
    osc1.frequency.exponentialRampToValueAtTime(120, now + 0.08);

    const gain1 = this.ctx.createGain();
    gain1.gain.setValueAtTime(0.5, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    osc1.connect(gain1);
    gain1.connect(this.getOutput());
    osc1.start(now);
    osc1.stop(now + 0.08);

    // Second metallic locking click
    const osc2 = this.ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1200, now + 0.1);
    osc2.frequency.exponentialRampToValueAtTime(300, now + 0.2);

    const gain2 = this.ctx.createGain();
    gain2.gain.setValueAtTime(0.6, now + 0.1);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

    osc2.connect(gain2);
    gain2.connect(this.getOutput());
    osc2.start(now + 0.1);
    osc2.stop(now + 0.2);
  }

  // Target Hit Sound (Ding / Steel impact)
  public playTargetHit() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(980, now);
    osc.frequency.exponentialRampToValueAtTime(400, now + 0.2);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.5, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

    osc.connect(gain);
    gain.connect(this.getOutput());

    osc.start(now);
    osc.stop(now + 0.25);
  }

  // Zombie Death Splat Sound
  public playZombieHit() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(250, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.15);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.6, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);

    osc.connect(gain);
    gain.connect(this.getOutput());

    osc.start(now);
    osc.stop(now + 0.15);
  }

  // Wave Completed Fanfare
  public playWaveComplete() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const freqs = [300, 450, 600, 900];

    freqs.forEach((freq, idx) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.08);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0, now + idx * 0.08);
      gain.gain.linearRampToValueAtTime(0.3, now + idx * 0.08 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.4);

      osc.connect(gain);
      gain.connect(this.getOutput());

      osc.start(now + idx * 0.08);
      osc.stop(now + idx * 0.08 + 0.4);
    });
  }

  // Dark Ambient Horror Drone
  public startAmbientDrone() {
    this.stopAmbientDrone();
  }

  public stopAmbientDrone() {
    if (this.ambientOsc1) {
      try {
        this.ambientOsc1.stop();
        this.ambientOsc1.disconnect();
      } catch {
        // ignore if stopped
      }
      this.ambientOsc1 = null;
    }
    if (this.ambientOsc2) {
      try {
        this.ambientOsc2.stop();
        this.ambientOsc2.disconnect();
      } catch {
        // ignore if stopped
      }
      this.ambientOsc2 = null;
    }
    if (this.ambientLfo) {
      try {
        this.ambientLfo.stop();
        this.ambientLfo.disconnect();
      } catch {
        // ignore if stopped
      }
      this.ambientLfo = null;
    }
    this.ambientGain = null;
  }

  // --- PROXIMITY ZOMBIE BUZZING SOUND ---
  // Dynamically adjusts volume, pitch cutoff, growl rate, and panning based on distance to closest zombie
  public updateZombieBuzz(minDist: number, dx: number = 0, dz: number = 0, yaw: number = 0) {
    void minDist; void dx; void dz; void yaw;
  }

  public stopZombieBuzz() {
    if (this.buzzOsc1) {
      try { this.buzzOsc1.stop(); this.buzzOsc1.disconnect(); } catch {}
      this.buzzOsc1 = null;
    }
    if (this.buzzOsc2) {
      try { this.buzzOsc2.stop(); this.buzzOsc2.disconnect(); } catch {}
      this.buzzOsc2 = null;
    }
    if (this.buzzLfo) {
      try { this.buzzLfo.stop(); this.buzzLfo.disconnect(); } catch {}
      this.buzzLfo = null;
    }
    this.buzzGain = null;
    this.buzzFilter = null;
    this.buzzPanner = null;
  }

  // --- SPATIAL ZOMBIE SOUND EFFECTS ---
  public playSpatialZombieGroan(
    zombiePos: { x: number; y: number; z: number },
    playerPos: { x: number; y: number; z: number },
    yaw: number,
    type: ZombieType = 'STANDING'
  ) { 
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;
    const ctx = this.ctx;

    const now = ctx.currentTime;

    // 1. Calculate relative distance and angle
    const dx = zombiePos.x - playerPos.x;
    const dz = zombiePos.z - playerPos.z;
    const dist = Math.max(0.5, Math.sqrt(dx * dx + dz * dz));

    // Angle relative to player facing direction (yaw)
    const angleToZombie = Math.atan2(dx, -dz);
    let relAngle = angleToZombie - yaw;
    while (relAngle > Math.PI) relAngle -= Math.PI * 2;
    while (relAngle < -Math.PI) relAngle += Math.PI * 2;

    // Pan calculation: -1 (full left) to +1 (full right)
    const panVal = Math.sin(relAngle);

    // Volume distance decay (inverse distance law)
    const rawVol = 1.0 / (1.0 + (dist - 1) * 0.12);
    const volume = Math.min(0.85, Math.max(0.04, rawVol));

    // Front/Back filter cutoff: muffled if behind player
    const isBehind = Math.abs(relAngle) > Math.PI / 2;
    const baseCutoff = isBehind ? 450 : 1600;

    // 2. Build Web Audio Node Chain
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(volume, now);

    const biquadFilter = ctx.createBiquadFilter();
    biquadFilter.type = 'lowpass';
    biquadFilter.frequency.setValueAtTime(baseCutoff, now);

    // Stereo Panner or Fallback
    let pannerNode: AudioNode = masterGain;
    if (typeof (ctx as any).createStereoPanner === 'function') {
      const panner = (ctx as any).createStereoPanner();
      panner.pan.setValueAtTime(panVal, now);
      pannerNode = panner;
    }

    biquadFilter.connect(masterGain);
    if (pannerNode !== masterGain) {
      masterGain.connect(pannerNode);
      pannerNode.connect(this.getOutput());
    } else {
      masterGain.connect(this.getOutput());
    }

    // 3. Sound Synthesis based on Zombie Type
    let duration = 0.9;

    if (type === 'CRAWLER') {
      // High-pitched screech / aggressive hiss
      duration = 0.6;
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(280, now);
      osc.frequency.linearRampToValueAtTime(380, now + 0.2);
      osc.frequency.exponentialRampToValueAtTime(110, now + duration);

      const lfo = ctx.createOscillator();
      lfo.frequency.setValueAtTime(22, now);
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 35;
      lfo.connect(osc.frequency);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.01, now);
      gain.gain.linearRampToValueAtTime(0.5, now + 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      osc.connect(gain);
      gain.connect(biquadFilter);

      lfo.start(now);
      osc.start(now);
      lfo.stop(now + duration);
      osc.stop(now + duration);

    } else if (type === 'BOSS') {
      // Deep guttural sub-bass roar
      duration = 1.2;
      const osc1 = ctx.createOscillator();
      osc1.type = 'sawtooth';
      osc1.frequency.setValueAtTime(45, now);
      osc1.frequency.linearRampToValueAtTime(75, now + 0.4);
      osc1.frequency.exponentialRampToValueAtTime(35, now + duration);

      const osc2 = ctx.createOscillator();
      osc2.type = 'square';
      osc2.frequency.setValueAtTime(50, now);
      osc2.frequency.linearRampToValueAtTime(80, now + 0.4);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.01, now);
      gain.gain.linearRampToValueAtTime(0.7, now + 0.15);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(biquadFilter);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + duration);
      osc2.stop(now + duration);

    } else if (type === 'STALKER') {
      // Sinister clicking / raspy whisper
      duration = 0.7;
      const bufferSize = ctx.sampleRate * duration;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * (i % 80 < 15 ? 1.8 : 0.2);
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.01, now);
      gain.gain.linearRampToValueAtTime(0.45, now + 0.1);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      noise.connect(gain);
      gain.connect(biquadFilter);

      noise.start(now);

    } else {
      // WALKER: Classic pitch-modulated zombie groan
      duration = 0.85;
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(85, now);
      osc.frequency.linearRampToValueAtTime(130, now + 0.3);
      osc.frequency.exponentialRampToValueAtTime(55, now + duration);

      const lfo = ctx.createOscillator();
      lfo.frequency.setValueAtTime(12, now);
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 18;
      lfo.connect(osc.frequency);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.01, now);
      gain.gain.linearRampToValueAtTime(0.5, now + 0.1);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      osc.connect(gain);
      gain.connect(biquadFilter);

      lfo.start(now);
      osc.start(now);
      lfo.stop(now + duration);
      osc.stop(now + duration);
    }
  }

  // Spatial Door Opening Hiss / Clank sound when zombie spawns
  public playDoorSpawnSound(
    doorPos: { x: number; y: number; z: number },
    playerPos: { x: number; y: number; z: number },
    yaw: number
  ) {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;
    const ctx = this.ctx;

    const now = ctx.currentTime;
    const dx = doorPos.x - playerPos.x;
    const dz = doorPos.z - playerPos.z;
    const dist = Math.max(0.5, Math.sqrt(dx * dx + dz * dz));

    const angleToDoor = Math.atan2(dx, -dz);
    let relAngle = angleToDoor - yaw;
    while (relAngle > Math.PI) relAngle -= Math.PI * 2;
    while (relAngle < -Math.PI) relAngle += Math.PI * 2;

    const panVal = Math.sin(relAngle);
    const volume = Math.min(0.6, Math.max(0.05, 1.0 / (1.0 + (dist - 1) * 0.15)));

    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(volume, now);

    if (typeof (ctx as any).createStereoPanner === 'function') {
      const panner = (ctx as any).createStereoPanner();
      panner.pan.setValueAtTime(panVal, now);
      masterGain.connect(panner);
      panner.connect(this.getOutput());
    } else {
      masterGain.connect(this.getOutput());
    }

    // Metallic door slam + hydraulic hiss
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.2);

    const oscGain = ctx.createGain();
    oscGain.gain.setValueAtTime(0.6, now);
    oscGain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);

    osc.connect(oscGain);
    oscGain.connect(masterGain);

    osc.start(now);
    osc.stop(now + 0.2);
  }

  // Heartbeat sound for low HP
  public playHeartbeat() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const beats = [0, 0.18];

    beats.forEach(delay => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(70, now + delay);
      osc.frequency.exponentialRampToValueAtTime(30, now + delay + 0.12);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.7, now + delay);
      gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.12);

      osc.connect(gain);
      gain.connect(this.getOutput());

      osc.start(now + delay);
      osc.stop(now + delay + 0.12);
    });
  }
}

export const soundManager = new SoundManager();
