/* Zwei unabhaengige Launcher-Ansichten, eine gemeinsame Favoriten-Reihenfolge. */
(function (B) {
  'use strict';

  const modes = new Set(['list', 'apps']);
  const buttons = document.querySelectorAll('.launcher-view-btn');
  const hint = document.getElementById('launcherHint');

  function syncViewControls() {
    buttons.forEach(button => {
      const active = button.dataset.launcherView === B.state.launcherView;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    if (hint) hint.textContent = B.state.launcherView === 'apps'
      ? 'App-Symbole gedrückt halten und verschieben · per Klick öffnen · Alt + Pfeiltasten zum Sortieren.'
      : 'Ziehe die Einträge, um die Reihenfolge deiner Favoriten anzupassen.';
  }

  function loadView() {
    const stored = B.storage.get('launcherView');
    if (modes.has(stored)) B.state.launcherView = stored;
    syncViewControls();
  }

  function setView(view) {
    if (!modes.has(view)) return;
    if (B.state.launcherView !== view) {
      B.drag.cancelIconDrag();
      B.state.launcherView = view;
      B.storage.set('launcherView', view);
      B.renderer.renderLauncher();
    }
    syncViewControls();
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

  // Die Auswahl wird aus denselben originrepos/Fallback-Repos erzeugt wie die Ansichten.
  // Bereits favorisierte Apps stehen nicht im Dropdown.
  function availableApps() {
    return B.data.repos.filter(repo => !B.favorites.isFavorite(repo.label));
  }

  function closeAddMenu(returnFocus = false) {
    if (!addMenu) return;
    addMenu.hidden = true;
    addButton.setAttribute('aria-expanded', 'false');
    if (returnFocus && !addButton.disabled) addButton.focus();
  }

  function refreshAddMenu() {
    if (!addMenu) return;
    const entries = availableApps();
    addButton.disabled = entries.length === 0;
    addButton.title = entries.length ? 'App zum Launcher hinzufügen' : 'Alle Apps sind bereits im Launcher';
    addMenu.replaceChildren();
    entries.forEach(repo => {
      const option = document.createElement('button');
      option.type = 'button';
      option.className = 'launcher-add-option';
      option.setAttribute('role', 'menuitem');
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
      addMenu.appendChild(option);
    });
    if (!entries.length) closeAddMenu();
  }

  function setup() {
    const controls = document.getElementById('launcherViewControls');
    if (!controls) return;
    controls.addEventListener('click', e => {
      const button = e.target.closest('[data-launcher-view]');
      if (button && controls.contains(button)) {
        closeAddMenu();
        setView(button.dataset.launcherView);
      }
    });
    addButton.addEventListener('click', () => {
      if (addButton.disabled) return;
      if (!addMenu.hidden) { closeAddMenu(); return; }
      refreshAddMenu();
      addMenu.hidden = false;
      addButton.setAttribute('aria-expanded', 'true');
      addMenu.querySelector('[role="menuitem"]')?.focus();
    });
    addMenu.addEventListener('click', e => {
      const option = e.target.closest('[role="menuitem"]');
      if (!option || !addMenu.contains(option)) return;
      const label = option.dataset.label;
      if (!label || B.favorites.isFavorite(label)) return;
      B.favorites.toggleFavorite(label);
      closeAddMenu();
      B.renderer.renderLauncher();
      if (!addButton.disabled) addButton.focus();
    });
    addWrap.addEventListener('keydown', e => {
      if (addMenu.hidden) return;
      if (e.key === 'Escape') { e.preventDefault(); closeAddMenu(true); return; }
      const options = Array.from(addMenu.querySelectorAll('[role="menuitem"]'));
      if (!options.length || !['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return;
      e.preventDefault();
      const index = options.indexOf(document.activeElement);
      let next = index;
      if (e.key === 'ArrowDown') next = (index + 1) % options.length;
      if (e.key === 'ArrowUp') next = (index - 1 + options.length) % options.length;
      if (e.key === 'Home') next = 0;
      if (e.key === 'End') next = options.length - 1;
      options[next].focus();
    });
    document.addEventListener('pointerdown', e => {
      if (!addMenu.hidden && !addWrap.contains(e.target)) closeAddMenu();
    });
    syncViewControls();
    refreshAddMenu();
  }

  B.launcher = { makeIcon, loadView, setView, syncViewControls, refreshAddMenu, closeAddMenu, setup };
})(window.BoilerRoom);
