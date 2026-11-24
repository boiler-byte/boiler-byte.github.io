/* Eigenstaendige Workspace-App. Katalog & Einstellungen kommen vom Boiler Room.
   Repos werden nach Bedarf in ungesandboxte, wiederverwendbare iFrames geladen. */
(function (B) {
  'use strict';

  const FAVORITES = 'favorites';
  const GROUP_PREFIX = 'group:';
  const rootURL = new URL('../', location.href);
  const $ = id => document.getElementById(id);
  const ui = Object.fromEntries([
    'workspace', 'sidebar', 'sidebarClose', 'sidebarToggle', 'backdrop', 'workspaceSelect',
    'workspaceLabel', 'appSearch', 'appSearchClear', 'appCount', 'appList', 'storageNotice', 'main', 'currentWorkspace', 'currentApp',
    'reloadApp', 'fullscreenToggle', 'fullscreenEnterIcon', 'fullscreenExitIcon', 'fullscreenNotice', 'externalApp', 'emptyView', 'emptyTitle', 'emptyDescription', 'emptyLink',
    'frames', 'loading'
  ].map(id => [id, $(id)]));
  const mobile = window.matchMedia('(max-width: 700px)');
  const types = B.data.types;
  const repoMap = new Map();
  const groups = new Map();
  const frames = new Map();
  // Keine Sandbox; notwendige Browser-Berechtigungen explizit an die App delegieren.
  // Die Berechtigungen des Top-Level-Dokuments und Browser-Abfragen gelten weiterhin.
  const framePermissions = [
    'autoplay', 'camera', 'microphone', 'geolocation', 'fullscreen', 'clipboard-read',
    'clipboard-write', 'display-capture', 'gamepad', 'accelerometer', 'gyroscope',
    'magnetometer', 'encrypted-media', 'picture-in-picture', 'web-share',
    'screen-wake-lock', 'midi'
  ].map(feature => feature + ' *').join('; ');

  function groupIds(repo) {
    return [...new Set([repo.group, repo.groups].flat().filter(id => typeof id === 'string' && id.trim()))];
  }

  for (const [id, group] of Object.entries(B.data.repogroups || {})) {
    if (!id.trim()) continue;
    groups.set(id, { label: typeof group === 'string' ? group : group?.label || id, repos: [] });
  }
  for (const repo of B.data.repos) {
    if (!repo || typeof repo.label !== 'string' || !repo.label.trim() || repoMap.has(repo.label)) continue;
    repoMap.set(repo.label, repo);
    for (const id of groupIds(repo)) {
      if (!groups.has(id)) groups.set(id, { label: id, repos: [] });
      groups.get(id).repos.push(repo);
    }
  }

  B.storage.init();
  let state = B.storage.get('workspace');
  let activeRepos = [];
  let drawerOpen = false;
  let favoritesSignature = '';
  let drawerPreviousFocus = null;
  let searchQuery = '';
  let searchTimer = null;
  let fullscreenNoticeTimer = null;

  function resolveURL(value) {
    if (typeof value !== 'string' || !value.trim()) return null;
    try {
      const url = new URL(value.trim(), rootURL);
      // Relative und absolute Web-URLs. Keine javascript:/data:-Dokumente als Apps.
      return ['http:', 'https:', 'file:'].includes(url.protocol) ? url.href : null;
    } catch (_) { return null; }
  }

  function workspaceExists(id) {
    return id === FAVORITES || (typeof id === 'string' && id.startsWith(GROUP_PREFIX) && groups.has(id.slice(GROUP_PREFIX.length)));
  }

  function workspaceLabel(id) {
    return id === FAVORITES ? 'Mein Workspace' : groups.get(id.slice(GROUP_PREFIX.length))?.label || 'Workspace';
  }

  function readFavorites() {
    const favorites = B.storage.get('favorites');
    const order = B.storage.get('favoriteOrder');
    const set = new Set(favorites);
    const labels = [...new Set([...order.filter(label => set.has(label)), ...favorites])];
    favoritesSignature = JSON.stringify(labels);
    return labels.map(label => repoMap.get(label)).filter(Boolean);
  }

  function members(id) {
    return id === FAVORITES ? readFavorites() : groups.get(id.slice(GROUP_PREFIX.length))?.repos || [];
  }

  function persist() {
    // Alte bzw. umbenannte Gruppen und Apps nicht dauerhaft als Auswahl behalten.
    const favorites = new Set(B.storage.get('favorites'));
    const lastApps = Object.fromEntries(Object.entries(state.lastApps).filter(([id, label]) => {
      if (!workspaceExists(id)) return false;
      if (id === FAVORITES) return favorites.has(label) && repoMap.has(label);
      return groups.get(id.slice(GROUP_PREFIX.length)).repos.some(repo => repo.label === label);
    }));
    if (state.app !== null) lastApps[state.selected] = state.app;
    else delete lastApps[state.selected];
    state.lastApps = lastApps;
    B.storage.set('workspace', state);
    ui.storageNotice.hidden = B.storage.isAvailable();
  }

  function populatePicker() {
    ui.workspaceSelect.append(new Option('Mein Workspace', FAVORITES));
    for (const [id, group] of groups) {
      ui.workspaceSelect.append(new Option(group.label, GROUP_PREFIX + id));
    }
  }

  function createAppItem(repo) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'app-item';
    button.dataset.label = repo.label;
    button.title = repo.label;
    const icon = document.createElement('span');
    icon.className = 'app-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = repo.icon || repo.label.slice(0, 1).toLocaleUpperCase('de');
    const imgURL = resolveURL(repo.img);
    if (imgURL) {
      const image = new Image();
      image.alt = '';
      image.loading = 'lazy';
      image.style.opacity = '0';
      image.addEventListener('load', () => { image.style.opacity = '1'; }, { once: true });
      image.addEventListener('error', () => image.remove(), { once: true });
      image.src = imgURL;
      icon.append(image);
    }
    const copy = document.createElement('span');
    copy.className = 'app-copy';
    const name = document.createElement('span');
    name.className = 'app-name';
    name.textContent = repo.label;
    const type = document.createElement('span');
    type.className = 'app-type';
    type.dataset.type = repo.type || '';
    type.textContent = resolveURL(repo.url) ? (types[repo.type]?.label || repo.type || 'App') : 'Information';
    copy.append(name, type);
    const dot = document.createElement('span');
    dot.className = 'active-dot';
    dot.setAttribute('aria-hidden', 'true');
    button.append(icon, copy, dot);
    button.addEventListener('click', () => {
      openApp(repo.label);
      if (mobile.matches) setSidebar(false, true);
    });
    return button;
  }

  function updateAppSelection() {
    for (const button of ui.appList.querySelectorAll('.app-item')) {
      const active = button.dataset.label === state.app;
      button.classList.toggle('is-active', active);
      if (active) button.setAttribute('aria-current', 'true');
      else button.removeAttribute('aria-current');
    }
  }

  function renderList() {
    const fragment = document.createDocumentFragment();
    const searching = Boolean(searchQuery);
    const visibleRepos = searching ? activeRepos
      .map((repo, index) => ({ repo, index, score: B.searchRelevance.score(repo, searchQuery) }))
      .filter(item => item.score >= 0)
      .sort((a, b) => b.score - a.score || a.index - b.index)
      .map(item => item.repo) : activeRepos;
    if (!visibleRepos.length) {
      const empty = document.createElement('p');
      empty.className = 'list-empty';
      empty.textContent = !activeRepos.length
        ? (state.selected === FAVORITES ? 'Noch keine Favoriten.' : 'Keine Repos in dieser Gruppe.')
        : 'Keine passenden Apps gefunden.';
      fragment.append(empty);
    }
    visibleRepos.forEach(repo => fragment.append(createAppItem(repo)));
    ui.appList.replaceChildren(fragment);
    ui.appCount.textContent = searching ? `${visibleRepos.length} / ${activeRepos.length}` : String(activeRepos.length);
    ui.appCount.setAttribute('aria-label', searching ? `${visibleRepos.length} von ${activeRepos.length} Apps` : `${activeRepos.length} Apps`);
    updateAppSelection();
  }

  function applySearch() {
    clearTimeout(searchTimer);
    searchTimer = null;
    searchQuery = B.searchRelevance.normalize(ui.appSearch.value);
    ui.appSearchClear.hidden = !ui.appSearch.value;
    renderList();
    ui.appList.scrollTop = 0;
  }

  function resetSearch(render = true) {
    clearTimeout(searchTimer);
    searchTimer = null;
    ui.appSearch.value = '';
    ui.appSearchClear.hidden = true;
    searchQuery = '';
    if (render) renderList();
  }

  function setupSearch() {
    ui.appSearch.addEventListener('input', () => {
      ui.appSearchClear.hidden = !ui.appSearch.value;
      clearTimeout(searchTimer);
      searchTimer = setTimeout(applySearch, 180);
    });
    ui.appSearchClear.addEventListener('click', () => {
      resetSearch();
      ui.appSearch.focus();
    });
    ui.appSearch.addEventListener('keydown', event => {
      if (event.key === 'Enter' && !event.isComposing) {
        event.preventDefault();
        applySearch();
        ui.appSearch.blur();
      } else if (event.key === 'Escape' && ui.appSearch.value) {
        event.preventDefault();
        resetSearch();
      }
    });
    ui.appSearch.addEventListener('search', () => {
      applySearch();
      ui.appSearch.blur();
    });
  }

  function fullscreenElement() {
    return document.fullscreenElement || document.webkitFullscreenElement || null;
  }

  function fullscreenSupported() {
    return Boolean((ui.workspace.requestFullscreen && document.fullscreenEnabled !== false)
      || (ui.workspace.webkitRequestFullscreen && document.webkitFullscreenEnabled !== false));
  }

  function syncFullscreen() {
    const active = Boolean(fullscreenElement());
    const supported = fullscreenSupported();
    const label = active ? 'Vollbild beenden' : supported ? 'Vollbild öffnen' : 'Vollbild in diesem Browser nicht verfügbar';
    ui.fullscreenToggle.disabled = !active && !supported;
    ui.fullscreenToggle.title = label;
    ui.fullscreenToggle.setAttribute('aria-label', label);
    ui.fullscreenToggle.setAttribute('aria-pressed', String(active));
    ui.fullscreenEnterIcon.toggleAttribute("hidden", active);
    ui.fullscreenExitIcon.toggleAttribute("hidden", !active);
  }

  function fullscreenFailed() {
    clearTimeout(fullscreenNoticeTimer);
    ui.fullscreenNotice.textContent = 'Vollbild konnte nicht umgeschaltet werden.';
    ui.fullscreenNotice.hidden = false;
    fullscreenNoticeTimer = setTimeout(() => { ui.fullscreenNotice.hidden = true; }, 4500);
    syncFullscreen();
  }

  async function toggleFullscreen() {
    try {
      if (fullscreenElement()) {
        const exit = document.exitFullscreen || document.webkitExitFullscreen;
        if (!exit) throw new Error('Fullscreen exit not supported');
        await exit.call(document);
      } else {
        const request = (document.fullscreenEnabled !== false && ui.workspace.requestFullscreen) || ui.workspace.webkitRequestFullscreen;
        if (!request) throw new Error('Fullscreen not supported');
        await request.call(ui.workspace);
      }
      syncFullscreen();
    } catch (_) { fullscreenFailed(); }
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
    entry.frame.remove();
    frames.delete(label);
  }

  function showEmpty(repo) {
    ui.frames.hidden = true;
    ui.emptyView.hidden = false;
    setLoading(null);
    ui.externalApp.hidden = true;
    ui.externalApp.removeAttribute('href');
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
      ui.emptyDescription.textContent = activeRepos.length ? 'Wähle eine App in der Sidebar aus.' : 'Dieser Repo-Gruppe sind noch keine Apps zugeordnet.';
    }
  }

  function openApp(label, save = true) {
    const repo = activeRepos.find(item => item.label === label) || null;
    state.app = repo?.label || null;
    if (save) persist();
    updateAppSelection();
    ui.currentApp.textContent = repo?.label || 'Workspace';
    document.title = (repo ? repo.label + ' · ' : '') + workspaceLabel(state.selected) + ' · Boiler Room';
    for (const entry of frames.values()) entry.frame.hidden = true;
    const url = resolveURL(repo?.url);
    if (!repo || !url) {
      showEmpty(repo);
      return;
    }
    let entry = frames.get(repo.label);
    if (entry && entry.url !== url) {
      removeFrame(repo.label);
      entry = null;
    }
    if (!entry) entry = createFrame(repo, url);
    ui.emptyView.hidden = true;
    ui.frames.hidden = false;
    entry.frame.hidden = false;
    ui.reloadApp.disabled = false;
    ui.externalApp.href = url;
    ui.externalApp.hidden = false;
    setLoading(entry);
  }

  function selectWorkspace(id, initial = false) {
    const previous = state.selected;
    if (state.app && !initial) state.lastApps[previous] = state.app;
    state.selected = workspaceExists(id) ? id : FAVORITES;
    const same = state.selected === previous;
    activeRepos = members(state.selected);
    ui.workspaceSelect.value = state.selected;
    ui.workspaceLabel.textContent = workspaceLabel(state.selected);
    ui.currentWorkspace.textContent = workspaceLabel(state.selected);
    if (!same) resetSearch(false);
    const wanted = (same ? state.app : null) || state.lastApps[state.selected];
    const repo = activeRepos.find(item => item.label === wanted)
      || activeRepos.find(item => resolveURL(item.url)) || activeRepos[0];
    renderList();
    openApp(repo?.label || null);
    ui.appList.querySelector('.is-active')?.scrollIntoView({ block: 'nearest' });
  }

  function syncSidebar() {
    const isMobile = mobile.matches;
    const visible = isMobile ? drawerOpen : !state.sidebarCollapsed;
    ui.sidebar.hidden = !visible;
    ui.workspace.classList.toggle('sidebar-collapsed', !isMobile && !visible);
    ui.backdrop.hidden = !isMobile || !drawerOpen;
    ui.sidebarToggle.setAttribute('aria-expanded', String(visible));
    const label = visible ? 'Sidebar ausblenden' : 'Sidebar einblenden';
    ui.sidebarToggle.setAttribute('aria-label', label);
    ui.sidebarToggle.title = label;
    // Der mobile Drawer ist modal; App-Inhalt darf dahinter nicht fokussiert werden.
    ui.main.inert = isMobile && drawerOpen;
    if (isMobile && drawerOpen) {
      ui.sidebar.setAttribute('role', 'dialog');
      ui.sidebar.setAttribute('aria-modal', 'true');
    } else {
      ui.sidebar.removeAttribute('role');
      ui.sidebar.removeAttribute('aria-modal');
    }
  }

  function setSidebar(visible, restoreFocus = false) {
    if (mobile.matches) {
      if (visible && !drawerOpen) drawerPreviousFocus = document.activeElement;
      drawerOpen = visible;
    } else {
      state.sidebarCollapsed = !visible;
      persist();
    }
    syncSidebar();
    if (visible && mobile.matches) ui.workspaceSelect.focus();
    if (!visible && restoreFocus) {
      const target = drawerPreviousFocus === ui.sidebarToggle ? drawerPreviousFocus : ui.sidebarToggle;
      target.focus();
      drawerPreviousFocus = null;
    }
  }

  function refreshFavorites() {
    const before = favoritesSignature;
    const next = readFavorites();
    if (before === favoritesSignature || state.selected !== FAVORITES) return;
    const activeStillExists = next.some(repo => repo.label === state.app);
    activeRepos = next;
    renderList();
    if (!activeStillExists) {
      const repo = activeRepos.find(item => resolveURL(item.url)) || activeRepos[0];
      openApp(repo?.label || null);
    } else updateAppSelection();
  }

  populatePicker();
  readFavorites();
  selectWorkspace(state.selected, true);
  syncSidebar();
  setupSearch();
  syncFullscreen();
  ui.fullscreenToggle.addEventListener('click', toggleFullscreen);
  document.addEventListener('fullscreenchange', syncFullscreen);
  document.addEventListener('webkitfullscreenchange', syncFullscreen);
  document.addEventListener('fullscreenerror', fullscreenFailed);
  document.addEventListener('webkitfullscreenerror', fullscreenFailed);
  ui.workspaceSelect.addEventListener('change', () => {
    selectWorkspace(ui.workspaceSelect.value);
    // Bei Touch bleibt der Drawer fuer die anschliessende App-Auswahl offen.
  });
  ui.sidebarToggle.addEventListener('click', () => setSidebar(ui.sidebar.hidden, false));
  ui.sidebarClose.addEventListener('click', () => setSidebar(false, true));
  ui.backdrop.addEventListener('click', () => setSidebar(false, true));
  ui.reloadApp.addEventListener('click', () => {
    if (!state.app) return;
    removeFrame(state.app);
    openApp(state.app, false);
  });
  document.addEventListener('keydown', event => {
    if (event.defaultPrevented) return;
    if (event.key === 'Escape' && mobile.matches && drawerOpen) {
      event.preventDefault();
      setSidebar(false, true);
    } else if (event.key === 'Tab' && mobile.matches && drawerOpen) {
      const focusable = [...ui.sidebar.querySelectorAll('a[href], button:not(:disabled), select:not(:disabled), input:not(:disabled)')].filter(el => el.getClientRects().length && el.tabIndex >= 0);
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
  });
  const handleViewport = () => { drawerOpen = false; syncSidebar(); };
  if (mobile.addEventListener) mobile.addEventListener('change', handleViewport);
  else mobile.addListener(handleViewport);
  window.addEventListener('storage', event => {
    if (event.key === 'boilerRoom' || event.key === null) refreshFavorites();
  });
  window.addEventListener('pageshow', refreshFavorites);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') refreshFavorites();
  });
})(window.BoilerRoom);
