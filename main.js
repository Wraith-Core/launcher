// Wraith Core launcher — main process.
// Everything shown (updates, links, join code, branding) comes from the server's public feed:
//   http://37.221.94.8:30120/w_deploy/launcher.json
// so the launcher itself rarely needs a new build.
const { app, BrowserWindow, ipcMain, shell } = require('electron');
const updater = require('./updater');
const identity = require('./identity');
const { execFile } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const SERVER = 'http://37.221.94.8:30120';
const FEED_URL = `${SERVER}/w_deploy/launcher.json`;
const RELEASES = 'https://github.com/Wraith-Core/launcher/releases/latest';
const IMAGES = { 'logo.png': 'image/png', 'banner.jpg': 'image/jpeg', 'hero.jpg': 'image/jpeg' };

const screenshot = process.argv.find((a) => a.startsWith('--screenshot='))?.split('=')[1];
const startView = process.argv.find((a) => a.startsWith('--view='))?.split('=')[1];
// Sample players for design screenshots only (`--screenshot=... --mock`).
const mock = Boolean(screenshot) && process.argv.includes('--mock');
const MOCK = ['أبو فهد', 'Sheriff Cole', 'راكان', 'ذيب الصحراء', 'Doc Holliday', 'نايف', 'Maria', 'سعود', 'Ghost', 'حمد', 'Jesse', 'مشعل'];

if (!screenshot && !app.requestSingleInstanceLock()) app.quit();

let win = null;
let feed = null;

function createWindow() {
  win = new BrowserWindow({
    width: 1320,
    height: 820,
    minWidth: 1200,
    minHeight: 760,
    frame: false,
    show: false,
    paintWhenInitiallyHidden: true,
    backgroundColor: '#1a0808',
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
  // screenshot runs are silent (no music) and leave the player's settings alone
  const query = { ...(startView ? { view: startView } : {}), ...(screenshot ? { quiet: '1' } : {}) };
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'), Object.keys(query).length ? { query } : undefined);
  if (screenshot) {
    // `npm run shot`: render off-screen, save a PNG, quit (used to preview the design).
    win.webContents.once('did-finish-load', () => setTimeout(async () => {
      fs.writeFileSync(path.resolve(screenshot), (await win.webContents.capturePage()).toPNG());
      app.quit();
    }, 7000));
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
  updater.setup(() => win, { enabled: !screenshot && app.isPackaged });
});
app.on('window-all-closed', () => app.quit());

// ----- data --------------------------------------------------------------------

const cacheFile = () => path.join(app.getPath('userData'), 'feed-cache.json');

async function getJson(url, ms) {
  const res = await fetch(url, { signal: AbortSignal.timeout(ms), cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// Last saved copy, returned instantly so the window is never empty while the server answers.
ipcMain.handle('feed-cached', () => {
  try {
    return JSON.parse(fs.readFileSync(cacheFile(), 'utf8'));
  } catch {
    return null;
  }
});

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
    const started = Date.now();
    const d = await getJson(`${SERVER}/dynamic.json`, 5000);
    return { online: true, players: mock ? MOCK.length : Number(d.clients) || 0, max: Number(d.sv_maxclients) || 0, ping: Date.now() - started };
  } catch {
    return { online: false };
  }
});

// Who is in the server right now: name, ping and picture from the server's own feed (built by the
// deploy agent; identifiers never leave the server). Pictures may only come from Discord or Steam.
const AVATAR_HOSTS = new Set(['cdn.discordapp.com', 'avatars.steamstatic.com', 'avatars.akamai.steamstatic.com', 'avatars.cloudflare.steamstatic.com']);
const safeAvatar = (url) => {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && AVATAR_HOSTS.has(u.hostname) ? u.href : null;
  } catch {
    return null;
  }
};

ipcMain.handle('players', async () => {
  if (mock) return MOCK.map((name, i) => ({ name, ping: 30 + ((i * 37) % 170), avatar: i % 3 === 2 ? null : `https://cdn.discordapp.com/embed/avatars/${i % 6}.png` }));
  try {
    const feed = await getJson(`${SERVER}/w_deploy/players.json`, 5000);
    return (feed.players || []).map((p) => ({ name: String(p.name || '').slice(0, 32), ping: Number(p.ping) || 0, avatar: safeAvatar(p.avatar) })).filter((p) => p.name);
  } catch {
    try {
      // older servers: the built-in list (no pictures; skip clients that are still loading)
      const list = await getJson(`${SERVER}/players.json`, 5000);
      return list.filter((p) => p.id > 0).map((p) => ({ name: String(p.name || '').replace(/\^\d/g, '').slice(0, 32), ping: Number(p.ping) || 0, avatar: null }));
    } catch {
      return [];
    }
  }
});

ipcMain.handle('redm', () => redmInstalled());

// ----- the player on this PC -----------------------------------------------------------
// Recognised from Steam / Discord on this PC (identity.js), then looked up on the server: in the
// server right now or not, and the play time txAdmin has counted for that account.
const DISCORD_APP_ID = '1550753546763374612'; // the server's Discord application, used only to read the local user
let me = null;
let meAt = 0;

ipcMain.handle('me', async () => {
  if (mock) return { identity: { name: 'RSK', avatar: 'https://cdn.discordapp.com/embed/avatars/1.png' }, server: { known: true, online: true, ping: 42, playMinutes: 3978, firstJoin: 1789092620 } };
  if (!me || Date.now() - meAt > 5 * 60_000) {
    me = await identity.detect(feed?.links?.discordAppId || DISCORD_APP_ID).catch(() => me);
    meAt = Date.now();
  }
  if (!me || (!me.steam && !me.discord)) return { identity: null, server: null };
  const q = new URLSearchParams();
  if (me.steam) q.set('steam', me.steam);
  if (me.discord) q.set('discord', me.discord);
  let server = null;
  try {
    server = await getJson(`${SERVER}/w_deploy/me?${q}`, 5000);
  } catch {}
  return { identity: { name: me.name, avatar: safeAvatar(me.avatar) }, server };
});

// Is RedM running on this PC? (RedM.exe and its RedM_*GameProcess / the RDR2 child)
function redmProcesses() {
  return new Promise((resolve) => execFile('tasklist', ['/fo', 'csv', '/nh'], { windowsHide: true, maxBuffer: 4 * 1024 * 1024 }, (err, out) => {
    if (err) return resolve([]);
    resolve([...new Set(out.split(/\r?\n/).map((l) => l.split('","')[0].replace(/^"/, '')).filter((n) => /^RedM/i.test(n)))]);
  }));
}
ipcMain.handle('game', async () => ({ running: mock || (await redmProcesses()).length > 0 }));

// "Leave the game": closes RedM (the page asks the player to confirm first).
ipcMain.handle('quit-game', async () => {
  const names = await redmProcesses();
  if (!names.length) return false;
  for (const name of [...names, 'RDR2.exe']) {
    await new Promise((r) => execFile('taskkill', ['/f', '/im', name], { windowsHide: true }, () => r()));
  }
  return true;
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
