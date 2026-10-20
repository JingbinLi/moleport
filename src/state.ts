import { MoleHole } from './types';
import fs from 'fs';
import path from 'path';

/**
 * Resolved on every call (not at import time) so the location follows HOME:
 * the detached web UI and the tests both run with a different HOME than the
 * CLI that started them.
 */
function stateFile(): string {
  return path.resolve(process.env.HOME || '', '.mole_holes.json');
}

export function loadState(): MoleHole[] {
  const file = stateFile();
  if (!fs.existsSync(file)) return [];
  try {
    const data = fs.readFileSync(file, 'utf-8');
    return JSON.parse(data) as MoleHole[];
  } catch (e) {
    return [];
  }
}

export function saveState(state: MoleHole[]) {
  const file = stateFile();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(state, null, 2), 'utf-8');
}
