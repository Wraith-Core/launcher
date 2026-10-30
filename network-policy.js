// All launcher content and account traffic uses the authenticated HTTPS store channel.
const DEFAULT_API = 'https://wraith7.com/shop/api/launcher';
function apiBase(value = DEFAULT_API) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash)
    throw new Error('Launcher API must use HTTPS without embedded credentials');
  return url.href.replace(/\/$/, '');
}
const HOSTS = {
  discord: new Set(['discord.gg', 'discord.com', 'www.discord.com']),
  website: new Set(['wraith7.com', 'www.wraith7.com', 'store.wraith7.com']),
  redm: new Set(['redm.net', 'www.redm.net']),
  launcher: new Set(['github.com']), join: new Set(['cfx.re']),
};
function externalUrl(which, value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443')
      || !HOSTS[which]?.has(url.hostname)) return null;
    if (which === 'discord' && !(url.hostname === 'discord.gg' ? /^\/[a-z0-9-]+\/?$/i : /^\/invite\/[a-z0-9-]+\/?$/i).test(url.pathname)) return null;
    if (which === 'launcher' && !url.pathname.startsWith('/Wraith-Core/launcher/releases')) return null;
    if (which === 'join' && !/^\/join\/[a-z0-9]{4,12}\/?$/i.test(url.pathname)) return null;
    return url.href;
  } catch { return null; }
}
function connectUrl(code) {
  return typeof code === 'string' && /^[a-z0-9]{4,12}$/i.test(code) ? `redm://connect/cfx.re/join/${code}` : null;
}
module.exports = { DEFAULT_API, apiBase, externalUrl, connectUrl };
