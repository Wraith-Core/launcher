// Who is using this PC, so the launcher can recognise its player on the server:
//   Steam    the account signed in to Steam (registry), or the most recent one in loginusers.vdf;
//            FXServer names it steam:<hex of the SteamID64>.
//   Discord  the account in the running Discord app, from its local RPC pipe: the READY event carries
//            the user (id, name, avatar) without any login or permission prompt.
// The result is remembered, so the player is still recognised when Steam or Discord is closed.
const { app } = require('electron');
const { execFile } = require('node:child_process');
const fs = require('node:fs');
const net = require('node:net');
const path = require('node:path');

const STEAM64_BASE = 76561197960265728n;
const store = () => path.join(app.getPath('userData'), 'identity.json');

function reg(key, value) {
  return new Promise((resolve) => execFile('reg', ['query', key, '/v', value], { windowsHide: true }, (err, out) => {
    if (err) return resolve(null);
    const m = out.match(new RegExp(`${value}\\s+REG_\\w+\\s+(.+)`));
    resolve(m ? m[1].trim() : null);
  }));
}

async function steamId64() {
  const active = await reg('HKCU\\Software\\Valve\\Steam\\ActiveProcess', 'ActiveUser');
  const account = active ? parseInt(active, 16) : 0;
  if (account > 0) return (STEAM64_BASE + BigInt(account)).toString();
  const steamPath = await reg('HKCU\\Software\\Valve\\Steam', 'SteamPath');
  if (!steamPath) return null;
  try {
    const vdf = fs.readFileSync(path.join(steamPath, 'config', 'loginusers.vdf'), 'utf8');
    const recent = [...vdf.matchAll(/"(\d{17})"\s*\{([^}]*)\}/g)].find(([, , body]) => /"MostRecent"\s*"1"/.test(body));
    return recent ? recent[1] : null;
  } catch {
    return null;
  }
}

async function steamProfile(id64) {
  // Public profile XML: name and picture without an API key (private profiles just return nothing).
  try {
    const res = await fetch(`https://steamcommunity.com/profiles/${id64}?xml=1`, { signal: AbortSignal.timeout(6000) });
    const xml = await res.text();
    const name = xml.match(/<steamID><!\[CDATA\[(.*?)\]\]><\/steamID>/)?.[1] || null;
    const avatar = xml.match(/<avatarFull><!\[CDATA\[(https:\/\/avatars[^\]]+)\]\]><\/avatarFull>/)?.[1] || null;
    return { name, avatar };
  } catch {
    return {};
  }
}

function discordUser(clientId) {
  const frame = (op, payload) => {
    const body = Buffer.from(JSON.stringify(payload));
    const head = Buffer.alloc(8);
    head.writeInt32LE(op, 0);
    head.writeInt32LE(body.length, 4);
    return Buffer.concat([head, body]);
  };
  const tryPipe = (i) => new Promise((resolve) => {
    const sock = net.connect(`\\\\?\\pipe\\discord-ipc-${i}`);
    let buf = Buffer.alloc(0);
    const done = (v) => {
      clearTimeout(timer);
      sock.destroy();
      resolve(v);
    };
    const timer = setTimeout(() => done(null), 2500);
    sock.on('error', () => done(null));
    sock.on('connect', () => sock.write(frame(0, { v: 1, client_id: clientId })));
    sock.on('data', (d) => {
      buf = Buffer.concat([buf, d]);
      if (buf.length < 8) return;
      const len = buf.readInt32LE(4);
      if (buf.length < 8 + len) return;
      try {
        const msg = JSON.parse(buf.subarray(8, 8 + len).toString('utf8'));
        done(msg.evt === 'READY' ? msg.data?.user || null : null);
      } catch {
        done(null);
      }
    });
  });
  return (async () => {
    for (let i = 0; i < 10; i++) {
      const user = await tryPipe(i);
      if (user) return user;
    }
    return null;
  })();
}

function load() {
  try {
    return JSON.parse(fs.readFileSync(store(), 'utf8'));
  } catch {
    return {};
  }
}

async function detect(discordAppId) {
  const known = load();
  const [id64, user] = await Promise.all([steamId64(), discordAppId ? discordUser(discordAppId) : null]);
  const next = { ...known };
  if (id64) {
    next.steam = BigInt(id64).toString(16);
    if (id64 !== known.steam64 || !known.steamName) Object.assign(next, { steam64: id64 }, await steamProfile(id64).then((p) => ({ steamName: p.name, steamAvatar: p.avatar })));
  }
  if (user?.id) {
    next.discord = user.id;
    next.discordName = user.global_name || user.username;
    next.discordAvatar = user.avatar
      ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${user.avatar.startsWith('a_') ? 'gif' : 'png'}?size=128`
      : null;
  }
  try {
    fs.writeFileSync(store(), JSON.stringify(next));
  } catch {}
  return {
    steam: next.steam || null,
    discord: next.discord || null,
    name: next.discordName || next.steamName || null,
    avatar: next.discordAvatar || next.steamAvatar || null,
  };
}

module.exports = { detect };
