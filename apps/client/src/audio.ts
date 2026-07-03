// Audio procedural con WebAudio: sin archivos, sonidos sintetizados al vuelo.
import { store } from './store.js';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
const lastPlayed = new Map<string, number>();

function ensureCtx(): AudioContext | null {
  if (!ctx) {
    try {
      ctx = new AudioContext();
      master = ctx.createGain();
      master.gain.value = 0.35;
      master.connect(ctx.destination);
    } catch {
      return null;
    }
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

// desbloquear el audio con la primera interacción (requisito de los navegadores)
export function unlockAudio(): void {
  ensureCtx();
}

function canPlay(key: string, minGapMs: number): boolean {
  if (store.muted) return false;
  const now = performance.now();
  if ((lastPlayed.get(key) ?? 0) + minGapMs > now) return false;
  lastPlayed.set(key, now);
  return true;
}

function tone(
  freq: number,
  durationMs: number,
  type: OscillatorType = 'square',
  volume = 0.5,
  slideTo?: number,
): void {
  const ac = ensureCtx();
  if (!ac || !master) return;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, ac.currentTime + durationMs / 1000);
  gain.gain.setValueAtTime(volume, ac.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + durationMs / 1000);
  osc.connect(gain).connect(master);
  osc.start();
  osc.stop(ac.currentTime + durationMs / 1000);
}

function noise(durationMs: number, volume = 0.4, lowpass = 1200): void {
  const ac = ensureCtx();
  if (!ac || !master) return;
  const len = Math.floor((ac.sampleRate * durationMs) / 1000);
  const buffer = ac.createBuffer(1, len, ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ac.createBufferSource();
  src.buffer = buffer;
  const filter = ac.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = lowpass;
  const gain = ac.createGain();
  gain.gain.value = volume;
  src.connect(filter).connect(gain).connect(master);
  src.start();
}

export const sfx = {
  shot(): void {
    if (!canPlay('shot', 70)) return;
    tone(700, 60, 'square', 0.12, 300);
  },
  snipe(): void {
    if (!canPlay('snipe', 120)) return;
    tone(1400, 150, 'sawtooth', 0.2, 200);
  },
  zap(): void {
    if (!canPlay('zap', 100)) return;
    tone(180, 120, 'sawtooth', 0.22, 1400);
  },
  boom(): void {
    if (!canPlay('boom', 90)) return;
    noise(280, 0.5, 700);
    tone(90, 250, 'sine', 0.4, 40);
  },
  death(): void {
    if (!canPlay('death', 80)) return;
    tone(320, 100, 'triangle', 0.15, 90);
  },
  coin(): void {
    if (!canPlay('coin', 60)) return;
    tone(880, 70, 'square', 0.12);
    setTimeout(() => tone(1320, 90, 'square', 0.1), 60);
  },
  place(): void {
    tone(240, 90, 'triangle', 0.3, 480);
  },
  upgrade(): void {
    tone(440, 80, 'square', 0.2);
    setTimeout(() => tone(660, 80, 'square', 0.2), 80);
    setTimeout(() => tone(880, 110, 'square', 0.2), 160);
  },
  specialize(): void {
    // fanfarria ascendente más épica que la mejora normal
    [523, 659, 784, 1047, 1319].forEach((f, i) =>
      setTimeout(() => tone(f, 160, 'sawtooth', 0.22), i * 90),
    );
    setTimeout(() => tone(1047, 400, 'triangle', 0.2), 480);
  },
  ping(): void {
    if (!canPlay('ping', 120)) return;
    tone(1200, 90, 'sine', 0.18, 1600);
    setTimeout(() => tone(1600, 110, 'sine', 0.14), 90);
  },
  sell(): void {
    tone(500, 120, 'triangle', 0.2, 220);
  },
  leak(): void {
    if (!canPlay('leak', 250)) return;
    tone(200, 300, 'sawtooth', 0.3, 80);
  },
  wave(): void {
    tone(196, 180, 'sawtooth', 0.25);
    setTimeout(() => tone(262, 180, 'sawtooth', 0.25), 170);
    setTimeout(() => tone(330, 260, 'sawtooth', 0.28), 340);
  },
  boss(): void {
    tone(65, 600, 'sawtooth', 0.4, 55);
    setTimeout(() => tone(62, 800, 'sawtooth', 0.4, 45), 500);
  },
  victory(): void {
    [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 250, 'triangle', 0.3), i * 180));
  },
  defeat(): void {
    [392, 330, 262, 196].forEach((f, i) => setTimeout(() => tone(f, 320, 'sawtooth', 0.25), i * 220));
  },
  error(): void {
    if (!canPlay('error', 150)) return;
    tone(150, 120, 'square', 0.18);
  },
};
