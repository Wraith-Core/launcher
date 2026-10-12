// Builds the launcher and publishes it as a GitHub release of Wraith-Core/launcher.
// Installed launchers pick the new version up by themselves (electron-updater reads latest.yml).
//   1) raise "version" in package.json   2) npm run release -- "what changed"
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const { version } = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const tag = `v${version}`;
const notes = process.argv.slice(2).join(' ') || `لانشر ريد ريفر ${tag}`;
// npx is a .cmd shim on Windows (needs a shell); gh is a real exe, so its arguments stay intact.
const run = (cmd, args) => execFileSync(cmd, args, { stdio: 'inherit', shell: cmd === 'npx' && process.platform === 'win32' });

const exists = (() => {
  try {
    execFileSync('gh', ['release', 'view', tag, '--repo', 'Wraith-Core/launcher'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
})();
if (exists) {
  console.error(`${tag} is already released. Raise "version" in package.json first.`);
  process.exit(1);
}

fs.rmSync('dist', { recursive: true, force: true });
run('npx', ['electron-builder', '--win', '--publish', 'never']);

// The certificate installer ships with every release: players run it once so Windows trusts the signature.
const SETUP = 'RedRiver-Setup.exe';
const assets = [`dist/${SETUP}`, `dist/${SETUP}.blockmap`, 'dist/latest.yml', 'dist/RedRiver-Portable.exe', 'build/RedRiver-Certificate.bat', 'build/RedRiver-CodeSigning.cer'];
for (const a of assets) if (!fs.existsSync(a)) throw new Error(`missing build output: ${a}`);

// Installed launchers download exactly the file latest.yml names, so it must be the installer uploaded here.
const named = [...fs.readFileSync('dist/latest.yml', 'utf8').matchAll(/^\s*(?:- )?(?:url|path): (.+)$/gm)].map((m) => m[1].trim());
if (!named.length || named.some((n) => n !== SETUP)) throw new Error(`dist/latest.yml names ${named.join(', ') || 'nothing'}, expected ${SETUP}`);

// The Wraith Core names stay on every release: portable copies of 1.3.0 download WraithCore-Portable.exe
// by that exact name, and older links (Discord posts, the old README) point at the WraithCore-* files.
const legacy = { [`dist/${SETUP}`]: 'dist/WraithCore-Setup.exe', 'dist/RedRiver-Portable.exe': 'dist/WraithCore-Portable.exe', 'build/RedRiver-Certificate.bat': 'dist/WraithCore-Certificate.bat' };
for (const [from, to] of Object.entries(legacy)) fs.copyFileSync(from, to);

run('gh', ['release', 'create', tag, ...assets, ...Object.values(legacy), '--repo', 'Wraith-Core/launcher', '--title', `ريد ريفر - Red River ${tag}`, '--notes', notes]);
console.log(`\nReleased ${tag}: https://github.com/Wraith-Core/launcher/releases/tag/${tag}`);
