// Carga de sprites reales de torre (PNG en /sprites/, servidos desde public/) con
// FALLBACK al arte vectorial: si un sprite no existe o aún no cargó, getTowerSprite
// devuelve null y el renderer dibuja el vector de siempre. Migración gradual y segura.
import type { TowerTypeId } from '@td/shared';

const cache = new Map<string, HTMLImageElement | null>();

export let spritesEnabled = localStorage.getItem('td_sprites') !== '0';
export function setSpritesEnabled(on: boolean): void {
  spritesEnabled = on;
  localStorage.setItem('td_sprites', on ? '1' : '0');
}

// Carga perezosa + cacheada. Devuelve la imagen si ya está lista, o null mientras
// carga / si falló (404). El renderer usa el vector hasta que esté disponible.
function load(url: string): HTMLImageElement | null {
  const cached = cache.get(url);
  if (cached !== undefined) return cached;
  const img = new Image();
  cache.set(url, null);
  img.onload = () => cache.set(url, img);
  img.onerror = () => cache.set(url, null);
  img.src = url;
  return null;
}

// etapa del sprite: especializada -> specA/specB ; si no -> l1/l2/l3
function stageOf(level: number, spec: number): string {
  if (spec === 0) return 'specA';
  if (spec === 1) return 'specB';
  return `l${Math.max(1, Math.min(3, level))}`;
}

// torres que ya tienen hoja de sprites (el resto cae al vector automáticamente)
const HAS_SPRITE = new Set<TowerTypeId>([
  'archer', 'cannon', 'frost', 'poison', 'tesla', 'sniper', 'mortar', 'banner', 'trap', 'flak',
]);

export function getTowerSprite(type: TowerTypeId, level: number, spec: number): HTMLImageElement | null {
  if (!spritesEnabled || !HAS_SPRITE.has(type)) return null;
  // la Trampa no se mejora: siempre su única imagen.
  const stage = type === 'trap' ? 'l1' : stageOf(level, spec);
  const img = load(`/sprites/tower_${type}_${stage}.png`);
  return img && img.complete && img.naturalWidth > 0 ? img : null;
}

// texturas de partícula (blanco, para tintar). part_<name>.png
export function getPartSprite(name: string): HTMLImageElement | null {
  if (!spritesEnabled) return null;
  const img = load(`/sprites/part_${name}.png`);
  return img && img.complete && img.naturalWidth > 0 ? img : null;
}

export function getProjSprite(name: string): HTMLImageElement | null {
  if (!spritesEnabled) return null;
  const img = load(`/sprites/proj_${name}.png`);
  return img && img.complete && img.naturalWidth > 0 ? img : null;
}

// ---------- jefes ANIMADOS ----------
// Cada jefe tiene una hoja de BOSS_FRAMES fotogramas (boss_<tipo>_f0..f5.png,
// generados por tools/slice-sprites.ts). El renderer pasa un contador entero
// (tiempo + id) y aquí se reduce al frame en bucle. Fallback: si el tipo no
// tiene hoja (o aún carga), se devuelve null y el renderer dibuja el vector.
const BOSS_FRAMES = 6;
const HAS_BOSS_SPRITE = new Set<string>(['golem', 'chimera', 'behemoth']);

export function getBossSprite(type: string, frame: number): HTMLImageElement | null {
  if (!spritesEnabled || !HAS_BOSS_SPRITE.has(type)) return null;
  const f = ((frame % BOSS_FRAMES) + BOSS_FRAMES) % BOSS_FRAMES;
  const img = load(`/sprites/boss_${type}_f${f}.png`);
  return img && img.complete && img.naturalWidth > 0 ? img : null;
}
