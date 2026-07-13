/** Looping background music player — shuffles between the tracks in public/audio. */
import { loadAudioSettings } from './audioSettings';

const TRACKS = ['/audio/BullRace.mp3', '/audio/rideitout.mp3'];

let audio: HTMLAudioElement | null = null;
let idx = 0;
let started = false;

let musicVol = loadAudioSettings().musicVol;
let musicMuted = loadAudioSettings().musicMuted;

function ensureAudio(): HTMLAudioElement {
  if (audio) return audio;
  const a = new Audio();
  a.preload = 'auto';
  a.volume = musicVol;
  a.addEventListener('ended', () => {
    idx = (idx + 1) % TRACKS.length;
    a.src = TRACKS[idx];
    void a.play().catch(() => {});
  });
  audio = a;
  return a;
}

function tryPlay() {
  if (musicMuted) return;
  const a = ensureAudio();
  if (!a.src) {
    idx = Math.floor(Math.random() * TRACKS.length);
    a.src = TRACKS[idx];
  }
  a.volume = musicVol;
  void a.play().catch(() => {
    // autoplay blocked — will retry on the next user gesture
    started = false;
  });
}

/** Begin playback now if allowed, and on the first user gesture otherwise. */
export function startMusicOnGesture(): void {
  if (started) return;
  started = true;
  const go = () => {
    tryPlay();
    if (audio && !audio.paused) {
      window.removeEventListener('pointerdown', go);
      window.removeEventListener('keydown', go);
    }
  };
  window.addEventListener('pointerdown', go);
  window.addEventListener('keydown', go);
  tryPlay();
}

export function setMusicVolume(v: number): void {
  musicVol = Math.max(0, Math.min(1, v));
  if (audio && !musicMuted) audio.volume = musicVol;
}

export function setMusicMuted(m: boolean): void {
  musicMuted = m;
  if (!audio) {
    if (!m) tryPlay();
    return;
  }
  if (m) {
    audio.pause();
  } else {
    audio.volume = musicVol;
    void audio.play().catch(() => {});
  }
}
