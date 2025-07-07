



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




### Usage: Local (per-directory) vs Global (system-wide)

#### Local usage (per-directory)

You can run the binary directly from the download location after granting execute permission:

```sh
# macOS example (in Downloads folder)
chmod +x ~/Downloads/moleport-macos
xattr -dr com.apple.quarantine ~/Downloads/moleport-macos  # (macOS only)
~/Downloads/moleport-macos ...
```

On Linux:
```sh
chmod +x ~/Downloads/moleport-linux
~/Downloads/moleport-linux ...
```

On Windows:
```sh
moleport-win.exe ...
```

#### Global usage (system-wide)

To use the CLI from anywhere, move the binary to a directory in your PATH (e.g., `/usr/local/bin` on macOS/Linux):

```sh
# macOS example
sudo mv ~/Downloads/moleport-macos /usr/local/bin/moleport
```


Now you can run:
```sh
moleport -v
```
If you see the version number, the CLI is installed successfully.

For detailed usage and all available options, use:
```sh
moleport --help
moleport tu --help
```
You can replace `tu` with any subcommand to see its specific help.

On Linux, use the correct binary name and skip the quarantine step.

On Windows, add the binary directory to your PATH or run `moleport-win.exe` directly.

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
