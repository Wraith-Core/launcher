const test = require('node:test');
const assert = require('node:assert/strict');
const { apiBase, externalUrl, connectUrl } = require('../network-policy');
const { createAccountLink } = require('../account-link');
const TOKEN = 'a'.repeat(64);
test('API transport is HTTPS and never embeds credentials', () => {
  assert.equal(apiBase(), 'https://wraith7.com/shop/api/launcher');
  for (const value of ['http://host.test', 'https://user:password@host.test', 'https://host.test?token=x', 'https://host.test/#x']) assert.throws(() => apiBase(value));
});
test('support and join links are pinned to known services', () => {
  for (const value of ['https://evil.test', 'https://wraith7.com.evil.test', 'https://wraith7.com@evil.test', 'http://wraith7.com', 'javascript:alert(1)', 'https://wraith7.com:444']) assert.equal(externalUrl('website', value), null);
  assert.equal(externalUrl('website', 'https://wraith7.com/shop'), 'https://wraith7.com/shop');
  assert.ok(externalUrl('discord', 'https://discord.gg/redriver'));
  assert.equal(externalUrl('discord', 'https://discord.com/oauth2/authorize'), null);
  assert.equal(externalUrl('launcher', 'https://github.com/attacker/bad/releases'), null);
  assert.equal(connectUrl('code;quit'), null);
  assert.equal(connectUrl('abc123'), 'redm://connect/cfx.re/join/abc123');
});
test('pair token stays outside returned UI data and persists only after game proof', async () => {
  let saved = '', phase = 'waiting';
  const calls = [];
  const account = createAccountLink({ load: () => '', save: (value) => { saved = value; }, remove: () => {}, now: () => 0,
    request: async (method, route, key) => { calls.push({ method, route, key }); return route === '/pair'
      ? { status: 200, body: { code: '12345678', pollToken: TOKEN, expiresAt: 300000 } }
      : phase === 'waiting' ? { status: 202, body: {} } : { status: 200, body: { state: 'linked', server: { known: true }, expiresAt: 999999 } }; } });
  assert.deepEqual(await account.start(), { code: '12345678', expiresAt: 300000 });
  assert.equal(saved, ''); assert.equal((await account.status()).state, 'waiting');
  phase = 'linked'; assert.equal((await account.status()).state, 'linked'); assert.equal(saved, TOKEN);
  assert.deepEqual(calls.map((c) => c.route), ['/pair', '/me', '/me']);
  assert.equal(JSON.stringify(await account.status()).includes(TOKEN), false);
});
test('transient failures keep the token while authorization rejection clears it', async () => {
  let status = 503, removed = 0;
  const account = createAccountLink({ load: () => TOKEN, save: () => {}, remove: () => { removed++; }, request: async () => ({ status, body: {} }) });
  assert.equal((await account.status()).state, 'unavailable'); assert.equal(removed, 0);
  status = 401; assert.equal((await account.status()).state, 'unlinked'); assert.equal(removed, 1);
});
test('late profile response cannot restore a locally revoked account', async () => {
  let reply, removed = 0, saved = 0;
  const account = createAccountLink({ load: () => TOKEN, save: () => { saved++; }, remove: () => { removed++; },
    request: (method) => method === 'GET' ? new Promise((resolve) => { reply = resolve; }) : Promise.resolve({ status: 200, body: {} }) });
  const pending = account.status(); await account.unlink();
  reply({ status: 200, body: { state: 'linked', server: { known: true } } });
  assert.equal((await pending).state, 'unlinked'); assert.equal(saved, 0); assert.equal(removed, 1);
});
test('failed revocation does not falsely claim an account was unlinked', async () => {
  let removed = 0;
  const account = createAccountLink({ load: () => TOKEN, save: () => {}, remove: () => { removed++; }, request: async () => ({ status: 503, body: {} }) });
  await assert.rejects(account.unlink()); assert.equal(removed, 0);
});
