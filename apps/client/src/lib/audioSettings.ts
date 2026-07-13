/** Persisted audio settings (music + sfx), the single source of truth. */
export interface AudioSettings {
  musicMuted: boolean;
  sfxMuted: boolean;
  musicVol: number; // 0..1
  sfxVol: number; // 0..1
}

const KEY = 'bullrace.audio';

const DEFAULTS: AudioSettings = {
  musicMuted: false,
  sfxMuted: false,
  musicVol: 0.4,
  sfxVol: 0.7,
};

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

export function loadAudioSettings(): AudioSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<AudioSettings>;
      return {
        musicMuted: !!p.musicMuted,
        sfxMuted: !!p.sfxMuted,
        musicVol: typeof p.musicVol === 'number' ? clamp01(p.musicVol) : DEFAULTS.musicVol,
        sfxVol: typeof p.sfxVol === 'number' ? clamp01(p.sfxVol) : DEFAULTS.sfxVol,
      };
    }
  } catch {
    /* ignore */
  }
  return { ...DEFAULTS };
}

export function saveAudioSettings(s: AudioSettings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}
