/* Workspace PWA + explicit offline app packages. Never cache arbitrary URLs/API calls. */
'use strict';
importScripts('offline-model.js');
const M = self.BoilerRoomOfflineModel;
const scope = new URL(self.registration.scope);
const url = path => new URL(path, scope).href;
const prefix = M.prefix(scope);
const shellCache = `${prefix}shell-v24`;
const dataCache = `${prefix}data-v1`;
const indexCache = `${prefix}offline-index-v1`;
const packagePrefix = `${prefix}offline-app-v1:`;
const catalog = url('../repos.js');
const font = url('../fonts/SpaceGrotesk-VariableFont_wght.ttf');
const entry = url('index.html');
const manager = url('offline.html');
const shell = [entry, manager, url('workspace.css'), url('workspace.js'), url('pwa.js'),
  url('offline-model.js'), url('offline-client.js'), url('offline-manager.js'), url('offline.css'),
  url('../js/data.js'), url('../js/storage.js'), url('../js/search-relevance.js'),
  url('manifest.webmanifest'), url('icons/icon-192.png'), url('icons/icon-512.png'),
  url('icons/icon-maskable-512.png'), url('icons/apple-touch-icon.png')];
const shellSet = new Set(shell);
let mutationQueue = Promise.resolve();

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
async function installPackage(raw, progress) {
  const pkg = M.validate(raw, scope);
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
      // Only trusted, static, public assets. Do not cache authenticated responses or redirects.
      const response = await fetch(file, { cache: 'reload', credentials: 'omit', redirect: 'error' });
      const cacheControl = response.headers.get('Cache-Control') || '';
      if (response.status !== 200 || response.type === 'opaque' || response.redirected || /(?:^|,)\s*(?:no-store|private)(?:\s|=|,|$)/i.test(cacheControl)) {
        throw new Error(`Datei nicht offline speicherbar: ${new URL(file).pathname}`);
      }
      if (file === pkg.entry && !/\b(?:text\/html|application\/xhtml\+xml)\b/i.test(response.headers.get('Content-Type') || '')) {
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
    // Do not mix the v23 and v24 shells: activate after old pages close.
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
  const work = mutationQueue.then(async () => {
    if (msg.action === 'install') return installPackage(msg.package, progress);
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
async function fromApp(request) {
  const records = Object.values(await readIndex());
  const record = records.find(record => record.files.includes(request.url));
  if (record && (await caches.keys()).includes(record.cache)) {
    const cached = await (await caches.open(record.cache)).match(request.url, { ignoreVary: true });
    if (cached) return cached;
  }
  return fetch(request);
}
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const target = new URL(request.url);
  if (target.origin !== scope.origin) return;
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
