import { MoleHole } from './types';
import fs from 'fs';
import path from 'path';

const STATE_FILE = path.resolve(process.env.HOME || '', '.mole_holes.json');

export function loadState(): MoleHole[] {
  if (!fs.existsSync(STATE_FILE)) return [];
  try {
    const data = fs.readFileSync(STATE_FILE, 'utf-8');
    return JSON.parse(data) as MoleHole[];
  } catch (e) {
    return [];
  }
}

export function saveState(state: MoleHole[]) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf-8');
}
