// Launcher page. All data arrives through window.wraith (preload.js); text is inserted with
// textContent only, so nothing from the feed or player names can run as code.
const $ = (id) => document.getElementById(id);
const api = window.wraith;

const state = { feed: null, status: null, players: [], board: null, launching: false };
const dateFmt = new Intl.DateTimeFormat('ar-SA-u-ca-gregory-nu-latn', { day: 'numeric', month: 'long', year: 'numeric' });
const rel = new Intl.RelativeTimeFormat('ar', { numeric: 'auto' });
const pad = (n) => String(n).padStart(2, '0');

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function ago(iso) {
  const diff = (new Date(iso).getTime() - Date.now()) / 1000;
  const abs = Math.abs(diff);
  if (abs < 3600) return rel.format(Math.round(diff / 60), 'minute');
  if (abs < 86400) return rel.format(Math.round(diff / 3600), 'hour');
  return rel.format(Math.round(diff / 86400), 'day');
}

let toastTimer = null;
function toast(text, action) {
  $('toast-text').textContent = text;
  const btn = $('toast-action');
  btn.hidden = !action;
  if (action) {
    btn.textContent = action.label;
    btn.onclick = () => {
      action.run();
      $('toast').hidden = true;
    };
  }
  $('toast').hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ($('toast').hidden = true), action ? 12000 : 5000);
}

// ----- the survey plates (as the loading screen: develop in, drift, caption) ---------------

const plates = [...(window.PLATES || [])];
let plateIndex = Math.floor(Math.random() * Math.max(1, plates.length));
let plateAlt = false;

function showPlate() {
  const p = plates[plateIndex % plates.length];
  if (!p) return;
  const box = $('plates');
  const node = el('div', `plate${plateAlt ? ' alt' : ''}`);
  plateAlt = !plateAlt;
  node.style.backgroundImage = `url("${p.file}")`;
  if (p.focus) node.style.backgroundPosition = p.focus;
  node.style.transformOrigin = p.focus || '50% 50%';
  const old = [...box.children];
  box.append(node);
  old.forEach((o) => {
    o.classList.add('is-out');
    setTimeout(() => o.remove(), 1600);
  });
  const caption = $('caption');
  caption.classList.add('is-out');
  setTimeout(() => {
    $('cap-title').textContent = p.title_ar || p.title_en || '';
    $('cap-credit').textContent = p.credit || '';
    caption.classList.remove('is-out');
  }, 500);
  plateIndex++;
}

// ----- feed: server name, links, updates -----------------------------------------------

function allItems() {
  const out = [];
  for (const u of state.feed?.updates || []) {
    for (const s of u.sections || []) for (const it of s.items || []) out.push({ number: u.number, system: s.system, ...it });
  }
  return out;
}

let tipIndex = 0;
function showTip() {
  const items = allItems().slice(0, 12);
  $('tip').hidden = !items.length;
  if (!items.length) return;
  const it = items[tipIndex % items.length];
  const tip = $('tip');
  tip.classList.add('is-out');
  setTimeout(() => {
    $('tip-sys').textContent = it.system;
    $('tip-text').textContent = `${it.label}: ${it.text}`;
    $('tip-count').textContent = `${pad((tipIndex % items.length) + 1)} / ${pad(items.length)}`;
    tip.classList.remove('is-out');
    tipIndex++;
  }, tip.dataset.ready ? 480 : 0);
  tip.dataset.ready = '1';
}

function lastSeen() {
  try {
    return Number(localStorage.getItem('lastSeenUpdate') || 0);
  } catch {
    return 0;
  }
}
function markSeen() {
  try {
    localStorage.setItem('lastSeenUpdate', String(state.feed?.updates?.[0]?.number || 0));
  } catch {}
  $('attn').hidden = true;
}

function applyFeed(feed) {
  state.feed = feed;
  const name = feed.server?.name || 'Wraith Core';
  $('wm-primary').textContent = name;
  document.title = name;
  if (feed.server?.nameAr) $('wm-second').textContent = feed.server.nameAr;
  if (feed.server?.tagline) $('tagline').textContent = feed.server.tagline;
  $('btn-discord').hidden = !feed.links?.discord;
  const code = feed.server?.joinCode ? `cfx.re/join/${feed.server.joinCode}` : '';
  api.version().then((v) => ($('legal-right').textContent = [code, `v${v}`].filter(Boolean).join('  ·  ')));
  $('attn').hidden = !(feed.updates || []).some((u) => u.number > lastSeen());
  if (state.board === 'updates') renderUpdates();
  showTip();
}

async function loadFeed() {
  if (!state.feed) {
    const cached = await api.feedCached();
    if (cached) applyFeed(cached);
  }
  const { feed, live } = await api.feed();
  if (!feed) return;
  applyFeed(feed);
  if (!live) toast('تعذّر الاتصال بالسيرفر، هذه آخر نسخة محفوظة من التحديثات.');
}

async function loadImages() {
  // A server may publish its own hero image: it plays first, before the survey plates.
  const hero = await api.image('hero.jpg');
  if (hero) plates.unshift({ file: hero, title_ar: '', credit: '', focus: '50% 50%' });
}

// ----- server status -----------------------------------------------------------------------

function renderStatus() {
  const s = state.status || {};
  const max = s.max || 48;
  const players = s.online ? s.players : 0;
  const status = $('m-status');
  status.classList.toggle('is-online', Boolean(s.online));
  status.lastElementChild.textContent = s.online ? 'السيرفر شغّال' : 'السيرفر مقفل';
  $('m-players').textContent = s.online ? `${players}/${max}` : '—';
  $('m-ping').textContent = s.online ? `${s.ping}ms` : '—';

  $('pct-num').textContent = String(players);
  $('pct-max').textContent = `/ ${max}`;
  $('track').style.setProperty('--p', String(Math.min(1, players / max)));
  $('load').classList.toggle('is-idle', !players);
  const line = $('load-status');
  line.replaceChildren();
  if (!s.online) line.append('السيرفر مقفل حالياً، تابع الدسكورد لمعرفة موعد الفتح');
  else if (!players) line.append('السيرفر فاضي الحين، ', el('b', null, 'كن أول الداخلين'));
  else line.append(el('b', null, `${players} لاعب`), ` داخل السيرفر الحين من أصل ${max}`);
}

async function refresh() {
  const [status, players] = await Promise.all([api.status(), api.players()]);
  state.status = status;
  state.players = status.online ? players : [];
  renderStatus();
  if (state.board === 'players') renderPlayers();
}

// ----- the board -----------------------------------------------------------------------------

function highlight(text, query) {
  const frag = document.createDocumentFragment();
  if (!query) {
    frag.append(text);
    return frag;
  }
  const lower = text.toLowerCase();
  let at = 0;
  for (let i = lower.indexOf(query); i !== -1; i = lower.indexOf(query, at)) {
    frag.append(text.slice(at, i), el('mark', null, text.slice(i, i + query.length)));
    at = i + query.length;
  }
  frag.append(text.slice(at));
  return frag;
}

function renderUpdates() {
  const query = $('search').value.trim().toLowerCase();
  const body = $('board-body');
  body.replaceChildren();
  let shown = 0;
  (state.feed?.updates || []).forEach((u, index) => {
    const block = el('section', 'u');
    let any = false;
    for (const s of u.sections || []) {
      const matches = (s.items || []).filter((it) => !query || it.text.toLowerCase().includes(query) || s.system.toLowerCase().includes(query));
      if (!matches.length) continue;
      if (!any) {
        const head = el('div', 'u-head');
        const h3 = el('h3', null, `تحديث السيرفر رقم ${u.number}`);
        if (index === 0) h3.append(el('span', 'u-latest', 'الأحدث'));
        head.append(h3);
        if (u.date) head.append(el('time', null, `${dateFmt.format(new Date(u.date))} · ${ago(u.date)}`));
        block.append(head);
        any = true;
      }
      const sys = el('div', 'u-sys');
      sys.append(el('h4', null, s.system));
      for (const it of matches) {
        const row = el('p', 'u-item');
        const text = el('span');
        text.append(highlight(it.text, query));
        row.append(el('span', `tag ${it.type}`, it.label), text);
        sys.append(row);
        shown++;
      }
      block.append(sys);
    }
    if (any) body.append(block);
  });
  if (!body.children.length) body.append(el('p', 'empty', query ? 'لا توجد نتائج مطابقة.' : 'لا توجد تحديثات منشورة بعد.'));
  $('board-note').textContent = query ? `${shown}` : '';
}

// The player's Discord or Steam picture in a torn paper frame (grey at rest, colour under the cursor);
// the first letter of the name when there is no picture or it fails to load.
function avatar(p) {
  const box = el('span', 'avatar');
  const letter = () => box.replaceChildren(el('span', 'avatar-letter', [...(p.name || '?')][0].toUpperCase()));
  if (!p.avatar) {
    letter();
    return box;
  }
  const img = el('img');
  img.alt = '';
  img.loading = 'lazy';
  img.referrerPolicy = 'no-referrer';
  img.addEventListener('error', letter, { once: true });
  img.src = p.avatar;
  box.append(img);
  return box;
}

// Ping in figures plus three bars; the red mark only when the connection is poor.
function pingMeter(ms) {
  const level = ms <= 60 ? 3 : ms <= 120 ? 2 : 1;
  const box = el('span', `ping lv${level}`);
  const bars = el('span', 'ping-bars');
  for (let i = 1; i <= 3; i++) bars.append(el('i', i <= level ? 'on' : null));
  box.append(bars, el('span', 'fig', `${ms}ms`));
  if (ms > 150) box.append(el('i', 'ping-bad'));
  return box;
}

function renderPlayers() {
  const body = $('board-body');
  body.replaceChildren();
  const list = state.players;
  $('board-note').textContent = state.status?.online ? `${list.length} / ${state.status.max || 48}` : '';
  if (!list.length) {
    body.append(el('p', 'empty', state.status?.online ? 'السيرفر فاضي الحين، ادخل وابدأ قصتك قبل الكل.' : 'السيرفر مقفل حالياً.'));
    return;
  }
  list.forEach((p, i) => {
    const row = el('div', 'row');
    row.append(el('span', 'row-n fig', pad(i + 1)), avatar(p), el('span', 'row-name', p.name), pingMeter(p.ping));
    body.append(row);
  });
}

function openBoard(kind) {
  state.board = kind;
  $('board-title').textContent = kind === 'updates' ? 'التحديثات' : 'اللاعبون';
  $('board-search').hidden = kind !== 'updates';
  $('board').hidden = false;
  $('board-scrim').hidden = false;
  if (kind === 'updates') {
    renderUpdates();
    markSeen();
    $('search').focus();
  } else renderPlayers();
}
function closeBoard() {
  state.board = null;
  $('board').hidden = true;
  $('board-scrim').hidden = true;
}
document.querySelectorAll('[data-board]').forEach((b) => b.addEventListener('click', () => openBoard(b.dataset.board)));
$('board-close').addEventListener('click', closeBoard);
$('board-scrim').addEventListener('click', closeBoard);
$('search').addEventListener('input', renderUpdates);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && state.board) closeBoard();
});

// ----- RedM & joining ---------------------------------------------------------------------------

async function checkRedm() {
  const installed = await api.redm();
  const note = $('redm-note');
  note.replaceChildren();
  if (installed) note.append('RedM مثبّتة على جهازك وجاهزة للدخول');
  else {
    const get = el('button', null, 'حمّلها من هنا');
    get.addEventListener('click', () => api.open('redm'));
    note.append('RedM غير مثبّتة على جهازك، ', get);
  }
}

// ----- the player: recognised on this PC, looked up on the server ---------------------------------
// idle -> (click) launching -> in (the server sees the account) -> idle again once they leave.
let launchUntil = 0;
let presence = 'idle';

function renderPresence() {
  const play = $('play');
  play.classList.toggle('is-busy', presence === 'launching');
  play.classList.toggle('is-in', presence === 'in');
  play.disabled = presence !== 'idle';
  $('play-text').textContent = { idle: 'ادخل السيرفر', launching: 'جاري الدخول للسيرفر…', in: 'أنت داخل السيرفر' }[presence];
  $('btn-leave').hidden = presence !== 'in';
}

function renderMe(m) {
  const box = $('me');
  if (!m?.identity) {
    box.hidden = true;
    return;
  }
  const srv = m.server || {};
  box.hidden = false;
  box.classList.toggle('is-in', Boolean(srv.online));
  const name = m.identity.name || srv.name || 'لاعب';
  $('me-name').textContent = name;
  const av = $('me-avatar');
  av.replaceChildren(avatar({ name, avatar: m.identity.avatar }).firstChild);
  $('me-hours').textContent = String(Math.floor((srv.playMinutes || 0) / 60));
  $('me-since').textContent = srv.firstJoin ? new Intl.DateTimeFormat('ar-SA-u-ca-gregory-nu-latn', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(srv.firstJoin * 1000)) : '—';
  let line;
  if (srv.online) line = `داخل السيرفر الحين · ${srv.ping}ms`;
  else if (!srv.known) line = 'ما دخلت السيرفر للحين، أول دخول يبدأ عدّاد ساعاتك';
  else if (srv.lastSeen) line = `آخر دخول ${ago(new Date(srv.lastSeen * 1000).toISOString())}`;
  else line = 'غير متصل';
  $('me-state').textContent = line;
}

async function refreshMe() {
  const [m, g] = await Promise.all([api.me(), api.game()]);
  renderMe(m);
  const online = Boolean(m?.server?.online);
  if (online) presence = 'in';
  else if (g.running || Date.now() < launchUntil) presence = 'launching';
  else presence = 'idle';
  if (online) launchUntil = 0;
  renderPresence();
}

async function join() {
  if (presence !== 'idle') return;
  presence = 'launching';
  renderPresence();
  const r = await api.connect();
  if (r.ok) {
    launchUntil = Date.now() + 3 * 60_000; // until the server sees the account, or three minutes
    toast('يتم فتح RedM والدخول للسيرفر مباشرة…');
  } else {
    presence = 'idle';
    renderPresence();
    if (r.reason === 'no-redm') toast('لازم تثبّت RedM أولاً عشان تدخل السيرفر.', { label: 'تحميل RedM', run: () => api.open('redm') });
    else toast('تعذّر الدخول المباشر، جرّب صفحة الانضمام.', { label: 'صفحة الانضمام', run: () => api.open('join') });
  }
}

$('btn-leave').addEventListener('click', () => {
  toast('تبي تطلع من اللعبة؟ بتنقفل RedM.', {
    label: 'اطلع من اللعبة',
    run: async () => {
      await api.quitGame();
      launchUntil = 0;
      setTimeout(refreshMe, 1500);
    },
  });
});

$('play').addEventListener('click', join);
$('btn-discord').addEventListener('click', () => api.open('discord'));

// ----- music: the loading screen's three tracks (CC0 / public domain, see CREDITS.md) ----------

const TRACKS = ['music/01_long_trail.ogg', 'music/02_estellita_waltz_1908.ogg', 'music/03_mazurka_harmonica_1939.ogg'];
const audio = new Audio();
audio.volume = 0.22;
let track = 0;
audio.addEventListener('ended', () => {
  track = (track + 1) % TRACKS.length;
  audio.src = TRACKS[track];
  audio.play().catch(() => {});
});
function musicOn() {
  try {
    return localStorage.getItem('music') !== 'off';
  } catch {
    return true;
  }
}
function setMusic(on, remember = true) {
  if (remember) {
    try {
      localStorage.setItem('music', on ? 'on' : 'off');
    } catch {}
  }
  $('music-btn').classList.toggle('is-on', on);
  $('music-state').textContent = on ? 'الموسيقى تعمل' : 'الموسيقى متوقفة';
  if (on) {
    if (!audio.src) audio.src = TRACKS[track];
    audio.play().catch(() => {});
  } else audio.pause();
}
$('music-btn').addEventListener('click', () => setMusic(audio.paused));

// ----- window & self-update -----------------------------------------------------------------------

$('win-min').addEventListener('click', () => api.window('min'));
$('win-close').addEventListener('click', () => api.window('close'));
$('greet').textContent = (() => {
  const h = new Date().getHours();
  return h >= 4 && h < 12 ? 'صباح الخير' : 'مساء الخير';
})();

// ----- launcher update: one button in the masthead -------------------------------------------------

let updateAnnounced = false;
function renderUpdate(u) {
  const btn = $('upd');
  if (!u || u.state === 'idle') {
    btn.hidden = true;
    return;
  }
  const pct = `${u.percent || 0}٪`;
  const text = {
    available: `تحديث جديد ${u.version} · حدّث الآن`,
    downloading: u.wantInstall ? `جاري تحديث اللانشر ${pct}` : `تحديث جديد ${u.version} · ${pct}`,
    ready: `حدّث الآن إلى ${u.version}`,
    installing: 'جاري التحديث، سيعاد فتح اللانشر…',
    error: 'تعذّر التحديث، اضغط للمحاولة مرة ثانية',
  }[u.state];
  btn.hidden = false;
  $('upd-text').textContent = text;
  btn.disabled = u.state === 'installing';
  btn.classList.toggle('is-ready', u.state === 'ready' || u.state === 'available');
  btn.style.setProperty('--pct', `${u.state === 'downloading' ? u.percent || 0 : 0}%`);
  if (!updateAnnounced && (u.state === 'available' || u.state === 'downloading' || u.state === 'ready')) {
    updateAnnounced = true;
    toast(`نسخة جديدة من اللانشر (${u.version}) متوفرة.`, { label: 'حدّث الآن', run: () => api.installUpdate() });
  }
}
$('upd').addEventListener('click', () => api.installUpdate());
api.onUpdate(renderUpdate);
api.updateState().then(renderUpdate);

// ----- boot ----------------------------------------------------------------------------------------

const params = new URLSearchParams(location.search);
loadImages().then(showPlate);
setInterval(showPlate, 16_000);
setInterval(showTip, 8_000);
loadFeed();
if (['updates', 'players'].includes(params.get('view'))) openBoard(params.get('view'));
refresh();
checkRedm();
refreshMe();
setInterval(refreshMe, 8_000);
setMusic(!params.has('quiet') && musicOn(), false);
setInterval(refresh, 20_000);
setInterval(loadFeed, 5 * 60_000);
