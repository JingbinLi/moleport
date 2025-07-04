import { spawn } from 'child_process';
import getPort from 'get-port';
import { MoleHole } from './types';

export async function createTunnel({
  name,
  targetHost,
  targetPort,
  localPort,
  bastion
}: {
  name: string;
  targetHost: string;
  targetPort: number;
  localPort?: number;
  bastion?: string;
}): Promise<MoleHole> {
  const port = localPort || await getPort();
  const sshArgs = [
    '-N',
    '-o', 'ExitOnForwardFailure=yes',
    '-L', `${port}:${targetHost}:${targetPort}`
  ];
  if (bastion) {
    sshArgs.push(bastion);
  } else {
    sshArgs.push(targetHost);
  }
  return new Promise<MoleHole>((resolve, reject) => {
    const proc = spawn('ssh', sshArgs, {
      detached: true,
      stdio: 'ignore'
    });
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        proc.unref();
        resolve({
          name,
          targetHost,
          targetPort,
          localPort: port,
          bastion,
          pid: proc.pid || -1
        });
      }
    }, 1000);
    proc.on('exit', (code) => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        reject(new Error(`ssh tunnel failed, exit code: ${code}`));
      }
    });
    proc.on('error', (err) => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        reject(err);
      }
    });
  });
}
