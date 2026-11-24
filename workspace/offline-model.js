/* Shared package contract for the Workspace Offline Manager and its worker. */
(function (global) {
  'use strict';
  const MAX_FILES = 500;
  function prefix(scope) { return `boiler-room-workspace:${new URL(scope).href}:`; }
  function indexKey(scope) { return new URL('apps/.offline-index', scope).href; }
  function appDirectory(value, scope) {
    const u = new URL(value, scope);
    const base = new URL('apps/', scope);
    if (u.origin !== base.origin || !['https:', 'http:'].includes(u.protocol) ||
        u.username || u.password || u.hash || !u.pathname.startsWith(base.pathname) || /%2f|%5c/i.test(u.pathname)) {
      throw new Error('Offline-Dateien müssen im lokalen workspace/apps/-Verzeichnis liegen.');
    }
    const rest = u.pathname.slice(base.pathname.length);
    const folder = rest.split('/')[0];
    if (!folder || folder.startsWith('.') || !rest.includes('/')) throw new Error('Ein eigenes App-Unterverzeichnis ist erforderlich.');
    return { href: u.href, directory: new URL(`${folder}/`, base).href };
  }
  function validate(raw, scope) {
    if (!raw || typeof raw.id !== 'string' || !raw.id.trim() || raw.id.length > 300 ||
        typeof raw.entry !== 'string' || !Array.isArray(raw.files) || raw.files.length > MAX_FILES ||
        raw.files.some(file => typeof file !== 'string' || !file.trim())) throw new Error('Ungültige Offline-Konfiguration.');
    const entry = appDirectory(raw.entry, scope);
    const files = [...new Set([entry.href, ...raw.files.map(file => {
      const asset = appDirectory(new URL(file, entry.href).href, scope);
      if (asset.directory !== entry.directory) throw new Error('Dateien müssen im selben App-Verzeichnis liegen.');
      return asset.href;
    })])].sort();
    if (files.length > MAX_FILES) throw new Error(`Maximal ${MAX_FILES} Offline-Dateien pro App.`);
    const version = typeof raw.version === 'string' || typeof raw.version === 'number' ? String(raw.version) : '';
    if (version.length > 100) throw new Error('Die Versionsangabe ist zu lang.');
    return { id: raw.id, entry: entry.href, directory: entry.directory, files, version,
      signature: JSON.stringify([entry.href, version, files]) };
  }
  function describe(repo, scope) {
    if (!repo || typeof repo.url !== 'string' || !repo.url.trim()) return { kind: 'info' };
    if (!repo.offline || typeof repo.offline !== 'object') return { kind: 'unsupported', reason: 'Kein Offline-Paket hinterlegt.' };
    try {
      const entry = new URL(repo.offline.entry || repo.url, new URL('../', scope)).href;
      return { kind: 'package', pkg: validate({ id: repo.label, entry, files: repo.offline.files, version: repo.offline.version }, scope) };
    } catch (e) { return { kind: 'unsupported', reason: e.message }; }
  }
  function status(description, installed) {
    if (description.kind !== 'package') return installed ? 'obsolete' : description.kind;
    if (!installed) return 'missing';
    if (!installed.complete) return 'incomplete';
    return installed.signature === description.pkg.signature ? 'ready' : 'update';
  }
  global.BoilerRoomOfflineModel = { prefix, indexKey, appDirectory, validate, describe, status };
})(typeof self !== 'undefined' ? self : globalThis);
