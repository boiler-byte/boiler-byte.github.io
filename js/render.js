/* Bibliothek: alle Apps einzeln; Launcher: ausschliesslich sortierte Favoriten. */
(function (B) {
  'use strict';

  const s = B.state;
  const repos = B.data.repos;
  const repoGrid = B.dom.repoGrid;
  const searchRelevance = (repo, query) => B.search.searchRelevance(repo, query);

  function getFilteredRepos() {
    const searching = Boolean(s.activeSearch.trim());
    const filtered = repos
      .map((repo, index) => ({
        repo,
        index,
        relevance: searching ? searchRelevance(repo, s.activeSearch) : 0
      }))
      .filter(({ repo, relevance }) =>
        (s.activeFilter === 'all' || repo.type === s.activeFilter) &&
        (!searching || relevance >= 0)
      );

    if (searching) {
      // Relevanz vor Sortierung, bei Gleichstand die urspruengliche Reihenfolge.
      filtered.sort((a, b) => b.relevance - a.relevance || a.index - b.index);
    } else if (s.librarySort !== 'original') {
      const collator = new Intl.Collator('de', { numeric: true, sensitivity: 'base' });
      filtered.sort((a, b) => {
        if (s.librarySort === 'name') return collator.compare(a.repo.label, b.repo.label) || a.index - b.index;
        if (s.librarySort === 'type') return collator.compare(a.repo.type, b.repo.type) || collator.compare(a.repo.label, b.repo.label);
        if (s.librarySort === 'newest') return (Number(b.repo.year) || 0) - (Number(a.repo.year) || 0) || a.index - b.index;
        return a.index - b.index;
      });
    }
    return filtered.map(({ repo }) => repo);
  }

  let observer = null;
  function observeCards() {
    if (observer) observer.disconnect();
    if (!('IntersectionObserver' in window)) {
      repoGrid.querySelectorAll('.card').forEach(card => card.classList.add('visible'));
      return;
    }
    observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });
    repoGrid.querySelectorAll('.card:not(.visible)').forEach(card => observer.observe(card));
  }

  function renderRepos() {
    if (observer) { observer.disconnect(); observer = null; }
    repoGrid.replaceChildren();
    const filtered = getFilteredRepos();
    document.getElementById('librarySummary').textContent = `${filtered.length} von ${repos.length} Apps`;

    if (!filtered.length) {
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      empty.textContent = '— Keine Apps gefunden —';
      repoGrid.appendChild(empty);
      return;
    }

    const searching = Boolean(s.activeSearch.trim());
    filtered.forEach((repo, i) => {
      // Gruppenattribute bleiben erhalten, werden hier aber nicht zusammengefasst.
      const card = B.cards.createCard(repo, i);
      if (searching) card.classList.remove('featured', 'featured-wide', 'featured-tall');
      repoGrid.appendChild(card);
    });

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion || s.activeView !== 'cards') {
      repoGrid.querySelectorAll('.card').forEach(card => card.classList.add('visible'));
    } else {
      requestAnimationFrame(() => {
        repoGrid.querySelectorAll('.card').forEach((card, idx) => {
          setTimeout(() => card.classList.add('visible'), Math.min(idx, 12) * 40);
        });
      });
      observeCards();
    }
  }

  function renderLauncher() {
    const grid = B.dom.launcherGrid;
    const addWrap = document.getElementById('launcherAddWrap');
    const actions = document.querySelector('.launcher-actions');
    B.drag.cancelIconDrag();
    // Den einen +App-Button vor dem Leeren des Grids zurueckholen.
    // So bleiben Dropdown und alle Event-Handler beim Ansichtswechsel erhalten.
    if (addWrap && actions && addWrap.parentElement !== actions) actions.appendChild(addWrap);
    addWrap?.classList.remove('is-empty');
    grid.replaceChildren();
    const appView = s.launcherView === 'apps';
    grid.classList.toggle('view-list', !appView);
    grid.classList.toggle('launcher-app-grid', appView);
    B.launcher.syncViewControls();
    B.launcher.refreshAddMenu();
    const order = B.favorites.getOrder();
    const entries = repos.filter(repo => B.favorites.isFavorite(repo.label))
      .sort((a, b) => order.indexOf(a.label) - order.indexOf(b.label));

    if (!entries.length) {
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      const message = document.createElement('p');
      message.textContent = 'Noch keine Favoriten. Markiere Apps in Entdecken oder der Bibliothek mit ★.';
      empty.appendChild(message);
      // Der bestehende Dropdown-Button steht direkt unter dem Leerzustandstext.
      // Keine zweite Schaltflaeche, keine duplizierten IDs oder Listener.
      if (addWrap) {
        addWrap.classList.add('is-empty');
        empty.appendChild(addWrap);
      }
      grid.appendChild(empty);
      return;
    }
    entries.forEach((repo, i) => {
      if (appView) {
        grid.appendChild(B.launcher.makeIcon(repo));
        return;
      }
      const card = B.cards.createCard(repo, i, { favoriteVariant: 'trash' });
      card.classList.add('visible');
      // Der Entfernen-Button kommt ganz rechts hinter den App-Namen.
      const image = card.querySelector('.card-image');
      const favorite = image?.querySelector('.fav-btn');
      if (favorite) card.appendChild(favorite);
      image?.remove();
      card.querySelector('.card-tooltip')?.remove();
      card.querySelector('.card-meta')?.remove();
      grid.appendChild(card);
    });
    if (!appView) B.drag.enableList();
  }

  B.renderer = { getFilteredRepos, renderRepos, renderLauncher };
})(window.BoilerRoom);
