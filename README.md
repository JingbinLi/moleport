



<p align="center">
	<img src="./moleport-logo.jpeg" alt="moleport logo" width="180" />
</p>

# moleport

Node.js CLI tool for SSH tunnel (MolePort) management. Supports both CLI and HTTP API.

## Download Binary

You can download the latest prebuilt binaries from the [GitHub Releases page](https://github.com/JingbinLi/moleport/releases):

- **Linux:** `moleport-linux`
- **macOS:** `moleport-macos`
- **Windows:** `moleport-win.exe`


After download, give execute permission (Linux/macOS):
```sh
chmod +x moleport-linux   # or moleport-macos
```

If you are on macOS, you may also need to remove the quarantine attribute before running:
```sh
xattr -dr com.apple.quarantine moleport-macos
```

Then run:
```sh
./moleport-linux ...      # or ./moleport-macos ...
moleport-win.exe ...      # on Windows
```

---

## Install & Build (from source)
```sh
npm install
npx tsc
npm link
```
This will make the `moleport` command available globally for development/testing.

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
