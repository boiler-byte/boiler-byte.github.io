/* Relevanzsuche sowie Eingabe, Debounce und Reset. */
(function (B) {
  'use strict';

  const s = B.state;
  const { normalize: normalizeSearchText, score: searchRelevance } = B.searchRelevance;
  const searchInput = B.dom.searchInput;
  const searchWrap = B.dom.searchWrap;
  const searchClear = B.dom.searchClear;
  const repoGrid = B.dom.repoGrid;
  const renderRepos = () => B.renderer.renderRepos();
  const syncActiveFilterChip = () => B.filters.syncActive();

  // ---------- SUCH-LOGIK ----------
  let searchDebounceTimer = null;

  function applySearch() {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = null;
    s.activeSearch = searchInput.value.trim();
    searchWrap.classList.toggle('has-value', searchInput.value.length > 0);

    // Bei aktiver Suche auf "Alle" wechseln.
    if (s.activeSearch && s.activeFilter !== 'all') {
      s.activeFilter = 'all';
      syncActiveFilterChip();
    }
    repoGrid.style.opacity = '1';
    renderRepos();
  }

  function resetSearch(restoreFocus = false) {
    // Verhindert, dass eine noch ausstehende Debounce-Suche
    // die gerade zurückgesetzte Suche erneut übernimmt.
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = null;
    searchInput.value = '';
    s.activeSearch = '';
    searchWrap.classList.remove('has-value');
    repoGrid.style.opacity = '1';
    renderRepos();
    if (restoreFocus) searchInput.focus();
    else searchInput.blur();
  }

  function setupSearch() {
    searchInput.addEventListener('input', () => {
      searchWrap.classList.toggle('has-value', searchInput.value.length > 0);
      clearTimeout(searchDebounceTimer);
      searchDebounceTimer = setTimeout(applySearch, 180);
    });

    searchClear.addEventListener('click', () => resetSearch(true));

    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        // Suche sofort übernehmen und die Bildschirmtastatur schließen.
        applySearch();
        searchInput.blur();
      } else if (e.key === 'Escape' && searchInput.value) {
        e.preventDefault();
        resetSearch(true);
      }
    });

    // iOS/Safari kann die Suchtaste über das native "search"-Event
    // melden, auch ohne ein zuverlässiges Enter-keydown.
    searchInput.addEventListener('search', () => {
      applySearch();
      searchInput.blur();
    });
  }

  B.search = { normalize: normalizeSearchText, searchRelevance, applySearch, resetSearch, setup: setupSearch };
})(window.BoilerRoom);
