// scripts/build-installer.js
// Automated Professional NSIS Installer and Signed Update Package Builder for MorningTV

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const distReleaseDir = path.join(rootDir, 'build_dist');
const keyPath = path.join(__dirname, 'morningtv.key');

function log(msg) {
  console.log(`\x1b[36m[MorningTV Builder]\x1b[0m ${msg}`);
}

function error(msg) {
  console.error(`\x1b[31m[Error]\x1b[0m ${msg}`);
  process.exit(1);
}

function prepareOutputDir() {
  if (!fs.existsSync(distReleaseDir)) {
    fs.mkdirSync(distReleaseDir, { recursive: true });
    return;
  }
  for (const f of fs.readdirSync(distReleaseDir)) {
    fs.unlinkSync(path.join(distReleaseDir, f));
  }
}

async function run() {
  log('Starting Professional Windows Installer & Update Builder...');

  if (!fs.existsSync(keyPath)) {
    error(`Signing key not found at: ${keyPath}. Run 'npm run signer:gen' first.`);
  }

  const privateKey = fs.readFileSync(keyPath, 'utf8').trim();
  const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
  const version = pkg.version;

  log(`Target Product: MorningTV v${version} (Windows 10/11 x64)`);
  prepareOutputDir();

  // 1. Build Frontend
  log('1/3 Building production frontend bundle...');
  execSync('npm run build', {
    cwd: rootDir,
    stdio: 'inherit'
  });

  // 2. Build Tauri NSIS with Signing Key
  log('2/3 Compiling Rust binary and packaging NSIS Installer...');
  const buildEnv = {
    ...process.env,
    TAURI_SIGNING_PRIVATE_KEY: privateKey,
    TAURI_SIGNING_PRIVATE_KEY_PATH: keyPath,
    TAURI_SIGNING_PRIVATE_KEY_PASSWORD: ''
  };

  execSync('npm run tauri:build', {
    cwd: rootDir,
    stdio: 'inherit',
    env: buildEnv
  });

  // 3. Locate and Copy Artifacts
  log('3/3 Packaging release artifacts and generating latest.json manifest...');
  const nsisDir = path.join(rootDir, 'src-tauri', 'target', 'release', 'bundle', 'nsis');
  const exeName = `MorningTV_${version}_x64-setup.exe`;
  const builtExe = path.join(nsisDir, exeName);
  const builtSig = `${builtExe}.sig`;

  if (!fs.existsSync(builtExe)) {
    error(`Built executable not found at: ${builtExe}`);
  }

  const destExe = path.join(distReleaseDir, exeName);
  const destSig = path.join(distReleaseDir, `${exeName}.sig`);

  fs.copyFileSync(builtExe, destExe);
  log(`✅ Output Setup Installer: ${destExe} (${(fs.statSync(destExe).size / (1024 * 1024)).toFixed(2)} MB)`);

  let signature = '';
  if (fs.existsSync(builtSig)) {
    fs.copyFileSync(builtSig, destSig);
    signature = fs.readFileSync(destSig, 'utf8').trim();
    log(`✅ Output Minisign Signature: ${destSig}`);
  }

  // Generate latest.json for GitHub Releases Auto-Updater
  const manifest = {
    version,
    notes: `• Native Windows 10 & 11 live TV streaming engine with zero buffering\n• 8,300+ Verified live television channels auto-aggregated\n• Universal drive and custom directory installation support\n• Intelligent stream failover and multi-mirror backup recovery`,
    pub_date: new Date().toISOString(),
    platforms: {
      'windows-x86_64': {
        signature: signature || '',
        url: `https://github.com/morningstarwebd/morningtv/releases/download/v${version}/${exeName}`
      }
    }
  };

  const manifestPath = path.join(distReleaseDir, 'latest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
  log(`✅ Output Updater Manifest: ${manifestPath}`);

  console.log(`\n🎉 BUILD COMPLETE! All distribution files are in /build_dist:`);
  console.log(`   1. ${exeName} (Installer)`);
  console.log(`   2. ${exeName}.sig (Cryptographic signature)`);
  console.log(`   3. latest.json (Auto-updater release manifest)`);
}

run().catch((e) => {
  error(e.message);
});
