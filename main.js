// Wraith Core launcher — main process.
// Everything shown (updates, links, join code, branding) comes from the server's public feed:
//   http://37.221.94.8:30120/w_deploy/launcher.json
// so the launcher itself rarely needs a new build.
const { app, BrowserWindow, ipcMain, shell } = require('electron');
const { autoUpdater } = require('electron-updater');
const { execFile } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const SERVER = 'http://37.221.94.8:30120';
const FEED_URL = `${SERVER}/w_deploy/launcher.json`;
const RELEASES = 'https://github.com/Wraith-Core/launcher/releases/latest';
const IMAGES = { 'logo.png': 'image/png', 'banner.jpg': 'image/jpeg' };

const screenshot = process.argv.find((a) => a.startsWith('--screenshot='))?.split('=')[1];

if (!screenshot && !app.requestSingleInstanceLock()) app.quit();

let win = null;
let feed = null;

function createWindow() {
  win = new BrowserWindow({
    width: 1120,
    height: 700,
    minWidth: 960,
    minHeight: 620,
    frame: false,
    show: false,
    paintWhenInitiallyHidden: true,
    backgroundColor: '#0e0e0e',
    title: 'Wraith Core',
    icon: path.join(__dirname, 'build', 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  win.removeMenu();
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (e) => e.preventDefault());
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  if (screenshot) {
    // `npm run shot`: render off-screen, save a PNG, quit (used to preview the design).
    win.webContents.once('did-finish-load', () => setTimeout(async () => {
      fs.writeFileSync(path.resolve(screenshot), (await win.webContents.capturePage()).toPNG());
      app.quit();
    }, 4000));
  } else {
    win.once('ready-to-show', () => win.show());
  }
}

app.on('second-instance', () => {
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.focus();
});
app.whenReady().then(() => {
  createWindow();
  setupUpdates();
});
app.on('window-all-closed', () => app.quit());

// ----- launcher self-update (GitHub releases of Wraith-Core/launcher) -------------
// The installed build downloads updates in the background and installs them on exit;
// the portable build can't replace itself, so it only tells the player where to get it.
function setupUpdates() {
  if (screenshot || !app.isPackaged) return;
  const portable = Boolean(process.env.PORTABLE_EXECUTABLE_FILE);
  autoUpdater.autoDownload = !portable;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on('update-available', (info) => portable && win?.webContents.send('update', { state: 'available', version: info.version }));
  autoUpdater.on('update-downloaded', (info) => win?.webContents.send('update', { state: 'ready', version: info.version }));
  autoUpdater.on('error', () => {});
  const check = () => autoUpdater.checkForUpdates().catch(() => {});
  check();
  setInterval(check, 60 * 60_000);
}

ipcMain.on('install-update', () => autoUpdater.quitAndInstall(true, true));

// ----- data --------------------------------------------------------------------

const cacheFile = () => path.join(app.getPath('userData'), 'feed-cache.json');

async function getJson(url, ms) {
  const res = await fetch(url, { signal: AbortSignal.timeout(ms), cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// Live feed when the server answers, otherwise the last copy we saw.
ipcMain.handle('feed', async () => {
  try {
    feed = await getJson(FEED_URL, 8000);
    fs.writeFileSync(cacheFile(), JSON.stringify(feed));
    return { feed, live: true };
  } catch {
    try {
      feed = JSON.parse(fs.readFileSync(cacheFile(), 'utf8'));
      return { feed, live: false };
    } catch {
      return { feed: null, live: false };
    }
  }
});

ipcMain.handle('status', async () => {
  try {
    const d = await getJson(`${SERVER}/dynamic.json`, 5000);
    return { online: true, players: Number(d.clients) || 0, max: Number(d.sv_maxclients) || 0 };
  } catch {
    return { online: false };
  }
});

// Server images come through the main process as data URLs (the page itself has no network access).
ipcMain.handle('image', async (_e, name) => {
  if (!IMAGES[name]) return null;
  try {
    const res = await fetch(`${SERVER}/w_deploy/${name}`, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    return `data:${IMAGES[name]};base64,${Buffer.from(await res.arrayBuffer()).toString('base64')}`;
  } catch {
    return null;
  }
});

ipcMain.handle('version', () => app.getVersion());

// ----- actions -------------------------------------------------------------------

function regExists(key) {
  return new Promise((resolve) => execFile('reg', ['query', key], { windowsHide: true }, (err) => resolve(!err)));
}

async function redmInstalled() {
  return (await regExists('HKCU\\Software\\Classes\\RedM.ProtocolHandler\\shell\\open\\command')) || regExists('HKCR\\redm');
}

ipcMain.handle('connect', async () => {
  const code = feed?.server?.joinCode;
  if (!code) return { ok: false, reason: 'no-code' };
  if (!(await redmInstalled())) return { ok: false, reason: 'no-redm' };
  const url = (feed.connectUrl || 'redm://connect/cfx.re/join/{code}').replace('{code}', encodeURIComponent(code));
  if (!url.startsWith('redm://')) return { ok: false, reason: 'bad-url' };
  await shell.openExternal(url);
  setTimeout(() => win?.minimize(), 1500);
  return { ok: true };
});

ipcMain.handle('open', async (_e, which) => {
  const code = feed?.server?.joinCode;
  const links = {
    discord: feed?.links?.discord,
    website: feed?.links?.website,
    redm: 'https://redm.net/',
    launcher: RELEASES,
    join: code ? `https://cfx.re/join/${code}` : null,
  };
  const url = links[which];
  if (!url || !url.startsWith('https://')) return false;
  await shell.openExternal(url);
  return true;
});

ipcMain.on('window', (_e, action) => {
  if (action === 'min') win?.minimize();
  if (action === 'close') win?.close();
});
