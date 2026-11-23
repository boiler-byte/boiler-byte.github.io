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
      // Neutrale, skalierbare Filter-Icons statt farbiger Emoji.
      const iconPaths = {
        game: '<path d="M6.1 9h11.8a3 3 0 0 1 2.9 2.4l1 5.4a2.2 2.2 0 0 1-3.5 2.1l-2.5-2H8.2l-2.5 2a2.2 2.2 0 0 1-3.5-2.1l1-5.4A3 3 0 0 1 6.1 9Z"/><path d="M7 11.6v4.2M4.9 13.7h4.2"/><circle cx="16.8" cy="12.7" r=".8"/><circle cx="19" cy="14.8" r=".8"/>',
        tool: '<path d="M14.7 6.3a5 5 0 0 0-6.5 6.5l-5.3 5.3a2 2 0 1 0 2.8 2.8l5.3-5.3a5 5 0 0 0 6.5-6.5l-3.4 3.4-3.1-3.1 3.7-3.1Z"/>',
        misc: '<path d="M4 4h5v2a2 2 0 1 0 4 0V4h7v6h-2a2 2 0 1 0 0 4h2v6h-6v-2a2 2 0 1 0-4 0v2H4v-6h2a2 2 0 1 0 0-4H4V4Z"/>'
      };
      if (Object.prototype.hasOwnProperty.call(iconPaths, key)) {
        const symbol = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        symbol.setAttribute('viewBox', '0 0 24 24');
        symbol.setAttribute('aria-hidden', 'true');
        symbol.setAttribute('focusable', 'false');
        symbol.classList.add('filter-type-icon');
        symbol.innerHTML = iconPaths[key];
        chip.appendChild(symbol);
        chip.classList.add('chip-type');
      }
      const text = document.createElement('span');
      text.className = 'text';
      text.textContent = type.label || key;
      chip.appendChild(text);
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
