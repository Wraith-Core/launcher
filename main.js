// ريد ريفر (Red River) launcher — main process.
// Everything shown (updates, links, join code, branding) comes from the server's public feed:
//   https://wraith7.com/shop/api/launcher/public/launcher.json
// so the launcher itself rarely needs a new build.
const { app, BrowserWindow, ipcMain, shell, safeStorage } = require('electron');
const path = require('node:path');

// ----- the player's data stays where it has always been -------------------------------------------
// Electron keeps userData in %APPDATA%\<app name>, and the app name is the "productName" packaged in
// app.asar. Launchers 1.0-1.3 shipped as "Wraith Core", so on every player's PC feed-cache.json,
// identity.json (who the player is) and localStorage (music on/off, last update seen) live in
// %APPDATA%\Wraith Core. The public name is now ريد ريفر / Red River, but only the names players see
// changed (build.productName, shortcutName, uninstallDisplayName in package.json): the packaged
// productName is still "Wraith Core", and this line pins the folder as well, so renaming either one
// later can never move it. It runs before anything touches userData (the single-instance lock below
// lives there too). Never change this folder name: players would silently lose that data.
app.setPath('userData', path.join(app.getPath('appData'), 'Wraith Core'));

const updater = require('./updater');
const identity = require('./identity');
const { execFile } = require('node:child_process');
const fs = require('node:fs');

// Public data is published by the game server over HTTPS; the app never queries an identifier.
const policy = require('./network-policy');
const { createAccountLink } = require('./account-link');
const API = policy.apiBase(process.env.WRAITH_LAUNCHER_API_URL);
const SERVER = `${API}/public`;
const FEED_URL = `${SERVER}/launcher.json`;
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
    title: 'ريد ريفر - Red River',
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

const cacheFile = () => path.join(app.getPath('userData'), 'feed-cache-v2.json');

async function getJson(url, ms) {
  const res = await fetch(url, { signal: AbortSignal.timeout(ms), cache: 'no-store', redirect: 'error' });
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
    const feed = await getJson(`${SERVER}/players.json`, 5000);
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

const tokenFile = () => path.join(app.getPath('userData'), 'launcher-account.dpapi');
let account;
const accountLink = () => account ??= createAccountLink({
  request: async (method, route, token) => {
    const response = await fetch(API + route, { method, redirect: 'error', signal: AbortSignal.timeout(8000),
      headers: { Origin: new URL(API).origin, ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
    return { status: response.status, body: await response.json() };
  },
  load: () => { try { return safeStorage.isEncryptionAvailable() ? safeStorage.decryptString(fs.readFileSync(tokenFile())) : ''; } catch { return ''; } },
  save: (token) => {
    if (!safeStorage.isEncryptionAvailable()) throw new Error('Secure account storage unavailable');
    const temp = tokenFile() + '.tmp'; fs.writeFileSync(temp, safeStorage.encryptString(token)); fs.renameSync(temp, tokenFile());
  },
  remove: () => fs.rmSync(tokenFile(), { force: true }),
});
let identityRefresh = null;
ipcMain.handle('pair-start', async () => {
  try { return { ok: true, ...await accountLink().start() }; } catch { return { ok: false }; }
});
ipcMain.handle('pair-remove', async () => {
  try { await accountLink().unlink(); return { ok: true }; } catch { return { ok: false }; }
});
ipcMain.handle('me', async () => {
  if (mock) return { identity: { name: 'RSK', avatar: 'https://cdn.discordapp.com/embed/avatars/1.png' }, state: 'linked', server: { known: true, online: true, ping: 42, playMinutes: 3978, firstJoin: 1789092620 } };
  if ((!me || Date.now() - meAt > 5 * 60_000) && !identityRefresh) {
    meAt = Date.now();
    identityRefresh = identity.detect(DISCORD_APP_ID).then((value) => { me = value; }).catch(() => {}).finally(() => { identityRefresh = null; });
  }
  const linked = await accountLink().status();
  return { ...linked, identity: { name: linked.server?.name || me?.name || 'حسابك', avatar: safeAvatar(me?.avatar) } };
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
    const res = await fetch(`${SERVER}/${name}`, { signal: AbortSignal.timeout(8000), redirect: 'error' });
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
  const url = policy.connectUrl(code);
  if (!url) return { ok: false, reason: 'bad-url' };
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
  const url = policy.externalUrl(which, links[which]);
  if (!url) return false;
  await shell.openExternal(url);
  return true;
});

ipcMain.on('window', (_e, action) => {
  if (action === 'min') win?.minimize();
  if (action === 'close') win?.close();
});
