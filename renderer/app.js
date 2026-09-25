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
    row.append(el('span', 'row-n fig', pad(i + 1)), el('span', 'row-name', p.name), el('span', `row-ping fig${p.ping > 150 ? ' is-slow' : ''}`, `${p.ping}ms`));
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

async function join() {
  if (state.launching) return;
  state.launching = true;
  $('play').disabled = true;
  $('play-text').textContent = 'جاري فتح RedM…';
  const r = await api.connect();
  if (r.ok) toast('يتم فتح RedM والدخول للسيرفر مباشرة…');
  else if (r.reason === 'no-redm') toast('لازم تثبّت RedM أولاً عشان تدخل السيرفر.', { label: 'تحميل RedM', run: () => api.open('redm') });
  else toast('تعذّر الدخول المباشر، جرّب صفحة الانضمام.', { label: 'صفحة الانضمام', run: () => api.open('join') });
  setTimeout(() => {
    state.launching = false;
    $('play').disabled = false;
    $('play-text').textContent = 'ادخل السيرفر';
  }, 6000);
}
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

api.onUpdate((info) => {
  if (info.state === 'ready') toast(`نسخة جديدة من اللانشر (${info.version}) جاهزة، تتثبت عند الإغلاق.`, { label: 'تحديث الآن', run: () => api.installUpdate() });
  else toast(`نسخة جديدة من اللانشر متوفرة (${info.version}).`, { label: 'تحميل', run: () => api.open('launcher') });
});

// ----- boot ----------------------------------------------------------------------------------------

const params = new URLSearchParams(location.search);
loadImages().then(showPlate);
setInterval(showPlate, 16_000);
setInterval(showTip, 8_000);
loadFeed().then(() => {
  const view = params.get('view');
  if (view === 'updates' || view === 'players') openBoard(view);
});
refresh();
checkRedm();
setMusic(!params.has('quiet') && musicOn(), false);
setInterval(refresh, 20_000);
setInterval(loadFeed, 5 * 60_000);
