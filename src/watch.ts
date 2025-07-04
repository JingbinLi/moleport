import http from 'http';
import { loadState, saveState } from './state';
import { createTunnel } from './tunnel';
import { killTunnel } from './kill';
import { MoleHole } from './types';

export function startApiServer(port: number) {
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || '', `http://localhost:${port}`);
    res.setHeader('Content-Type', 'application/json');
    if (req.method === 'GET' && url.pathname === '/api/v1/ls') {
      res.end(JSON.stringify(loadState()));
    } else if (req.method === 'POST' && url.pathname === '/api/v1/tu') {
      let body = '';
      req.on('data', chunk => (body += chunk));
      req.on('end', async () => {
        try {
          const cfg = JSON.parse(body);
          const tunnels: MoleHole[] = loadState();
          const mole = await createTunnel(cfg);
          tunnels.push(mole);
          saveState(tunnels);
          res.end(JSON.stringify(mole));
        } catch {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: 'Invalid request' }));
        }
      });
    } else if (req.method === 'POST' && url.pathname === '/api/v1/kill') {
      let body = '';
      req.on('data', chunk => (body += chunk));
      req.on('end', () => {
        try {
          const { name, all } = JSON.parse(body);
          const tunnels: MoleHole[] = loadState();
          const { killed, remaining } = killTunnel(tunnels, name, all);
          saveState(remaining);
          res.end(JSON.stringify({ killed }));
        } catch {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: 'Invalid request' }));
        }
      });
    } else {
      res.statusCode = 404;
      res.end(JSON.stringify({ error: 'Not found' }));
    }
  });
  server.listen(port, () => {
    console.log(`API server running at http://localhost:${port}/api/v1`);
  });
}
