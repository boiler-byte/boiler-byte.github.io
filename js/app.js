/* Bootstrapping fuer klassische Skripte: keine ES-Module. */
(function (B) {
  'use strict';
  function init() {
    B.storage.init();
    B.favorites.load();
    B.favorites.loadOrder();
    B.favorites.sanitize();
    B.favorites.syncOrder();
    B.views.load();
    B.launcher.loadView();
    B.filters.renderChips();
    B.views.applyClasses();
    B.platform.init();
    B.launcher.setup();
    B.filters.setup();
    B.search.setup();
    B.views.setup();
    B.drag.setup();
    B.navigation.initialize();
    function refreshExternalFavorites() {
      const before = JSON.stringify(B.favorites.getOrder());
      B.favorites.load();
      B.favorites.loadOrder();
      if (before === JSON.stringify(B.favorites.getOrder())) return;
      B.filters.updateFavCount();
      if (B.state.section === 'launcher') B.renderer.renderLauncher();
      document.querySelectorAll('.card[data-label] .fav-btn').forEach(button => {
        const label = button.closest('.card').dataset.label;
        B.cards.syncFavoriteButton(button, B.favorites.isFavorite(label), label);
      });
    }
    window.addEventListener('storage', event => {
      if (event.key === 'boilerRoom' || event.key === null) refreshExternalFavorites();
    });
    window.addEventListener('pageshow', refreshExternalFavorites);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState !== 'visible') return;
      refreshExternalFavorites();
      if (B.state.section === 'library') B.focus.refresh();
    });
  }
  B.init = init;
  init();
})(window.BoilerRoom);
