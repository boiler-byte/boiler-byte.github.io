/* Eigenstaendige Workspace-App. Katalog & Einstellungen kommen vom Boiler Room.
   Repos werden nach Bedarf in ungesandboxte, wiederverwendbare iFrames geladen. */
(function (B) {
  'use strict';

  const FAVORITES = 'favorites';
  const GROUP_PREFIX = 'group:';
  const rootURL = new URL('../', location.href);
  const $ = id => document.getElementById(id);
  const ui = Object.fromEntries([
    'workspace', 'workspaceSelect', 'homeWorkspaceTitle', 'storageNotice', 'current', 'currentIcon', 'currentWorkspace', 'currentApp',
    'reloadApp', 'externalApp', 'shareApp', 'emptyView', 'emptyTitle', 'emptyDescription', 'emptyLink',
    'frames', 'loading', 'offlineManagerLink', 'homeApp', 'homeView', 'homeSearch',
    'homeSearchToggle', 'homeSearchWrap', 'homeSearchClear', 'homeTitle', 'homeCount', 'homeApps', 'homeRecentSection',
    'homeWorkspaceSection', 'homeWorkspaceCount', 'homeWorkspaceApps',
    'toolbarMenuToggle', 'toolbarMenu', 'toolbarRecentSection', 'toolbarRecentApps', 'toolbarPositionToggle', 'toolbarMenuBackdrop', 'appStage'
  ].map(id => [id, $(id)]));
  const mobile = window.matchMedia('(max-width: 700px)');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const stageMotion = { duration: 320, easing: 'cubic-bezier(.22,.61,.36,1)', fill: 'both' };
  let activeSurface = null;
  let surfaceTransition = null;
  const types = B.data.types;
  const repoMap = new Map();
  const groups = B.data.getGroups();
  const frames = new Map();
  // Keine Sandbox; notwendige Browser-Berechtigungen explizit an die App delegieren.
  // Die Berechtigungen des Top-Level-Dokuments und Browser-Abfragen gelten weiterhin.
  const framePermissions = [
    'autoplay', 'camera', 'microphone', 'geolocation', 'fullscreen', 'clipboard-read',
    'clipboard-write', 'display-capture', 'gamepad', 'accelerometer', 'gyroscope',
    'magnetometer', 'encrypted-media', 'picture-in-picture', 'web-share',
    'screen-wake-lock', 'midi'
  ].map(feature => feature + ' *').join('; ');

  for (const repo of B.data.repos) {
    if (!repo || typeof repo.label !== 'string' || !repo.label.trim() || repoMap.has(repo.label)) continue;
    repoMap.set(repo.label, repo);
  }

  B.storage.init();
  B.favorites.load();
  B.favorites.loadOrder();
  let state = B.storage.get('workspace');
  let activeRepos = [];
  let favoritesSignature = '';
  let offlineRecords = new Map();
  let openToken = 0;
  let offlineRevision = 0;
  let edit = null, gesture = null, deferredHome = false;
  const offlineBusy = new Set();
  let offlineInitial = refreshOffline();

  async function refreshOffline(render = true) {
    const revision = ++offlineRevision;
    try {
      const records = await B.offline.snapshot();
      if (revision !== offlineRevision) return;
      offlineRecords = new Map(records.map(record => [record.id, record]));
      if (render) { renderHome(); if (!ui.toolbarMenu.hidden) renderToolbarRecent(); }
    } catch (_) { /* online URLs remain usable if browser storage is unavailable */ }
  }

  function resolveURL(value) {
    if (typeof value !== 'string' || !value.trim()) return null;
    try {
      const url = new URL(value.trim(), rootURL);
      // Relative und absolute Web-URLs. Keine javascript:/data:-Dokumente als Apps.
      return ['http:', 'https:', 'file:'].includes(url.protocol) ? url.href : null;
    } catch (_) { return null; }
  }

  function catalogApps() {
    return [...repoMap.values()].filter(repo => resolveURL(repo.url));
  }

  function recentLabels() {
    return B.storage.get('workspaceRecentApps').filter(label => resolveURL(repoMap.get(label)?.url));
  }

  function recordUsage(label) {
    B.storage.set('workspaceRecentApps', [label, ...recentLabels().filter(item => item !== label)]);
  }

  function searchCatalog(query) {
    const rank = new Map(recentLabels().map((label, index) => [label, index]));
    const position = repo => rank.get(repo.label) ?? Infinity;
    return catalogApps().map((repo, index) => ({ repo, index, score: B.searchRelevance.score(repo, query) }))
      .filter(item => item.score >= 0)
      .sort((a, b) => (position(a.repo) - position(b.repo)) || b.score - a.score || a.index - b.index)
      .slice(0, 27)
      .map(item => item.repo);
  }

  function renderHomeGrid(grid, repos, emptyMessage) {
    grid.replaceChildren(...repos.map(repo => createAppItem(repo, true, false, grid.id)));
    if (!repos.length && emptyMessage) {
      const empty = document.createElement('p');
      empty.className = 'home-empty';
      empty.textContent = emptyMessage;
      grid.append(empty);
    }
  }

  function renderHome() {
    if (ui.homeView.hidden) return;
    if (gesture) { deferredHome = true; return; }
    deferredHome = false;
    const query = B.searchRelevance.normalize(ui.homeSearch.value);
    const recent = recentLabels();
    const repos = query ? searchCatalog(query) : recent.slice(0, 9).map(label => repoMap.get(label));
    ui.homeRecentSection.hidden = !query && !recent.length;
    ui.homeWorkspaceSection.hidden = Boolean(query);
    ui.homeTitle.textContent = query ? 'Suchergebnisse' : 'Zuletzt verwendet';
    ui.homeCount.textContent = String(repos.length);
    ui.homeSearchClear.hidden = !ui.homeSearch.value;
    const editRepos = edit?.grid === ui.homeApps.id ? repos : (!query ? activeRepos.filter(repo => resolveURL(repo.url)) : []);
    if (edit && !editRepos.some(repo => repo.label === edit.label)) edit = null;
    renderHomeGrid(ui.homeApps, repos, query ? 'Keine passenden Apps gefunden.' : '');
    if (!query) {
      const workspaceRepos = activeRepos.filter(repo => resolveURL(repo.url));
      ui.homeWorkspaceCount.textContent = String(workspaceRepos.length);
      renderHomeGrid(ui.homeWorkspaceApps, workspaceRepos, 'Noch keine Apps in diesem Workspace. Suche im gesamten App-Katalog.');
    }
  }

  function setExternalURL(url) {
    if (url) {
      ui.externalApp.href = url;
      ui.externalApp.removeAttribute('aria-disabled');
      ui.externalApp.removeAttribute('tabindex');
    } else {
      ui.externalApp.removeAttribute('href');
      ui.externalApp.setAttribute('aria-disabled', 'true');
      ui.externalApp.tabIndex = -1;
    }
  }

  function renderToolbarRecent() {
    const appOpen = Boolean(state.app && activeSurface?.classList.contains('app-frame'));
    ui.toolbarRecentSection.hidden = !appOpen;
    const repos = appOpen ? recentLabels().slice(0, 9).map(label => repoMap.get(label)) : [];
    ui.toolbarRecentApps.replaceChildren(...repos.map(repo => createAppItem(repo, false, true)));
    if (appOpen && !repos.length) {
      const empty = document.createElement('p');
      empty.className = 'list-empty';
      empty.textContent = 'Noch keine Apps verwendet.';
      ui.toolbarRecentApps.append(empty);
    }
    updateAppSelection();
  }

  function setToolbarMenu(visible, restoreFocus = false) {
    if (visible) renderToolbarRecent();
    ui.toolbarMenu.hidden = !visible;
    ui.toolbarMenuBackdrop.hidden = !visible;
    ui.toolbarMenuToggle.setAttribute('aria-expanded', String(visible));
    const label = visible ? 'Toolbar-Menü schließen' : 'Toolbar-Menü öffnen';
    ui.toolbarMenuToggle.title = label;
    ui.toolbarMenuToggle.setAttribute('aria-label', label);
    if (restoreFocus) ui.toolbarMenuToggle.focus({ preventScroll: true });
  }

  const toolbar = ui.toolbarMenu.closest('.toolbar');
  let toolbarAnimations = [];

  function settleToolbarPosition() {
    toolbarAnimations.forEach(animation => animation.cancel());
    toolbarAnimations = [];
  }

  function syncToolbarPosition(animate = false) {
    const bottom = B.storage.get('workspaceToolbarBottom') === true;
    const changed = bottom !== ui.workspace.classList.contains('toolbar-bottom');
    const layers = [toolbar, ui.appStage];
    const motion = changed && animate && !reducedMotion.matches && typeof toolbar.animate === 'function';
    // Capture the actual rendered positions, including any interrupted motion.
    const previous = motion ? layers.map(layer => layer.getBoundingClientRect()) : [];
    if (changed) settleToolbarPosition();
    ui.workspace.classList.toggle('toolbar-bottom', bottom);
    ui.toolbarPositionToggle.setAttribute('aria-pressed', String(bottom));
    const label = bottom ? 'Toolbar nach oben verschieben' : 'Toolbar nach unten verschieben';
    ui.toolbarPositionToggle.title = label;
    ui.toolbarPositionToggle.setAttribute('aria-label', label);
    if (!motion) return;
    // FLIP: final layout is applied once; the live toolbar and stage slide from
    // their old positions without moving or recreating any iframe DOM nodes.
    const next = layers.map(layer => layer.getBoundingClientRect());
    const animations = layers.map((layer, index) => layer.animate([
      { transform: `translateY(${previous[index].top - next[index].top}px)` },
      { transform: 'translateY(0px)' }
    ], { duration: 320, easing: 'cubic-bezier(.22,.61,.36,1)' }));
    toolbarAnimations = animations;
    Promise.all(animations.map(animation => animation.finished)).then(() => {
      if (toolbarAnimations === animations) settleToolbarPosition();
    }).catch(() => {}); // A newer position or reduced-motion change can cancel.
  }

  function setHomeSearch(visible, focus = false) {
    ui.homeSearchWrap.hidden = !visible;
    ui.homeSearchToggle.setAttribute('aria-expanded', String(visible));
    const label = visible ? 'Suche schließen' : 'Suche öffnen';
    ui.homeSearchToggle.title = label;
    ui.homeSearchToggle.setAttribute('aria-label', label);
    if (!visible) ui.homeSearch.value = '';
    renderHome();
    if (focus) (visible ? ui.homeSearch : ui.homeSearchToggle).focus();
  }

  // Keep both live surfaces mounted during the transition. Never move an iframe
  // in the DOM: its browsing context and current app state must survive navigation.
  function settleSurfaces() {
    const previous = surfaceTransition;
    surfaceTransition = null;
    if (previous) previous.animations.forEach(animation => animation.cancel());
    const surfaces = [ui.homeView, ui.emptyView, ...[...frames.values()].map(entry => entry.frame)];
    for (const surface of surfaces) {
      const active = surface === activeSurface;
      surface.hidden = !active;
      surface.inert = !active;
      surface.style.removeProperty('z-index');
    }
    ui.frames.hidden = ![...frames.values()].some(entry => entry.frame === activeSurface);
  }

  function transitionTo(next) {
    // Interruptions settle to the last requested surface before starting again.
    // A cancelled animation must never hide the destination of a newer request.
    settleSurfaces();
    const previous = activeSurface;
    activeSurface = next;
    if (!previous || previous === next || reducedMotion.matches || typeof next.animate !== 'function') {
      settleSurfaces();
      return;
    }
    const returning = next === ui.homeView;
    next.hidden = false;
    if (next.classList.contains('app-frame')) ui.frames.hidden = false;
    if (previous.classList.contains('app-frame')) ui.frames.hidden = false;
    if (previous.contains(document.activeElement) || previous === document.activeElement) ui.homeApp.focus({ preventScroll: true });
    previous.inert = true;
    next.inert = false;
    previous.style.zIndex = returning ? '2' : '1';
    next.style.zIndex = returning ? '1' : '2';
    const depth = { transform: 'scale(.94)', opacity: .55 };
    const front = { transform: 'scale(1.045)', opacity: 0 };
    const normal = { transform: 'scale(1)', opacity: 1 };
    const animations = [
      previous.animate([normal, returning ? front : depth], stageMotion),
      next.animate([returning ? depth : front, normal], stageMotion)
    ];
    const transition = { animations };
    surfaceTransition = transition;
    Promise.all(animations.map(animation => animation.finished)).then(() => {
      if (surfaceTransition === transition) settleSurfaces();
    }, () => {});
  }

  function showHome() {
    endEdit();
    setToolbarMenu(false);
    ++openToken;
    state.app = null;
    persist();
    setLoading(null);
    ui.reloadApp.disabled = true;
    setExternalURL(null);
    renderCurrent(null);
    document.title = workspaceLabel(state.selected) + ' · Boiler Room';
    renderToolbarRecent();
    // Refresh the overview before the next paint, including the latest app usage.
    transitionTo(ui.homeView);
    setHomeSearch(false);
  }

  function workspaceExists(id) {
    return id === FAVORITES || (typeof id === 'string' && id.startsWith(GROUP_PREFIX) && groups.has(id.slice(GROUP_PREFIX.length)));
  }

  function workspaceLabel(id) {
    return id === FAVORITES ? 'Favoriten' : groups.get(id.slice(GROUP_PREFIX.length))?.label || 'Workspace';
  }

  function readFavorites(track = true) {
    const favorites = B.storage.get('favorites');
    const order = B.storage.get('favoriteOrder');
    const set = new Set(favorites);
    const labels = [...new Set([...order.filter(label => set.has(label)), ...favorites])];
    if (track) favoritesSignature = JSON.stringify(labels);
    return labels.map(label => repoMap.get(label)).filter(Boolean);
  }

  function members(id) {
    return id === FAVORITES ? readFavorites() : groups.get(id.slice(GROUP_PREFIX.length))?.repos || [];
  }

  function persist() {
    B.storage.set('workspace', state);
    ui.storageNotice.hidden = B.storage.isAvailable();
  }

  function populatePicker() {
    ui.workspaceSelect.append(new Option('Favoriten', FAVORITES));
    for (const [id, group] of groups) {
      ui.workspaceSelect.append(new Option(group.label, GROUP_PREFIX + id));
    }
  }

  function animateFavoriteStar(star, added, departing = false) {
    if (reducedMotion.matches || !star || typeof star.animate !== 'function') return;
    // Animate the SVG, not the hit target. Start at the previous visual size.
    const frames = [
      { transform: `scale(${added ? 2 : .5})`, offset: 0 },
      { transform: `scale(${added ? .78 : 1.22})`, offset: .46 },
      { transform: `scale(${added ? 1.22 : .92})`, offset: .72 },
      { transform: 'scale(1)', offset: 1 }
    ];
    if (departing) {
      frames[0].opacity = 1;
      frames[1].opacity = 1;
      frames[3].opacity = 0;
    }
    const animation = star.animate(frames, { duration: 320, easing: 'ease-out' });
    if (departing) animation.finished.then(() => star.remove(), () => star.remove());
  }

  function createFavoriteButton(repo) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'workspace-fav';
    button.dataset.label = repo.label;
    button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5l2.95 5.98 6.6.96-4.78 4.66 1.13 6.57L12 17.58l-5.9 3.09 1.13-6.57L2.45 9.44l6.6-.96L12 2.5z"/></svg>';
    const favorite = B.favorites.isFavorite(repo.label);
    button.classList.toggle('is-fav', favorite);
    button.setAttribute('aria-pressed', String(favorite));
    button.title = favorite ? 'Aus Favoriten entfernen' : 'Zu Favoriten hinzufügen';
    button.setAttribute('aria-label', button.title + ': ' + repo.label);
    button.addEventListener('click', () => {
      const scope = button.closest('.home-apps');
      const oldStar = button.querySelector('svg');
      const rect = oldStar.getBoundingClientRect();
      const added = B.favorites.toggleFavorite(repo.label);
      refreshFavorites();
      // Re-rendering may remove a favorite from Favoriten. Restore focus
      // to the corresponding star if it remains available, otherwise the search.
      const replacement = [...scope.querySelectorAll('.workspace-fav')].find(el => el.dataset.label === repo.label);
      if (replacement) {
        animateFavoriteStar(replacement.querySelector('svg'), added);
      } else if (!added && !reducedMotion.matches && typeof oldStar.animate === 'function' && rect.width && rect.height) {
        const ghost = oldStar.cloneNode(true);
        ghost.classList.add('workspace-fav-ghost');
        ghost.style.left = `${rect.left + rect.width / 2 - 13}px`;
        ghost.style.top = `${rect.top + rect.height / 2 - 13}px`;
        document.body.append(ghost);
        animateFavoriteStar(ghost, false, true);
      }
      (replacement || (ui.homeSearchWrap.hidden ? ui.homeSearchToggle : ui.homeSearch)).focus({ preventScroll: true });
    });
    return button;
  }

  function createAppIcon(repo, eager = false) {
    const icon = document.createElement('span');
    icon.className = 'app-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = repo.icon || repo.label.slice(0, 1).toLocaleUpperCase('de');
    const imgURL = resolveURL(repo.img);
    if (imgURL) {
      const image = new Image();
      image.alt = '';
      image.loading = eager ? 'eager' : 'lazy';
      image.style.opacity = '0';
      image.addEventListener('load', () => { image.style.opacity = '1'; }, { once: true });
      image.addEventListener('error', () => image.remove(), { once: true });
      image.src = imgURL;
      icon.append(image);
    }
    return icon;
  }

  function renderCurrent(repo) {
    ui.current.classList.toggle('is-app', Boolean(repo));
    ui.currentApp.textContent = repo?.label || 'Workspace';
    ui.currentWorkspace.hidden = Boolean(repo);
    ui.current.title = repo?.label || 'Workspace · der Boiler Room';
    if (repo) {
      ui.currentIcon.replaceChildren(createAppIcon(repo, true));
    } else {
      const brand = document.createElement('span');
      brand.className = 'brand-mark';
      brand.textContent = 'db';
      ui.currentIcon.replaceChildren(brand);
    }
  }

  function createAppItem(repo, card = false, recent = false, gridId = null) {
    const item = document.createElement('div');
    item.className = card ? 'app-card' : 'app-row';
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'app-item';
    button.dataset.label = repo.label;
    button.title = repo.label;
    const icon = createAppIcon(repo);
    const copy = document.createElement('span');
    copy.className = 'app-copy';
    const name = document.createElement('span');
    name.className = 'app-name';
    name.textContent = repo.label;
    const type = document.createElement('span');
    type.className = 'app-type';
    type.dataset.type = repo.type || '';
    type.textContent = resolveURL(repo.url) ? (types[repo.type]?.label || repo.type || 'App') : 'Information';
    const offlineEntry = B.offline.localEntry(repo, offlineRecords.get(repo.label));
    if (offlineEntry) {
      type.textContent += ' · Offline';
      button.title = repo.label + ' · Offline-Paket vorhanden';
    }
    copy.append(name, type);
    const dot = document.createElement('span');
    dot.className = 'active-dot';
    dot.setAttribute('aria-hidden', 'true');
    button.append(icon, copy, dot);
    button.addEventListener('click', event => {
      if (gridId && (button._suppressClick || edit)) {
        event.preventDefault();
        button._suppressClick = false;
        return;
      }
      openApp(repo.label);
      if (recent) ui.toolbarMenuToggle.focus({ preventScroll: true });
    });
    item.append(button);
    if (!recent) item.append(createFavoriteButton(repo));
    if (gridId) setupCardEditing(item, button, icon, repo, gridId);
    return item;
  }

  // A single icon is edited at a time. Pointer events cover mouse, pen and touch;
  // reordering is permitted only in the unfiltered Favorites workspace grid.
  const HOLD_MS = 450;
  const MOVE_PX = 9;
  function editableGrid(grid) {
    return grid === ui.homeWorkspaceApps.id && state.selected === FAVORITES && !B.searchRelevance.normalize(ui.homeSearch.value);
  }
  function sameEdit(card) {
    return edit && edit.label === card.dataset.label && edit.grid === card.dataset.grid;
  }
  function editCards() {
    return [...ui.homeView.querySelectorAll('.app-card[data-grid]')];
  }
  function syncEditCards() {
    editCards().forEach(syncEditCard);
  }
  function syncEditCard(card) {
    const selected = Boolean(sameEdit(card));
    card.classList.toggle('is-editing', selected);
    card.classList.toggle('is-holding', selected && Boolean(gesture?.held));
    const controls = card.querySelector('.app-edit-controls');
    controls.hidden = !selected || Boolean(gesture?.held);
    card.querySelector('.workspace-fav').hidden = selected;
    const toggle = controls.querySelector('.app-edit-menu-toggle');
    const panel = card.querySelector('.app-edit-menu');
    const open = selected && !gesture?.held && Boolean(edit.menu);
    toggle.setAttribute('aria-expanded', String(open));
    panel.hidden = !open;
    if (open) renderEditMenu(panel, edit);
  }
  function enterEdit(card) {
    if (!sameEdit(card)) edit = { label: card.dataset.label, grid: card.dataset.grid, menu: false };
    else edit.menu = false;
    syncEditCards();
  }
  function endEdit(restoreFocus = false) {
    if (gesture) finishGesture(null, true);
    const card = editCards().find(sameEdit);
    edit = null;
    syncEditCards();
    if (restoreFocus) card?.querySelector('.app-item')?.focus({ preventScroll: true });
  }
  function editButton(className, text, label) {
    const button = document.createElement('button');
    button.type = 'button'; button.className = className; button.textContent = text;
    button.title = label; button.setAttribute('aria-label', label);
    return button;
  }
  function setupCardEditing(card, button, icon, repo, grid) {
    card.dataset.grid = grid; card.dataset.label = repo.label;
    const controls = document.createElement('div');
    controls.className = 'app-edit-controls';
    const more = editButton('app-edit-menu-toggle', '⋯', 'Kontextmenü: ' + repo.label);
    more.setAttribute('aria-expanded', 'false');
    const close = editButton('app-edit-close', '×', 'Edit-Modus beenden: ' + repo.label);
    const panel = document.createElement('div');
    panel.className = 'app-edit-menu'; panel.setAttribute('role', 'group');
    panel.setAttribute('aria-label', 'Offline-Aktionen: ' + repo.label);
    controls.append(more, close); card.append(controls, panel);
    more.addEventListener('click', () => {
      if (!sameEdit(card)) return;
      if (edit.menu) { edit.menu = false; syncEditCards(); }
      else openEditMenu(edit, repo);
    });
    close.addEventListener('click', () => endEdit(true));
    icon.addEventListener('dragstart', event => event.preventDefault());
    button.addEventListener('pointerdown', event => {
      if (event.button !== 0 || !event.isPrimary || !icon.contains(event.target) || gesture) return;
      button._suppressClick = false;
      const g = gesture = { card, button, icon, capture: event.target, grid, id: event.pointerId, x: event.clientX, y: event.clientY, held: false, target: null };
      const hold = () => {
        if (gesture !== g) return;
        g.held = true; button._suppressClick = true;
        enterEdit(card);
        try { g.capture.setPointerCapture(g.id); } catch (_) {}
      };
      // A second grab of an already edited favorite can drag immediately.
      if (sameEdit(card) && editableGrid(grid)) hold();
      else g.timer = setTimeout(hold, HOLD_MS);
    });
    button.addEventListener('contextmenu', event => {
      event.preventDefault();
      // Native touch context menus must not interrupt an active hold.
      if (!gesture) enterEdit(card);
    });
    button.addEventListener('keydown', event => {
      if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
        event.preventDefault(); enterEdit(card); more.focus();
      } else if (sameEdit(card) && editableGrid(grid) && event.altKey && ['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)) {
        event.preventDefault();
        const cards = [...card.parentElement.querySelectorAll('.app-card')];
        const offset = {ArrowLeft:-1,ArrowRight:1,ArrowUp:-3,ArrowDown:3}[event.key];
        const target = cards[cards.indexOf(card) + offset];
        if (target) { moveFavorite(repo.label, target.dataset.label); editCards().find(sameEdit)?.querySelector('.app-item').focus(); }
      }
    });
    syncEditCard(card);
  }
  function dragMove(event) {
    const g = gesture;
    if (!g || event.pointerId !== g.id) return;
    const distance = Math.hypot(event.clientX - g.x, event.clientY - g.y);
    if (!g.held) {
      if (distance > MOVE_PX) { clearTimeout(g.timer); g.button._suppressClick = true; }
      return;
    }
    if (!editableGrid(g.grid) || (!g.ghost && distance < MOVE_PX)) return;
    event.preventDefault();
    if (!g.ghost) {
      const rect = g.icon.getBoundingClientRect();
      g.ghost = g.icon.cloneNode(true); g.ghost.classList.add('app-drag-ghost');
      g.ghost.style.width = rect.width + 'px'; g.ghost.style.height = rect.height + 'px';
      document.body.append(g.ghost); g.card.classList.add('is-dragging');
    }
    g.ghost.style.left = event.clientX + 'px'; g.ghost.style.top = event.clientY + 'px';
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest('.app-card');
    const next = target && target !== g.card && target.parentElement === ui.homeWorkspaceApps ? target : null;
    if (g.target !== next) { g.target?.classList.remove('is-drop-target'); g.target = next; next?.classList.add('is-drop-target'); }
  }
  function finishGesture(event, cancel = false) {
    const g = gesture;
    if (!g || (event && event.pointerId !== g.id)) return;
    clearTimeout(g.timer); gesture = null;
    if (g.capture.hasPointerCapture(g.id)) g.capture.releasePointerCapture(g.id);
    g.ghost?.remove(); g.target?.classList.remove('is-drop-target'); g.card.classList.remove('is-dragging');
    if (g.held) {
      g.button._suppressClick = true;
      if (!cancel && g.target && editableGrid(g.grid)) moveFavorite(g.card.dataset.label, g.target.dataset.label);
      else syncEditCards();
    }
    if (deferredHome) {
      if (g.held || cancel) renderHome();
      else setTimeout(() => { if (deferredHome) renderHome(); }, 0);
    }
  }
  function moveFavorite(label, target) {
    // Keep non-launchable favorites in their existing slots; share the order
    // with the platform launcher, and read current storage before writing.
    if (!editableGrid(ui.homeWorkspaceApps.id)) return;
    const all = readFavorites(false).map(repo => repo.label);
    const visible = all.filter(label => resolveURL(repoMap.get(label)?.url));
    const from = visible.indexOf(label), to = visible.indexOf(target);
    if (from < 0 || to < 0 || from === to) return;
    visible.splice(from, 1); visible.splice(to, 0, label);
    let index = 0;
    B.favorites.setOrder(all.map(label => resolveURL(repoMap.get(label)?.url) ? visible[index++] : label));
    refreshFavorites();
  }
  document.addEventListener('pointermove', dragMove, { passive: false });
  document.addEventListener('pointerup', event => finishGesture(event));
  document.addEventListener('pointercancel', event => finishGesture(event, true));
  document.addEventListener('lostpointercapture', event => { if (event.target === gesture?.capture) finishGesture(event, true); });
  window.addEventListener('blur', () => finishGesture(null, true));
  document.addEventListener('pointerdown', event => {
    if (edit?.menu && !event.target.closest('.app-edit-menu, .app-edit-menu-toggle')) {
      edit.menu = false; syncEditCards();
    }
  }, true);

  async function openEditMenu(current, repo) {
    current.menu = true;
    current.checking = repo.boiler_room_pwa === true && B.offline.supported;
    current.description = null; current.error = '';
    const request = current.request = {};
    syncEditCards();
    try {
      // The service worker owns the shared 24h/7d interval, including checks
      // from other tabs and the Offline Manager. Never force a network check.
      if (repo.boiler_room_pwa === true && B.offline.supported) {
        await offlineInitial;
        const cached = await B.offline.cachedDescription(repo);
        if (current.request !== request) return;
        current.description = cached;
        if (edit === current) syncEditCards();
        if (navigator.onLine && B.offline.describe(repo).kind === 'candidate') {
          const description = await B.offline.discover(repo, { force: false });
          if (current.request === request) current.description = description;
        }
      }
    } catch (error) { if (current.request === request) current.error = error.message; }
    finally {
      if (current.request === request) { current.checking = false; if (edit === current) syncEditCards(); }
    }
  }
  function renderEditMenu(panel, current) {
    const repo = repoMap.get(current.label);
    const record = offlineRecords.get(current.label);
    const description = current.description;
    const busy = offlineBusy.has(current.label);
    const online = navigator.onLine && B.offline.supported;
    panel.replaceChildren();
    const note = text => { const p = document.createElement('p'); p.textContent = text; panel.append(p); };
    const action = (text, kind, enabled) => {
      const button = editButton('app-edit-action', text, text + ': ' + current.label);
      button.disabled = !enabled || busy;
      button.addEventListener('click', () => runEditAction(current, repo, kind)); panel.append(button);
    };
    if (busy) note('Offline-Vorgang läuft …');
    else if (current.checking) note('Version wird geprüft …');
    if (current.error) note(current.error);
    if (repo.boiler_room_pwa === true && description?.kind === 'package') {
      const status = B.offline.status(description, record);
      if (status === 'update') action('Update', 'update', online && !current.checking);
      else if (!record || status === 'incomplete') action('Installieren', 'install', online && !current.checking);
    }
    if (record) action('Deinstallieren', 'remove', B.offline.supported && !current.checking);
    if (!panel.children.length) note(repo.boiler_room_pwa !== true ? 'Keine Offline-Aktionen verfügbar.' : description?.reason || (!online ? 'Offline: keine Prüfung möglich.' : 'Kein Update verfügbar.'));
  }
  async function runEditAction(current, repo, kind) {
    if (offlineBusy.has(repo.label) || (kind !== 'remove' && (repo.boiler_room_pwa !== true || !navigator.onLine))) return;
    offlineBusy.add(repo.label); current.error = ''; syncEditCards();
    try {
      if (kind === 'remove') await B.offline.request('remove', { id: repo.label });
      else await B.offline.request('install', { repo: { label: repo.label, url: repo.url } });
      offlineInitial = refreshOffline(); await offlineInitial;
      if (repo.boiler_room_pwa === true) {
        const description = await B.offline.cachedDescription(repo);
        current.description = description;
        if (edit?.label === repo.label) edit.description = description;
      }
      B.toast?.showMessage(repo.label + ': ' + ({remove:'deinstalliert',install:'installiert',update:'aktualisiert'}[kind]));
    } catch (error) {
      current.error = error.message;
      B.toast?.showMessage(repo.label + ': ' + error.message);
    } finally { offlineBusy.delete(repo.label); syncEditCards(); }
  }

  function updateAppSelection() {
    for (const button of ui.toolbarRecentApps.querySelectorAll('.app-item')) {
      const active = button.dataset.label === state.app;
      button.classList.toggle('is-active', active);
      button.parentElement.classList.toggle('is-active', active);
      if (active) button.setAttribute('aria-current', 'true');
      else button.removeAttribute('aria-current');
    }
  }

  function setLoading(entry) {
    ui.loading.hidden = !entry || !entry.loading;
  }

  function createFrame(repo, url) {
    const frame = document.createElement('iframe');
    frame.className = 'app-frame';
    frame.title = repo.label;
    frame.allow = framePermissions;
    frame.allowFullscreen = true;
    frame.hidden = true;
    frame.inert = true;
    const entry = { frame, url, loading: true, timer: 0 };
    frames.set(repo.label, entry);
    function finishLoading() {
      clearTimeout(entry.timer);
      entry.loading = false;
      if (state.app === repo.label && frames.get(repo.label) === entry) setLoading(entry);
    }
    frame.addEventListener('load', finishLoading);
    frame.addEventListener('error', finishLoading);
    // Bei langsamen/blockierten externen Apps den Bedienbereich nicht dauerhaft ueberlagern.
    entry.timer = setTimeout(finishLoading, 15000);
    frame.src = url;
    ui.frames.append(frame);
    return entry;
  }

  function removeFrame(label) {
    const entry = frames.get(label);
    if (!entry) return;
    clearTimeout(entry.timer);
    if (surfaceTransition) settleSurfaces();
    if (activeSurface === entry.frame) activeSurface = null;
    entry.frame.remove();
    frames.delete(label);
  }

  function showEmpty(repo) {
    setLoading(null);
    setExternalURL(null);
    ui.reloadApp.disabled = true;
    ui.emptyLink.hidden = true;
    if (repo) {
      ui.emptyTitle.textContent = repo.label;
      ui.emptyDescription.textContent = repo.description || 'Für dieses Repo ist keine App-URL hinterlegt.';
    } else if (state.selected === FAVORITES && !activeRepos.length) {
      ui.emptyTitle.textContent = 'Dein eigener Workspace';
      ui.emptyDescription.textContent = 'Füge im Boiler Room Apps zu deinen Favoriten hinzu. Sie erscheinen automatisch hier.';
      ui.emptyLink.hidden = false;
    } else {
      ui.emptyTitle.textContent = activeRepos.length ? 'App auswählen' : 'Dieser Workspace ist leer';
      ui.emptyDescription.textContent = activeRepos.length ? 'Wähle eine App in der App-Übersicht aus.' : 'Dieser Repo-Gruppe sind noch keine Apps zugeordnet.';
    }
    transitionTo(ui.emptyView);
    renderToolbarRecent();
  }

  async function openApp(label, save = true) {
    endEdit();
    setToolbarMenu(false);
    const token = ++openToken;
    const repo = repoMap.get(label) || null;
    state.app = repo?.label || null;
    if (save) {
      if (resolveURL(repo?.url)) recordUsage(repo.label);
      persist();
    }
    updateAppSelection();
    renderCurrent(repo);
    document.title = (repo ? repo.label + ' · ' : '') + workspaceLabel(state.selected) + ' · Boiler Room';
    const originalURL = resolveURL(repo?.url);
    if (!repo || !originalURL) {
      showEmpty(repo);
      return;
    }
    // Resolve the saved package before creating an iframe (including cold offline starts).
    ui.loading.hidden = false;
    ui.reloadApp.disabled = true;
    setExternalURL(null);
    let pending;
    do { pending = offlineInitial; await pending; } while (pending !== offlineInitial && token === openToken);
    if (token !== openToken) return;
    const url = B.offline.localEntry(repo, offlineRecords.get(repo.label)) || originalURL;
    let entry = frames.get(repo.label);
    if (entry && entry.url !== url) {
      removeFrame(repo.label);
      entry = null;
    }
    if (!entry) entry = createFrame(repo, url);
    transitionTo(entry.frame);
    renderToolbarRecent();
    ui.reloadApp.disabled = false;
    setExternalURL(url);
    setLoading(entry);
  }

  function selectWorkspace(id) {
    state.selected = workspaceExists(id) ? id : FAVORITES;
    activeRepos = members(state.selected);
    ui.workspaceSelect.value = state.selected;
    ui.homeWorkspaceTitle.textContent = workspaceLabel(state.selected);
    const managerURL = new URL('offline.html', location.href);
    managerURL.searchParams.set('workspace', state.selected);
    ui.offlineManagerLink.href = managerURL.href;
    showHome();
  }

  function refreshFavorites() {
    const before = favoritesSignature;
    B.favorites.load();
    B.favorites.loadOrder();
    const next = readFavorites();
    if (before === favoritesSignature) return;
    if (state.selected === FAVORITES) activeRepos = next;
    renderHome();
  }

  // Deep-Link hat beim Start Vorrang; ohne gueltige Gruppe gilt der gespeicherte Zustand.
  const requestedGroup = new URLSearchParams(location.search).get('group');
  const requestedFavorites = new URLSearchParams(location.search).get('favorites') === '1';
  const initialWorkspace = requestedFavorites ? FAVORITES : requestedGroup !== null && groups.has(requestedGroup)
    ? GROUP_PREFIX + requestedGroup : state.selected;

  function syncGroupURL() {
    const url = new URL(location.href);
    url.searchParams.delete('favorites');
    if (state.selected === FAVORITES) url.searchParams.delete('group');
    else url.searchParams.set('group', state.selected.slice(GROUP_PREFIX.length));
    // Dropdown-Wechsel soll beim Reload nicht zur urspruenglichen Deep-Link-Gruppe zurueckspringen.
    // Keine zusaetzlichen History-Eintraege beim Wechsel innerhalb des Workspace.
    if (url.href !== location.href) {
      try { history.replaceState(history.state, '', url.href); }
      catch (_) { /* z.B. restriktive file://-Umgebung */ }
    }
  }

  syncToolbarPosition();
  populatePicker();
  readFavorites();
  selectWorkspace(initialWorkspace);
  if (requestedGroup !== null || requestedFavorites) syncGroupURL();
  ui.toolbarMenuToggle.addEventListener('click', () => setToolbarMenu(ui.toolbarMenu.hidden));
  ui.toolbarMenuBackdrop.addEventListener('click', () => setToolbarMenu(false, true));
  ui.toolbarPositionToggle.addEventListener('click', () => {
    B.storage.set('workspaceToolbarBottom', !ui.workspace.classList.contains('toolbar-bottom'));
    setToolbarMenu(false, true);
    syncToolbarPosition(true);
    ui.storageNotice.hidden = B.storage.isAvailable();
  });
  ui.offlineManagerLink.addEventListener('click', () => setToolbarMenu(false, true));
  ui.externalApp.addEventListener('click', event => {
    if (ui.externalApp.getAttribute('aria-disabled') === 'true') { event.preventDefault(); return; }
    setToolbarMenu(false, true);
  });
  ui.shareApp.addEventListener('click', async () => {
    const repo = repoMap.get(state.app);
    const appURL = resolveURL(repo?.url);
    const workspaceURL = new URL('index.html', location.href);
    if (state.selected === FAVORITES) workspaceURL.searchParams.set('favorites', '1');
    else workspaceURL.searchParams.set('group', state.selected.slice(GROUP_PREFIX.length));
    // Share the original catalog URL, not an installation-specific offline mirror.
    const url = appURL || workspaceURL.href;
    const title = appURL ? repo.label : workspaceLabel(state.selected) + ' · Boiler Room';
    setToolbarMenu(false, true);
    try {
      if (typeof navigator.share === 'function' && (!navigator.canShare || navigator.canShare({ title, url }))) {
        await navigator.share({ title, url });
        return;
      }
    } catch (error) { if (error.name === 'AbortError') return; }
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        B.toast?.showMessage('Link kopiert.');
        return;
      }
    } catch (_) { /* Clipboard may be blocked or require user activation. */ }
    window.prompt('Link zum Teilen kopieren:', url);
  });
  document.addEventListener('pointerdown', event => {
    if (!ui.toolbarMenu.hidden && !ui.toolbarMenu.contains(event.target) && !ui.toolbarMenuToggle.contains(event.target) && event.target !== ui.toolbarMenuBackdrop) {
      setToolbarMenu(false);
    }
  });
  ui.homeApp.addEventListener('click', showHome);
  ui.homeSearchToggle.addEventListener('click', () => setHomeSearch(ui.homeSearchWrap.hidden, true));
  ui.homeSearch.addEventListener('input', renderHome);
  ui.homeSearch.addEventListener('search', renderHome);
  ui.homeSearchClear.addEventListener('click', () => { ui.homeSearch.value = ''; renderHome(); ui.homeSearch.focus(); });
  ui.homeSearch.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); setHomeSearch(false, true); }
    else if (event.key === 'Enter' && !event.isComposing) { event.preventDefault(); renderHome(); ui.homeSearch.blur(); }
  });
  ui.workspaceSelect.addEventListener('change', () => {
    selectWorkspace(ui.workspaceSelect.value);
    syncGroupURL();
  });
  ui.reloadApp.addEventListener('click', () => {
    if (!state.app) return;
    setToolbarMenu(false, true);
    const label = state.app;
    offlineInitial = refreshOffline();
    removeFrame(label);
    openApp(label, false);
  });
  document.addEventListener('keydown', event => {
    if (event.defaultPrevented) return;
    if (event.key === 'Escape' && edit) {
      event.preventDefault(); endEdit(true);
    } else if (event.key === 'Escape' && !ui.toolbarMenu.hidden) {
      event.preventDefault();
      setToolbarMenu(false, true);
    }
  });
  const handleMotionPreference = () => { if (reducedMotion.matches) { if (surfaceTransition) settleSurfaces(); settleToolbarPosition(); } };
  if (reducedMotion.addEventListener) reducedMotion.addEventListener('change', handleMotionPreference);
  else reducedMotion.addListener(handleMotionPreference);
  const handleViewport = () => { settleToolbarPosition(); setToolbarMenu(false); };
  if (mobile.addEventListener) mobile.addEventListener('change', handleViewport);
  else mobile.addListener(handleViewport);
  window.addEventListener('storage', event => {
    if (event.key === 'boilerRoom' || event.key === null) { refreshFavorites(); renderHome(); syncToolbarPosition(); if (!ui.toolbarMenu.hidden) renderToolbarRecent(); }
  });
  window.addEventListener('pageshow', () => { refreshFavorites(); offlineInitial = refreshOffline(); });
  window.addEventListener('online', () => { offlineInitial = refreshOffline(); });
  window.addEventListener('offline', () => { offlineInitial = refreshOffline(); });
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', event => {
      if (event.data?.protocol === 'boiler-room-offline-v1' && event.data.changed) offlineInitial = refreshOffline();
    });
    navigator.serviceWorker.addEventListener('controllerchange', () => { offlineInitial = refreshOffline(); });
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') { refreshFavorites(); offlineInitial = refreshOffline(); }
  });
})(window.BoilerRoom);
