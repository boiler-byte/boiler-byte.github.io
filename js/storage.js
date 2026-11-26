/* Zentrale Persistenz: genau ein JSON-Eintrag in localStorage.boilerRoom.
   Vor jedem Zugriff den aktuellen Stand lesen, damit Plattform und Workspace
   auch in verschiedenen Tabs keine jeweils fremden Einstellungen ueberschreiben. */
(function (B) {
  'use strict';

  const KEY = 'boilerRoom';
  const DEFAULTS = {
    favorites: [],
    workspaceRecentApps: [],
    workspaceToolbarBottom: false,
    favoriteOrder: [],
    launcherTypeOrder: ['game', 'tool', 'misc'],
    launcherTypeClosed: [],
    libraryView: 'cards',
    lastSection: 'discover',
    workspace: { selected: 'favorites', app: null, lastApps: {}, sidebarCollapsed: false }
  };
  const OLD_KEYS = [
    'boilerRoomFavorites', 'boilerRoomFavOrder', 'boilerRoomView', 'boilerRoomLauncherView'
  ];
  const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const validWorkspace = value => value === 'favorites' || (typeof value === 'string' && value.startsWith('group:') && value.length > 6);
  const strings = value => Array.isArray(value) ? value.filter(x => typeof x === 'string') : [];
  const uniqueStrings = value => [...new Set(strings(value).filter(x => x.trim()))];

  function snapshotValue(value) {
    return value !== null && typeof value === 'object' ? JSON.parse(JSON.stringify(value)) : value;
  }

  function normalizeWorkspace(value) {
    const w = isObject(value) ? value : {};
    const lastApps = isObject(w.lastApps) ? Object.fromEntries(Object.entries(w.lastApps)
      .filter(([key, label]) => validWorkspace(key) && typeof label === 'string')) : {};
    return {
      selected: validWorkspace(w.selected) ? w.selected : 'favorites',
      app: typeof w.app === 'string' ? w.app : null,
      lastApps,
      sidebarCollapsed: w.sidebarCollapsed === true
    };
  }

  function normalize(data) {
    const raw = isObject(data) ? data : {};
    // Andere Felder im gemeinsamen Objekt beibehalten; veralteten Toggle entsorgen.
    const result = {
      ...raw,
      favorites: strings(raw.favorites),
      workspaceRecentApps: uniqueStrings(raw.workspaceRecentApps),
      workspaceToolbarBottom: raw.workspaceToolbarBottom === true,
      favoriteOrder: strings(raw.favoriteOrder),
      launcherTypeOrder: Array.isArray(raw.launcherTypeOrder) ? uniqueStrings(raw.launcherTypeOrder) : DEFAULTS.launcherTypeOrder.slice(),
      launcherTypeClosed: uniqueStrings(raw.launcherTypeClosed),
      libraryView: ['cards', 'list', 'icons'].includes(raw.libraryView) ? raw.libraryView : DEFAULTS.libraryView,
      lastSection: ['discover', 'library', 'launcher', 'about'].includes(raw.lastSection) ? raw.lastSection : DEFAULTS.lastSection,
      workspace: normalizeWorkspace(raw.workspace)
    };
    delete result.launcherView;
    return result;
  }

  let values = normalize({});
  let available = false;

  function read() {
    const raw = localStorage.getItem(KEY);
    if (raw === null) return normalize({});
    try { return normalize(JSON.parse(raw)); }
    catch (e) {
      console.warn('[Boiler] Ungueltige gespeicherte Einstellungen; Standardwerte werden verwendet:', e);
      return normalize({});
    }
  }

  function refresh() {
    if (!available) return;
    try { values = read(); }
    catch (e) {
      available = false;
      console.warn('[Boiler] localStorage nicht verfuegbar:', e);
    }
  }

  function write() {
    if (!available) return;
    try { localStorage.setItem(KEY, JSON.stringify(values)); }
    catch (e) {
      available = false;
      console.warn('[Boiler] Einstellungen konnten nicht gespeichert werden:', e);
    }
  }

  function init() {
    try {
      values = read();
      OLD_KEYS.forEach(key => localStorage.removeItem(key));
      available = true;
      write();
    } catch (e) {
      available = false;
      console.warn('[Boiler] localStorage nicht verfuegbar:', e);
    }
  }

  function get(name) {
    refresh();
    return snapshotValue(values[name]);
  }

  function set(name, value) {
    if (!Object.prototype.hasOwnProperty.call(DEFAULTS, name)) {
      throw new Error('Unbekannte Boiler-Room-Einstellung: ' + name);
    }
    refresh();
    values[name] = name === 'workspace' ? normalizeWorkspace(value) : snapshotValue(value);
    write();
  }

  B.storage = { init, get, set, isAvailable: () => available };
})(window.BoilerRoom);
