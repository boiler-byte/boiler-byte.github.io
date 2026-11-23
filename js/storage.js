/* Zentrale Persistenz: genau ein JSON-Eintrag in localStorage.boilerRoom.
   Die bisherigen Einzel-Schluessel werden ohne Datenuebernahme entfernt. */
(function (B) {
  'use strict';

  const KEY = 'boilerRoom';
  const DEFAULTS = {
    favorites: [],
    favoriteOrder: [],
    libraryView: 'cards',
    launcherView: 'apps',
    lastSection: 'discover'
  };
  const OLD_KEYS = [
    'boilerRoomFavorites',
    'boilerRoomFavOrder',
    'boilerRoomView',
    'boilerRoomLauncherView'
  ];

  let values = { ...DEFAULTS, favorites: [], favoriteOrder: [] };
  let available = false;

  function snapshotValue(value) {
    return Array.isArray(value) ? value.slice() : value;
  }

  function write() {
    if (!available) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(values));
    } catch (e) {
      console.warn('[Boiler] Einstellungen konnten nicht gespeichert werden:', e);
    }
  }

  function init() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        try {
          const data = JSON.parse(raw);
          if (data && typeof data === 'object' && !Array.isArray(data)) {
            if (Array.isArray(data.favorites)) {
              values.favorites = data.favorites.filter(x => typeof x === 'string');
            }
            if (Array.isArray(data.favoriteOrder)) {
              values.favoriteOrder = data.favoriteOrder.filter(x => typeof x === 'string');
            }
            if (['cards', 'list', 'icons'].includes(data.libraryView)) {
              values.libraryView = data.libraryView;
            }
            if (['list', 'apps'].includes(data.launcherView)) {
              values.launcherView = data.launcherView;
            }
            if (['discover', 'library', 'launcher', 'about'].includes(data.lastSection)) {
              values.lastSection = data.lastSection;
            }
          }
        } catch (e) {
          console.warn('[Boiler] Ungueltige gespeicherte Einstellungen; Standardwerte werden verwendet:', e);
        }
      }
      // Keine Migration: alte, nicht mehr verwendete Eintraege entsorgen.
      OLD_KEYS.forEach(key => localStorage.removeItem(key));
      available = true;
      write();
    } catch (e) {
      console.warn('[Boiler] localStorage nicht verfuegbar:', e);
      // Bei eingeschraenktem Storage bleiben die Werte bis zum Reload im Speicher.
    }
  }

  function get(name) {
    return snapshotValue(values[name]);
  }

  function set(name, value) {
    if (!Object.prototype.hasOwnProperty.call(DEFAULTS, name)) {
      throw new Error('Unbekannte Boiler-Room-Einstellung: ' + name);
    }
    values[name] = snapshotValue(value);
    write();
  }

  B.storage = { init, get, set, isAvailable: () => available };
})(window.BoilerRoom);
