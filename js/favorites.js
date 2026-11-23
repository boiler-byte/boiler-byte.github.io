/* Persistenz, Bereinigung und Reihenfolge der Favoriten. */
(function (B) {
  'use strict';

  const repos = B.data.repos;
  const updateFavCount = () => B.filters.updateFavCount();

  let favorites = new Set();
  let favOrder = [];

  function loadFavorites() {
    const arr = B.storage.get('favorites');
    if (Array.isArray(arr)) {
      favorites = new Set(arr.filter(x => typeof x === 'string'));
    }
  }

  function saveFavorites() {
    B.storage.set('favorites', Array.from(favorites));
  }

  function loadFavOrder() {
    const arr = B.storage.get('favoriteOrder');
    if (Array.isArray(arr)) favOrder = arr.filter(x => typeof x === 'string');
  }

  function saveFavOrder() {
    B.storage.set('favoriteOrder', favOrder);
  }

  // Reihenfolge mit aktuellen Favoriten abgleichen:
  // entfernte raus, neue hinten anfügen.
  function syncFavOrder() {
    favOrder = favOrder.filter(l => favorites.has(l));
    favorites.forEach(l => { if (!favOrder.includes(l)) favOrder.push(l); });
    saveFavOrder();
  }

  // Entfernt Labels aus Favoriten & Reihenfolge, die es in `repos` nicht (mehr) gibt.
  // Gibt zurück, ob etwas geändert wurde.
  function sanitizeFavorites() {
    const validLabels = new Set(repos.map(r => r.label));
    let changed = false;

    // Favoriten säubern
    const cleanFavs = new Set();
    favorites.forEach(label => {
      if (validLabels.has(label)) {
        cleanFavs.add(label);
      } else {
        changed = true;
      }
    });
    if (changed) favorites = cleanFavs;

    // Reihenfolge säubern
    const beforeOrder = favOrder.length;
    favOrder = favOrder.filter(label => validLabels.has(label));
    if (favOrder.length !== beforeOrder) changed = true;

    if (changed) {
      saveFavorites();
      saveFavOrder();
      updateFavCount();
      console.info('[Boiler] Ungültige Favoriten-Labels entfernt.');
    }
    return changed;
  }

  function isFavorite(label) {
    return favorites.has(label);
  }

  function toggleFavorite(label) {
    if (favorites.has(label)) {
      favorites.delete(label);
    } else {
      favorites.add(label);
    }
    const added = favorites.has(label);
    saveFavorites();
    syncFavOrder();
    updateFavCount();
    if (B.toast) B.toast.showFavorite(label, added);
    return added;
  }

  B.favorites = {
    load: loadFavorites,
    loadOrder: loadFavOrder,
    sanitize: sanitizeFavorites,
    syncOrder: syncFavOrder,
    isFavorite,
    toggleFavorite,
    count: () => favorites.size,
    getOrder: () => favOrder.slice(),
    setOrder: order => { favOrder = order.slice(); saveFavOrder(); },
    isStorageAvailable: () => B.storage.isAvailable()
  };
})(window.BoilerRoom);
