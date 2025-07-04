

# moleport

Node.js CLI tool for SSH tunnel (MolePort) management. Supports both CLI and HTTP API.

## Install & Build
```sh
npm install
npx tsc
```

## Usage

### Create a tunnel
```
moleport tu {targetHost}:{targetPort} [-p {localPort}] [-b {bastion}] [-n {name}]
```
Map targetHost:targetPort to a local port, optionally via a bastion host.

### Batch create tunnels
```
moleport tu -j '[{"name":"db","targetHost":"host","targetPort":3306}]'
```

### List tunnels
```
moleport ls
```

### Kill tunnel(s)
```
moleport kill -n {name}
moleport kill --all
```

### Start HTTP API server
```
moleport watch [-p {server_port}]
```
Default port: 8080

## API


## MoleHole Type
```ts
type MoleHole = {
	name: string;
	targetHost: string;
	targetPort: number;
	localPort: number;
	bastion?: string;
	pid: number;
}
```
