// Launcher page. All data arrives through window.wraith (preload.js); text is inserted with
// textContent only, so nothing from the feed or player names can run as code.
const $ = (id) => document.getElementById(id);
const api = window.wraith;

const state = { feed: null, status: null, players: [], redm: null, launching: false };
const dateFmt = new Intl.DateTimeFormat('ar-SA-u-ca-gregory-nu-latn', { day: 'numeric', month: 'long', year: 'numeric' });
const rel = new Intl.RelativeTimeFormat('ar', { numeric: 'auto' });
const SCENES = ['art/scene-sunset.svg', 'art/scene-dusk.svg', 'art/scene-night.svg'];
const AVATAR_COLORS = ['#e8392b', '#d9772b', '#b8433a', '#9c3d5c', '#c2873a', '#7d4aa8', '#3f7fb8', '#3a9a6e'];

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

function avatar(name, size) {
  // Arabic letters don't join across initials, so Arabic names get one letter, Latin names two.
  const words = name.split(/\s+/).map((w) => w.replace(/[^\p{L}\p{N}]/gu, '')).filter(Boolean);
  const arabic = /[؀-ۿ]/.test(name);
  const letters = (arabic ? [...(words[0] || '?')][0] : words.length > 1 ? words[0][0] + words[1][0] : [...(words[0] || '?')].slice(0, 2).join('')).toUpperCase();
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.codePointAt(0)) >>> 0;
  const node = el('span', 'av', letters);
  node.style.background = `radial-gradient(circle at 35% 30%, ${AVATAR_COLORS[h % AVATAR_COLORS.length]}, #2a0c0b 140%)`;
  if (size) {
    node.style.width = `${size}px`;
    node.style.height = `${size}px`;
  }
  return node;
}

// ----- views ------------------------------------------------------------------------

function show(view) {
  document.querySelectorAll('.view').forEach((v) => v.classList.toggle('active', v.id === `view-${view}`));
  document.querySelectorAll('.nav-btn[data-view]').forEach((b) => b.classList.toggle('active', b.dataset.view === view));
  if (view === 'updates') markSeen();
}

document.querySelectorAll('[data-view]').forEach((b) => b.addEventListener('click', () => show(b.dataset.view)));
document.querySelectorAll('[data-goto]').forEach((b) => b.addEventListener('click', () => show(b.dataset.goto)));
document.querySelectorAll('[data-link]').forEach((b) => b.addEventListener('click', () => api.open(b.dataset.link)));

// ----- updates ------------------------------------------------------------------------

function allItems() {
  const out = [];
  for (const u of state.feed?.updates || []) {
    for (const s of u.sections || []) out.push({ update: u, section: s });
  }
  return out;
}

function renderActivities() {
  const box = $('acards');
  box.replaceChildren();
  const items = allItems().slice(0, 3);
  if (!items.length) {
    box.append(el('div', 'empty-card', 'لا توجد تحديثات منشورة بعد'));
    return;
  }
  items.forEach(({ update, section }, i) => {
    const card = el('button', 'acard');
    const img = el('img');
    img.src = SCENES[i % SCENES.length];
    img.alt = '';
    const first = section.items[0];
    const badge = el('span', `acard-badge type-${first?.type || 'changed'}`, first?.label || 'تحديث');
    const body = el('div', 'acard-body');
    body.append(el('b', null, section.system), el('p', null, first?.text || ''), el('small', null, `تحديث رقم ${update.number} · ${ago(update.date)}`));
    card.append(img, el('div', 'acard-shade'), badge, body);
    card.addEventListener('click', () => show('updates'));
    box.append(card);
  });
}

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

function renderUpdateList() {
  const query = $('search').value.trim().toLowerCase();
  const box = $('ulist');
  box.replaceChildren();
  let shown = 0;
  for (const update of state.feed?.updates || []) {
    const card = el('article', 'ucard panel');
    let hasAny = false;
    for (const section of update.sections || []) {
      const matches = (section.items || []).filter((it) => !query || it.text.toLowerCase().includes(query) || section.system.toLowerCase().includes(query));
      if (!matches.length) continue;
      if (!hasAny) {
        const head = el('div', 'ucard-head');
        head.append(el('b', null, `تحديث السيرفر رقم ${update.number}`));
        if (update.date) head.append(el('time', null, `${dateFmt.format(new Date(update.date))} · ${ago(update.date)}`));
        card.append(head);
        hasAny = true;
      }
      const block = el('section', 'usec');
      block.append(el('h3', null, section.system));
      for (const it of matches) {
        const row = el('p', 'uitem');
        const text = el('span');
        text.append(highlight(it.text, query));
        row.append(el('span', `chip type-${it.type}`, it.label), text);
        block.append(row);
        shown++;
      }
      card.append(block);
    }
    if (hasAny) box.append(card);
  }
  if (!box.children.length) box.append(el('p', 'empty', query ? 'لا توجد نتائج مطابقة.' : 'لا توجد تحديثات منشورة بعد.'));
  $('search-note').textContent = query ? `${shown} نتيجة` : '';
}

$('search').addEventListener('input', () => {
  if ($('search').value.trim()) show('updates');
  renderUpdateList();
});

// New-update badge: anything newer than what this player last opened.
function lastSeen() {
  return Number(localStorage.getItem('lastSeenUpdate') || 0);
}
function markSeen() {
  const latest = state.feed?.updates?.[0]?.number || 0;
  localStorage.setItem('lastSeenUpdate', String(latest));
  renderBadges();
}
function renderBadges() {
  const unseen = (state.feed?.updates || []).filter((u) => u.number > lastSeen()).length;
  $('nav-badge').hidden = !unseen;
  $('nav-badge').textContent = unseen > 9 ? '9+' : String(unseen);
  $('bell-dot').hidden = !unseen;
}
$('bell').addEventListener('click', () => show('updates'));

async function loadFeed() {
  if (!state.feed) {
    const cached = await api.feedCached();
    if (cached) applyFeed(cached);
  }
  const { feed, live } = await api.feed();
  if (!feed) {
    if (!state.feed) $('acards').replaceChildren(el('div', 'empty-card', 'تعذّر الاتصال بالسيرفر'));
    return;
  }
  applyFeed(feed);
  if (!live) toast('تعذّر الاتصال بالسيرفر، هذه آخر نسخة محفوظة من التحديثات.');
}

function applyFeed(feed) {
  state.feed = feed;
  if (/^#[0-9a-f]{6}$/i.test(feed.branding?.color || '')) document.documentElement.style.setProperty('--accent', feed.branding.color);
  const name = feed.server?.name || 'Wraith Core';
  $('greet-name').textContent = name;
  document.title = name;
  if (feed.server?.tagline) $('hero-tagline').textContent = feed.server.tagline;
  const parts = name.trim().split(/\s+/);
  $('hero-title').replaceChildren(parts[0].toUpperCase(), ...(parts.length > 1 ? [el('br'), parts.slice(1).join(' ').toUpperCase()] : []));
  const hasDiscord = Boolean(feed.links?.discord);
  for (const id of ['nav-discord', 'hero-discord', 'mini-discord']) $(id).hidden = !hasDiscord;
  $('q-discord').hidden = !hasDiscord;
  $('nav-website').hidden = !feed.links?.website;
  const code = feed.server?.joinCode ? `cfx.re/join/${feed.server.joinCode}` : '';
  $('q-join-code').textContent = code || 'رمز الدخول غير متوفر';
  $('lb-code').textContent = code;
  const latest = feed.updates?.[0];
  $('q-latest-title').textContent = latest ? `تحديث رقم ${latest.number}` : 'آخر تحديث';
  $('q-latest-sub').textContent = latest ? `${latest.sections.map((s) => s.system).join('، ')} · ${ago(latest.date)}` : 'لا توجد تحديثات بعد';
  $('stat-updates').textContent = String(latest?.number || 0);
  renderActivities();
  renderUpdateList();
  renderBadges();
}

async function loadImages() {
  const [logo, banner, hero] = await Promise.all(['logo.png', 'banner.jpg', 'hero.jpg'].map((n) => api.image(n)));
  if (logo) for (const id of ['nav-logo', 'q-logo']) $(id).src = logo;
  if (banner) $('lb-banner').src = banner;
  if (hero) $('hero-art').src = hero;
}

// ----- server status & players ---------------------------------------------------------------

function renderStatus() {
  const s = state.status || {};
  const tag = $('hero-status');
  tag.className = `tag status-tag ${s.online ? 'online' : 'offline'}`;
  tag.lastElementChild.textContent = s.online ? 'السيرفر شغّال' : 'السيرفر مقفل';
  const players = s.online ? s.players : 0;
  const max = s.max || 48;
  $('ring-count').textContent = String(players);
  $('ring-max').textContent = `من ${max}`;
  const circumference = 2 * Math.PI * 84;
  const fraction = Math.min(1, players / max);
  const fill = $('ring-fill');
  // inline style: the stylesheet's starting value would win over an SVG attribute
  fill.style.strokeDasharray = `${Math.max(fraction * circumference, 6)} ${circumference}`;
  fill.style.opacity = players ? '1' : '0'; // a round cap would still draw a dot at zero
  $('stat-ping').textContent = s.online ? `${s.ping}ms` : '—';
  $('stat-state').textContent = s.online ? 'شغّال' : 'مقفل';
  $('play').disabled = state.launching;
}

function renderPlayers() {
  const list = state.players;
  $('people-count').textContent = String(list.length);
  const col = $('people-list');
  col.replaceChildren();
  if (!list.length) {
    col.append(el('span', 'people-empty', state.status?.online ? 'لا أحد\nداخل الحين' : 'السيرفر\nمقفل'));
  } else {
    for (const p of list.slice(0, 8)) {
      const a = avatar(p.name);
      a.title = `${p.name} · ${p.ping}ms`;
      col.append(a);
    }
    if (list.length > 8) col.append(el('span', 'more', `+${list.length - 8}`));
  }

  const stack = $('crowd-stack');
  stack.replaceChildren(...list.slice(0, 4).map((p) => avatar(p.name)));
  $('crowd-pill').textContent = list.length ? `${list.length} لاعب داخل الحين` : 'كن أول من يدخل اليوم';

  const plist = $('plist');
  plist.replaceChildren();
  $('players-note').textContent = list.length ? `${list.length} من ${state.status?.max || 48}` : '';
  if (!list.length) {
    const box = el('div', 'players-empty panel');
    const art = el('img');
    art.src = 'art/scene-night.svg';
    art.alt = '';
    const btn = el('button', 'btn-play small', 'كن أول الداخلين');
    btn.addEventListener('click', join);
    box.append(art, el('b', null, state.status?.online ? 'السيرفر فاضي الحين' : 'السيرفر مقفل حالياً'), el('small', null, state.status?.online ? 'ادخل الحين وابدأ قصتك قبل الكل.' : 'تابع روم الدسكورد لمعرفة موعد الفتح.'), btn);
    plist.append(box);
  }
  for (const p of list) {
    const row = el('div', 'prow panel');
    const ping = el('span', `ping ${p.ping > 150 ? 'bad' : p.ping > 80 ? 'mid' : ''}`);
    ping.append(el('i'), `${p.ping}ms`);
    row.append(avatar(p.name), el('b', null, p.name), ping);
    plist.append(row);
  }
}

async function refresh() {
  const [status, players] = await Promise.all([api.status(), api.players()]);
  state.status = status;
  state.players = status.online ? players : [];
  renderStatus();
  renderPlayers();
}
$('refresh').addEventListener('click', refresh);

// ----- RedM & joining ---------------------------------------------------------------------

async function checkRedm() {
  state.redm = await api.redm();
  $('redm-state').textContent = state.redm ? 'مثبّتة وجاهزة للدخول' : 'غير مثبّتة على جهازك';
  $('lb-get').hidden = state.redm;
  $('lb-step').textContent = state.redm ? 'اضغط تشغيل للدخول' : 'ثبّت RedM أولاً';
}
$('lb-get').addEventListener('click', () => api.open('redm'));
$('open-join-page').addEventListener('click', () => api.open('join'));

function progress(pct, step) {
  $('progress').style.width = `${pct}%`;
  $('lb-step').textContent = step;
}

async function join() {
  if (state.launching) return;
  state.launching = true;
  $('play').disabled = true;
  $('play-text').textContent = 'جاري التشغيل…';
  show('home');
  progress(15, 'جاري التحقق من اللعبة…');
  const r = await api.connect();
  if (r.ok) {
    progress(60, 'جاري فتح RedM…');
    setTimeout(() => progress(100, 'تم، RedM يوصلك للسيرفر الحين'), 1200);
  } else {
    progress(0, 'اضغط تشغيل للدخول');
    if (r.reason === 'no-redm') toast('لازم تثبّت RedM أولاً عشان تدخل السيرفر.', { label: 'تحميل RedM', run: () => api.open('redm') });
    else toast('تعذّر الدخول المباشر، جرّب صفحة الانضمام.', { label: 'صفحة الانضمام', run: () => api.open('join') });
  }
  setTimeout(() => {
    state.launching = false;
    $('play').disabled = false;
    $('play-text').textContent = 'ادخل السيرفر';
    if (r.ok) progress(0, 'اضغط تشغيل للدخول');
  }, 6000);
}
for (const id of ['play', 'nav-play', 'lb-play', 'q-join']) $(id).addEventListener('click', join);
$('q-discord').addEventListener('click', () => api.open('discord'));
$('hero-discord').addEventListener('click', () => api.open('discord'));
$('q-latest').addEventListener('click', () => show('updates'));

// ----- chrome ------------------------------------------------------------------------------

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

$('win-min').addEventListener('click', () => api.window('min'));
$('win-close').addEventListener('click', () => api.window('close'));
$('greet').textContent = (() => {
  const h = new Date().getHours();
  return h >= 4 && h < 12 ? 'صباح الخير' : 'مساء الخير';
})();

api.onUpdate((info) => {
  if (info.state === 'ready') toast(`نسخة جديدة من اللانشر (${info.version}) جاهزة، تتثبت تلقائياً عند الإغلاق.`, { label: 'تحديث الآن', run: () => api.installUpdate() });
  else toast(`نسخة جديدة من اللانشر متوفرة (${info.version}).`, { label: 'تحميل', run: () => api.open('launcher') });
});

api.version().then((v) => ($('version').textContent = `v${v}`));
loadFeed();
loadImages();
refresh();
checkRedm();
const startView = new URLSearchParams(location.search).get('view');
if (['updates', 'players'].includes(startView)) show(startView);
setInterval(refresh, 20_000);
setInterval(loadFeed, 5 * 60_000);
