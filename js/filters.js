/* Filter-Chips fuer die Bibliothek; Favoriten werden nur im Launcher gesammelt. */
(function (B) {
  'use strict';

  const s = B.state;
  const types = B.data.types;
  const filterChips = B.dom.filterChips;
  const repoGrid = B.dom.repoGrid;

  function renderFilterChips() {
    filterChips.replaceChildren();
    const allChip = document.createElement('button');
    allChip.type = 'button';
    allChip.className = 'chip active';
    allChip.textContent = 'Alle';
    allChip.dataset.type = 'all';
    allChip.setAttribute('aria-pressed', 'true');
    filterChips.appendChild(allChip);

    Object.entries(types).forEach(([key, type]) => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'chip';
      const symbol = document.createElement('span');
      symbol.textContent = type.symbol || '';
      symbol.setAttribute('aria-hidden', 'true');
      const text = document.createElement('span');
      text.className = 'text';
      text.textContent = type.label || key;
      chip.append(symbol, document.createTextNode(' '), text);
      chip.dataset.type = key;
      chip.setAttribute('aria-label', type.label || key);
      chip.setAttribute('aria-pressed', 'false');
      filterChips.appendChild(chip);
    });
  }

  // Das API bleibt kompatibel; statt eines Zaehlers leuchtet der Tab ohne Favoriten.
  function updateFavCount() {
    const tab = document.querySelector('.platform-tab[data-section="launcher"]');
    if (!tab) return;
    const empty = B.favorites.count() === 0;
    tab.classList.toggle('needs-favorites', empty);
    tab.title = empty ? 'Noch keine Apps im Launcher – hier kannst du welche hinzufügen' : '';
  }

  function syncActiveFilterChip() {
    filterChips.querySelectorAll('.chip').forEach(chip => {
      const selected = chip.dataset.type === s.activeFilter;
      chip.classList.toggle('active', selected);
      chip.setAttribute('aria-pressed', String(selected));
    });
  }

  function setupFilters() {
    filterChips.addEventListener('click', e => {
      const chip = e.target.closest('.chip');
      if (!chip || !filterChips.contains(chip)) return;
      s.activeFilter = chip.dataset.type;
      syncActiveFilterChip();
      repoGrid.style.opacity = '0.3';
      setTimeout(() => {
        B.renderer.renderRepos();
        repoGrid.style.opacity = '1';
      }, 120);
    });
  }

  B.filters = {
    renderChips: renderFilterChips,
    updateFavCount,
    syncActive: syncActiveFilterChip,
    setup: setupFilters
  };
})(window.BoilerRoom);
