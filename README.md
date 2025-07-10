




<p align="center">
	<img src="./moleport-logo.jpeg" alt="moleport logo" width="180" />
</p>

# moleport

moleport is a Node.js CLI tool for SSH tunnel (MolePort) management. It supports both command-line and HTTP API usage, and can be used as a standalone binary or as a development project.

---

## 1. Using the Binary

### 1.1 Download

Download the latest prebuilt binaries from the [GitHub Releases page](https://github.com/JingbinLi/moleport/releases):

- **Linux:** `moleport-linux`
- **macOS:** `moleport-macos`
- **Windows:** `moleport-win.exe`

### 1.2 Local Usage (Per-directory)

After downloading, grant execute permission (Linux/macOS):

```sh
# macOS example (in Downloads folder)
chmod +x ~/Downloads/moleport-macos
xattr -dr com.apple.quarantine ~/Downloads/moleport-macos  # (macOS only)
~/Downloads/moleport-macos
```

On Linux:
```sh
chmod +x ~/Downloads/moleport-linux
~/Downloads/moleport-linux
```

On Windows:
```sh
moleport-win.exe
```

### 1.3 Global Usage (System-wide)

To use the CLI from anywhere, move the binary to a directory in your `PATH` (e.g., `/usr/local/bin` on macOS/Linux):

```sh
# macOS/Linux example
sudo mv ~/Downloads/moleport-macos /usr/local/bin/moleport
```

On Windows, add the binary directory to your `PATH` or run `moleport-win.exe` directly.

### 1.4 Verify Installation

```sh
moleport -v
```
If you see the version number, the CLI is installed successfully.

### 1.5 Command Help

For detailed usage and all available options:
```sh
moleport --help
moleport tu --help
```
Replace `tu` with any subcommand to see its specific help.

---

## 2. Usage Examples

### 2.1 Create a Tunnel
```sh
moleport tu {targetHost}:{targetPort} [-p {localPort}] [-b {bastion}] [-n {name}]
```
Maps `targetHost:targetPort` to a local port, optionally via a bastion host.

### 2.2 Batch Create Tunnels
```sh
moleport tu -j '[{"name":"db","targetHost":"host","targetPort":3306,"bastion":"example-bastion"}]'
```

### 2.3 List Tunnels
```sh
moleport ls
```

### 2.4 Kill Tunnel(s)
```sh
moleport kill -n {name}
moleport kill --all
```

### 2.5 Start HTTP API Server
```sh
moleport watch [-p {server_port}]
```
Default port: 8080

---

## 3. API

The HTTP API allows you to manage tunnels programmatically. (See future documentation for details.)

---

## 4. MoleHole Type Definition
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

---

