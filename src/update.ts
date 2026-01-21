import { createWriteStream, existsSync, unlinkSync, chmodSync, renameSync, readlinkSync, lstatSync } from "fs";
import { get } from "https";
import { join, dirname } from "path";
import { execSync } from "child_process";

const GITHUB_REPO = "JingbinLi/moleport";
const GITHUB_API = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;

interface ReleaseAsset {
  name: string;
  browser_download_url: string;
}

interface Release {
  tag_name: string;
  assets: ReleaseAsset[];
}

function getCurrentVersion(): string {
  try {
    const pkg = require("../package.json");
    return pkg.version || "0.0.0";
  } catch {
    return "0.0.0";
  }
}

function getPlatformBinaryName(): string {
  const platform = process.platform;
  if (platform === "darwin") return "moleport-macos";
  if (platform === "linux") return "moleport-linux";
  if (platform === "win32") return "moleport-win.exe";
  throw new Error(`Unsupported platform: ${platform}`);
}

function getLatestRelease(): Promise<Release> {
  return new Promise((resolve, reject) => {
    get(
      GITHUB_API,
      {
        headers: {
          "User-Agent": "moleport-updater",
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          if (res.statusCode !== 200) {
            reject(new Error(`GitHub API returned ${res.statusCode}`));
            return;
          }
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error("Failed to parse GitHub API response"));
          }
        });
      }
    ).on("error", reject);
  });
}

function downloadFile(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    get(url, (res) => {
      if (res.statusCode === 302 || res.statusCode === 301) {
        const redirectUrl = res.headers.location;
        if (redirectUrl) {
          downloadFile(redirectUrl, dest).then(resolve).catch(reject);
          return;
        }
      }
      if (res.statusCode !== 200) {
        reject(new Error(`Download failed with status ${res.statusCode}`));
        return;
      }
      const file = createWriteStream(dest);
      res.pipe(file);
      file.on("finish", () => {
        file.close();
        resolve();
      });
      file.on("error", (err) => {
        unlinkSync(dest);
        reject(err);
      });
    }).on("error", (err) => {
      reject(err);
    });
  });
}

function getCurrentBinaryPath(): string | null {
  try {
    // Get the path of the currently running executable
    let execPath = process.execPath;
    
    // Check if we're running as a packaged binary (not node)
    if (execPath.includes("node")) {
      return null; // Running in development mode
    }
    
    // If it's a symlink, resolve to the actual file
    try {
      const stats = lstatSync(execPath);
      if (stats.isSymbolicLink()) {
        const realPath = readlinkSync(execPath);
        // Handle relative symlinks
        if (realPath.startsWith('/')) {
          execPath = realPath;
        } else {
          execPath = join(dirname(execPath), realPath);
        }
      }
    } catch {
      // If we can't check symlink, just use the original path
    }
    
    return execPath;
  } catch {
    return null;
  }
}

export async function checkForUpdates(silent = false): Promise<{
  hasUpdate: boolean;
  currentVersion: string;
  latestVersion: string;
}> {
  const currentVersion = getCurrentVersion();
  
  try {
    const release = await getLatestRelease();
    const latestVersion = release.tag_name.replace(/^v/, "");
    
    const hasUpdate = latestVersion !== currentVersion;
    
    if (!silent) {
      if (hasUpdate) {
        console.log(`\n🔔 Update available: ${currentVersion} → ${latestVersion}`);
        console.log(`Run \`moleport update\` to update\n`);
      } else {
        console.log(`✅ You are running the latest version (${currentVersion})`);
      }
    }
    
    return { hasUpdate, currentVersion, latestVersion };
  } catch (error: any) {
    if (!silent) {
      console.error(`Failed to check for updates: ${error.message}`);
    }
    return { hasUpdate: false, currentVersion, latestVersion: currentVersion };
  }
}

export async function updateBinary(): Promise<void> {
  console.log("🔍 Checking for updates...");
  
  const currentBinaryPath = getCurrentBinaryPath();
  if (!currentBinaryPath) {
    console.error("❌ Cannot update: not running as a packaged binary");
    console.log("💡 If you're in development mode, use: npm run build");
    return;
  }
  
  // Check write permission
  const { accessSync, constants, writeFileSync } = require("fs");
  const binaryDir = dirname(currentBinaryPath);
  
  try {
    // Check directory write permission
    accessSync(binaryDir, constants.W_OK);
    
    // Try to create a test file
    const testFile = join(binaryDir, ".moleport-update-test");
    writeFileSync(testFile, "test");
    unlinkSync(testFile);
  } catch (error: any) {
    if (error.code === "EACCES" || error.code === "EPERM") {
      console.error("❌ Cannot update: no write permission to binary directory");
      console.log(`💡 Try running with sudo: sudo moleport update`);
      console.log(`   Or reinstall to user directory: ~/.local/moleport/`);
      throw error;
    }
    // For other errors, continue (might be transient)
  }
  
  const currentVersion = getCurrentVersion();
  const release = await getLatestRelease();
  const latestVersion = release.tag_name.replace(/^v/, "");
  
  if (latestVersion === currentVersion) {
    console.log(`✅ Already on the latest version (${currentVersion})`);
    return;
  }
  
  console.log(`📦 Updating from ${currentVersion} to ${latestVersion}...`);
  
  const binaryName = getPlatformBinaryName();
  const asset = release.assets.find((a) => a.name === binaryName);
  
  if (!asset) {
    throw new Error(`No binary found for platform: ${binaryName}`);
  }
  
  const downloadUrl = asset.browser_download_url;
  const tempPath = currentBinaryPath + ".new";
  const backupPath = currentBinaryPath + ".backup";
  
  console.log(`⬇️  Downloading ${binaryName}...`);
  
  try {
    await downloadFile(downloadUrl, tempPath);
    
    // Verify download succeeded
    if (!existsSync(tempPath)) {
      throw new Error("Download failed: file not created");
    }
    
    console.log("📝 Installing update...");
    
    // Backup current binary
    if (existsSync(backupPath)) {
      unlinkSync(backupPath);
    }
    renameSync(currentBinaryPath, backupPath);
    
    // Replace with new binary
    renameSync(tempPath, currentBinaryPath);
    
    // Set executable permissions (Unix-like systems)
    if (process.platform !== "win32") {
      chmodSync(currentBinaryPath, 0o755);
      
      // Remove macOS quarantine attribute
      if (process.platform === "darwin") {
        try {
          execSync(`xattr -dr com.apple.quarantine "${currentBinaryPath}"`, {
            stdio: "ignore",
          });
        } catch {
          // Ignore if xattr fails
        }
      }
    }
    
    // Clean up backup
    unlinkSync(backupPath);
    
    console.log(`✅ Successfully updated to version ${latestVersion}`);
    console.log("🎉 Please restart moleport to use the new version");
  } catch (error) {
    // Clean up temp file if it exists
    if (existsSync(tempPath)) {
      try {
        unlinkSync(tempPath);
      } catch {
        // Ignore cleanup errors
      }
    }
    
    // Restore backup if it exists
    if (existsSync(backupPath) && !existsSync(currentBinaryPath)) {
      try {
        renameSync(backupPath, currentBinaryPath);
        console.log("⚠️  Restored previous version after update failure");
      } catch {
        // Ignore restore errors
      }
    }
    
    throw error;
  }
}
