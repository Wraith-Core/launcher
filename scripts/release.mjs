// Builds the launcher and publishes it as a GitHub release of Wraith-Core/launcher.
// Installed launchers pick the new version up by themselves (electron-updater reads latest.yml).
//   1) raise "version" in package.json   2) npm run release -- "what changed"
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const { version } = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const tag = `v${version}`;
const notes = process.argv.slice(2).join(' ') || `Wraith Core launcher ${tag}`;
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

const assets = ['dist/WraithCore-Setup.exe', 'dist/WraithCore-Setup.exe.blockmap', 'dist/latest.yml', 'dist/WraithCore-Portable.exe'];
for (const a of assets) if (!fs.existsSync(a)) throw new Error(`missing build output: ${a}`);
run('gh', ['release', 'create', tag, ...assets, '--repo', 'Wraith-Core/launcher', '--title', `Wraith Core Launcher ${tag}`, '--notes', notes]);
console.log(`\nReleased ${tag}: https://github.com/Wraith-Core/launcher/releases/tag/${tag}`);
