import { killTunnel } from '../src/kill';
import { MoleHole } from '../src/types';

describe('killTunnel', () => {
  it('should kill by name', () => {
    const tunnels: MoleHole[] = [
      { name: 'a', targetHost: 'h', targetPort: 1, localPort: 2, pid: 1 },
      { name: 'b', targetHost: 'h', targetPort: 1, localPort: 3, pid: 2 },
    ];
    const { killed, remaining } = killTunnel(tunnels, 'a', false);
    expect(killed.length).toBe(1);
    expect(killed[0].name).toBe('a');
    expect(remaining.length).toBe(1);
    expect(remaining[0].name).toBe('b');
  });

  it('should kill all', () => {
    const tunnels: MoleHole[] = [
      { name: 'a', targetHost: 'h', targetPort: 1, localPort: 2, pid: 1 },
      { name: 'b', targetHost: 'h', targetPort: 1, localPort: 3, pid: 2 },
    ];
    const { killed, remaining } = killTunnel(tunnels, undefined, true);
    expect(killed.length).toBe(2);
    expect(remaining.length).toBe(0);
  });
});
