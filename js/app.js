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
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && B.state.section === 'library') B.focus.refresh();
    });
  }
  B.init = init;
  init();
})(window.BoilerRoom);
