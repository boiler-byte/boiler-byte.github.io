/* One worker registration and message channel, shared by Workspace and Manager. */
(function (global) {
  'use strict';
  const B = global.BoilerRoom = global.BoilerRoom || {};
  const scope = new URL('./', document.currentScript.src).href;
  const model = global.BoilerRoomOfflineModel;
  const supported = 'serviceWorker' in navigator && 'caches' in global && global.isSecureContext;
  let registrationPromise;
  function register() {
    if (!supported) return Promise.reject(new Error('Offline-Funktionen benötigen HTTPS oder localhost und einen Service Worker.'));
    if (!registrationPromise) {
      registrationPromise = navigator.serviceWorker.register(new URL('sw.js', scope).href, { scope, updateViaCache: 'none' })
        .catch(async error => {
          const existing = await navigator.serviceWorker.getRegistration(scope).catch(() => null);
          if (existing?.scope === scope && existing.active) return existing;
          registrationPromise = null; throw error;
        });
    }
    return registrationPromise;
  }
  async function activeWorker() {
    const registration = await register();
    if (registration.active?.state === 'activated') return registration.active;
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Offline-Dienst noch nicht bereit. Bitte die Seite erneut öffnen.')), 15000);
      navigator.serviceWorker.ready.then(ready => {
        clearTimeout(timeout);
        if (ready.scope !== scope || !ready.active) reject(new Error('Kein passender Workspace-Service-Worker aktiv.'));
        else resolve(ready.active);
      }, reject);
    });
  }
  async function request(action, payload = {}, onProgress) {
    const worker = await activeWorker();
    return new Promise((resolve, reject) => {
      const channel = new MessageChannel();
      let timer;
      const finish = (error, value) => { clearTimeout(timer); channel.port1.close(); error ? reject(error) : resolve(value); };
      const arm = duration => { clearTimeout(timer); timer = setTimeout(() => finish(new Error(action === 'list'
        ? 'Offline-Dienst antwortet nicht. Bei einem Update alle Workspace-Tabs schließen und erneut öffnen.'
        : 'Offline-Vorgang antwortet nicht mehr. Status erneut prüfen.')), duration); };
      channel.port1.onmessage = event => {
        const msg = event.data || {};
        if (msg.progress) { arm(120000); if (onProgress) onProgress(msg.progress); return; }
        if (msg.ok) finish(null, msg.result);
        else finish(new Error(msg.error || 'Offline-Vorgang fehlgeschlagen.'));
      };
      arm(action === 'list' ? 8000 : 120000);
      try { worker.postMessage({ protocol: 'boiler-room-offline-v1', action, ...payload }, [channel.port2]); }
      catch (error) { finish(error); }
    });
  }
  // Read the authoritative index without a worker round trip for startup routing.
  async function snapshot() {
    if (!supported) return [];
    const name = `${model.prefix(scope)}offline-index-v1`;
    if (!(await caches.keys()).includes(name)) return [];
    const response = await (await caches.open(name)).match(model.indexKey(scope));
    if (!response) return [];
    const records = await response.json();
    const names = new Set(await caches.keys());
    return Promise.all(Object.values(records).map(async record => {
      if (!names.has(record.cache)) return { ...record, complete: false };
      const cache = await caches.open(record.cache);
      const matches = await Promise.all(record.files.map(file => cache.match(file, { ignoreVary: true })));
      return { ...record, complete: matches.every(Boolean) };
    }));
  }
  function describe(repo) { return model.describe(repo, scope); }
  function localEntry(repo, installed) {
    const description = describe(repo);
    if (description.kind !== 'package' || !installed?.complete) return null;
    return installed.entry; // A previously installed version remains usable until successfully updated.
  }
  B.offline = { supported, scope, register, request, snapshot, describe, localEntry, status: model.status };
})(window);
