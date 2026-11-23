/* Namespace, DOM-Knoten und fluechtiger UI-Zustand. */
(function (global) {
  'use strict';
  const B = global.BoilerRoom = global.BoilerRoom || {};

  B.state = {
    activeFilter: 'all',
    activeSearch: '',
    activeView: 'cards',
    section: 'discover',
    librarySort: 'original',
    launcherView: 'apps'
  };
  B.dom = {
    filterChips: document.getElementById('filterChips'),
    repoGrid: document.getElementById('repoGrid'),
    searchInput: document.getElementById('searchInput'),
    searchWrap: document.getElementById('searchWrap'),
    searchClear: document.getElementById('searchClear'),
    viewSelect: document.getElementById('viewSelect'),
    discoverPage: document.getElementById('discoverPage'),
    libraryPage: document.getElementById('libraryPage'),
    launcherPage: document.getElementById('launcherPage'),
    aboutPage: document.getElementById('aboutPage'),
    launcherGrid: document.getElementById('launcherGrid')
  };
  B.historyKeys = {
    group: '__boilerRoomRepoGroup',
    navigation: '__boilerRoomNavigation'
  };
})(window);
