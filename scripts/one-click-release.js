// scripts/one-click-release.js
// Automated Professional One-Click Release System for MorningTV (Tauri v2 + Rust)
// Handles version synchronization, quality build, NSIS packaging, signing, tagging & GitHub release.

import { execFileSync, execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const RELEASE_REPO = 'morningstarwebd/morningtv';
const distReleaseDir = path.join(ROOT, 'build_dist');
const keyPath = path.join(__dirname, 'morningtv.key');

function log(msg) {
  console.log(`\x1b[36m[Release]\x1b[0m ${msg}`);
}

function success(msg) {
  console.log(`\x1b[32m[Success]\x1b[0m ${msg}`);
}

function error(msg) {
  console.error(`\x1b[31m[Error]\x1b[0m ${msg}`);
  process.exit(1);
}

function runGit(args, options = {}) {
  return execFileSync('git', args, {
    cwd: ROOT,
    encoding: 'utf8',
    ...options,
  });
}

function assertReleaseVersion(version) {
  if (!/^\d+\.\d+\.\d+$/.test(version)) {
    throw new Error(`Invalid release version format: "${version}". Expected X.Y.Z`);
  }
}

function prepareOutputDir() {
  if (!fs.existsSync(distReleaseDir)) {
    fs.mkdirSync(distReleaseDir, { recursive: true });
    return;
  }
  for (const f of fs.readdirSync(distReleaseDir)) {
    try {
      fs.unlinkSync(path.join(distReleaseDir, f));
    } catch {}
  }
}

async function runRelease() {
  try {
    log('========================================================');
    log('🌅 MorningTV Automated One-Click Release System');
    log('========================================================\n');

    const shouldPublish = process.argv.includes('--publish');
    const skipGate = process.argv.includes('--skip-gate') || process.argv.includes('--force');

    // 0. Verify signing key
    log('Step 0: Validating Minisign release signing key...');
    let privateKey = process.env.TAURI_SIGNING_PRIVATE_KEY;
    if (!privateKey && fs.existsSync(keyPath)) {
      privateKey = fs.readFileSync(keyPath, 'utf8').trim();
    }
    if (!privateKey) {
      if (shouldPublish) {
        throw new Error('Signing key not found in process.env.TAURI_SIGNING_PRIVATE_KEY or scripts/morningtv.key. A private key is required to sign updates for release.');
      } else {
        log('⚠️  Warning: No signing key found. Proceeding with unsigned local build.');
      }
    }

    // 1. Version resolution
    const pkgPath = path.join(ROOT, 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    const currentVersion = pkg.version;

    let nextVersion = process.argv.find((arg) => /^\d+\.\d+\.\d+$/.test(arg));
    if (!nextVersion) {
      let tagExists = false;
      try {
        const out = execSync(`git tag -l v${currentVersion}`, { cwd: ROOT, encoding: 'utf8' }).trim();
        tagExists = out.length > 0;
      } catch {}

      if (tagExists) {
        const parts = currentVersion.split('.').map(Number);
        parts[2] += 1;
        nextVersion = parts.join('.');
      } else {
        nextVersion = currentVersion;
      }
    }
    assertReleaseVersion(nextVersion);

    log(`Step 1: Version Resolution -> Current: v${currentVersion} | Target: v${nextVersion}`);

    // Synchronize version across all configuration files
    log('Step 2: Synchronizing version in project manifests...');

    // 2a. package.json
    pkg.version = nextVersion;
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');

    // 2b. src-tauri/tauri.conf.json
    const tauriConfPath = path.join(ROOT, 'src-tauri', 'tauri.conf.json');
    if (fs.existsSync(tauriConfPath)) {
      const tauriConf = JSON.parse(fs.readFileSync(tauriConfPath, 'utf8'));
      tauriConf.version = nextVersion;
      fs.writeFileSync(tauriConfPath, JSON.stringify(tauriConf, null, 2) + '\n', 'utf8');
    }

    // 2c. src-tauri/Cargo.toml
    const cargoTomlPath = path.join(ROOT, 'src-tauri', 'Cargo.toml');
    if (fs.existsSync(cargoTomlPath)) {
      let cargoToml = fs.readFileSync(cargoTomlPath, 'utf8');
      cargoToml = cargoToml.replace(/^version\s*=\s*"[^"]+"/m, `version = "${nextVersion}"`);
      fs.writeFileSync(cargoTomlPath, cargoToml, 'utf8');
    }

    // 2d. src-tauri/src/config/defaults.rs
    const defaultsRsPath = path.join(ROOT, 'src-tauri', 'src', 'config', 'defaults.rs');
    if (fs.existsSync(defaultsRsPath)) {
      let defaultsRs = fs.readFileSync(defaultsRsPath, 'utf8');
      defaultsRs = defaultsRs.replace(/pub const APP_VERSION:\s*&str\s*=\s*"[^"]+";/, `pub const APP_VERSION: &str = "${nextVersion}";`);
      fs.writeFileSync(defaultsRsPath, defaultsRs, 'utf8');
    }

    // 2e. src/components/SettingsDialog.tsx
    const settingsPath = path.join(ROOT, 'src', 'components', 'SettingsDialog.tsx');
    if (fs.existsSync(settingsPath)) {
      let settingsContent = fs.readFileSync(settingsPath, 'utf8');
      settingsContent = settingsContent.replace(/v\d+\.\d+\.\d+/g, `v${nextVersion}`);
      fs.writeFileSync(settingsPath, settingsContent, 'utf8');
    }

    // 2f. src/types/index.ts
    const typesPath = path.join(ROOT, 'src', 'types', 'index.ts');
    if (fs.existsSync(typesPath)) {
      let typesContent = fs.readFileSync(typesPath, 'utf8');
      typesContent = typesContent.replace(/export const APP_VERSION = "[^"]+";/, `export const APP_VERSION = "${nextVersion}";`);
      fs.writeFileSync(typesPath, typesContent, 'utf8');
    }

    prepareOutputDir();

    // 3. Quality Gate & Frontend Build
    if (!skipGate) {
      log('Step 3: Running Quality Gate (TypeScript & Vite Production Bundle)...');
      execSync('npm run build', { cwd: ROOT, stdio: 'inherit' });
      execSync('cargo check --manifest-path src-tauri/Cargo.toml', { cwd: ROOT, stdio: 'inherit' });
    } else {
      log('Step 3: Quality gate skipped via flag. Running frontend build...');
      execSync('npm run build', { cwd: ROOT, stdio: 'inherit' });
    }

    // 4. Tauri NSIS & Update Package Build
    const skipBuild = process.argv.includes('--skip-build');
    if (!skipBuild) {
      log('Step 4: Compiling native Rust binary and packaging signed NSIS installer...');
      const buildEnv = {
        ...process.env,
        ...(privateKey ? {
          TAURI_SIGNING_PRIVATE_KEY: privateKey,
          TAURI_SIGNING_PRIVATE_KEY_PATH: fs.existsSync(keyPath) ? keyPath : undefined,
          TAURI_SIGNING_PRIVATE_KEY_PASSWORD: process.env.TAURI_SIGNING_PRIVATE_KEY_PASSWORD || '',
        } : {}),
      };

      execSync('npx tauri build --ignore-version-mismatches', {
        cwd: ROOT,
        stdio: 'inherit',
        env: buildEnv,
      });
    } else {
      log('Step 4: Build skipped via flag (--skip-build). Using existing binary/installer...');
    }

    // 5. Locate and Collect Built Artifacts
    log('Step 5: Locating and copying release artifacts...');
    const candidateDirs = [
      path.join(ROOT, 'target', 'release', 'bundle', 'nsis'),
      path.join(ROOT, 'src-tauri', 'target', 'release', 'bundle', 'nsis'),
    ];
    const exeName = `MorningTV_${nextVersion}_x64-setup.exe`;
    let builtExe = null;
    let nsisDir = null;
    for (const dir of candidateDirs) {
      const candidate = path.join(dir, exeName);
      if (fs.existsSync(candidate)) {
        builtExe = candidate;
        nsisDir = dir;
        break;
      }
    }

    if (!builtExe) {
      throw new Error(`Built NSIS executable not found. Checked: ${candidateDirs.join(', ')}`);
    }

    let builtSig = `${builtExe}.sig`;
    if (!fs.existsSync(builtSig)) {
      log(`Minisign signature missing. Signing ${exeName} with tauri signer...`);
      execSync(`npx tauri signer sign "${builtExe}" -f "${keyPath}" --password "" --app-version "${nextVersion}"`, {
        cwd: ROOT,
        stdio: 'inherit',
      });
    }

    const destExe = path.join(distReleaseDir, exeName);
    const destSig = path.join(distReleaseDir, `${exeName}.sig`);
    fs.copyFileSync(builtExe, destExe);
    log(`✅ Copied Setup Installer: ${exeName} (${(fs.statSync(destExe).size / (1024 * 1024)).toFixed(2)} MB)`);

    let signature = '';
    if (fs.existsSync(builtSig)) {
      fs.copyFileSync(builtSig, destSig);
      signature = fs.readFileSync(destSig, 'utf8').trim();
      log(`✅ Copied Minisign Signature: ${exeName}.sig`);
    }

    // Check for updater zip artifacts (if generated by Tauri)
    const zipName = `MorningTV_${nextVersion}_x64-setup.nsis.zip`;
    const builtZip = path.join(nsisDir, zipName);
    if (fs.existsSync(builtZip)) {
      const destZip = path.join(distReleaseDir, zipName);
      fs.copyFileSync(builtZip, destZip);
      log(`✅ Copied Updater Zip: ${zipName}`);
      if (fs.existsSync(`${builtZip}.sig`)) {
        fs.copyFileSync(`${builtZip}.sig`, `${destZip}.sig`);
      }
    }

    // 6. Generate latest.json Manifest
    log('Step 6: Generating latest.json auto-updater manifest...');
    let releaseNotes = `• YouTube-Style Dynamic Adaptive Buffering: Up to 30s forward buffer cushion on fast networks\n• Predictive RAM Pre-Warming: Local Rust Axum proxy pre-caches neighbor channels\n• Zero-Blackout Visual Continuity: Frosted-glass ambient channel identity aura during tuning\n• Official Vector MorningTV Emblem: New brand iconography across all views\n• Deep Byte-Inspection Sentinel 3.0: High-speed multi-threaded stream auditor`;

    const notesPath = path.join(ROOT, 'RELEASE_NOTES.md');
    if (fs.existsSync(notesPath)) {
      const customNotes = fs.readFileSync(notesPath, 'utf8').trim();
      if (customNotes) releaseNotes = customNotes;
    }

    const updateUrl = `https://github.com/${RELEASE_REPO}/releases/download/v${nextVersion}/${exeName}`;
    const latestJson = {
      version: nextVersion,
      notes: releaseNotes,
      pub_date: new Date().toISOString(),
      platforms: {
        'windows-x86_64': {
          signature: signature || '',
          url: updateUrl,
        },
      },
    };

    const latestJsonPath = path.join(distReleaseDir, 'latest.json');
    fs.writeFileSync(latestJsonPath, JSON.stringify(latestJson, null, 2) + '\n', 'utf8');
    fs.writeFileSync(path.join(ROOT, 'latest.json'), JSON.stringify(latestJson, null, 2) + '\n', 'utf8');
    log(`✅ Generated latest.json updater manifest`);

    // 7. Git Commit, Tag & Push
    log(`Step 7: Committing version changes and creating Git tag v${nextVersion}...`);
    const trackedFiles = [
      'package.json',
      'package-lock.json',
      'scripts/one-click-release.js',
      'src-tauri/tauri.conf.json',
      'src-tauri/Cargo.toml',
      'src-tauri/Cargo.lock',
      'src-tauri/src/config/defaults.rs',
      'src/types/index.ts',
      'src/components/SettingsDialog.tsx',
      'assets/morningtv-installer.nsi',
      'latest.json',
      'RELEASE_NOTES.md',
    ].filter((f) => fs.existsSync(path.join(ROOT, f)));

    try {
      runGit(['add', '-A']);
      runGit(['commit', '-m', `Release v${nextVersion}: High-performance native Windows IPTV player`]);
    } catch (e) {
      log('Git commit note: working tree clean or already committed.');
    }

    try {
      runGit(['tag', '-a', `v${nextVersion}`, '-m', `Release v${nextVersion}`]);
    } catch (e) {
      log(`Git tag note: tag v${nextVersion} already exists locally.`);
    }

    log('Step 8: Pushing commit and tag to GitHub origin...');
    try {
      runGit(['push', 'origin', 'HEAD']);
    } catch (e) {
      log(`Git push branch warning: ${e.message}`);
    }
    try {
      runGit(['push', 'origin', `v${nextVersion}`]);
    } catch (e) {
      log(`Git push tag warning: ${e.message}`);
    }

    // 8. Publish GitHub Release using gh CLI
    if (shouldPublish) {
      log(`Step 9: Publishing release v${nextVersion} to GitHub repository ${RELEASE_REPO}...`);
      const artifactFiles = fs
        .readdirSync(distReleaseDir)
        .map((f) => path.join(distReleaseDir, f));

      const releaseArgs = [
        'release',
        'create',
        `v${nextVersion}`,
        ...artifactFiles,
        '--repo',
        RELEASE_REPO,
        '--title',
        `MorningTV v${nextVersion}`,
        '--notes',
        releaseNotes,
      ];

      execFileSync(process.platform === 'win32' ? 'gh.exe' : 'gh', releaseArgs, {
        cwd: ROOT,
        stdio: 'inherit',
      });

      success(`\n🎉 RELEASE v${nextVersion} SUCCESSFULLY PUBLISHED TO GITHUB!`);
      console.log(`🔗 https://github.com/${RELEASE_REPO}/releases/tag/v${nextVersion}\n`);
    } else {
      log('\n⚠️ Build & Tag complete! Re-run with --publish to automatically publish assets to GitHub Releases:');
      console.log(`   node scripts/one-click-release.js ${nextVersion} --publish\n`);
    }
  } catch (err) {
    error(`Release execution failed: ${err.message}`);
  }
}

runRelease();
