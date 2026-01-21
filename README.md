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

### 1.3 Global Usage (Recommended)

#### User Installation (No sudo required)

Install to your user directory:

```sh
# macOS/Linux
mkdir -p ~/.local/moleport
mv ~/Downloads/moleport-macos ~/.local/moleport/moleport
chmod +x ~/.local/moleport/moleport

# macOS only: remove quarantine
xattr -dr com.apple.quarantine ~/.local/moleport/moleport

# Create symlink in user's bin directory
mkdir -p ~/.local/bin
ln -sf ~/.local/moleport/moleport ~/.local/bin/moleport

# Add to PATH (if not already in your shell profile)
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.zshrc  # or ~/.bashrc
source ~/.zshrc  # or source ~/.bashrc
```

Benefits: No sudo needed, easy self-updates with `moleport update`.

#### System-wide Installation (Optional)

For all users on the system:

```sh
# macOS/Linux (requires sudo)
sudo mkdir -p /usr/local/moleport
sudo mv ~/Downloads/moleport-macos /usr/local/moleport/moleport
sudo chmod +x /usr/local/moleport/moleport
sudo ln -sf /usr/local/moleport/moleport /usr/local/bin/moleport

# macOS only: remove quarantine
sudo xattr -dr com.apple.quarantine /usr/local/moleport/moleport

# Optional: allow updates without sudo
sudo chown -R $(whoami) /usr/local/moleport
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

### 2.5 Update moleport
```sh
# Check and install the latest version
moleport update

# Only check for updates (without installing)
moleport update --check-only
```

The update command automatically:
- Downloads the latest binary from GitHub releases
- Replaces the current binary with the new version
- Sets executable permissions
- Removes macOS quarantine attribute (if applicable)

moleport also checks for updates silently at startup and notifies you when a new version is available.

### 2.6 Start HTTP API Server
```sh
moleport watch [-p {server_port}]
```
Default port: 8080

### 2.7 Batch Create Tunnels with TOML

You can use the `--toml <config-file-path>` option to batch create multiple tunnels from a TOML file. For example:

```toml
[[tunnels]]
name = "db1"
targetHost = "10.0.0.1"
targetPort = 3306
localPort = 13306
bastion = "user@bastion-host"

[[tunnels]]
name = "db2"
targetHost = "10.0.0.2"
targetPort = 5432
localPort = 15432
```

Usage:
```sh
moleport tu --toml ./tunnels.toml
```

Supports both array and object style TOML (e.g., `tunnels = [...]`). This makes it easy to manage multiple tunnels at once.

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

