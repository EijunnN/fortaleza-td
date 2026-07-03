import fs from 'node:fs';
import path from 'node:path';
import type { HighscoreEntry } from '@td/shared';

const DATA_DIR = process.env.TD_DATA_DIR ?? path.resolve(process.cwd(), 'data');
const FILE = path.join(DATA_DIR, 'highscores.json');
const MAX_ENTRIES = 25;

export function loadHighscores(): HighscoreEntry[] {
  try {
    return JSON.parse(fs.readFileSync(FILE, 'utf8')) as HighscoreEntry[];
  } catch {
    return [];
  }
}

export function saveHighscore(entry: HighscoreEntry): void {
  try {
    const scores = loadHighscores();
    scores.push(entry);
    scores.sort((a, b) => b.wave - a.wave);
    scores.length = Math.min(scores.length, MAX_ENTRIES);
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify(scores, null, 2));
  } catch (err) {
    console.error('No se pudo guardar el highscore:', err);
  }
}
