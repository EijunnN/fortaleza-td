import type { AffixId } from '../types.js';

// Orden estable: se usa como índice de bit en el snapshot (bit = 1<<index).
export const AFFIX_ORDER: AffixId[] = [
  'swift',
  'armored',
  'regen',
  'vampiric',
  'elusive',
  'frostward',
  'explosive',
];

export interface AffixDef {
  id: AffixId;
  name: string;
  icon: string;
  color: string;
  desc: string;
}

export const AFFIXES: Record<AffixId, AffixDef> = {
  swift: { id: 'swift', name: 'Veloz', icon: '💨', color: '#4fc3f7', desc: 'Se mueve mucho más rápido' },
  armored: { id: 'armored', name: 'Coraza', icon: '🛡️', color: '#b0bec5', desc: 'Armadura reforzada' },
  regen: { id: 'regen', name: 'Regenerador', icon: '💚', color: '#81c784', desc: 'Recupera vida constantemente' },
  vampiric: { id: 'vampiric', name: 'Vampírico', icon: '🩸', color: '#e57373', desc: 'Cura a los enemigos cercanos' },
  elusive: { id: 'elusive', name: 'Escurridizo', icon: '👁️', color: '#ce93d8', desc: 'Esquiva muchos proyectiles' },
  frostward: { id: 'frostward', name: 'Gélido', icon: '❄️', color: '#80deea', desc: 'Resiste el hielo' },
  explosive: { id: 'explosive', name: 'Explosivo', icon: '💥', color: '#ffb74d', desc: 'Suelta crías al morir' },
};

// Máscara de bits de una lista de afijos (para el snapshot compacto).
export function affixMask(affixes: AffixId[]): number {
  let m = 0;
  for (const a of affixes) m |= 1 << AFFIX_ORDER.indexOf(a);
  return m;
}

// Afijos presentes en una máscara (para el cliente).
export function affixesFromMask(mask: number): AffixId[] {
  const out: AffixId[] = [];
  for (let i = 0; i < AFFIX_ORDER.length; i++) if (mask & (1 << i)) out.push(AFFIX_ORDER[i]);
  return out;
}
