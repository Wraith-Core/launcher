// Device tokens stay in the main process. The renderer sees only a short-lived pairing code.
function createAccountLink({ request, load, save, remove, now = Date.now }) {
  let token = load() || '', pendingUntil = 0, pairCode = null, generation = 0;
  const currentState = () => !token ? { state: 'unlinked' } : pendingUntil
    ? { state: 'waiting', code: pairCode, expiresAt: pendingUntil } : { state: 'unavailable' };
  return {
    async start() {
      if (token) await this.unlink();
      const ownGeneration = ++generation;
      const result = await request('POST', '/pair');
      if (generation !== ownGeneration) throw new Error('Pairing request cancelled');
      if (result.status !== 200 || !/^\d{8}$/.test(result.body.code) || !/^[a-f0-9]{64}$/.test(result.body.pollToken)
        || !Number.isFinite(result.body.expiresAt) || result.body.expiresAt <= now()) throw new Error('Pairing unavailable');
      token = result.body.pollToken; pendingUntil = result.body.expiresAt; pairCode = result.body.code;
      return { code: pairCode, expiresAt: pendingUntil };
    },
    async status() {
      if (!token) return { state: 'unlinked' };
      if (pendingUntil && pendingUntil <= now()) {
        token = ''; pendingUntil = 0; pairCode = null; return { state: 'expired' };
      }
      try {
        const ownGeneration = generation, requestedToken = token;
        const result = await request('GET', '/me', requestedToken);
        if (ownGeneration !== generation || requestedToken !== token) return currentState();
        if (result.status === 202 && pendingUntil) return { state: 'waiting', code: pairCode, expiresAt: pendingUntil };
        if (result.status === 401) {
          token = ''; pendingUntil = 0; pairCode = null; remove(); return { state: 'unlinked' };
        }
        if (result.status !== 200 || result.body.state !== 'linked' || !result.body.server) throw new Error('Profile unavailable');
        if (pendingUntil) save(token);
        pendingUntil = 0; pairCode = null;
        return result.body;
      } catch { return { state: 'unavailable' }; }
    },
    async unlink() {
      generation++;
      if (token) {
        const result = await request('DELETE', '/me', token);
        if (![200, 401].includes(result.status)) throw new Error('Account unlink unavailable');
      }
      remove(); token = ''; pendingUntil = 0; pairCode = null;
      return { state: 'unlinked' };
    },
  };
}
module.exports = { createAccountLink };
