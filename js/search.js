/* Relevanzsuche sowie Eingabe, Debounce und Reset. */
(function (B) {
  'use strict';

  const s = B.state;
  const types = B.data.types;
  const STATUS = B.data.STATUS;
  const searchInput = B.dom.searchInput;
  const searchWrap = B.dom.searchWrap;
  const searchClear = B.dom.searchClear;
  const repoGrid = B.dom.repoGrid;
  const renderRepos = () => B.renderer.renderRepos();
  const syncActiveFilterChip = () => B.filters.syncActive();

  // ---------- SUCHE MIT RELEVANZBEWERTUNG ----------
  // Normalisierung macht die Suche unabhängig von Groß-/Kleinschreibung,
  // Umlauten und mehrfachen Leerzeichen.
  function normalizeSearchText(value) {
    return String(value ?? '')
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLocaleLowerCase('de')
      .replace(/ß/g, 'ss')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // Höhere Werte bedeuten relevantere Treffer; -1 bedeutet kein Treffer.
  // Titel (exakt > Beginn > Wortbeginn > Teilstring) stehen immer vor
  // Tags, Beschreibung und sonstigen Metadaten.
  function searchRelevance(repo, query) {
    const q = normalizeSearchText(query);
    if (!q) return 0;

    const title = normalizeSearchText(repo.label);
    const description = normalizeSearchText(repo.description);
    const tags = (repo.tags || []).map(normalizeSearchText);
    const type = normalizeSearchText(types[repo.type]?.label || repo.type);
    const status = normalizeSearchText(repo.status ? (STATUS[repo.status]?.label || repo.status) : '');
    const year = normalizeSearchText(repo.year);

    if (title === q) return 1000;
    if (title.startsWith(q)) return 950;
    if (title.split(/[\s._/-]+/).some(word => word.startsWith(q))) return 900;
    if (title.includes(q)) return 850;

    if (tags.some(tag => tag === q)) return 700;
    if (tags.some(tag => tag.startsWith(q))) return 650;
    if (tags.some(tag => tag.includes(q))) return 600;

    if (description.startsWith(q)) return 550;
    if (description.includes(q)) return 500;

    if (type === q) return 400;
    if (type.includes(q)) return 350;
    if (status === q || year === q) return 300;
    if (status.includes(q) || year.includes(q)) return 250;

    // Auch mehrere Suchwörter dürfen über verschiedene Felder verteilt sein.
    // Es müssen aber alle Wörter vorkommen (keine beliebigen Teiltreffer).
    const combined = [title, description, ...tags, type, status, year].join(' ');
    const terms = q.split(' ');
    if (terms.length > 1 && terms.every(term => combined.includes(term))) {
      return 100 + terms.filter(term => title.includes(term)).length * 10;
    }
    return -1;
  }

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
