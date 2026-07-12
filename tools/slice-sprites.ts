/**
 * Recorta las HOJAS de sprites (torres = 5 etapas, proyectiles = 7) en imágenes
 * individuales con FONDO TRANSPARENTE, y las escribe en apps/client/public/sprites.
 *
 * - Quita el fondo con un relleno (flood-fill) desde los bordes: se siembra solo en
 *   píxeles del BORDE parecidos al color de las esquinas (así una torre cortada por
 *   el borde no se come), y crece siguiendo gradientes suaves (blanco o verde).
 * - Detecta cada sub-sprite por columnas con contenido (separadas por huecos vacíos).
 *
 * Uso: pnpm exec tsx tools/slice-sprites.ts
 */
import sharp from 'sharp';
import { mkdirSync, existsSync, unlinkSync } from 'node:fs';
import path from 'node:path';

const SRC = 'apps/client/assets/sprites';
const OUT = 'apps/client/public/sprites';
mkdirSync(OUT, { recursive: true });

// Hojas de torre y el nombre de cada una de sus 5 etapas (izq→der).
const TOWER_SHEETS = ['archer', 'cannon', 'frost', 'poison', 'tesla', 'sniper', 'mortar', 'banner', 'flak'];
const TOWER_STAGES = ['l1', 'l2', 'l3', 'specA', 'specB'];
// Hoja de proyectiles (7, en el orden del prompt).
const PROJ_NAMES = ['arrow', 'iceshard', 'poison', 'cannonball', 'bomb', 'teslabolt', 'sniper'];
// Hoja de proyectiles de la Balista de Cielo (3 reales: dardo, ráfaga, arpón).
// Las ESTELAS de aire de esta hoja generan 2 runs fantasma entre el dardo y la
// ráfaga; se nombran _skip y se borran al final (la ráfaga y el arpón casi se
// tocan, así que el refinado parte su run fusionado por el valle → 5 esperados).
const PROJ_FLAK_NAMES = ['flakneedle', '_skip1', '_skip2', 'flakburst', 'flakharpoon'];
// Hojas de JEFES: 6 fotogramas de animación en bucle (izq→der). El renderer los
// cicla por tiempo (boss_<tipo>_f0..f5.png).
const BOSS_SHEETS = ['golem', 'chimera', 'behemoth'];
const BOSS_FRAMES = ['f0', 'f1', 'f2', 'f3', 'f4', 'f5'];

interface RGBA {
  data: Buffer;
  W: number;
  H: number;
}

async function load(file: string): Promise<RGBA> {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, W: info.width, H: info.height };
}

// Quita el fondo: pone alpha=0 en la región de fondo conectada a los bordes.
function removeBackground({ data, W, H }: RGBA): void {
  const idx = (x: number, y: number) => y * W + x;
  const rgb = (i: number): [number, number, number] => [data[i * 4], data[i * 4 + 1], data[i * 4 + 2]];
  const d = (a: [number, number, number], b: [number, number, number]) =>
    Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);

  // color de fondo = promedio de las 4 esquinas
  const corners: [number, number, number][] = [
    rgb(idx(0, 0)),
    rgb(idx(W - 1, 0)),
    rgb(idx(0, H - 1)),
    rgb(idx(W - 1, H - 1)),
  ];
  const bgCol: [number, number, number] = [
    Math.round(corners.reduce((s, c) => s + c[0], 0) / 4),
    Math.round(corners.reduce((s, c) => s + c[1], 0) / 4),
    Math.round(corners.reduce((s, c) => s + c[2], 0) / 4),
  ];

  const SEED_TOL = 60; // qué tan parecido al color de esquina para sembrar en el borde
  const GROW_TOL = 32; // tolerancia local al crecer (sigue gradientes suaves)

  const bg = new Uint8Array(W * H);
  const queue: number[] = [];
  const seed = (x: number, y: number) => {
    const i = idx(x, y);
    if (bg[i]) return;
    if (d(rgb(i), bgCol) <= SEED_TOL) {
      bg[i] = 1;
      queue.push(i);
    }
  };
  for (let x = 0; x < W; x++) {
    seed(x, 0);
    seed(x, H - 1);
  }
  for (let y = 0; y < H; y++) {
    seed(0, y);
    seed(W - 1, y);
  }

  // BFS: un vecino se une al fondo si su color se parece al del píxel actual
  let head = 0;
  while (head < queue.length) {
    const i = queue[head++];
    const ci = rgb(i);
    const x = i % W;
    const y = (i / W) | 0;
    const tryN = (nx: number, ny: number) => {
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) return;
      const ni = idx(nx, ny);
      if (bg[ni]) return;
      if (d(rgb(ni), ci) <= GROW_TOL) {
        bg[ni] = 1;
        queue.push(ni);
      }
    };
    tryN(x - 1, y);
    tryN(x + 1, y);
    tryN(x, y - 1);
    tryN(x, y + 1);
  }

  // aplica transparencia
  for (let i = 0; i < W * H; i++) if (bg[i]) data[i * 4 + 3] = 0;
}

// Detecta los sub-sprites por columnas con contenido (alpha>umbral), separados por
// huecos vacíos de al menos MIN_GAP px. Devuelve rangos [x0,x1] inclusivos.
function findColumns({ data, W, H }: RGBA, expected: number): [number, number][] {
  const ALPHA_MIN = 40;
  // una columna "cuenta" si tiene bastante ALTURA de contenido: así las SOMBRAS
  // bajas entre torres (que quedaron opacas) se tratan como hueco y no las fusionan.
  const COL_MIN = Math.max(2, Math.floor(H * 0.07));
  const MIN_GAP = 14; // huecos menores se puentean (no parten una torre)
  const colHas: boolean[] = new Array(W);
  for (let x = 0; x < W; x++) {
    let c = 0;
    for (let y = 0; y < H; y++) if (data[(y * W + x) * 4 + 3] > ALPHA_MIN) c++;
    colHas[x] = c >= COL_MIN;
  }
  const runs: [number, number][] = [];
  let x = 0;
  while (x < W) {
    if (!colHas[x]) {
      x++;
      continue;
    }
    let end = x;
    let gap = 0;
    let j = x;
    while (j < W) {
      if (colHas[j]) {
        end = j;
        gap = 0;
      } else if (++gap > MIN_GAP) {
        break;
      }
      j++;
    }
    runs.push([x, end]);
    x = j;
  }
  if (runs.length !== expected) {
    console.warn(`   ⚠️  detecté ${runs.length} sub-sprites (esperaba ${expected}) — refinando`);
  }
  return refineRuns({ data, W, H }, runs, expected);
}

// Ajusta los runs al número esperado con dos heurísticas:
// - SOBRAN: descartar los runs más estrechos (columnas-ruido de 1-2 px, p. ej.
//   una estela suelta que sobrevivió al flood-fill).
// - FALTAN: partir el run más ANCHO por su "valle" (la columna con menos
//   contenido de su tramo central) — pasa cuando dos sprites se puentean con
//   polvo/cadenas y el hueco real queda por debajo de MIN_GAP.
function refineRuns({ data, W, H }: RGBA, runs: [number, number][], expected: number): [number, number][] {
  const ALPHA_MIN = 40;
  const colCount = (x: number): number => {
    let c = 0;
    for (let y = 0; y < H; y++) if (data[(y * W + x) * 4 + 3] > ALPHA_MIN) c++;
    return c;
  };
  const out = runs.map((r) => [...r] as [number, number]);
  while (out.length > expected) {
    let narrow = 0;
    for (let i = 1; i < out.length; i++) if (out[i][1] - out[i][0] < out[narrow][1] - out[narrow][0]) narrow = i;
    // solo descartar si es claramente ruido (mucho más estrecho que el resto)
    const w = out[narrow][1] - out[narrow][0];
    const maxW = Math.max(...out.map((r) => r[1] - r[0]));
    if (w > maxW * 0.25) break; // no es ruido: mejor conservar y avisar
    out.splice(narrow, 1);
  }
  while (out.length < expected) {
    let wide = 0;
    for (let i = 1; i < out.length; i++) if (out[i][1] - out[i][0] > out[wide][1] - out[wide][0]) wide = i;
    const [x0, x1] = out[wide];
    const w = x1 - x0;
    if (w < 40) break; // demasiado estrecho para partirlo con sentido
    // valle: columna con MENOS contenido del tramo central (25%-75%)
    let bestX = -1;
    let bestC = Infinity;
    for (let x = x0 + Math.floor(w * 0.25); x <= x1 - Math.floor(w * 0.25); x++) {
      const c = colCount(x);
      if (c < bestC) {
        bestC = c;
        bestX = x;
      }
    }
    if (bestX < 0) break;
    out.splice(wide, 1, [x0, bestX - 1], [bestX + 1, x1]);
    out.sort((a, b) => a[0] - b[0]);
  }
  return out;
}

// Limpieza de FRAGMENTOS del vecino: cuando dos sprites casi se tocan, el corte
// por valle deja esquirlas del de al lado dentro del recorte (una punta de aguja,
// un brazo, un eslabón de cadena). Un fragmento SIEMPRE toca el borde lateral
// del recorte (viene cortado); las piezas legítimas sueltas (el vapor del
// Behemot, las 3 agujas de la ráfaga) o no tocan el borde o son grandes. Regla:
// borrar componentes que tocan el borde izquierdo/derecho y miden <15% de la
// mayor, y cualquier miguita (<2%) toque donde toque.
function dropFragments(data: Buffer, W: number, H: number): void {
  const label = new Int32Array(W * H).fill(-1);
  const areas: number[] = [];
  const touchesSide: boolean[] = [];
  const stack: number[] = [];
  for (let start = 0; start < W * H; start++) {
    if (label[start] !== -1 || data[start * 4 + 3] <= 24) continue;
    const id = areas.length;
    let area = 0;
    let side = false;
    label[start] = id;
    stack.push(start);
    while (stack.length > 0) {
      const i = stack.pop()!;
      area++;
      const x = i % W;
      const y = (i / W) | 0;
      if (x <= 1 || x >= W - 2) side = true;
      const tryN = (nx: number, ny: number) => {
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) return;
        const ni = ny * W + nx;
        if (label[ni] === -1 && data[ni * 4 + 3] > 24) {
          label[ni] = id;
          stack.push(ni);
        }
      };
      tryN(x - 1, y);
      tryN(x + 1, y);
      tryN(x, y - 1);
      tryN(x, y + 1);
    }
    areas.push(area);
    touchesSide.push(side);
  }
  const maxArea = Math.max(0, ...areas);
  const drop = areas.map((a, id) => a < maxArea * 0.02 || (touchesSide[id] && a < maxArea * 0.15));
  for (let i = 0; i < W * H; i++) {
    if (label[i] >= 0 && drop[label[i]]) data[i * 4 + 3] = 0;
  }
}

async function sliceSheet(
  name: string,
  srcFile: string,
  stageNames: string[],
  prefix: string,
  opts: { clean?: boolean } = {},
) {
  if (!existsSync(srcFile)) {
    console.log(`   (falta ${srcFile}, salto)`);
    return;
  }
  const img = await load(srcFile);
  removeBackground(img);
  const runs = findColumns(img, stageNames.length);

  // por cada run: caja delimitadora REAL del contenido (sin trim, que revienta con
  // recortes vacíos), + un pequeño padding transparente.
  const P = 8;
  let saved = 0;
  for (let k = 0; k < runs.length; k++) {
    const [rx0, rx1] = runs[k];
    let y0 = img.H,
      y1 = -1,
      bx0 = rx1 + 1,
      bx1 = rx0 - 1;
    for (let y = 0; y < img.H; y++) {
      for (let x = rx0; x <= rx1; x++) {
        if (img.data[(y * img.W + x) * 4 + 3] > 24) {
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
          if (x < bx0) bx0 = x;
          if (x > bx1) bx1 = x;
        }
      }
    }
    if (y1 < 0 || bx1 < bx0) continue; // run vacío
    const left = Math.max(0, bx0 - P);
    const top = Math.max(0, y0 - P);
    const width = Math.min(img.W - left, bx1 - bx0 + 1 + 2 * P);
    const height = Math.min(img.H - top, y1 - y0 + 1 + 2 * P);
    const stage = stageNames[saved] ?? `x${saved}`;
    const out = path.join(OUT, `${prefix}${name ? name + '_' : ''}${stage}.png`);
    // copia raw del recorte (para poder limpiar fragmentos sin tocar la hoja)
    const region = Buffer.alloc(width * height * 4);
    for (let y = 0; y < height; y++) {
      img.data.copy(region, y * width * 4, ((top + y) * img.W + left) * 4, ((top + y) * img.W + left + width) * 4);
    }
    if (opts.clean) dropFragments(region, width, height);
    await sharp(region, { raw: { width, height, channels: 4 } })
      .png()
      .toFile(out);
    saved++;
  }
  console.log(`✅ ${name || prefix}: ${saved} sprites  (runs x: ${runs.map((r) => r.join('-')).join(', ')})`);
}

async function main() {
  console.log('— Recortando hojas de torres —');
  for (const t of TOWER_SHEETS) {
    await sliceSheet(t, path.join(SRC, `tower_${t}.png`), TOWER_STAGES, 'tower_');
  }
  // Trampa de púas: objeto ÚNICO (sin mejoras) → una sola imagen.
  console.log('— Recortando la Trampa (única) —');
  await sliceSheet('trap', path.join(SRC, 'tower_trap.png'), ['l1'], 'tower_');

  console.log('— Recortando proyectiles —');
  await sliceSheet('', path.join(SRC, 'projectiles.png'), PROJ_NAMES, 'proj_');
  await sliceSheet('', path.join(SRC, 'proj_flak.png'), PROJ_FLAK_NAMES, 'proj_', { clean: true });
  // borrar los runs fantasma de las estelas (nombrados _skip a propósito)
  for (const skip of ['proj__skip1.png', 'proj__skip2.png']) {
    const f = path.join(OUT, skip);
    if (existsSync(f)) unlinkSync(f);
  }

  console.log('— Recortando jefes (6 fotogramas de animación c/u) —');
  for (const b of BOSS_SHEETS) {
    await sliceSheet(b, path.join(SRC, `boss_${b}.png`), BOSS_FRAMES, 'boss_', { clean: true });
  }
  console.log(`\nListo. Salida en ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
