/* Bibliothek: Apps und Workspace-Gruppen; Launcher: sortierte Favoriten. */
(function (B) {
  'use strict';

  const s = B.state;
  const repos = B.data.repos;
  const repoGrid = B.dom.repoGrid;
  const searchRelevance = (repo, query) => B.search.searchRelevance(repo, query);

  function getFilteredEntries(includeGroups = true) {
    const searching = Boolean(s.activeSearch.trim());
    const groups = includeGroups ? [...B.groups.catalog.values()] : [];
    const entries = [
      ...groups.map(group => ({ group, repo: { label: group.label, type: 'group',
        year: Math.max(0, ...group.repos.map(repo => Number(repo.year) || 0)),
        description: group.description || '', tags: Array.isArray(group.tags) ? group.tags : [] } })),
      ...repos.map(repo => ({ repo }))
    ];
    const filtered = entries.map((entry, index) => {
      const { repo, group } = entry;
      let relevance = searching ? searchRelevance(repo, s.activeSearch) : 0;
      if (group && searching) {
        // Gruppenname und eigene Metadaten zuerst; Mitgliedertreffer ergaenzen die Suche.
        for (const member of group.repos) {
          const score = searchRelevance(member, s.activeSearch);
          if (score >= 0) relevance = Math.max(relevance, Math.min(450, score));
        }
      }
      return { ...entry, index, relevance };
    }).filter(({ repo, group, relevance }) =>
      (s.activeFilter === 'all' || (group ? group.repos.some(member => member.type === s.activeFilter) : repo.type === s.activeFilter)) &&
      (!searching || relevance >= 0));

    if (searching) {
      filtered.sort((a, b) => b.relevance - a.relevance || a.index - b.index);
    } else if (s.librarySort === 'original') {
      // Kuratierte App-Reihenfolge beibehalten; jede Gruppe genau einmal
      // unmittelbar nach ihrem ersten sichtbaren Mitglied einfuegen.
      const apps = filtered.filter(entry => !entry.group);
      const firstByRepo = new Map(apps.map(entry => [entry.repo, []]));
      const unplaced = [];
      for (const entry of filtered) {
        if (!entry.group) continue;
        const members = new Set(entry.group.repos);
        const first = apps.find(app => members.has(app.repo));
        if (first) firstByRepo.get(first.repo).push(entry);
        else unplaced.push(entry);
      }
      return [...apps.flatMap(entry => [entry, ...firstByRepo.get(entry.repo)]), ...unplaced];
    } else {
      const collator = new Intl.Collator('de', { numeric: true, sensitivity: 'base' });
      filtered.sort((a, b) => {
        if (s.librarySort === 'name') return collator.compare(a.repo.label, b.repo.label) || a.index - b.index;
        if (s.librarySort === 'type') return collator.compare(a.repo.type, b.repo.type) || collator.compare(a.repo.label, b.repo.label);
        if (s.librarySort === 'newest') return (Number(b.repo.year) || 0) - (Number(a.repo.year) || 0) || a.index - b.index;
        return a.index - b.index;
      });
    }
    return filtered;
  }

  function getFilteredRepos() {
    return getFilteredEntries(false).map(({ repo }) => repo);
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
    const filtered = getFilteredEntries();
    const groupCount = filtered.filter(entry => entry.group).length;
    document.getElementById('librarySummary').textContent = `${filtered.length - groupCount} von ${repos.length} Apps · ${groupCount} von ${B.groups.catalog.size} Gruppen`;

    if (!filtered.length) {
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      empty.textContent = '— Keine Apps oder Gruppen gefunden —';
      repoGrid.appendChild(empty);
      return;
    }

    const searching = Boolean(s.activeSearch.trim());
    filtered.forEach(({ repo, group }, i) => {
      const card = group ? B.groups.createGroupCard(group, i) : B.cards.createCard(repo, i);
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
    B.drag.cancelIconDrag();
    B.launcher.closeInfo();
    // Alle drei Bedienelemente bleiben in einer gemeinsamen Aktionsleiste.
    addWrap?.classList.remove('is-empty');
    grid.replaceChildren();
    const appView = s.launcherView === 'apps';
    grid.classList.toggle('view-list', !appView);
    grid.classList.toggle('launcher-app-grid', appView);
    B.launcher.refreshAddMenu();
    const order = B.favorites.getOrder();
    const entries = repos.filter(repo => B.favorites.isFavorite(repo.label))
      .sort((a, b) => order.indexOf(a.label) - order.indexOf(b.label));

    const groups = new Map();
    entries.forEach(repo => {
      const type = (typeof repo.type === 'string' && repo.type.trim()) ? repo.type : 'misc';
      if (!groups.has(type)) groups.set(type, []);
      groups.get(type).push(repo);
    });
    // Typgruppen nur ab 9 Launcher-Apps UND mindestens 2 belegten Typen.
    // Die gespeicherten Gruppen-Einstellungen bleiben unterhalb der Schwelle erhalten.
    const grouped = entries.length >= 9 && groups.size >= 2;
    grid.classList.toggle('launcher-ungrouped', !grouped);
    B.launcher.syncViewControls();

    if (!entries.length) {
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      const message = document.createElement('p');
      message.textContent = 'Noch keine Favoriten. Markiere Apps in Entdecken oder der Bibliothek mit ★.';
      empty.appendChild(message);
      addWrap?.classList.add('is-empty');
      grid.appendChild(empty);
      return;
    }

    let index = 0;
    function appendApp(repo, container) {
      if (appView) {
        container.appendChild(B.launcher.makeIcon(repo));
        return;
      }
      const card = B.cards.createCard(repo, index++, { favoriteVariant: 'trash' });
      card.classList.add('visible');
      // Der Entfernen-Button kommt ganz rechts hinter den App-Namen.
      const image = card.querySelector('.card-image');
      const favorite = image?.querySelector('.fav-btn');
      if (favorite) card.appendChild(favorite);
      image?.remove();
      card.querySelector('.card-tooltip')?.remove();
      card.querySelector('.card-meta')?.remove();
      container.appendChild(card);
    }

    if (grouped) {
      B.launcher.getTypeOrder([...groups.keys()]).forEach(type => {
        const groupRepos = groups.get(type);
        if (!groupRepos?.length) return;
        const { section, items } = B.launcher.makeTypeGroup(type, groupRepos.length, appView);
        groupRepos.forEach(repo => appendApp(repo, items));
        grid.appendChild(section);
      });
    } else {
      // Ohne Gruppen bleibt die individuelle Favoriten-Reihenfolge sichtbar.
      entries.forEach(repo => appendApp(repo, grid));
    }
    if (!appView) B.drag.enableList();
  }

  B.renderer = { getFilteredRepos, renderRepos, renderLauncher };
})(window.BoilerRoom);
