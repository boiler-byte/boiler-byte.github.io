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
  let edit = null, press = null, homeRefreshPending = false;
  let favoriteGridVisible = false;
  const favoriteMotion = new Map();
  let favoriteExitLayer = null;
  let offlineInitial = refreshOffline();

  async function refreshOffline(render = true) {
    const revision = ++offlineRevision;
    try {
      const records = await B.offline.snapshot();
      if (revision !== offlineRevision) return;
      offlineRecords = new Map(records.map(record => [record.id, record]));
      if (render) {
        if (edit || press) homeRefreshPending = true; else renderHome();
        if (!ui.toolbarMenu.hidden) renderToolbarRecent();
      }
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

  // Keep live favorite cards keyed by label. Only actual membership/order
  // changes animate; worker snapshots and duplicate storage events do not.
  function settleFavoriteMotion() {
    for (const [node, animation] of favoriteMotion) animation.cancel();
    favoriteMotion.clear();
    favoriteExitLayer?.remove(); favoriteExitLayer = null;
  }
  function playFavoriteMotion(node, frames, duration, cleanup = () => {}) {
    favoriteMotion.get(node)?.cancel();
    const animation = node.animate(frames, { duration, easing: 'cubic-bezier(.22,.61,.36,1)' });
    favoriteMotion.set(node, animation);
    const finish = () => {
      if (favoriteMotion.get(node) !== animation) return;
      favoriteMotion.delete(node); cleanup();
    };
    animation.finished.then(finish, finish);
  }
  function favoriteVisual(node) {
    const rect = node.getBoundingClientRect();
    return { rect, opacity: getComputedStyle(node).opacity };
  }
  function animateFavoriteExit(grid, node, visual, origin) {
    if (!visual.rect.width || !visual.rect.height) return;
    if (!favoriteExitLayer) {
      favoriteExitLayer = document.createElement('div');
      favoriteExitLayer.className = 'favorite-exit-layer';
      favoriteExitLayer.inert = true;
      favoriteExitLayer.setAttribute('aria-hidden', 'true');
      grid.append(favoriteExitLayer);
    }
    const layer = favoriteExitLayer;
    // The removed card is purely visual and no longer occupies a grid cell.
    // Use a clone so no active controls, focus or pointer listeners survive.
    const ghost = node.cloneNode(true);
    ghost.classList.add('favorite-exit');
    ghost.style.left = `${visual.rect.left - origin.left}px`;
    ghost.style.top = `${visual.rect.top - origin.top}px`;
    ghost.style.width = `${visual.rect.width}px`;
    ghost.style.height = `${visual.rect.height}px`;
    layer.append(ghost);
    playFavoriteMotion(ghost, [
      { opacity: visual.opacity, transform: 'scale(1)' },
      { opacity: 0, transform: 'scale(.88)' }
    ], 220, () => {
      ghost.remove();
      if (!layer.children.length) { layer.remove(); if (favoriteExitLayer === layer) favoriteExitLayer = null; }
    });
  }
  function emptyHomeItem(message) {
    const empty = document.createElement('p');
    empty.className = 'home-empty'; empty.textContent = message;
    return empty;
  }
  function updateFavoriteCard(card, repo) {
    const offline = Boolean(B.offline.localEntry(repo, offlineRecords.get(repo.label)));
    const button = card.querySelector('.app-item');
    const type = card.querySelector('.app-type');
    const label = types[repo.type]?.label || repo.type || 'App';
    type.textContent = label + (offline ? ' · Offline' : '');
    button.title = repo.label + (offline ? ' · Offline-Paket vorhanden' : '');
    // A card inherited from a different workspace might still have its star.
    card.querySelector('.workspace-fav')?.remove();
  }
  function renderFavoriteGrid(grid, repos, emptyMessage, animate) {
    const old = [...grid.children].filter(node => node.classList.contains('app-card') || node.classList.contains('home-empty'));
    const oldCards = new Map(old.filter(node => node.classList.contains('app-card')).map(node => [node.dataset.label, node]));
    const empty = old.find(node => node.classList.contains('home-empty'));
    const next = repos.map(repo => {
      const card = oldCards.get(repo.label) || createAppItem(repo, true);
      updateFavoriteCard(card, repo); return card;
    });
    if (!next.length && emptyMessage) next.push(empty || emptyHomeItem(emptyMessage));
    const changed = old.length !== next.length || old.some((node, i) => node !== next[i]);
    if (!changed) return;
    const motion = animate && !reducedMotion.matches && !surfaceTransition && typeof grid.animate === 'function';
    const visuals = motion ? new Map(old.map(node => [node, favoriteVisual(node)])) : new Map();
    // A newer change starts at the actual displayed positions. Let unrelated
    // exits finish, but remove an old ghost if that same card is re-added.
    if (!motion) settleFavoriteMotion();
    else {
      for (const node of old) {
        const animation = favoriteMotion.get(node);
        if (animation) { favoriteMotion.delete(node); animation.cancel(); }
      }
      const returning = new Set(next.map(node => node.dataset.label || ''));
      if (favoriteExitLayer) {
        for (const ghost of [...favoriteExitLayer.children]) {
          if (!returning.has(ghost.dataset.label || '')) continue;
          const animation = favoriteMotion.get(ghost);
          favoriteMotion.delete(ghost); animation?.cancel(); ghost.remove();
        }
        if (!favoriteExitLayer.children.length) { favoriteExitLayer.remove(); favoriteExitLayer = null; }
      }
    }
    const nextSet = new Set(next);
    for (const node of old) if (!nextSet.has(node)) node.remove();
    next.forEach((node, i) => {
      if (grid.children[i] !== node) grid.insertBefore(node, grid.children[i] || null);
    });
    if (!motion) return;
    const origin = grid.getBoundingClientRect();
    for (const node of old) if (!nextSet.has(node)) animateFavoriteExit(grid, node, visuals.get(node), origin);
    for (const node of next) {
      const before = visuals.get(node), after = node.getBoundingClientRect();
      if (!after.width || !after.height) continue;
      if (!before || !before.rect.width || !before.rect.height) {
        playFavoriteMotion(node, [
          { opacity: 0, transform: 'translateY(8px) scale(.92)' },
          { opacity: 1, transform: 'translateY(0) scale(1)' }
        ], 280);
        continue;
      }
      const dx = before.rect.left - after.left, dy = before.rect.top - after.top;
      const sx = before.rect.width / after.width, sy = before.rect.height / after.height;
      if (Math.abs(dx) < .5 && Math.abs(dy) < .5 && Math.abs(sx - 1) < .005 && Math.abs(sy - 1) < .005 && Number(before.opacity) >= .999) continue;
      playFavoriteMotion(node, [
        { opacity: before.opacity, transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`, transformOrigin: 'top left' },
        { opacity: 1, transform: 'none', transformOrigin: 'top left' }
      ], 300);
    }
  }
  function renderHomeGrid(grid, repos, emptyMessage) {
    const favorites = grid === ui.homeWorkspaceApps && state.selected === FAVORITES;
    grid.classList.toggle('reorderable', favorites);
    if (favorites) {
      if (!favoriteGridVisible) { settleFavoriteMotion(); grid.replaceChildren(); }
      renderFavoriteGrid(grid, repos, emptyMessage, favoriteGridVisible);
      favoriteGridVisible = true;
      return;
    }
    if (grid === ui.homeWorkspaceApps) { favoriteGridVisible = false; settleFavoriteMotion(); }
    grid.replaceChildren(...repos.map(repo => createAppItem(repo, true)));
    if (!repos.length && emptyMessage) grid.append(emptyHomeItem(emptyMessage));
  }

  function renderHome() {
    if (ui.homeView.hidden) { favoriteGridVisible = false; settleFavoriteMotion(); return; }
    finishPress(false);
    closeEdit(false);
    homeRefreshPending = false;
    const query = B.searchRelevance.normalize(ui.homeSearch.value);
    const recent = recentLabels();
    const repos = query ? searchCatalog(query) : recent.slice(0, 9).map(label => repoMap.get(label));
    ui.homeRecentSection.hidden = !query && !recent.length;
    ui.homeWorkspaceSection.hidden = Boolean(query);
    if (query) { favoriteGridVisible = false; settleFavoriteMotion(); }
    ui.homeTitle.textContent = query ? 'Suchergebnisse' : 'Zuletzt verwendet';
    ui.homeCount.textContent = String(repos.length);
    ui.homeSearchClear.hidden = !ui.homeSearch.value;
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
    if (next !== ui.homeView || previous !== ui.homeView) { favoriteGridVisible = false; settleFavoriteMotion(); }
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
    finishPress(false);
    closeEdit(false);
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
      const oldStar = button.querySelector('svg');
      const rect = oldStar.getBoundingClientRect();
      const added = B.favorites.toggleFavorite(repo.label);
      refreshFavorites();
      // The new favorite is hidden on re-render; a detached visual star finishes
      // the original bounce without keeping a second interactive control alive.
      if (!reducedMotion.matches && typeof oldStar.animate === 'function' && rect.width && rect.height) {
        const ghost = oldStar.cloneNode(true);
        ghost.classList.add('workspace-fav-ghost');
        if (added) ghost.classList.add('is-fav');
        const size = added ? 13 : 26;
        ghost.style.left = `${rect.left + rect.width / 2 - size / 2}px`;
        ghost.style.top = `${rect.top + rect.height / 2 - size / 2}px`;
        document.body.append(ghost);
        animateFavoriteStar(ghost, added, true);
      }
      (ui.homeSearchWrap.hidden ? ui.homeSearchToggle : ui.homeSearch).focus({ preventScroll: true });
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

  function createAppItem(repo, card = false, recent = false) {
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
      if (card && (item.classList.contains('is-editing') || item._suppressClickUntil > Date.now())) { event.preventDefault(); return; }
      openApp(repo.label);
      if (recent) ui.toolbarMenuToggle.focus({ preventScroll: true });
    });
    item.append(button);
    if (card) {
      item.dataset.label = repo.label;
      button.setAttribute('aria-haspopup', 'true');
      button.draggable = false;
      bindAppEdit(item, button, repo);
    }
    if (!recent && !B.favorites.isFavorite(repo.label)) item.append(createFavoriteButton(repo));
    return item;
  }

  // One edit session at a time. Long press works with mouse, pen and touch.
  const HOLD_MS = 480, MOVE_THRESHOLD = 10;
  const editButton = (className, label, glyph) => {
    const button = document.createElement('button');
    button.type = 'button'; button.className = className;
    button.title = label; button.setAttribute('aria-label', label);
    button.textContent = glyph;
    return button;
  };
  function flushHomeRefresh() {
    if (homeRefreshPending && !edit && !press) renderHome();
  }
  function closeEdit(refresh = true) {
    if (edit) {
      const current = edit; edit = null;
      current.item.classList.remove('is-editing', 'edit-ready');
      current.item.querySelectorAll('.app-edit-control, .app-context-menu').forEach(el => el.remove());
    }
    if (refresh) flushHomeRefresh();
  }
  function beginEdit(item, repo) {
    closeEdit(false);
    edit = { item, repo, menu: null, busy: false, description: null, checking: false };
    item.classList.add('is-editing');
    return edit;
  }
  function showEditControls(current) {
    if (edit !== current || current.item.classList.contains('edit-ready')) return;
    const { item, repo } = current;
    const more = editButton('app-edit-control app-edit-more', 'Kontextmenü: ' + repo.label, '⋯');
    const exit = editButton('app-edit-control app-edit-exit', 'Edit-Modus beenden', '×');
    more.setAttribute('aria-expanded', 'false');
    more.addEventListener('click', () => {
      if (current.menu) { hideContext(current); return; }
      openContext(current, more);
    });
    exit.addEventListener('click', () => { closeEdit(); item.querySelector('.app-item')?.focus({preventScroll:true}); });
    item.append(more, exit); item.classList.add('edit-ready');
  }
  function hideContext(current) {
    current.menu?.remove(); current.menu = null;
    current.item.querySelector('.app-edit-more')?.setAttribute('aria-expanded', 'false');
  }
  function positionContext(current) {
    if (!current.menu) return;
    const menu = current.menu, card = current.item.getBoundingClientRect(), view = ui.homeView.getBoundingClientRect();
    menu.style.maxWidth = `${Math.max(120, view.width - 24)}px`;
    menu.style.left = `${Math.max(view.left + 8 - card.left, Math.min(0, view.right - 8 - card.left - menu.offsetWidth))}px`;
    const below = view.bottom - card.top - 32, above = card.top - view.top - 8;
    const flip = below < menu.scrollHeight && above > below;
    menu.style.maxHeight = `${Math.max(64, flip ? above : below)}px`;
    menu.style.top = flip ? `${-menu.offsetHeight - 8}px` : '30px';
  }
  function paintContext(current) {
    if (edit !== current || !current.menu) return;
    const { repo, menu, description } = current;
    const busy = current.busy || offlineOperations.has(repo.label);
    menu.replaceChildren();
    const action = (label, run, disabled = false) => {
      const button = document.createElement('button');
      button.type = 'button'; button.textContent = label; button.disabled = disabled;
      button.addEventListener('click', run); menu.append(button);
    };
    const note = text => { const p = document.createElement('p'); p.textContent = text; menu.append(p); };
    B.favorites.load();
    action(B.favorites.isFavorite(repo.label) ? 'Favorit entfernen' : 'Favorit hinzufügen', () => {
      B.favorites.toggleFavorite(repo.label); closeEdit(false); refreshFavorites(); flushHomeRefresh();
    }, busy);
    const installed = offlineRecords.get(repo.label);
    if (repo.boiler_room_pwa === true) {
      if (current.checking) note('Version wird geprüft …');
      if (description?.kind === 'package') {
        const status = B.offline.status(description, installed);
        if (status === 'update') action('Update', () => runContextAction(current, 'update'), busy || current.checking || !navigator.onLine || !B.offline.supported);
        if (!installed || status === 'incomplete') action('Installieren', () => runContextAction(current, 'install'), busy || current.checking || !navigator.onLine || !B.offline.supported);
      }
      if (current.error) note(current.error);
      else if (description?.kind === 'unknown' || description?.kind === 'unsupported') note(description.reason || 'Kein Offline-Paket verfügbar.');
    }
    // Existing packages can always be explicitly removed, even after revoking PWA opt-in.
    if (installed) action('Deinstallieren', () => runContextAction(current, 'remove'), busy || !B.offline.supported);
    if (busy) note(current.progress || 'Offline-Vorgang läuft …');
    positionContext(current);
  }
  async function openContext(current, more) {
    const menu = document.createElement('div');
    menu.className = 'app-context-menu';
    menu.setAttribute('role', 'group'); menu.setAttribute('aria-label', 'App-Aktionen');
    current.item.append(menu); current.menu = menu;
    more.setAttribute('aria-expanded', 'true');
    current.error = '';
    const eligible = current.repo.boiler_room_pwa === true && B.offline.describe(current.repo).kind === 'candidate';
    current.checking = eligible && !offlineOperations.has(current.repo.label);
    paintContext(current);
    if (!eligible || offlineOperations.has(current.repo.label)) return;
    try {
      // The worker uses the existing 24h / 7d interval and shared persistent cache.
      // No forced check, no network request while offline.
      current.description = B.offline.supported
        ? await B.offline.discover(current.repo, { force: false, cacheOnly: !navigator.onLine })
        : await B.offline.cachedDescription(current.repo);
    } catch (error) {
      current.description = await B.offline.cachedDescription(current.repo).catch(() => null);
      current.error = error.message;
    } finally {
      current.checking = false; paintContext(current);
    }
  }
  const offlineOperations = new Set();
  async function runContextAction(current, action) {
    const { repo } = current;
    if (current.busy || offlineOperations.has(repo.label)) return;
    offlineOperations.add(repo.label); current.busy = true; current.error = ''; current.progress = '';
    paintContext(current);
    try {
      if (action === 'remove') {
        await B.offline.request('remove', { id: repo.label });
        offlineRecords.delete(repo.label);
      } else {
        const result = await B.offline.request('install', { repo: { label: repo.label, url: repo.url } }, progress => {
          current.progress = `${progress.done}/${progress.total} Dateien`; paintContext(current);
        });
        offlineRecords.set(repo.label, { ...result, complete: true });
        current.description = { kind: 'package', pkg: result };
      }
      B.toast?.showMessage(action === 'remove' ? 'App deinstalliert.' : action === 'update' ? 'App aktualisiert.' : 'App installiert.');
    } catch (error) {
      current.error = error.message; B.toast?.showMessage(error.message);
    } finally {
      offlineOperations.delete(repo.label); current.busy = false; current.progress = '';
      await refreshOffline(); paintContext(current);
      if (edit && edit !== current && edit.repo.label === repo.label) paintContext(edit);
    }
  }
  function bindAppEdit(item, button, repo) {
    button.addEventListener('pointerdown', event => {
      if (!event.isPrimary || event.button !== 0 || press) return;
      if (edit?.item !== item) closeEdit(false);
      const grid = item.parentElement;
      const reorderable = grid === ui.homeWorkspaceApps && state.selected === FAVORITES;
      const g = { item, button, repo, grid, reorderable, id: event.pointerId, type: event.pointerType,
        x: event.clientX, y: event.clientY, lastY: event.clientY, held: false, moved: false, dragging: false, timer: 0 };
      press = g;
      g.timer = setTimeout(() => {
        if (press !== g || !item.isConnected) return;
        g.held = true; g.current = beginEdit(item, repo);
        try { ui.homeView.setPointerCapture(g.id); } catch (_) {}
      }, HOLD_MS);
    });
    button.addEventListener('contextmenu', event => {
      event.preventDefault();
      if (press) return; // touch-generated contextmenu during a long press
      const current = edit?.item === item ? edit : beginEdit(item, repo);
      showEditControls(current);
    });
    button.addEventListener('keydown', event => {
      if (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10')) {
        event.preventDefault(); showEditControls(edit?.item === item ? edit : beginEdit(item, repo));
        item.querySelector('.app-edit-more')?.focus();
      }
    });
    button.addEventListener('dragstart', event => event.preventDefault());
  }
  function startDrag(g) {
    settleFavoriteMotion();
    g.dragging = true; g.original = [...g.grid.children];
    const rect = g.item.getBoundingClientRect();
    g.offsetX = g.x - rect.left; g.offsetY = g.y - rect.top;
    g.ghost = g.item.cloneNode(true); g.ghost.classList.add('app-drag-ghost');
    g.ghost.setAttribute('aria-hidden','true'); g.ghost.inert = true;
    g.ghost.style.width = `${rect.width}px`; g.ghost.style.height = `${rect.height}px`;
    document.body.append(g.ghost); g.item.classList.add('is-dragging');
  }
  function moveDrag(g, x, y) {
    g.ghost.style.left = `${x - g.offsetX}px`; g.ghost.style.top = `${y - g.offsetY}px`;
    const target = document.elementFromPoint(x, y)?.closest('.app-card');
    if (target && target !== g.item && target.parentElement === g.grid) {
      const children = [...g.grid.children];
      g.grid.insertBefore(g.item, children.indexOf(g.item) < children.indexOf(target) ? target.nextSibling : target);
    }
  }
  function saveDragOrder(g) {
    const visible = [...g.grid.querySelectorAll('.app-card')].map(el => el.dataset.label);
    const visibleSet = new Set(visible);
    const favorites = B.storage.get('favorites'), favoriteSet = new Set(favorites);
    const order = [...new Set([...B.storage.get('favoriteOrder').filter(label => favoriteSet.has(label)), ...favorites])];
    // Replace only the displayed favorite slots; preserve other stored favorites.
    const sorted = visible.filter(label => favoriteSet.has(label));
    let index = 0;
    B.favorites.setOrder(order.map(label => visibleSet.has(label) ? sorted[index++] : label));
    activeRepos = readFavorites(); ui.storageNotice.hidden = B.storage.isAvailable();
  }
  function finishPress(commit = true) {
    const g = press; if (!g) return;
    press = null; clearTimeout(g.timer);
    if (g.raf) cancelAnimationFrame(g.raf);
    if (g.held || g.moved) g.item._suppressClickUntil = Date.now() + 450;
    if (g.dragging) {
      g.ghost.remove(); g.item.classList.remove('is-dragging');
      if (commit) saveDragOrder(g); else g.grid.append(...g.original);
    }
    if (g.held && commit) showEditControls(g.current);
    else if (g.held) closeEdit(false);
    try { if (ui.homeView.hasPointerCapture(g.id)) ui.homeView.releasePointerCapture(g.id); } catch (_) {}
  }
  document.addEventListener('pointermove', event => {
    const g = press; if (!g || event.pointerId !== g.id) return;
    const distance = Math.hypot(event.clientX - g.x, event.clientY - g.y);
    if (!g.held && distance > MOVE_THRESHOLD) { clearTimeout(g.timer); g.moved = true; }
    if (!g.held && g.moved && g.reorderable && g.type === 'touch') {
      ui.homeView.scrollTop += g.lastY - event.clientY; event.preventDefault();
    }
    g.lastY = event.clientY;
    if (!g.held || !g.reorderable || distance <= MOVE_THRESHOLD && !g.dragging) return;
    if (!g.dragging) startDrag(g);
    event.preventDefault(); moveDrag(g, event.clientX, event.clientY);
    g.dragX = event.clientX; g.dragY = event.clientY;
    if (!g.raf) {
      const tick = () => {
        if (press !== g || !g.dragging) return;
        const rect = ui.homeView.getBoundingClientRect();
        const delta = g.dragY < rect.top + 45 ? -9 : g.dragY > rect.bottom - 45 ? 9 : 0;
        if (delta) { ui.homeView.scrollTop += delta; moveDrag(g, g.dragX, g.dragY); }
        g.raf = requestAnimationFrame(tick);
      };
      g.raf = requestAnimationFrame(tick);
    }
  }, { passive: false });
  document.addEventListener('pointerup', event => { if (press?.id === event.pointerId) { finishPress(); if (!edit && homeRefreshPending) setTimeout(flushHomeRefresh, 0); } });
  document.addEventListener('pointercancel', event => { if (press?.id === event.pointerId) { finishPress(false); flushHomeRefresh(); } });
  window.addEventListener('blur', () => { finishPress(false); closeEdit(); });
  ui.homeView.addEventListener('scroll', () => { if (edit?.menu) positionContext(edit); }, { passive: true });
  window.addEventListener('resize', () => { if (edit?.menu) positionContext(edit); });

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
    finishPress(false);
    closeEdit(false);
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
    if (edit && !edit.item.contains(event.target) && !press) { closeEdit(false); if (homeRefreshPending) setTimeout(flushHomeRefresh, 0); }
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
    if (event.key === 'Escape' && (edit || press)) {
      event.preventDefault(); const item = edit?.item; finishPress(false); closeEdit(); item?.querySelector('.app-item')?.focus({preventScroll:true}); return;
    }
    if (event.key === 'Escape' && !ui.toolbarMenu.hidden) {
      event.preventDefault();
      setToolbarMenu(false, true);
    }
  });
  const handleMotionPreference = () => { if (reducedMotion.matches) { if (surfaceTransition) settleSurfaces(); settleToolbarPosition(); settleFavoriteMotion(); } };
  if (reducedMotion.addEventListener) reducedMotion.addEventListener('change', handleMotionPreference);
  else reducedMotion.addListener(handleMotionPreference);
  const handleViewport = () => { finishPress(false); closeEdit(); settleToolbarPosition(); settleFavoriteMotion(); setToolbarMenu(false); };
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
