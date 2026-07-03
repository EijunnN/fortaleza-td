import type { TowerDef, TowerLevelDef, TowerSpecDef, TowerTypeId } from '../types.js';

// Orden estable: se usa como índice compacto en los snapshots.
export const TOWER_ORDER: TowerTypeId[] = [
  'archer',
  'cannon',
  'frost',
  'poison',
  'tesla',
  'sniper',
  'mortar',
  'bank',
];

export const TOWERS: Record<TowerTypeId, TowerDef> = {
  archer: {
    id: 'archer',
    name: 'Arquero',
    desc: 'Barato y rápido. Dispara a tierra y aire.',
    color: '#8bc34a',
    hotkey: '1',
    targetsAir: true,
    targetsGround: true,
    projectileKind: 'bullet',
    levels: [
      { cost: 50, damage: 8, range: 2.6, cooldown: 0.7, projectileSpeed: 14 },
      { cost: 70, damage: 15, range: 2.9, cooldown: 0.6, projectileSpeed: 15 },
      { cost: 115, damage: 27, range: 3.2, cooldown: 0.5, projectileSpeed: 16 },
    ],
    specs: [
      {
        key: 'repeater',
        name: 'Ballesta Repetidora',
        desc: 'Dispara tres saetas a la vez, casi sin pausa.',
        cost: 240,
        damage: 22,
        range: 3.3,
        cooldown: 0.3,
        projectileSpeed: 18,
        shots: 3,
      },
      {
        key: 'longbow',
        name: 'Arco Largo',
        desc: 'Alcance y daño enormes; sus flechas perforan armadura.',
        cost: 240,
        damage: 78,
        range: 5.2,
        cooldown: 0.75,
        projectileSpeed: 20,
        pierceArmor: true,
      },
    ],
  },
  cannon: {
    id: 'cannon',
    name: 'Cañón',
    desc: 'Daño en área. Solo alcanza enemigos terrestres.',
    color: '#ff7043',
    hotkey: '2',
    targetsAir: false,
    targetsGround: true,
    projectileKind: 'shell',
    levels: [
      { cost: 90, damage: 24, range: 2.4, cooldown: 1.6, projectileSpeed: 10, splash: 0.9 },
      { cost: 135, damage: 44, range: 2.6, cooldown: 1.5, projectileSpeed: 10, splash: 1.05 },
      { cost: 215, damage: 78, range: 2.9, cooldown: 1.4, projectileSpeed: 11, splash: 1.2 },
    ],
    specs: [
      {
        key: 'howitzer',
        name: 'Obús',
        desc: 'Un proyectil descomunal con área devastadora.',
        cost: 380,
        damage: 155,
        range: 3.3,
        cooldown: 1.5,
        projectileSpeed: 11,
        splash: 1.9,
      },
      {
        key: 'flak',
        name: 'Metralla',
        desc: 'Ráfaga doble que ahora también derriba a los voladores.',
        cost: 380,
        damage: 52,
        range: 3.0,
        cooldown: 1.1,
        projectileSpeed: 12,
        splash: 1.0,
        shots: 2,
        targetsAirOverride: true,
      },
    ],
  },
  frost: {
    id: 'frost',
    name: 'Hielo',
    desc: 'Poco daño pero congela: los enemigos van mucho más lento.',
    color: '#4fc3f7',
    hotkey: '3',
    targetsAir: true,
    targetsGround: true,
    projectileKind: 'bullet',
    levels: [
      { cost: 70, damage: 4, range: 2.3, cooldown: 0.9, projectileSpeed: 12, slow: { factor: 0.55, duration: 1.6 } },
      { cost: 100, damage: 7, range: 2.5, cooldown: 0.85, projectileSpeed: 13, slow: { factor: 0.45, duration: 2.1 } },
      { cost: 165, damage: 13, range: 2.8, cooldown: 0.8, projectileSpeed: 14, slow: { factor: 0.33, duration: 2.7 } },
    ],
    specs: [
      {
        key: 'glacier',
        name: 'Glaciar',
        desc: 'Casi congela por completo y a todo un grupo a la vez.',
        cost: 320,
        damage: 30,
        range: 3.0,
        cooldown: 0.9,
        projectileSpeed: 14,
        splash: 1.4,
        slow: { factor: 0.15, duration: 3.2 },
      },
      {
        key: 'permafrost',
        name: 'Escarcha Eterna',
        desc: 'No dispara: ralentiza sin parar a todo lo que la rodea.',
        cost: 300,
        damage: 0,
        range: 2.8,
        cooldown: 0.8,
        slowAura: { factor: 0.5, radius: 2.7 },
      },
    ],
  },
  poison: {
    id: 'poison',
    name: 'Veneno',
    desc: 'Envenena: daño sostenido que ignora la armadura.',
    color: '#9ccc65',
    hotkey: '4',
    targetsAir: true,
    targetsGround: true,
    projectileKind: 'bullet',
    levels: [
      { cost: 80, damage: 6, range: 2.5, cooldown: 1.1, projectileSpeed: 12, poison: { dps: 10, duration: 3 } },
      { cost: 120, damage: 10, range: 2.7, cooldown: 1.05, projectileSpeed: 13, poison: { dps: 19, duration: 3.2 } },
      { cost: 195, damage: 17, range: 2.9, cooldown: 1.0, projectileSpeed: 14, poison: { dps: 34, duration: 3.5 } },
    ],
    specs: [
      {
        key: 'plague',
        name: 'Plaga',
        desc: 'Nube tóxica en área con veneno brutal.',
        cost: 360,
        damage: 20,
        range: 3.0,
        cooldown: 1.0,
        projectileSpeed: 14,
        splash: 1.15,
        poison: { dps: 60, duration: 4 },
      },
      {
        key: 'corrosion',
        name: 'Corrosión',
        desc: 'Ácido que perfora armadura y derrite hasta a los más gordos.',
        cost: 360,
        damage: 34,
        range: 2.9,
        cooldown: 0.85,
        projectileSpeed: 14,
        poison: { dps: 95, duration: 4 },
        pierceArmor: true,
      },
    ],
  },
  tesla: {
    id: 'tesla',
    name: 'Tesla',
    desc: 'Rayo instantáneo que salta entre varios enemigos.',
    color: '#ffee58',
    hotkey: '5',
    targetsAir: true,
    targetsGround: true,
    projectileKind: 'beam',
    levels: [
      { cost: 120, damage: 18, range: 2.2, cooldown: 1.3, chain: { targets: 3, falloff: 0.7 } },
      { cost: 180, damage: 32, range: 2.4, cooldown: 1.2, chain: { targets: 4, falloff: 0.72 } },
      { cost: 290, damage: 55, range: 2.7, cooldown: 1.1, chain: { targets: 5, falloff: 0.75 } },
    ],
    specs: [
      {
        key: 'storm',
        name: 'Tormenta',
        desc: 'El rayo salta entre casi toda la horda.',
        cost: 420,
        damage: 70,
        range: 3.3,
        cooldown: 1.0,
        chain: { targets: 9, falloff: 0.86 },
      },
      {
        key: 'railgun',
        name: 'Riel',
        desc: 'Un único impacto colosal que perfora armadura.',
        cost: 420,
        damage: 240,
        range: 4.2,
        cooldown: 1.6,
        chain: { targets: 1, falloff: 1 },
        pierceArmor: true,
      },
    ],
  },
  sniper: {
    id: 'sniper',
    name: 'Francotirador',
    desc: 'Alcance enorme, daño altísimo y perfora armadura. Muy lento.',
    color: '#b0bec5',
    hotkey: '6',
    targetsAir: true,
    targetsGround: true,
    projectileKind: 'snipe',
    levels: [
      { cost: 130, damage: 60, range: 5.5, cooldown: 3.2, pierceArmor: true },
      { cost: 195, damage: 115, range: 6.5, cooldown: 3.0, pierceArmor: true },
      { cost: 310, damage: 210, range: 7.5, cooldown: 2.8, pierceArmor: true },
    ],
    specs: [
      {
        key: 'railcannon',
        name: 'Cañón de Riel',
        desc: 'Daño demoledor; remata a los enemigos malheridos al instante.',
        cost: 520,
        damage: 480,
        range: 8.5,
        cooldown: 3.0,
        pierceArmor: true,
        execute: 0.15,
      },
      {
        key: 'ranger',
        name: 'Explorador',
        desc: 'Dispara mucho más rápido sin perder alcance.',
        cost: 480,
        damage: 150,
        range: 7.0,
        cooldown: 1.3,
        pierceArmor: true,
      },
    ],
  },
  mortar: {
    id: 'mortar',
    name: 'Mortero',
    desc: 'Artillería de largo alcance con gran área. No dispara de cerca ni al aire.',
    color: '#a1887f',
    hotkey: '7',
    targetsAir: false,
    targetsGround: true,
    projectileKind: 'bomb',
    levels: [
      { cost: 140, damage: 42, range: 6.0, cooldown: 2.9, projectileSpeed: 5.5, splash: 1.3, minRange: 2.0 },
      { cost: 210, damage: 75, range: 6.6, cooldown: 2.8, projectileSpeed: 6, splash: 1.5, minRange: 2.0 },
      { cost: 330, damage: 130, range: 7.2, cooldown: 2.7, projectileSpeed: 6.5, splash: 1.7, minRange: 2.0 },
    ],
    specs: [
      {
        key: 'barrage',
        name: 'Bombardeo',
        desc: 'Lanza tres bombas por andanada. Lluvia de fuego.',
        cost: 520,
        damage: 130,
        range: 7.5,
        cooldown: 3.0,
        projectileSpeed: 6.5,
        splash: 1.7,
        minRange: 2.0,
        shots: 3,
      },
      {
        key: 'napalm',
        name: 'Napalm',
        desc: 'Deja el terreno ardiendo: veneno de fuego en toda el área.',
        cost: 500,
        damage: 90,
        range: 7.2,
        cooldown: 2.8,
        projectileSpeed: 6,
        splash: 1.9,
        minRange: 2.0,
        poison: { dps: 55, duration: 4 },
      },
    ],
  },
  bank: {
    id: 'bank',
    name: 'Mina de oro',
    desc: 'No ataca: genera oro para su dueño al final de cada oleada.',
    color: '#ffd54f',
    hotkey: '8',
    targetsAir: false,
    targetsGround: false,
    projectileKind: 'none',
    levels: [
      { cost: 100, damage: 0, range: 0, cooldown: 0, incomePerWave: 14 },
      { cost: 160, damage: 0, range: 0, cooldown: 0, incomePerWave: 26 },
      { cost: 260, damage: 0, range: 0, cooldown: 0, incomePerWave: 48 },
    ],
    specs: [
      {
        key: 'treasury',
        name: 'Tesorería',
        desc: 'Ingreso enorme para su dueño cada oleada.',
        cost: 320,
        damage: 0,
        range: 0,
        cooldown: 0,
        incomePerWave: 110,
      },
      {
        key: 'mint',
        name: 'Casa de Moneda',
        desc: 'Reparte oro a TODO el equipo cada oleada.',
        cost: 320,
        damage: 0,
        range: 0,
        cooldown: 0,
        incomePerWave: 55,
        incomeToAll: true,
      },
    ],
  },
};

export function towerLevel(type: TowerTypeId, level: number): TowerLevelDef {
  return TOWERS[type].levels[level - 1];
}

// Stats activos de una torre: la especialización manda sobre el nivel.
export function activeStats(type: TowerTypeId, level: number, spec: number): TowerLevelDef | TowerSpecDef {
  if (spec >= 0) return TOWERS[type].specs[spec];
  return TOWERS[type].levels[level - 1];
}

// ¿La torre alcanza objetivos aéreos? (algunas especializaciones lo cambian.)
export function towerTargetsAir(type: TowerTypeId, spec: number): boolean {
  const def = TOWERS[type];
  if (spec >= 0 && def.specs[spec].targetsAirOverride !== undefined) {
    return def.specs[spec].targetsAirOverride!;
  }
  return def.targetsAir;
}

export function towerTotalCost(type: TowerTypeId, level: number, spec = -1): number {
  let total = 0;
  for (let i = 0; i < level; i++) total += TOWERS[type].levels[i].cost;
  if (spec >= 0) total += TOWERS[type].specs[spec].cost;
  return total;
}
