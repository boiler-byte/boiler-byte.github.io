/* Central view: catalog / favorites / groups, per-package and bulk operations. */
(function (B) {
  'use strict';
  const $ = id => document.getElementById(id);
  const ui = Object.fromEntries(['workspaceBack','connectionStatus','offlineWorkspace','checkVersions','updateAll','installAll','removeAll','metricReady','metricPending',
    'metricUnsupported','coverage','workspaceSummary','serviceNotice','operationPanel','operationText','operationProgress','offlineSearch',
    'offlineList','storageSummary','protectStorage'].map(id => [id, $(id)]));
  const groups = B.data.getGroups();
  const catalog = new Map();
  for (const repo of B.data.repos) if (repo && typeof repo.label === 'string' && repo.label.trim() && !catalog.has(repo.label)) catalog.set(repo.label, repo);
  B.storage.init();
  let installed = new Map(), descriptions = new Map(), busy = false, available = false, checked = false, revision = 0;
  let activeRefresh = null, checking = false;
  const states = { ready: 'Offline bereit', update: 'Update verfügbar', incomplete: 'Unvollständig', missing: 'Bereitstellbar', unsupported: 'Kein Offline-Paket', info: 'Information', obsolete: 'Nicht mehr zugeordnet', unknown: 'Manifest nicht geprüft', saved: 'Offline gespeichert' };
  const selections = new Map([['all','Alle Apps'],['favorites','Mein Workspace'], ...[...groups].map(([id,g]) => ['group:'+id,g.label])]);
  for (const [value,label] of selections) ui.offlineWorkspace.append(new Option(label,value));
  const requested = new URLSearchParams(location.search).get('workspace');
  const stored = B.storage.get('workspace').selected;
  ui.offlineWorkspace.value = selections.has(requested) ? requested : selections.has(stored) ? stored : 'favorites';
  function syncLink() {
    const selection = ui.offlineWorkspace.value;
    const back = new URL('index.html', location.href);
    if (selection.startsWith('group:')) back.searchParams.set('group', selection.slice(6));
    else if (selection === 'favorites') back.searchParams.set('favorites', '1');
    ui.workspaceBack.href = back.href;
    const url = new URL(location.href); url.searchParams.set('workspace', selection);
    try { history.replaceState(history.state, '', url.href); } catch (_) {}
  }
  function members() {
    const selection = ui.offlineWorkspace.value;
    if (selection === 'all') return [...catalog.values(), ...[...installed.values()].filter(r => !catalog.has(r.id)).map(r => ({ label:r.id, removed:true }))];
    if (selection === 'favorites') {
      const favorites = B.storage.get('favorites'); const set = new Set(favorites);
      return [...new Set([...B.storage.get('favoriteOrder').filter(id => set.has(id)), ...favorites])].map(id => catalog.get(id)).filter(Boolean);
    }
    return (groups.get(selection.slice(6))?.repos || []).filter(repo => catalog.get(repo.label) === repo);
  }
  function entries() {
    return members().map(repo => {
      const description = descriptions.get(repo.label) || B.offline.describe(repo), record = installed.get(repo.label);
      return { repo, description, record, state: B.offline.status(description,record) };
    });
  }
  function node(tag, className, value) {
    const el = document.createElement(tag); if (className) el.className = className; if (value !== undefined) el.textContent = value; return el;
  }
  function button(text, style, enabled, callback, label) {
    const btn = node('button','offline-button '+style,text); btn.type = 'button'; btn.disabled = !enabled; btn.setAttribute('aria-label',label || text); btn.addEventListener('click',callback); return btn;
  }
  function setNotice(text) { ui.serviceNotice.textContent = text || ''; ui.serviceNotice.hidden = !text; }
  const canInstall = () => available && !busy && !checking && navigator.onLine;
  const canRemove = () => available && !busy && !checking;
  function makeRow(item) {
    const { repo, description, record, state } = item;
    const row = node('article','offline-row');
    const title = node('div','offline-row-name');
    const icon = node('span','app-icon',repo.icon || repo.label.slice(0,1).toLocaleUpperCase('de')); icon.setAttribute('aria-hidden','true');
    const copy = node('div'); copy.append(node('strong','',repo.label),node('small','',repo.removed ? 'Nicht mehr im Katalog' : B.data.types[repo.type]?.label || 'App'));
    title.append(icon,copy);
    const status = node('div','offline-state'); status.dataset.state = checked ? state : 'unknown';
    status.append(node('span','',checked ? ((B.offline.statusLabel(state, description) || states[state]) + (['ready','saved'].includes(state) && record?.mode === 'partial' ? ' (teilweise)' : '')) : 'Status wird geprüft …'));
    if (record) {
      const date = new Date(record.installedAt).toLocaleDateString('de-DE');
      status.append(node('small','',`${record.files.length} Dateien · ${date}${record.version ? ' · v' + (record.versionName || record.version) : ''}`));
    } else if (description.kind === 'package') status.append(node('small','',`${description.pkg.files.length} Dateien${description.pkg.version ? ' · v' + (description.pkg.versionName || description.pkg.version) : ''}`));
    if (Number.isFinite(description.checkedAt)) status.append(node('small','','Geprüft: ' + new Date(description.checkedAt).toLocaleString('de-DE', {dateStyle:'short',timeStyle:'short'})));
    if (description.reason) status.append(node('small','',description.reason));
    const metadata = description.pkg || record;
    if (metadata?.mode === 'partial') status.append(node('small','','Teilweiser Offlinebetrieb'));
    if (metadata?.limitations?.length) status.append(node('small','',metadata.limitations.join(' · '))); 
    const actions = node('div','offline-row-actions');
    if (description.kind === 'package') {
      const verb = state === 'ready' || state === 'update' ? 'Aktualisieren' : state === 'incomplete' ? 'Reparieren' : 'Bereitstellen';
      actions.append(button(verb,state === 'ready' ? 'secondary' : 'primary',canInstall(),() => run([item],state === 'update' || state === 'ready' ? 'update' : 'install'),`${repo.label}: ${verb}`));
    }
    if (record) actions.append(button('Entfernen','secondary',canRemove(),() => run([item],'remove'),`${repo.label}: Offline-Dateien entfernen`));
    row.append(title,status,actions); return row;
  }
  function render() {
    const items = entries();
    const ready = items.filter(i => ['ready','saved'].includes(i.state) && i.record?.mode === 'full').length;
    const partial = items.filter(i => ['ready','saved'].includes(i.state) && i.record?.mode === 'partial').length;
    const unknown = items.filter(i => i.state === 'unknown').length;
    const provisionable = items.filter(i => i.description.kind === 'package' && ['missing','incomplete'].includes(i.state)).length;
    const updates = items.filter(i => i.state === 'update').length;
    const pending = provisionable + updates;
    const unsupported = items.filter(i => i.description.kind === 'unsupported').length;
    const launchable = items.filter(i => i.description.kind !== 'info' && !i.repo.removed).length;
    const removable = items.filter(i => i.record).length;
    ui.metricReady.textContent = checked ? ready : '–'; ui.metricPending.textContent = checked ? pending : '–'; ui.metricUnsupported.textContent = checked ? unsupported : '–';
    ui.coverage.max = launchable || 1; ui.coverage.value = checked ? ready : 0;
    ui.coverage.setAttribute('aria-valuetext',`${ready} von ${launchable} Apps aktuell bereit`);
    ui.workspaceSummary.textContent = !checked ? 'Offline-Status wird ermittelt …' : !launchable ? 'Dieser Bereich enthält keine startbaren Apps.' : ready === launchable ? 'Alle startbaren Apps sind vollständig offline gespeichert.' : `${ready} von ${launchable} startbaren Apps sind vollständig offline gespeichert.${partial ? ' '+partial+' teilweise verfügbar.' : ''}${unknown ? ' '+unknown+' Manifeste noch nicht geprüft.' : ''}${unsupported ? ' Apps ohne Paket können nicht zentral offline bereitgestellt werden.' : ''}${items.some(i=>i.state==='update') ? ' Bereits vollständig gespeicherte ältere Versionen bleiben bis zum Update nutzbar.' : ''}`;
    ui.installAll.textContent = provisionable ? `Bereitstellen (${provisionable})` : 'Bereitstellen';
    ui.updateAll.hidden = !updates;
    ui.updateAll.textContent = updates ? `Alle Aktualisieren (${updates})` : 'Alle Aktualisieren';
    ui.updateAll.disabled = !canInstall() || !updates;
    ui.checkVersions.textContent = checking ? 'Versionen werden geprüft …' : 'Versionen prüfen';
    ui.checkVersions.disabled = !canInstall() || !items.some(i => B.offline.describe(i.repo).kind === 'candidate');
    ui.removeAll.textContent = removable ? `Entfernen (${removable})` : 'Entfernen';
    ui.installAll.disabled = !canInstall() || !provisionable;
    ui.removeAll.disabled = !canRemove() || !removable;
    ui.offlineWorkspace.disabled = busy || Boolean(activeRefresh?.force);
    const query = B.searchRelevance.normalize(ui.offlineSearch.value);
    const visible = query ? items.filter(i => B.searchRelevance.score(i.repo,query) >= 0) : items;
    const fragment = document.createDocumentFragment(); visible.forEach(item => fragment.append(makeRow(item)));
    if (!visible.length) fragment.append(node('p','offline-empty',query ? 'Keine passenden Apps.' : 'Keine Apps in diesem Bereich.'));
    ui.offlineList.replaceChildren(fragment);
    ui.connectionStatus.textContent = navigator.onLine ? 'Online' : 'Offline'; ui.connectionStatus.dataset.offline = String(!navigator.onLine);
  }
  async function storageStatus() {
    const count = [...installed.values()].reduce((n,r) => n+r.files.length,0);
    let text = `${installed.size} gespeicherte Pakete · ${count} deklarierte Dateien in diesem Browserprofil.`;
    try {
      if (navigator.storage?.persisted) {
        const persistent = await navigator.storage.persisted();
        text += persistent ? ' Der Browser meldet dauerhaften Speicher.' : ' Der Browser kann die Dateien bei Speicherdruck löschen.';
        ui.protectStorage.hidden = persistent || !navigator.storage.persist || !available;
      }
    } catch (_) {}
    ui.storageSummary.textContent = text;
  }
  function refresh(force = false) {
    if (busy) return Promise.resolve();
    const selection = ui.offlineWorkspace.value;
    if (!force && activeRefresh?.selection === selection) return activeRefresh.promise;
    const token = ++revision;
    const job = { selection, force };
    activeRefresh = job; checking = true; render();
    job.promise = refreshSelection(token, force).finally(() => {
      if (activeRefresh === job) { activeRefresh = null; checking = false; render(); }
    });
    return job.promise;
  }
  async function refreshSelection(token, force) {
    try {
      const list = await B.offline.request('list');
      if (token !== revision) return;
      installed = new Map(list.map(r => [r.id,r])); available = true; checked = true;
      if (!busy) setNotice('');
    } catch (error) {
      const list = await B.offline.snapshot().catch(() => []);
      if (token !== revision) return;
      installed = new Map(list.map(r=>[r.id,r])); available = false; checked = true;
      setNotice(error.message);
    }
    render(); storageStatus();
    const queue = members().filter(repo => B.offline.describe(repo).kind === 'candidate');
    // Check only the selected workspace, regardless of the local search filter.
    // The worker enforces the daily interval across selections, reloads and tabs.
    await Promise.all(Array.from({length:Math.min(6,queue.length)},async () => {
      while (queue.length && token === revision) {
        const repo = queue.shift();
        let description;
        try {
          description = available ? await B.offline.discover(repo,{force,cacheOnly:!navigator.onLine}) : await B.offline.cachedDescription(repo);
        } catch (error) {
          description = descriptions.get(repo.label) || await B.offline.cachedDescription(repo).catch(() => null);
          if (!description || description.kind === 'candidate') description = {...B.offline.describe(repo), kind:'unknown', reason:error.message};
        }
        if (token !== revision) return;
        descriptions.set(repo.label,description);
        render();
      }
    }));
  }
  async function run(items, action) {
    const installing = action !== 'remove';
    if (!items.length || (installing ? !canInstall() : !canRemove())) return;
    if (action === 'remove' && !window.confirm(`Offline-Dateien von ${items.length === 1 ? '„'+items[0].repo.label+'“' : items.length+' Apps'} entfernen? Diese Apps sind danach auch in anderen Workspaces nicht mehr zentral offline verfügbar. App-Daten bleiben erhalten.`)) return;
    busy = true; ++revision; setNotice(''); ui.operationPanel.hidden = false; render();
    let succeeded = 0; const errors = [];
    for (let i=0;i<items.length;i++) {
      const item = items[i], label = item.repo.label;
      ui.operationText.textContent = `${i+1}/${items.length} · ${label} · ${installing ? 'Dateien werden gespeichert …' : 'Dateien werden entfernt …'}`;
      ui.operationProgress.max = items.length; ui.operationProgress.value = i;
      try {
        if (installing) {
          const result = await B.offline.request('install',{repo:{label:item.repo.label,url:item.repo.url}},p=>{
            ui.operationText.textContent = `${i+1}/${items.length} · ${label} · ${p.done}/${p.total} Dateien`;
            ui.operationProgress.value = i + p.done / p.total;
          }); installed.set(label,result);
          descriptions.set(label, {kind:'package', pkg:result, checkedAt:Date.now()});
        } else { await B.offline.request('remove',{id:label}); installed.delete(label); }
        succeeded++;
      } catch (error) { errors.push(`${label}: ${error.message}`); }
      ui.operationProgress.value = i+1; render();
    }
    busy = false; await refresh();
    ui.operationText.textContent = `${succeeded} von ${items.length} Apps ${action === 'update' ? 'aktualisiert' : installing ? 'bereitgestellt' : 'entfernt'}.${errors.length ? ' ' + errors.length + ' fehlgeschlagen.' : ''}`;
    if (errors.length) setNotice(errors.join(' · '));
    render();
  }
  function refreshAfterCurrent() {
    if (busy) return;
    if (activeRefresh) {
      const current = activeRefresh;
      if (!current.followUp) {
        current.followUp = true;
        current.promise.then(()=>{if(!busy) refresh();});
      }
    } else refresh();
  }
  ui.checkVersions.addEventListener('click',()=>{if(!ui.checkVersions.disabled) refresh(true);});
  ui.updateAll.addEventListener('click',()=>run(entries().filter(i=>i.state === 'update'),'update'));
  ui.installAll.addEventListener('click',()=>run(entries().filter(i=>i.description.kind === 'package' && ['missing','incomplete'].includes(i.state)),'install'));
  ui.removeAll.addEventListener('click',()=>run(entries().filter(i=>i.record),'remove'));
  ui.offlineWorkspace.addEventListener('change',()=>{ ui.offlineSearch.value=''; syncLink(); render(); refresh(); });
  ui.offlineSearch.addEventListener('input',render);
  ui.protectStorage.addEventListener('click',async()=>{
    try { const result = await navigator.storage.persist(); await storageStatus(); if (!result) setNotice('Der Browser hat dauerhaften Speicher nicht freigegeben.'); }
    catch (error) { setNotice(error.message); }
  });
  window.addEventListener('online',()=>{render(); if (!busy) refresh();});
  window.addEventListener('offline',render);
  window.addEventListener('storage',event=>{if(event.key==='boilerRoom' || event.key===null) { render(); if(!busy) refresh(); }});
  window.addEventListener('pageshow',()=>{if(!busy) refresh();});
  document.addEventListener('visibilitychange',()=>{if(!busy && document.visibilityState==='visible') refresh();});
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message',event=>{if(!busy && event.data?.protocol==='boiler-room-offline-v1' && event.data.changed) refreshAfterCurrent();});
    navigator.serviceWorker.addEventListener('controllerchange',refreshAfterCurrent);
  }
  // Also check when a visible manager stays open across the 24-hour boundary.
  setInterval(()=>{
    if (!busy && !checking && navigator.onLine && document.visibilityState==='visible' && members().some(repo=>
      B.offline.describe(repo).kind === 'candidate' && !B.offline.isVersionCheckFresh(descriptions.get(repo.label)))) refresh();
  },60000);
  syncLink(); render(); refresh();
})(window.BoilerRoom);
