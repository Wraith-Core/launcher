// Launcher page. All data arrives through window.wraith (preload.js); text is inserted with
// textContent only, so nothing from the feed can run as code.
const $ = (id) => document.getElementById(id);

const dateFmt = new Intl.DateTimeFormat('ar-SA-u-ca-gregory-nu-latn', { day: 'numeric', month: 'long', year: 'numeric' });

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

// ----- updates -------------------------------------------------------------

function renderUpdates(feed) {
  const box = $('updates');
  box.replaceChildren();
  if (!feed?.updates?.length) {
    box.append(el('p', 'empty', 'لا توجد تحديثات منشورة بعد.'));
    return;
  }
  for (const update of feed.updates) {
    const card = el('article', 'update');
    const head = el('header', 'update-head');
    head.append(el('span', 'update-title', `تحديث السيرفر رقم ${update.number}`));
    if (update.date) head.append(el('time', 'update-date', dateFmt.format(new Date(update.date))));
    card.append(head);
    for (const section of update.sections || []) {
      const block = el('section', 'update-section');
      block.append(el('h3', null, section.system));
      for (const item of section.items || []) {
        const row = el('p', 'item');
        row.append(el('span', `chip ${item.type}`, item.label), el('span', 'item-text', item.text));
        block.append(row);
      }
      card.append(block);
    }
    box.append(card);
  }
}

async function loadFeed() {
  const { feed, live } = await window.wraith.feed();
  $('offline').hidden = live || !feed;
  if (!feed) {
    $('updates').replaceChildren(el('p', 'empty', 'تعذّر الاتصال بالسيرفر. تأكد من اتصالك بالإنترنت.'));
    return;
  }
  if (/^#[0-9a-f]{6}$/i.test(feed.branding?.color || '')) document.documentElement.style.setProperty('--brand', feed.branding.color);
  $('server-name').textContent = feed.server?.name || 'Wraith Core';
  document.title = feed.server?.name || 'Wraith Core';
  $('discord').hidden = !feed.links?.discord;
  $('join-code').textContent = feed.server?.joinCode ? `cfx.re/join/${feed.server.joinCode}` : '';
  renderUpdates(feed);
}

async function loadImages() {
  const logo = await window.wraith.image('logo.png');
  if (logo) {
    $('logo').src = logo;
    $('title-logo').src = logo;
  }
  const banner = await window.wraith.image('banner.jpg');
  if (banner) $('hero').style.backgroundImage = `url("${banner}")`;
}

// ----- server status ---------------------------------------------------------

async function refreshStatus() {
  const s = await window.wraith.status();
  $('status').className = `status ${s.online ? 'online' : 'offline'}`;
  $('status-text').textContent = s.online ? `السيرفر شغّال · ${s.players} / ${s.max} لاعب` : 'السيرفر مقفل حالياً';
}

// ----- actions ----------------------------------------------------------------

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

$('play').addEventListener('click', async () => {
  const play = $('play');
  play.disabled = true;
  $('play-text').textContent = 'جاري التشغيل…';
  const r = await window.wraith.connect();
  if (r.ok) toast('يتم فتح RedM والدخول للسيرفر مباشرة…');
  else if (r.reason === 'no-redm') toast('لازم تثبّت RedM أولاً عشان تدخل السيرفر.', { label: 'تحميل RedM', run: () => window.wraith.open('redm') });
  else toast('تعذّر الدخول المباشر، جرّب صفحة الانضمام.', { label: 'صفحة الانضمام', run: () => window.wraith.open('join') });
  setTimeout(() => {
    play.disabled = false;
    $('play-text').textContent = 'دخول السيرفر';
  }, 4000);
});

$('discord').addEventListener('click', () => window.wraith.open('discord'));
$('win-min').addEventListener('click', () => window.wraith.window('min'));
$('win-close').addEventListener('click', () => window.wraith.window('close'));

window.wraith.onUpdate((info) => {
  if (info.state === 'ready') toast(`نسخة جديدة من اللانشر (${info.version}) جاهزة، تتثبت تلقائياً عند الإغلاق.`, { label: 'تحديث الآن', run: () => window.wraith.installUpdate() });
  else toast(`نسخة جديدة من اللانشر متوفرة (${info.version}).`, { label: 'تحميل', run: () => window.wraith.open('launcher') });
});

// ----- boot --------------------------------------------------------------------

window.wraith.version().then((v) => ($('version').textContent = `v${v}`));
loadFeed();
loadImages();
refreshStatus();
setInterval(refreshStatus, 20_000);
setInterval(loadFeed, 5 * 60_000);
