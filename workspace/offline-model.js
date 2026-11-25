/* Shared contract for app-owned boiler-room.json (schema_version 2). */
(function (global) {
  'use strict';
  const MAX_FILES = 500;
  const INSTALLED_CHECK_INTERVAL = 24 * 60 * 60 * 1000;
  const UNINSTALLED_CHECK_INTERVAL = 7 * INSTALLED_CHECK_INTERVAL;
  const modes = new Set(['full', 'partial', 'none']);
  function prefix(scope) { return `boiler-room-workspace:${new URL(scope).href}:`; }
  function indexKey(scope) { return new URL('apps/.offline-index', scope).href; }
  function versionCheckCache(scope) { return `${prefix(scope)}offline-versions-v1`; }
  function versionCheckKey(loc, scope) {
    const key = new URL('apps/.offline-version', scope);
    key.searchParams.set('id', loc.id);
    key.searchParams.set('entry', loc.entry);
    return key.href;
  }
  function isVersionCheckFresh(description, installed, now = Date.now()) {
    const interval = installed ? INSTALLED_CHECK_INTERVAL : UNINSTALLED_CHECK_INTERVAL;
    return Number.isFinite(description?.checkedAt) && description.checkedAt <= now && now - description.checkedAt < interval;
  }
  function webURL(value, base) {
    const u = new URL(value, base);
    if (!['https:', 'http:'].includes(u.protocol) || u.username || u.password || /%2f|%5c|%00/i.test(u.pathname)) throw new Error('Ungültige App-URL.');
    return u;
  }
  function locate(repo, scope) {
    if (!repo || typeof repo.url !== 'string' || !repo.url.trim()) return { kind: 'info' };
    try {
      const entry = webURL(repo.url.trim(), new URL('../', scope));
      entry.hash = '';
      if (entry.origin !== new URL(scope).origin) return { kind: 'unsupported', reason: 'Andere Origin: zentraler Offline-Start ist nicht möglich.' };
      const last = entry.pathname.split('/').pop();
      const directory = new URL(entry.href);
      directory.search = '';
      if (last && !last.includes('.')) directory.pathname += '/';
      else if (last) directory.pathname = directory.pathname.slice(0, -last.length);
      // Do not allow a package to take ownership of the platform shell or host root.
      const platform = new URL('../', scope);
      if (directory.pathname === '/' || directory.href === platform.href || directory.href === new URL(scope).href || directory.href === new URL('offline-apps/', scope).href || directory.pathname.startsWith(new URL('offline-apps/', scope).pathname)) throw new Error('Ein eigenes App-Verzeichnis ist erforderlich.');
      const manifest = new URL('boiler-room.json', directory).href;
      return { kind: 'candidate', id: repo.label, entry: entry.href, directory: directory.href, manifest };
    } catch (error) { return { kind: 'unsupported', reason: error.message }; }
  }
  function validate(raw, scope) {
    if (!raw || typeof raw.id !== 'string' || !raw.id.trim() || raw.id.length > 300 || typeof raw.entry !== 'string') throw new Error('Ungültige App-ID oder URL.');
    const loc = locate({ label: raw.id, url: raw.entry }, scope);
    if (loc.kind !== 'candidate') throw new Error(loc.reason || 'Ungültiger Einstieg.');
    const manifest = raw.metadata;
    if (!manifest || manifest.schema_version !== 2 || !Number.isSafeInteger(manifest.version) || manifest.version < 0 ||
        !manifest.offline || !modes.has(manifest.offline.mode) || !Array.isArray(manifest.offline.limitations) ||
        manifest.offline.limitations.some(x => typeof x !== 'string') || !Array.isArray(manifest.files) || manifest.files.length > MAX_FILES ||
        manifest.files.some(file => typeof file !== 'string' || !file.trim())) throw new Error('Ungültige boiler-room.json (Schema 2 erwartet).');
    if (manifest.offline.mode === 'none') throw new Error('Die App deklariert keinen Offlinebetrieb.');
    const directory = new URL(loc.directory);
    const assets = manifest.files.map(file => {
      const asset = webURL(file, directory);
      if (asset.hash || asset.origin !== directory.origin || !asset.pathname.startsWith(directory.pathname)) throw new Error('Dateien müssen im App-Verzeichnis liegen.');
      return asset.href;
    });
    // A directory URL without trailing slash may redirect to its canonical slash URL.
    const entry = new URL(loc.entry);
    const canonical = new URL(entry.href);
    if (entry.pathname + '/' === directory.pathname) canonical.pathname += '/';
    const files = [...new Set([canonical.href, loc.manifest, ...assets])].sort();
    if (files.length > MAX_FILES) throw new Error(`Maximal ${MAX_FILES} Offline-Dateien pro App.`);
    const version = String(manifest.version);
    const versionName = typeof manifest.version_name === 'string' ? manifest.version_name : '';
    const limitations = manifest.offline.limitations.slice();
    const mode = manifest.offline.mode;
    const direct = directory.href.startsWith(new URL('apps/', scope).href);
    // Apps outside the SW scope get a stable, same-origin local URL with relative paths intact.
    const mirror = direct ? null : new URL('offline-apps/' + encodeURIComponent(directory.pathname).replace(/_/g, '%5F').replace(/%/g, '_') + '/', scope).href;
    const localURL = file => mirror ? new URL(file.slice(directory.href.length), mirror).href : file;
    const launchEntry = localURL(canonical.href);
    return { id: raw.id, entry: loc.entry, canonicalEntry: canonical.href, directory: directory.href, manifest: loc.manifest,
      files, version, versionName, mode, limitations, metadata: manifest, mirror, launchEntry,
      signature: JSON.stringify([loc.entry, version, versionName, mode, limitations, files]) };
  }
  function describe(repo, scope, metadata) {
    const loc = locate(repo, scope);
    if (loc.kind !== 'candidate' || metadata === undefined) return loc;
    try { return { kind: 'package', pkg: validate({ id: loc.id, entry: loc.entry, metadata }, scope) }; }
    catch (e) { return { kind: 'unsupported', reason: e.message }; }
  }
  function matches(loc, installed) {
    if (!installed || !['candidate','package','unknown'].includes(loc.kind)) return false;
    const target = loc.pkg || loc;
    return target.entry === installed.entry || (target.directory === installed.directory && target.entry + '/' === installed.entry);
  }
  function status(description, installed) {
    if (description.kind === 'candidate' || description.kind === 'unknown') {
      if (installed && matches(description, installed)) return installed.complete ? 'saved' : 'incomplete';
      return 'unknown';
    }
    if (description.kind !== 'package') return installed ? 'obsolete' : description.kind;
    if (!installed) return 'missing';
    if (!matches(description, installed)) return 'update';
    if (!installed.complete) return 'incomplete';
    return installed.signature === description.pkg.signature ? 'ready' : 'update';
  }
  function statusLabel(state, description) {
    if (state !== 'update') return null;
    return `Version ${description.pkg.versionName || description.pkg.version} verfügbar`;
  }
  global.BoilerRoomOfflineModel = { prefix, indexKey, locate, validate, describe, matches, status, statusLabel, versionCheckCache, versionCheckKey, isVersionCheckFresh };
})(typeof self !== 'undefined' ? self : globalThis);
