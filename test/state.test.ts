import { loadState, saveState } from '../src/state';
import fs from 'fs';
import path from 'path';
import { MoleHole } from '../src/types';

describe('state', () => {
  // saveState() derives the file from HOME at call time, so cleanup has to
  // point at the file it actually writes.
  const testFile = path.resolve(__dirname, '.mole_holes.json');
  const oldEnv = process.env.HOME;

  beforeAll(() => {
    process.env.HOME = __dirname; // mock HOME
  });
  afterAll(() => {
    process.env.HOME = oldEnv;
    if (fs.existsSync(testFile)) fs.unlinkSync(testFile);
  });

  it('should save and load state', () => {
    const tunnels: MoleHole[] = [
      { name: 't1', targetHost: 'h', targetPort: 1, localPort: 2, pid: 123 },
    ];
    saveState(tunnels);
    const loaded = loadState();
    expect(loaded).toEqual(tunnels);
  });
});
