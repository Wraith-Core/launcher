// Launcher self-update: one button for the player, from the GitHub releases of Wraith-Core/launcher.
//
//   installed build  electron-updater downloads the new installer in the background; the button shows
//                    the progress and "update now" installs it silently and reopens the launcher.
//   portable build   it can't be replaced by electron-updater, so the button downloads the new portable
//                    exe, checks it carries the Wraith Core signature, and a tiny cmd script swaps the file
//                    once this process has exited and starts the new one.
const { app, ipcMain } = require('electron');
const { autoUpdater } = require('electron-updater');
const { execFile, spawn } = require('node:child_process');
const { once } = require('node:events');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO = 'Wraith-Core/launcher';
const THUMBPRINT = '6529C1D352A5AE451AD46FC52797D72C439ADBDB';
const portableExe = process.env.PORTABLE_EXECUTABLE_FILE || null;

let state = { state: 'idle' }; // idle | available | downloading | ready | installing | error
let getWindow = () => null;
let wantInstall = false;

function emit(patch) {
  state = { ...state, ...patch };
  getWindow()?.webContents.send('update', state);
}

// The file must be signed by the Wraith Core certificate. "UnknownError" only means this PC doesn't
// trust the certificate's root (the player never installed it); a tampered file reports HashMismatch.
function signedByUs(file) {
  const script = `$s = Get-AuthenticodeSignature -LiteralPath '${file.replace(/'/g, "''")}'; if ($s.SignerCertificate.Thumbprint -eq '${THUMBPRINT}' -and ('Valid','UnknownError') -contains [string]$s.Status) { 'ok' }`;
  return new Promise((resolve) => execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { windowsHide: true }, (err, out) => resolve(!err && out.trim() === 'ok')));
}

async function download(url, file, onProgress) {
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`download failed (HTTP ${res.status})`);
  const total = Number(res.headers.get('content-length')) || 0;
  const out = fs.createWriteStream(file);
  let got = 0;
  let last = -1;
  for await (const chunk of res.body) {
    got += chunk.length;
    if (!out.write(chunk)) await once(out, 'drain');
    const pct = total ? Math.floor((got * 100) / total) : 0;
    if (pct !== last) onProgress((last = pct));
  }
  await new Promise((resolve, reject) => out.end((e) => (e ? reject(e) : resolve())));
}

async function updatePortable() {
  const version = state.version;
  const dir = path.dirname(portableExe);
  let tmp = path.join(dir, `WraithCore-Portable.${version}.update.exe`);
  try {
    fs.accessSync(dir, fs.constants.W_OK);
  } catch {
    tmp = path.join(os.tmpdir(), `WraithCore-Portable.${version}.update.exe`);
  }
  emit({ state: 'downloading', percent: 0, wantInstall: true });
  await download(`https://github.com/${REPO}/releases/download/v${version}/WraithCore-Portable.exe`, tmp, (percent) => emit({ percent }));
  if (!(await signedByUs(tmp))) {
    fs.rmSync(tmp, { force: true });
    throw new Error('the downloaded file is not signed by Wraith Core');
  }
  emit({ state: 'installing' });
  // Swap the file once the running copy lets go of it (up to 90 s), then start the new one.
  const script = path.join(os.tmpdir(), `wraith-launcher-update-${Date.now()}.cmd`);
  fs.writeFileSync(script, [
    '@echo off',
    'set n=0',
    ':retry',
    `move /y "${tmp}" "${portableExe}" >nul 2>&1 && goto done`,
    'set /a n+=1',
    'if %n% geq 90 goto end',
    'timeout /t 1 /nobreak >nul',
    'goto retry',
    ':done',
    `start "" "${portableExe}"`,
    ':end',
    '(goto) 2>nul & del "%~f0"',
  ].join('\r\n'));
  spawn('cmd.exe', ['/d', '/c', script], { detached: true, stdio: 'ignore', windowsHide: true }).unref();
  setTimeout(() => app.quit(), 300);
}

function installNow() {
  emit({ state: 'installing' });
  setImmediate(() => autoUpdater.quitAndInstall(true, true)); // silent, reopen afterwards
}

let portableBusy = false;

function onInstallClicked() {
  // One click is enough: while a download or install is running, further clicks do nothing.
  if (state.state === 'installing' || portableBusy || (state.state === 'downloading' && wantInstall)) return;
  if (portableExe) {
    if (!state.version) return;
    portableBusy = true;
    updatePortable().catch((e) => {
      portableBusy = false;
      emit({ state: 'error', message: e.message, wantInstall: false });
    });
    return;
  }
  if (state.state === 'ready') return installNow();
  wantInstall = true; // installs as soon as the background download finishes
  emit({ wantInstall: true });
  if (state.state === 'available' || state.state === 'error') {
    emit({ state: 'downloading', percent: state.percent || 0 });
    autoUpdater.downloadUpdate().catch((e) => emit({ state: 'error', message: e.message }));
  }
}

function setup(windowGetter, { enabled }) {
  getWindow = windowGetter;
  ipcMain.handle('update-state', () => state);
  ipcMain.on('update-install', onInstallClicked);
  if (!enabled) return;

  autoUpdater.autoDownload = !portableExe;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on('update-available', (info) => emit({ state: portableExe ? 'available' : 'downloading', version: info.version, percent: 0 }));
  autoUpdater.on('download-progress', (p) => emit({ state: 'downloading', percent: Math.floor(p.percent) }));
  autoUpdater.on('update-downloaded', (info) => {
    emit({ state: 'ready', version: info.version, percent: 100 });
    if (wantInstall) installNow();
  });
  autoUpdater.on('error', (e) => state.state !== 'idle' && emit({ state: 'error', message: e.message }));

  // For testing the whole flow on a build: install as soon as an update is found.
  if (process.env.WRAITH_UPDATE_TEST === '1') {
    wantInstall = true;
    autoUpdater.on('update-available', () => portableExe && setTimeout(onInstallClicked, 500));
  }

  const check = () => autoUpdater.checkForUpdates().catch(() => {});
  check();
  setInterval(check, 30 * 60_000);
}

module.exports = { setup };
