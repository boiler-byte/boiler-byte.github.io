/* Workspace PWA + explicit offline app packages. Never cache arbitrary URLs/API calls. */
'use strict';
importScripts('offline-model.js');
const M = self.BoilerRoomOfflineModel;
const scope = new URL(self.registration.scope);
const url = path => new URL(path, scope).href;
const prefix = M.prefix(scope);
const shellCache = `${prefix}shell-v48`;
const dataCache = `${prefix}data-v1`;
const indexCache = `${prefix}offline-index-v1`;
const packagePrefix = `${prefix}offline-app-v1:`;
const catalog = url('../repos.js');
const font = url('../fonts/SpaceGrotesk-VariableFont_wght.ttf');
const entry = url('index.html');
const manager = url('offline.html');
const shell = [entry, manager, url('workspace.css'), url('workspace.js'), url('pwa.js'),
  url('offline-model.js'), url('offline-client.js'), url('offline-manager.js'), url('offline.css'),
  url('../js/data.js'), url('../js/storage.js'), url('../js/favorites.js'), url('../js/search-relevance.js'), url('../js/toast.js'), url('../css/toast.css'),
  url('manifest.webmanifest'), url('icons/icon-192.png'), url('icons/icon-512.png'),
  url('icons/icon-maskable-512.png'), url('icons/apple-touch-icon.png')];
const shellSet = new Set(shell);
let mutationQueue = Promise.resolve();
const versionChecksInFlight = new Map();
// A quota failure must not trigger repeated network requests during this worker's lifetime.
const unsavedVersionChecks = new Map();

async function refreshData(request) {
  const cache = await caches.open(dataCache);
  try {
    const response = await fetch(request, { cache: 'no-cache' });
    if (!response.ok || response.type === 'opaque') throw new Error('Resource unavailable');
    try { await cache.put(request, response.clone()); } catch (_) { /* quota */ }
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw error;
  }
}
async function readIndex() {
  if (!(await caches.keys()).includes(indexCache)) return Object.create(null);
  const response = await (await caches.open(indexCache)).match(M.indexKey(scope));
  const records = response ? await response.json() : {};
  return Object.assign(Object.create(null), records);
}
async function writeIndex(records) {
  await (await caches.open(indexCache)).put(M.indexKey(scope), new Response(JSON.stringify(records), { headers: { 'Content-Type': 'application/json' } }));
}
async function notify() {
  try {
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    clients.forEach(client => client.postMessage({ protocol: 'boiler-room-offline-v1', changed: true }));
  } catch (_) { /* UI also refreshes on focus */ }
}
async function listPackages() {
  const records = Object.values(await readIndex());
  const names = new Set(await caches.keys());
  return Promise.all(records.map(async record => {
    if (!names.has(record.cache)) return { ...record, complete: false };
    const cache = await caches.open(record.cache);
    const files = await Promise.all(record.files.map(file => cache.match(file, { ignoreVary: true })));
    return { ...record, complete: files.every(Boolean) };
  }));
}
async function publicFile(file) {
  const response = await fetch(file, { cache: 'reload', credentials: 'omit', redirect: 'error' });
  const cacheControl = response.headers.get('Cache-Control') || '';
  if (response.status !== 200 || response.type === 'opaque' || response.redirected || /(?:^|,)\s*(?:no-store|private)(?:\s|=|,|$)/i.test(cacheControl)) {
    throw new Error(`Datei nicht offline speicherbar: ${new URL(file).pathname} (HTTP ${response.status})`);
  }
  return response;
}
async function discover(repo) {
  const loc = M.locate(repo, scope);
  if (loc.kind !== 'candidate') return { description: loc };
  let response;
  try {
    response = await fetch(loc.manifest, { cache: 'no-store', credentials: 'omit', redirect: 'error' });
  } catch (_) { return { description: { ...loc, kind: 'unknown', reason: 'boiler-room.json momentan nicht erreichbar.' } }; }
  if (response.status === 404 || response.status === 410) return { description: { kind: 'unsupported', reason: 'Keine boiler-room.json gefunden.' } };
  if (!response.ok || response.type === 'opaque' || response.redirected) return { description: { ...loc, kind: 'unknown', reason: `Manifest nicht erreichbar (HTTP ${response.status}).` } };
  if (/(?:^|,)\s*(?:no-store|private)(?:\s|=|,|$)/i.test(response.headers.get('Cache-Control') || '')) {
    return { description: { kind: 'unsupported', reason: 'Manifest darf nicht offline gespeichert werden.' } };
  }
  try {
    const metadata = await response.clone().json();
    return { description: M.describe(repo, scope, metadata), response };
  } catch (_) { return { description: { kind: 'unsupported', reason: 'boiler-room.json ist kein gültiges JSON.' } }; }
}
async function readVersionCheck(key) {
  if (unsavedVersionChecks.has(key)) return unsavedVersionChecks.get(key);
  try {
    const response = await (await caches.open(M.versionCheckCache(scope))).match(key);
    return response ? await response.json() : null;
  } catch (_) { return null; }
}
function liveVersionCheck(repo, key) {
  if (versionChecksInFlight.has(key)) return versionChecksInFlight.get(key);
  const pending = (async () => {
    const found = await discover(repo);
    const description = { ...found.description, checkedAt: Date.now() };
    try {
      const cache = await caches.open(M.versionCheckCache(scope));
      await cache.put(key, new Response(JSON.stringify(description), { headers: { 'Content-Type': 'application/json' } }));
      unsavedVersionChecks.delete(key);
    } catch (_) { unsavedVersionChecks.set(key, description); }
    return { ...found, description };
  })();
  versionChecksInFlight.set(key, pending);
  const clear = () => { if (versionChecksInFlight.get(key) === pending) versionChecksInFlight.delete(key); };
  pending.then(clear, clear);
  return pending;
}
async function checkVersion(repo, { force = false, cacheOnly = false } = {}) {
  const loc = M.locate(repo, scope);
  if (loc.kind !== 'candidate') return loc;
  const key = M.versionCheckKey(loc, scope);
  if (!cacheOnly && versionChecksInFlight.has(key)) return (await versionChecksInFlight.get(key)).description;
  // Read installation state from the authoritative index, not from a tab's snapshot.
  // An incomplete but indexed package still uses the installed-app interval.
  const installed = !cacheOnly && !force && Boolean((await readIndex())[loc.id]);
  const cached = await readVersionCheck(key);
  // Cache-only browsing never consumes the next online check or discards a known result.
  if (cacheOnly) return cached || loc;
  if (versionChecksInFlight.has(key)) return (await versionChecksInFlight.get(key)).description;
  if (!force && M.isVersionCheckFresh(cached, installed)) return cached;
  return (await liveVersionCheck(repo, key)).description;
}
async function installPackage(repo, progress) {
  // An explicit install/update validates the live manifest again so that the
  // manifest and downloaded files belong to the same transaction.
  const loc = M.locate(repo, scope);
  if (loc.kind !== 'candidate') throw new Error(loc.reason || 'Kein Offline-Paket verfügbar.');
  const found = await liveVersionCheck(repo, M.versionCheckKey(loc, scope));
  if (found.description.kind !== 'package') throw new Error(found.description.reason || 'Kein Offline-Paket verfügbar.');
  const pkg = found.description.pkg;
  const records = await readIndex();
  const previous = records[pkg.id];
  if (Object.values(records).some(record => record.id !== pkg.id && record.directory === pkg.directory)) {
    throw new Error('Dieses App-Verzeichnis ist bereits einem anderen Offline-Paket zugeordnet.');
  }
  const stage = `${packagePrefix}${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const cache = await caches.open(stage);
  let done = 0;
  progress({ done, total: pkg.files.length });
  try {
    for (const file of pkg.files) {
      // Manifest and assets must come from the same discovery/install transaction.
      const response = file === pkg.manifest ? found.response : await publicFile(file);
      if (/(?:^|,)\s*(?:no-store|private)(?:\s|=|,|$)/i.test(response.headers.get('Cache-Control') || '')) throw new Error('Manifest darf nicht offline gespeichert werden.');
      if (file === pkg.canonicalEntry && !/\b(?:text\/html|application\/xhtml\+xml)\b/i.test(response.headers.get('Content-Type') || '')) {
        throw new Error('Der Offline-Einstieg muss ein HTML-Dokument sein.');
      }
      await cache.put(file, response);
      progress({ done: ++done, total: pkg.files.length });
    }
    records[pkg.id] = { ...pkg, cache: stage, installedAt: new Date().toISOString() };
    // Publish only after every file has arrived; failed updates leave the old package intact.
    await writeIndex(records);
  } catch (error) {
    await caches.delete(stage);
    throw error;
  }
  // A concurrent fetch may still be reading the previous cache; it can fall back to the network.
  if (previous && previous.cache !== stage) await caches.delete(previous.cache).catch(() => {});
  await notify();
  return { ...records[pkg.id], complete: true };
}
async function removePackage(id) {
  if (typeof id !== 'string') throw new Error('Ungültige App-ID.');
  const records = await readIndex();
  const previous = records[id];
  if (!previous) return false;
  delete records[id];
  await writeIndex(records);
  await caches.delete(previous.cache).catch(() => {});
  await notify();
  return true;
}
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(shellCache);
    await cache.addAll(shell.map(href => new Request(href, { cache: 'reload' })));
    await Promise.allSettled([refreshData(catalog), refreshData(font)]);
    // Do not mix the old and new shells: activate after old pages close.
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith(`${prefix}shell-`) && key !== shellCache).map(key => caches.delete(key)));
    // Never delete another app's or another installation's caches.
    const current = new Set(Object.values(await readIndex()).map(record => record.cache));
    await Promise.all(keys.filter(key => key.startsWith(packagePrefix) && !current.has(key)).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});
self.addEventListener('message', event => {
  const msg = event.data || {};
  const port = event.ports?.[0];
  if (msg.protocol !== 'boiler-room-offline-v1' || !port) return;
  // Restrict management commands to our own Workspace/manager documents.
  const source = event.source?.url;
  if (!source) return;
  const sourceURL = new URL(source);
  if (sourceURL.origin !== scope.origin || ![scope.pathname, new URL(entry).pathname, new URL(manager).pathname].includes(sourceURL.pathname)) return;
  const progress = value => { try { port.postMessage({ progress: value }); } catch (_) {} };
  if (msg.action === 'list') {
    event.waitUntil(listPackages().then(result => port.postMessage({ ok: true, result }), error => port.postMessage({ ok: false, error: error.message || String(error) })));
    return;
  }
  if (msg.action === 'discover') {
    event.waitUntil(checkVersion(msg.repo, { force: msg.force === true, cacheOnly: msg.cacheOnly === true }).then(description => port.postMessage({ok:true,result:description}), error => port.postMessage({ok:false,error:error.message || String(error)})));
    return;
  }
  const work = mutationQueue.then(async () => {
    if (msg.action === 'install') return installPackage(msg.repo, progress);
    if (msg.action === 'remove') return removePackage(msg.id);
    throw new Error('Unbekannter Offline-Vorgang.');
  });
  mutationQueue = work.catch(() => {});
  event.waitUntil(work.then(result => port.postMessage({ ok: true, result }), error => port.postMessage({ ok: false, error: error.message || String(error) })));
});
async function fromShell(href, request) {
  const cache = await caches.open(shellCache);
  return await cache.match(href) || fetch(request);
}
async function fromApp(request, mirrored = false) {
  const records = Object.values(await readIndex());
  const record = mirrored ? records.find(r => r.mirror && request.url.startsWith(r.mirror)) : records.find(r => !r.mirror && r.files.includes(request.url));
  const source = mirrored && record ? new URL(request.url.slice(record.mirror.length), record.directory).href : request.url;
  if (record && record.files.includes(source) && (await caches.keys()).includes(record.cache)) {
    const cached = await (await caches.open(record.cache)).match(source, { ignoreVary: true });
    if (cached) {
      // Reset response URL so CSS/JS relative imports resolve at the local mirror.
      return mirrored ? new Response(cached.body, { status: cached.status, headers: cached.headers }) : cached;
    }
  }
  if (mirrored) {
    if (!record || !record.files.includes(source)) return new Response('Nicht im Offline-Paket enthalten.', {status:404});
    return fetch(source, {credentials:'omit', redirect:'error'}).then(r => new Response(r.body,{status:r.status,headers:r.headers}));
  }
  return fetch(request);
}
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const target = new URL(request.url);
  if (target.origin !== scope.origin) return;
  if (target.pathname.startsWith(new URL('offline-apps/', scope).pathname)) {
    if (!request.headers.has('Range')) event.respondWith(fromApp(request, true));
    return;
  }
  if (target.pathname.startsWith(new URL('apps/', scope).pathname)) {
    if (!request.headers.has('Range')) event.respondWith(fromApp(request));
    return;
  }
  if (request.mode === 'navigate') {
    if (request.destination === 'iframe' || request.destination === 'frame') return;
    if (target.pathname === scope.pathname || target.pathname === new URL(entry).pathname) event.respondWith(fromShell(entry, request));
    else if (target.pathname === new URL(manager).pathname) event.respondWith(fromShell(manager, request));
    return;
  }
  if (shellSet.has(target.href)) event.respondWith(fromShell(target.href, request));
  else if (target.href === catalog || target.href === font) event.respondWith(refreshData(request));
});
