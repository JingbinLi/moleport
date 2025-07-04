import { MoleHole } from './types';

export function killTunnel(tunnels: MoleHole[], name?: string, all?: boolean): {killed: MoleHole[], remaining: MoleHole[]} {
  let toKill: MoleHole[] = [];
  if (all) {
    toKill = tunnels;
  } else if (name) {
    toKill = tunnels.filter(t => t.name === name);
  }
  toKill.forEach(t => {
    try {
      process.kill(t.pid, 'SIGTERM');
    } catch {}
  });
  const remaining = tunnels.filter(t => !toKill.includes(t));
  return { killed: toKill, remaining };
}
