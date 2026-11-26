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
    'reloadApp', 'externalApp', 'emptyView', 'emptyTitle', 'emptyDescription', 'emptyLink',
    'frames', 'loading', 'offlineManagerLink', 'homeApp', 'homeView', 'homeSearch',
    'homeSearchClear', 'homeTitle', 'homeCount', 'homeApps'
  ].map(id => [id, $(id)]));
  const mobile = window.matchMedia('(max-width: 700px)');
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
  let state = B.storage.get('workspace');
  let activeRepos = [];
  let drawerOpen = false;
  let favoritesSignature = '';
  let drawerPreviousFocus = null;
  let searchQuery = '';
  let searchTimer = null;
  let offlineRecords = new Map();
  let openToken = 0;
  let offlineRevision = 0;
  let offlineInitial = refreshOffline();

  async function refreshOffline(render = true) {
    const revision = ++offlineRevision;
    try {
      const records = await B.offline.snapshot();
      if (revision !== offlineRevision) return;
      offlineRecords = new Map(records.map(record => [record.id, record]));
      if (render) { renderList(); renderHome(); }
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

  function launcherApps() {
    const entries = readFavorites(false);
    const typeOf = repo => typeof repo.type === 'string' && repo.type.trim() ? repo.type : 'misc';
    const known = [...new Set(['game', 'tool', 'misc', ...Object.keys(types), ...B.data.repos.map(typeOf)])];
    const saved = B.storage.get('launcherTypeOrder');
    const order = [...saved.filter(type => known.includes(type)), ...known.filter(type => !saved.includes(type))];
    if (entries.length >= 9 && new Set(entries.map(typeOf)).size >= 2) {
      entries.sort((a, b) => order.indexOf(typeOf(a)) - order.indexOf(typeOf(b)));
    }
    return entries.filter(repo => resolveURL(repo.url));
  }

  function searchCatalog(query) {
    const rank = new Map(recentLabels().map((label, index) => [label, index]));
    const position = repo => rank.get(repo.label) ?? Infinity;
    return catalogApps().map((repo, index) => ({ repo, index, score: B.searchRelevance.score(repo, query) }))
      .filter(item => item.score >= 0)
      .sort((a, b) => (position(a.repo) - position(b.repo)) || b.score - a.score || a.index - b.index)
      .map(item => item.repo);
  }

  function renderHome() {
    if (ui.homeView.hidden) return;
    const query = B.searchRelevance.normalize(ui.homeSearch.value);
    const recent = recentLabels();
    const repos = query ? searchCatalog(query) : (recent.length ? recent.map(label => repoMap.get(label)) : launcherApps()).slice(0, 9);
    ui.homeTitle.textContent = query ? 'Suchergebnisse' : recent.length ? 'Zuletzt verwendet' : 'Apps aus dem Launcher';
    ui.homeCount.textContent = String(repos.length);
    ui.homeSearchClear.hidden = !ui.homeSearch.value;
    ui.homeApps.replaceChildren(...repos.map(repo => createAppItem(repo)));
    if (!repos.length) {
      const empty = document.createElement('p');
      empty.className = 'home-empty';
      empty.textContent = query ? 'Keine passenden Apps gefunden.' : 'Noch keine Apps im Launcher. Suche im gesamten App-Katalog.';
      ui.homeApps.append(empty);
    }
  }

  function showHome() {
    ++openToken;
    state.app = null;
    persist();
    for (const entry of frames.values()) entry.frame.hidden = true;
    ui.frames.hidden = true;
    ui.emptyView.hidden = true;
    ui.homeView.hidden = false;
    ui.homeSearch.value = '';
    setLoading(null);
    ui.reloadApp.hidden = true;
    ui.reloadApp.disabled = true;
    ui.externalApp.hidden = true;
    ui.externalApp.removeAttribute('href');
    ui.currentApp.textContent = 'App-Übersicht';
    document.title = workspaceLabel(state.selected) + ' · Boiler Room';
    updateAppSelection();
    renderHome();
  }

  function workspaceExists(id) {
    return id === FAVORITES || (typeof id === 'string' && id.startsWith(GROUP_PREFIX) && groups.has(id.slice(GROUP_PREFIX.length)));
  }

  function workspaceLabel(id) {
    return id === FAVORITES ? 'Mein Workspace' : groups.get(id.slice(GROUP_PREFIX.length))?.label || 'Workspace';
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
    const visibleRepos = searching ? searchCatalog(searchQuery) : activeRepos;
    const total = searching ? catalogApps().length : activeRepos.length;
    if (!visibleRepos.length) {
      const empty = document.createElement('p');
      empty.className = 'list-empty';
      empty.textContent = !searching && !activeRepos.length
        ? (state.selected === FAVORITES ? 'Noch keine Favoriten.' : 'Keine Repos in dieser Gruppe.')
        : 'Keine passenden Apps gefunden.';
      fragment.append(empty);
    }
    visibleRepos.forEach(repo => fragment.append(createAppItem(repo)));
    ui.appList.replaceChildren(fragment);
    ui.appCount.textContent = searching ? `${visibleRepos.length} / ${total}` : String(total);
    ui.appCount.setAttribute('aria-label', searching ? `${visibleRepos.length} von ${total} Apps` : `${total} Apps`);
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

  async function openApp(label, save = true) {
    const token = ++openToken;
    const repo = repoMap.get(label) || null;
    state.app = repo?.label || null;
    if (save) {
      if (resolveURL(repo?.url)) recordUsage(repo.label);
      persist();
    }
    ui.homeView.hidden = true;
    ui.reloadApp.hidden = false;
    renderList();
    updateAppSelection();
    ui.currentApp.textContent = repo?.label || 'Workspace';
    document.title = (repo ? repo.label + ' · ' : '') + workspaceLabel(state.selected) + ' · Boiler Room';
    for (const entry of frames.values()) entry.frame.hidden = true;
    const originalURL = resolveURL(repo?.url);
    if (!repo || !originalURL) {
      showEmpty(repo);
      return;
    }
    // Resolve the saved package before creating an iframe (including cold offline starts).
    ui.emptyView.hidden = true;
    ui.frames.hidden = false;
    ui.loading.hidden = false;
    ui.reloadApp.disabled = true;
    ui.externalApp.hidden = true;
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
    ui.emptyView.hidden = true;
    ui.frames.hidden = false;
    entry.frame.hidden = false;
    ui.reloadApp.disabled = false;
    ui.externalApp.href = url;
    ui.externalApp.hidden = false;
    setLoading(entry);
  }

  function selectWorkspace(id) {
    const previous = state.selected;
    state.selected = workspaceExists(id) ? id : FAVORITES;
    const same = state.selected === previous;
    activeRepos = members(state.selected);
    ui.workspaceSelect.value = state.selected;
    ui.workspaceLabel.textContent = workspaceLabel(state.selected);
    ui.currentWorkspace.textContent = workspaceLabel(state.selected);
    const managerURL = new URL('offline.html', location.href);
    managerURL.searchParams.set('workspace', state.selected);
    ui.offlineManagerLink.href = managerURL.href;
    if (!same) resetSearch(false);
    renderList();
    showHome();
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
    if (before === favoritesSignature) return;
    if (state.selected !== FAVORITES) { renderHome(); return; }
    activeRepos = next;
    renderList();
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

  populatePicker();
  readFavorites();
  selectWorkspace(initialWorkspace);
  if (requestedGroup !== null || requestedFavorites) syncGroupURL();
  syncSidebar();
  setupSearch();
  ui.homeApp.addEventListener('click', () => { showHome(); if (searchQuery) renderList(); });
  ui.homeSearch.addEventListener('input', renderHome);
  ui.homeSearch.addEventListener('search', renderHome);
  ui.homeSearchClear.addEventListener('click', () => { ui.homeSearch.value = ''; renderHome(); ui.homeSearch.focus(); });
  ui.homeSearch.addEventListener('keydown', event => {
    if (event.key === 'Escape' && ui.homeSearch.value) { event.preventDefault(); ui.homeSearch.value = ''; renderHome(); }
    else if (event.key === 'Enter' && !event.isComposing) { event.preventDefault(); renderHome(); ui.homeSearch.blur(); }
  });
  ui.workspaceSelect.addEventListener('change', () => {
    selectWorkspace(ui.workspaceSelect.value);
    syncGroupURL();
    // Bei Touch bleibt der Drawer fuer die anschliessende App-Auswahl offen.
  });
  ui.sidebarToggle.addEventListener('click', () => setSidebar(ui.sidebar.hidden, false));
  ui.sidebarClose.addEventListener('click', () => setSidebar(false, true));
  ui.backdrop.addEventListener('click', () => setSidebar(false, true));
  ui.reloadApp.addEventListener('click', () => {
    if (!state.app) return;
    const label = state.app;
    offlineInitial = refreshOffline();
    removeFrame(label);
    openApp(label, false);
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
    if (event.key === 'boilerRoom' || event.key === null) { refreshFavorites(); renderList(); renderHome(); }
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
