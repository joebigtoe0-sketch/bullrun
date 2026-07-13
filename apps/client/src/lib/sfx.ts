/* Bull Race — tiny WebAudio SFX synth (TS port of the design spec's
   bullrun-sfx.js — keep in sync with the spec folder). No audio files. */
import { loadAudioSettings } from './audioSettings';

let C: AudioContext | null = null;

let sfxVol = loadAudioSettings().sfxVol;
let sfxMuted = loadAudioSettings().sfxMuted;
let master: GainNode | null = null;

/** Shared master gain — every sound routes through it for global volume/mute. */
function masterGain(c: AudioContext): GainNode {
  if (!master || master.context !== c) {
    master = c.createGain();
    master.gain.value = sfxMuted ? 0 : sfxVol;
    master.connect(c.destination);
  }
  return master;
}

export function setSfxVolume(v: number): void {
  sfxVol = Math.max(0, Math.min(1, v));
  if (master) master.gain.value = sfxMuted ? 0 : sfxVol;
}

export function setSfxMuted(m: boolean): void {
  sfxMuted = m;
  if (master) master.gain.value = m ? 0 : sfxVol;
}

function ctx(): AudioContext | null {
  if (!C) {
    try {
      C = new AudioContext();
    } catch {
      return null;
    }
  }
  if (C && C.state === 'suspended') {
    try {
      void C.resume();
    } catch {
      /* ignore */
    }
  }
  return C;
}

function tone(freq: number, dur: number, type?: OscillatorType, vol?: number, slideTo?: number | null, when?: number) {
  const c = ctx();
  if (!c || c.state !== 'running') return;
  const t0 = c.currentTime + (when || 0);
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type || 'square';
  o.frequency.setValueAtTime(freq, t0);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol || 0.12, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g);
  g.connect(masterGain(c));
  o.start(t0);
  o.stop(t0 + dur + 0.05);
}

function noise(dur: number, vol?: number, when?: number, freq?: number) {
  const c = ctx();
  if (!c || c.state !== 'running') return;
  const t0 = c.currentTime + (when || 0);
  const n = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, n, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = freq || 2000;
  f.Q.value = 0.8;
  const g = c.createGain();
  g.gain.value = vol || 0.2;
  src.connect(f);
  f.connect(g);
  g.connect(masterGain(c));
  src.start(t0);
}

export const BRSfx = {
  unlock() { ctx(); },
  click() { tone(660, 0.055, 'square', 0.05); },
  pop() { tone(500, 0.09, 'triangle', 0.11, 760); },
  coin() { tone(880, 0.07, 'square', 0.09); tone(1318, 0.14, 'square', 0.09, null, 0.07); },
  error() { tone(220, 0.16, 'sawtooth', 0.07, 155); },
  chime() { tone(659, 0.12, 'triangle', 0.11); tone(880, 0.12, 'triangle', 0.11, null, 0.1); tone(1108, 0.22, 'triangle', 0.11, null, 0.2); },
  hammer() { noise(0.12, 0.28, 0, 900); tone(170, 0.1, 'square', 0.1, 110); },
  horn() { tone(392, 0.18, 'sawtooth', 0.1); tone(523, 0.18, 'sawtooth', 0.1, null, 0.18); tone(659, 0.34, 'sawtooth', 0.12, null, 0.36); },
  fanfare() { tone(523, 0.13, 'square', 0.1); tone(659, 0.13, 'square', 0.1, null, 0.13); tone(784, 0.13, 'square', 0.1, null, 0.26); tone(1046, 0.4, 'square', 0.12, null, 0.4); },
  whoosh() { noise(0.25, 0.14, 0, 600); },
  /* --- world/action sounds --- */
  step() { noise(0.04, 0.04, 0, 340); },
  axeHit() { noise(0.09, 0.18, 0, 760); tone(110, 0.08, 'square', 0.05, 70); },
  pickHit() { tone(1400, 0.045, 'square', 0.045, 950); noise(0.05, 0.13, 0, 2600); },
  forkHit() { noise(0.13, 0.11, 0, 1450); },
  gallop() { noise(0.05, 0.09, 0, 230); noise(0.05, 0.07, 0.09, 180); },
  levelup() { tone(523, 0.11, 'square', 0.1); tone(659, 0.11, 'square', 0.1, null, 0.11); tone(784, 0.11, 'square', 0.1, null, 0.22); tone(1046, 0.2, 'square', 0.11, null, 0.33); tone(1318, 0.34, 'square', 0.12, null, 0.44); },
};

// unlock audio on the first user gesture
const un = () => {
  ctx();
  window.removeEventListener('pointerdown', un);
  window.removeEventListener('keydown', un);
};
window.addEventListener('pointerdown', un);
window.addEventListener('keydown', un);
