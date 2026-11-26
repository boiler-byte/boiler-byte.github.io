/* Zwei unabhaengige Launcher-Ansichten, eine gemeinsame Favoriten-Reihenfolge. */
(function (B) {
  'use strict';

  const modes = new Set(['list', 'apps']);
  const manageButton = document.getElementById('launcherManageButton');
  const workspaceButton = document.getElementById('launcherWorkspaceButton');
  const manageIcon = manageButton.querySelector('svg path');
  const settingsIconPath = manageIcon.getAttribute('d');
  const hint = document.getElementById('launcherHint');
  const infoWrap = document.getElementById('launcherInfoWrap');
  const infoButton = document.getElementById('launcherInfoButton');
  let infoPinned = false;
  let infoHovered = false;
  let infoFocused = false;

  function syncInfo() {
    const open = infoPinned || infoHovered || infoFocused;
    hint.hidden = !open;
    infoButton.setAttribute('aria-expanded', String(open));
  }

  function closeInfo() {
    infoPinned = infoHovered = infoFocused = false;
    syncInfo();
  }

  function setupInfo() {
    infoWrap.addEventListener('pointerenter', e => {
      if (e.pointerType !== 'mouse' || !addMenu.hidden) return;
      infoHovered = true;
      syncInfo();
    });
    infoWrap.addEventListener('pointerleave', e => {
      if (e.pointerType !== 'mouse') return;
      infoHovered = false;
      syncInfo();
    });
    infoButton.addEventListener('focus', () => {
      infoFocused = infoButton.matches(':focus-visible');
      syncInfo();
    });
    infoButton.addEventListener('blur', closeInfo);
    infoButton.addEventListener('click', () => {
      if (infoPinned) { closeInfo(); return; }
      closeAddMenu();
      infoPinned = true;
      syncInfo();
    });
    document.addEventListener('pointerdown', e => {
      if (!infoWrap.contains(e.target)) closeInfo();
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && !hint.hidden) {
        e.preventDefault();
        closeInfo();
      }
    });
  }

  function syncViewControls() {
    const managing = B.state.launcherView === 'list';
    manageButton.classList.toggle('is-active', managing);
    manageButton.setAttribute('aria-pressed', String(managing));
    manageButton.querySelector('span').textContent = managing ? 'Zurück' : 'Verwalten';
    manageButton.setAttribute('aria-label', managing ? 'Zurück zur App-Ansicht' : 'Verwalten');
    manageIcon.setAttribute('d', managing ? 'M19 12H5m7-7-7 7 7 7' : settingsIconPath);
    if (managing && !addMenu.hidden) closeAddMenu();
    addButton.hidden = managing;
    workspaceButton.hidden = managing;
    manageButton.title = managing ? 'Zur App-Ansicht wechseln' : 'Launcher verwalten';
    if (hint) {
      const ungrouped = B.dom.launcherGrid.classList.contains('launcher-ungrouped');
      hint.textContent = ungrouped
        ? (B.state.launcherView === 'apps'
          ? 'App-Symbole gedrückt halten und verschieben, um die Reihenfolge anzupassen.'
          : 'App-Zeilen ziehen (Touch: am Punktgriff), um die Reihenfolge anzupassen.')
        : (B.state.launcherView === 'apps'
          ? 'Gruppenüberschriften ziehen (Touch: Punktgriff) · Apps am Symbol sortieren · Alt + Pfeiltasten.'
          : 'Gruppenüberschriften ziehen (Touch: Punktgriff) · App-Zeilen am Punktgriff innerhalb der Gruppe sortieren.');
    }
  }

  function loadView() {
    // Verwalten ist nur ein fluechtiger UI-Zustand (kein localStorage).
    B.state.launcherView = 'apps';
    syncViewControls();
  }

  function setView(view) {
    if (!modes.has(view)) return;
    if (B.state.launcherView !== view) {
      B.drag.cancelIconDrag();
      B.state.launcherView = view;
      B.renderer.renderLauncher();
    }
    syncViewControls();
  }

  // Beide Launcher-Ansichten teilen sich dieselbe Typ-Reihenfolge und den Oeffnungszustand.
  // Auch aktuell leere Typen behalten ihre Position im Speicher.
  function getTypeOrder(types) {
    const known = [...new Set(['game', 'tool', 'misc', ...Object.keys(B.data.types),
      ...B.data.repos.map(repo => (typeof repo.type === 'string' && repo.type.trim()) ? repo.type : 'misc'), ...types])];
    const saved = B.storage.get('launcherTypeOrder') || [];
    return [...saved.filter(type => known.includes(type)), ...known.filter(type => !saved.includes(type))];
  }

  function persistTypeOrder() {
    const visible = Array.from(B.dom.launcherGrid.querySelectorAll(':scope > .launcher-type-group'))
      .map(group => group.dataset.type);
    const previous = getTypeOrder([]);
    // Versteckte/aktuell leere Gruppen behalten ihre gespeicherte relative Position.
    const it = visible[Symbol.iterator]();
    const next = previous.map(type => visible.includes(type) ? it.next().value : type);
    B.storage.set('launcherTypeOrder', next);
  }

  function toggleType(type, open) {
    const closed = new Set(B.storage.get('launcherTypeClosed') || []);
    if (open) closed.delete(type);
    else closed.add(type);
    B.storage.set('launcherTypeClosed', [...closed]);
  }

  function isTypeOpen(type) {
    return !(B.storage.get('launcherTypeClosed') || []).includes(type);
  }

  function makeTypeGroup(type, count, appView) {
    const section = document.createElement('section');
    section.className = 'launcher-type-group';
    section.dataset.type = type;

    const heading = document.createElement('div');
    heading.className = 'launcher-type-heading';
    heading.draggable = true;
    heading.title = 'Gruppe ziehen, um die Reihenfolge zu ändern';

    const grip = document.createElement('span');
    grip.className = 'launcher-type-grip';
    grip.setAttribute('aria-hidden', 'true');
    grip.innerHTML = '<svg viewBox="0 0 20 20" width="18" height="18" fill="currentColor" aria-hidden="true"><circle cx="6" cy="5" r="1.4"/><circle cx="13" cy="5" r="1.4"/><circle cx="6" cy="10" r="1.4"/><circle cx="13" cy="10" r="1.4"/><circle cx="6" cy="15" r="1.4"/><circle cx="13" cy="15" r="1.4"/></svg>';

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'launcher-type-toggle';
    const label = B.data.types[type]?.label || (type.charAt(0).toLocaleUpperCase('de') + type.slice(1));
    const name = document.createElement('span');
    name.className = 'launcher-type-name';
    name.textContent = label;
    const number = document.createElement('span');
    number.className = 'launcher-type-count';
    number.textContent = String(count);
    const chevron = document.createElement('span');
    chevron.className = 'launcher-type-chevron';
    chevron.setAttribute('aria-hidden', 'true');
    const items = document.createElement('div');
    items.id = 'launcher-type-items-' + encodeURIComponent(type);
    button.setAttribute('aria-controls', items.id);
    items.className = appView ? 'launcher-type-items launcher-type-apps' : 'launcher-type-items view-list';
    const open = isTypeOpen(type);
    button.setAttribute('aria-expanded', String(open));
    items.hidden = !open;
    button.append(name, number, chevron);
    button.addEventListener('click', () => {
      const next = button.getAttribute('aria-expanded') !== 'true';
      button.setAttribute('aria-expanded', String(next));
      items.hidden = !next;
      toggleType(type, next);
    });
    button.addEventListener('keydown', e => {
      if (!e.altKey || !['ArrowUp', 'ArrowDown'].includes(e.key)) return;
      e.preventDefault();
      const parent = section.parentElement;
      if (!parent) return;
      const sections = Array.from(parent.querySelectorAll(':scope > .launcher-type-group'));
      const index = sections.indexOf(section);
      const target = sections[index + (e.key === 'ArrowUp' ? -1 : 1)];
      if (!target) return;
      parent.insertBefore(section, e.key === 'ArrowUp' ? target : target.nextSibling);
      persistTypeOrder();
      B.drag.announceTypePosition(section);
      button.focus({ preventScroll: true });
    });
    heading.append(grip, button);
    section.append(heading, items);
    return { section, items };
  }

  function makeIcon(repo) {
    const tile = document.createElement('button');
    tile.type = 'button';
    tile.className = 'launcher-app';
    tile.dataset.label = repo.label;
    tile.title = repo.url ? repo.label + ' öffnen' : repo.label;
    tile.setAttribute('aria-label', repo.label + (repo.url ? ' öffnen' : '') + '. Symbol gedrückt halten zum Sortieren.');

    const icon = document.createElement('span');
    icon.className = 'launcher-app-icon';
    if (repo.img) {
      const image = document.createElement('img');
      image.src = repo.img;
      image.alt = '';
      image.loading = 'lazy';
      image.decoding = 'async';
      image.draggable = false;
      image.addEventListener('error', () => {
        image.remove();
        icon.textContent = repo.icon || repo.label.charAt(0).toLocaleUpperCase('de');
        icon.classList.add('launcher-app-icon-fallback');
      }, { once: true });
      icon.appendChild(image);
    } else {
      icon.textContent = repo.icon || repo.label.charAt(0).toLocaleUpperCase('de');
      icon.classList.add('launcher-app-icon-fallback');
    }
    const label = document.createElement('span');
    label.className = 'launcher-app-label';
    label.textContent = repo.label;
    tile.append(icon, label);
    tile.addEventListener('click', e => {
      if (B.drag.suppressIconClick()) { e.preventDefault(); return; }
      if (repo.url) window.open(repo.url, '_blank', 'noopener,noreferrer');
    });
    return tile;
  }

  const addWrap = document.getElementById('launcherAddWrap');
  const addButton = document.getElementById('launcherAddButton');
  const addMenu = document.getElementById('launcherAddMenu');
  const addGroups = document.getElementById('launcherAddGroups');
  const addSearch = document.getElementById('launcherAddSearch');
  const addSearchWrap = document.getElementById('launcherAddSearchWrap');
  const addSearchClear = document.getElementById('launcherAddSearchClear');
  const addCloseButton = document.getElementById('launcherAddClose');
  const compactAddMenu = window.matchMedia('(max-width: 768px), (pointer: coarse)');
  let addSearchDebounceTimer = null;
  let addMenuFrame = null;

  // Android und iOS verkleinern/verschieben beim Einblenden der Tastatur
  // oft nur den Visual Viewport, nicht den Layout-Viewport. Das mobile
  // Menue bleibt deshalb unabhaengig vom +App-Button im sichtbaren Bereich.
  function positionAddMenu() {
    if (addMenu.hidden) return;
    const viewport = window.visualViewport;
    const width = viewport?.width || window.innerWidth;
    const height = viewport?.height || window.innerHeight;
    const left = viewport?.offsetLeft || 0;
    const top = viewport?.offsetTop || 0;
    const compact = compactAddMenu.matches || width <= 768 ||
      height < window.innerHeight - 80;
    addMenu.classList.toggle('is-viewport-positioned', compact);
    if (!compact) {
      ['--add-menu-left', '--add-menu-top', '--add-menu-width', '--add-menu-height']
        .forEach(name => addMenu.style.removeProperty(name));
      return;
    }
    const gap = Math.min(12, width / 8, height / 8);
    const menuWidth = Math.max(0, Math.min(320, width - 2 * gap));
    const menuHeight = Math.max(0, Math.min(350, height - 2 * gap));
    addMenu.style.setProperty('--add-menu-left', `${left + (width - menuWidth) / 2}px`);
    addMenu.style.setProperty('--add-menu-top', `${top + (height - menuHeight) / 2}px`);
    addMenu.style.setProperty('--add-menu-width', `${menuWidth}px`);
    addMenu.style.setProperty('--add-menu-height', `${menuHeight}px`);
  }

  function scheduleAddMenuPosition() {
    if (addMenu.hidden || addMenuFrame !== null) return;
    addMenuFrame = requestAnimationFrame(() => {
      addMenuFrame = null;
      positionAddMenu();
    });
  }

  // Wie bisher keine Favoriten, zusaetzlich nur Apps mit nichtleerer URL.
  // Relative URLs aus einer produktiven repos.js bleiben zulaessig.
  function availableApps() {
    return B.data.repos.filter(repo =>
      typeof repo.url === 'string' && repo.url.trim() !== '' && !B.favorites.isFavorite(repo.label)
    );
  }

  function resetAddSearch() {
    clearTimeout(addSearchDebounceTimer);
    addSearchDebounceTimer = null;
    addSearch.value = '';
    addSearchWrap.classList.remove('has-value');
  }

  function closeAddMenu(returnFocus = false) {
    if (!addMenu) return;
    clearTimeout(addSearchDebounceTimer);
    addSearchDebounceTimer = null;
    if (addMenuFrame !== null) cancelAnimationFrame(addMenuFrame);
    addMenuFrame = null;
    if (addMenu.contains(document.activeElement)) document.activeElement.blur();
    addMenu.hidden = true;
    addButton.setAttribute('aria-expanded', 'false');
    if (returnFocus && !addButton.disabled) addButton.focus({ preventScroll: true });
  }

  function refreshAddMenu() {
    if (!addMenu) return;
    const entries = availableApps();
    addButton.disabled = entries.length === 0;
    addButton.title = entries.length ? 'App zum Launcher hinzufügen' : 'Keine weiteren Apps mit URL verfügbar';
    const query = addSearch.value.trim();
    addGroups.replaceChildren();
    addGroups.scrollTop = 0;

    // Identische Relevanzsuche wie in der Bibliothek: Titel, Tags,
    // Beschreibung, Typ und Metadaten, inklusive Umlaut-Normalisierung.
    const collator = new Intl.Collator('de', { sensitivity: 'base', numeric: true });
    const groups = new Map();
    entries.forEach(repo => {
      const relevance = query ? B.search.searchRelevance(repo, query) : 0;
      if (relevance < 0) return;
      const type = typeof repo.type === 'string' && repo.type.trim() ? repo.type : 'other';
      if (!groups.has(type)) groups.set(type, []);
      groups.get(type).push({ repo, relevance });
    });
    // Gruppenreihenfolge folgt der Bibliothek, unbekannte Typen werden ergaenzt.
    const knownTypes = Object.keys(B.data.types);
    const typeKeys = Array.from(groups.keys()).sort((a, b) => {
      const aIndex = knownTypes.indexOf(a);
      const bIndex = knownTypes.indexOf(b);
      if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
      if (aIndex !== -1) return -1;
      if (bIndex !== -1) return 1;
      return collator.compare(a, b);
    });

    typeKeys.forEach(type => {
      const repos = groups.get(type).sort((a, b) =>
        (query ? b.relevance - a.relevance : 0) || collator.compare(a.repo.label, b.repo.label)
      );
      const section = document.createElement('details');
      section.className = 'launcher-add-group';
      // Normalzustand geschlossen, bei aktiver Suche Treffer direkt sichtbar.
      if (query) section.open = true;
      const summary = document.createElement('summary');
      summary.className = 'launcher-add-group-heading';
      const title = document.createElement('span');
      title.textContent = B.data.types[type]?.label || (type === 'other' ? 'Sonstige' : type);
      const count = document.createElement('span');
      count.className = 'launcher-add-group-count';
      count.textContent = String(repos.length);
      count.setAttribute('aria-label', `${repos.length} Apps`);
      summary.append(title, count);
      const list = document.createElement('div');
      list.className = 'launcher-add-group-options';

      repos.forEach(({ repo }) => {
        const option = document.createElement('button');
        option.type = 'button';
        option.className = 'launcher-add-option';
        option.dataset.label = repo.label;
        const icon = document.createElement('span');
        icon.className = 'launcher-add-option-icon';
        if (repo.img) {
          const img = document.createElement('img');
          img.src = repo.img;
          img.alt = '';
          img.loading = 'lazy';
          img.addEventListener('error', () => {
            img.remove();
            icon.textContent = repo.icon || repo.label.charAt(0).toLocaleUpperCase('de');
          }, { once: true });
          icon.appendChild(img);
        } else icon.textContent = repo.icon || repo.label.charAt(0).toLocaleUpperCase('de');
        const name = document.createElement('span');
        name.textContent = repo.label;
        option.append(icon, name);
        list.appendChild(option);
      });

      section.append(summary, list);
      addGroups.appendChild(section);
    });
    if (!typeKeys.length && entries.length) {
      const empty = document.createElement('p');
      empty.className = 'launcher-add-empty';
      empty.setAttribute('role', 'status');
      empty.textContent = 'Keine Apps gefunden';
      addGroups.appendChild(empty);
    }
    if (!entries.length) closeAddMenu();
  }

  function setup() {
    setupInfo();
    manageButton.addEventListener('click', () => {
      closeAddMenu();
      setView(B.state.launcherView === 'list' ? 'apps' : 'list');
      manageButton.focus({ preventScroll: true });
    });
    addButton.addEventListener('click', () => {
      if (addButton.disabled) return;
      closeInfo();
      if (!addMenu.hidden) { closeAddMenu(); return; }
      resetAddSearch();
      refreshAddMenu();
      addMenu.hidden = false;
      addButton.setAttribute('aria-expanded', 'true');
      positionAddMenu();
      // Kein automatischer Fokus: die Bildschirmtastatur bleibt geschlossen.
    });
    addCloseButton.addEventListener('click', () => closeAddMenu(true));
    window.addEventListener('resize', scheduleAddMenuPosition);
    window.visualViewport?.addEventListener('resize', scheduleAddMenuPosition);
    window.visualViewport?.addEventListener('scroll', scheduleAddMenuPosition);
    addSearch.addEventListener('focus', scheduleAddMenuPosition);
    addSearch.addEventListener('blur', scheduleAddMenuPosition);
    addSearch.addEventListener('input', () => {
      addSearchWrap.classList.toggle('has-value', addSearch.value.length > 0);
      clearTimeout(addSearchDebounceTimer);
      addSearchDebounceTimer = setTimeout(() => {
        addSearchDebounceTimer = null;
        if (!addMenu.hidden) refreshAddMenu();
      }, 180);
    });
    addSearchClear.addEventListener('click', () => {
      resetAddSearch();
      refreshAddMenu();
      addSearch.focus();
    });
    addSearch.addEventListener('search', () => {
      clearTimeout(addSearchDebounceTimer);
      addSearchDebounceTimer = null;
      addSearchWrap.classList.toggle('has-value', addSearch.value.length > 0);
      if (!addMenu.hidden) refreshAddMenu();
    });
    addMenu.addEventListener('click', e => {
      const option = e.target.closest('.launcher-add-option');
      if (!option || !addMenu.contains(option)) return;
      const label = option.dataset.label;
      if (!label || B.favorites.isFavorite(label)) return;
      B.favorites.toggleFavorite(label);
      closeAddMenu();
      B.renderer.renderLauncher();
      if (!addButton.disabled) addButton.focus({ preventScroll: true });
    });
    addWrap.addEventListener('keydown', e => {
      if (addMenu.hidden) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        if (document.activeElement === addSearch && addSearch.value) {
          resetAddSearch();
          refreshAddMenu();
        } else closeAddMenu(true);
        return;
      }
      if (document.activeElement === addSearch) {
        if (e.key === 'Enter') {
          e.preventDefault();
          clearTimeout(addSearchDebounceTimer);
          addSearchDebounceTimer = null;
          refreshAddMenu();
          return;
        }
        // Home/End bewegen beim Tippen den Cursor, Pfeil nach unten die Auswahl.
        if (e.key !== 'ArrowDown') return;
      }
      // Nur sichtbare Eintraege sind per Pfeiltaste erreichbar; native
      // <summary>-Elemente lassen sich weiterhin mit Enter/Leertaste oeffnen.
      const controls = Array.from(addGroups.querySelectorAll('.launcher-add-group-heading, .launcher-add-group[open] .launcher-add-option'));
      if (!controls.length || !['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return;
      e.preventDefault();
      const index = controls.indexOf(document.activeElement);
      let next = index;
      if (e.key === 'ArrowDown') next = (index + 1) % controls.length;
      if (e.key === 'ArrowUp') next = (index - 1 + controls.length) % controls.length;
      if (e.key === 'Home') next = 0;
      if (e.key === 'End') next = controls.length - 1;
      controls[next].focus();
    });
    document.addEventListener('pointerdown', e => {
      if (!addMenu.hidden && !addWrap.contains(e.target)) closeAddMenu();
    });
    syncViewControls();
    refreshAddMenu();
  }

  B.launcher = { makeIcon, makeTypeGroup, getTypeOrder, persistTypeOrder,
    loadView, setView, syncViewControls, refreshAddMenu, closeAddMenu, closeInfo, setup };
})(window.BoilerRoom);
