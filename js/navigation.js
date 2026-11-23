/* Bestehende Browser-Zurueck-Sonderregel fuer die Bibliothek ohne Gruppen. */
(function (B) {
  'use strict';
  const s = B.state;
  const NAV_HISTORY_KEY = B.historyKeys.navigation;
  const GROUP_HISTORY_KEY = B.historyKeys.group;
  const VIEW_BACK_CYCLE = ['cards', 'list', 'icons'];
  const searchInput = B.dom.searchInput;

  function initializeNavigationHistory() {
    try {
      const current = history.state && typeof history.state === 'object' ? history.state : {};
      const navigation = current[NAV_HISTORY_KEY];
      if (navigation?.kind === 'active') return;
      if (navigation?.kind === 'base') {
        history.pushState({ ...current, [NAV_HISTORY_KEY]: { kind: 'active' } }, '');
        return;
      }
      const base = { ...current };
      delete base[GROUP_HISTORY_KEY]; // Veraltete Gruppen-History nicht wiederherstellen.
      history.replaceState({ ...base, [NAV_HISTORY_KEY]: { kind: 'base' } }, '');
      history.pushState({ ...base, [NAV_HISTORY_KEY]: { kind: 'active' } }, '');
    } catch (e) {
      console.warn('[Boiler] Browser-History konnte nicht initialisiert werden:', e);
    }
  }

  function handleHistoryBack(state) {
    if (state?.[NAV_HISTORY_KEY]?.kind !== 'base') return;
    if (s.section === 'library') {
      if (searchInput.value || s.activeSearch) {
        B.search.resetSearch();
      } else if (s.activeFilter !== 'all') {
        s.activeFilter = 'all';
        B.filters.syncActive();
        B.renderer.renderRepos();
      } else {
        const i = VIEW_BACK_CYCLE.indexOf(s.activeView);
        B.views.setView(VIEW_BACK_CYCLE[(i + 1) % VIEW_BACK_CYCLE.length], true);
      }
    }
    setTimeout(() => {
      if (history.state?.[NAV_HISTORY_KEY]?.kind === 'base') {
        try { history.forward(); }
        catch (e) { console.warn('[Boiler] History-Anker konnte nicht wiederhergestellt werden:', e); }
      }
    }, 0);
  }

  window.addEventListener('popstate', e => handleHistoryBack(e.state));
  B.navigation = { initialize: initializeNavigationHistory, handleHistoryBack };
})(window.BoilerRoom);
