// mulberry32: RNG determinista con estado en un entero de 32 bits.
// La sim guarda el estado dentro de GameState para que las partidas sean reproducibles.

export function rand(state: { rng: number }): number {
  state.rng = (state.rng + 0x6d2b79f5) | 0;
  let t = state.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function randInt(state: { rng: number }, min: number, max: number): number {
  return min + Math.floor(rand(state) * (max - min + 1));
}

export function pick<T>(state: { rng: number }, arr: T[]): T {
  return arr[Math.floor(rand(state) * arr.length)];
}
