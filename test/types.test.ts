import { MoleHole } from '../src/types';

describe('MoleHole type', () => {
  it('should allow correct structure', () => {
    const m: MoleHole = {
      name: 'test',
      targetHost: 'h',
      targetPort: 22,
      localPort: 10022,
      pid: 1234,
    };
    expect(m.name).toBe('test');
  });
});
