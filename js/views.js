/* Bibliotheksansicht, Sortierung und gemeinsame SVG-Icon-Dropdowns. */
(function (B) {
  'use strict';
  const s = B.state;
  const repoGrid = B.dom.repoGrid;
  const svgNS = 'http://www.w3.org/2000/svg';
  const icons = {
    cards: '<rect x="3" y="4" width="8" height="16" rx="1.5"/><rect x="13" y="4" width="8" height="16" rx="1.5"/><path d="M3 11h8m2 0h8M5 15h4m6 0h4"/>',
    list: '<path d="M9 5h12M9 12h12M9 19h12"/><circle cx="4" cy="5" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="19" r="1"/>',
    icons: '<rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/>',
    original: '<path d="M7 20V4m-4 4 4-4 4 4m6-4v16m-4-4 4 4 4-4"/>',
    name: '<path d="m3 10 3-7 3 7M4 8h4m-5 6h6l-6 7h6m9-17v16m-4-4 4 4 4-4"/>',
    newest: '<circle cx="9" cy="9" r="6"/><path d="M9 5v4l3 2m6 1v9m-3-3 3 3 3-3"/>',
    type: '<path d="M3 4h7v7H3z"/><circle cx="17.5" cy="7.5" r="3.5"/><path d="m6.5 14-4 7h8zM14 15h7m-7 4h7"/>',
    check: '<path d="m5 12 4 4L19 6"/>'
  };
  function symbol(key) {
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    svg.classList.add('library-control-icon');
    svg.innerHTML = icons[key];
    return svg;
  }
  let opened = null;
  function closeMenus(restoreFocus = false) {
    if (opened) opened.close(restoreFocus);
  }
  function dropdown(id, label, entries, defaultValue, getValue, onSelect) {
    const button = document.getElementById(id);
    const menu = document.getElementById(id + 'Menu');
    const wrap = button.parentElement;
    const options = entries.map(([value, name]) => {
      const option = document.createElement('button');
      option.type = 'button';
      option.className = 'library-dropdown-option';
      option.setAttribute('role', 'menuitemradio');
      option.tabIndex = -1;
      option.dataset.value = value;
      option.dataset.default = String(value === defaultValue);
      const text = document.createElement('span');
      text.textContent = name;
      const check = symbol('check');
      check.classList.add('library-option-check');
      option.append(symbol(value), text, check);
      menu.appendChild(option);
      option.addEventListener('click', () => {
        onSelect(value);
        sync();
        close(true);
      });
      return option;
    });
    function sync() {
      const current = getValue();
      const entry = entries.find(([value]) => value === current);
      if (!entry) return;
      button.replaceChildren(symbol(current));
      button.setAttribute('aria-label', label + ': ' + entry[1]);
      button.title = label + ': ' + entry[1];
      button.dataset.value = current;
      button.dataset.nonDefault = String(current !== defaultValue);
      options.forEach(option => option.setAttribute('aria-checked', String(option.dataset.value === current)));
    }
    function position() {
      if (menu.hidden) return;
      const rect = button.getBoundingClientRect();
      const width = document.documentElement.clientWidth;
      const height = document.documentElement.clientHeight;
      const gap = 6;
      menu.style.left = '0px';
      menu.style.top = 'calc(100% + 6px)';
      menu.style.bottom = 'auto';
      menu.style.maxHeight = '';
      const menuWidth = menu.getBoundingClientRect().width;
      menu.style.left = Math.max(8 - rect.left, Math.min(0, width - 8 - rect.left - menuWidth)) + 'px';
      const below = height - rect.bottom - gap - 8;
      const above = rect.top - gap - 8;
      if (menu.offsetHeight > below && above > below) {
        menu.style.top = 'auto';
        menu.style.bottom = 'calc(100% + 6px)';
        menu.style.maxHeight = Math.max(44, above) + 'px';
      } else {
        menu.style.maxHeight = Math.max(44, below) + 'px';
      }
    }
    function close(restoreFocus) {
      menu.hidden = true;
      button.setAttribute('aria-expanded', 'false');
      if (opened === api) opened = null;
      if (restoreFocus) button.focus({ preventScroll: true });
    }
    function open(index) {
      closeMenus();
      sync();
      menu.hidden = false;
      button.setAttribute('aria-expanded', 'true');
      opened = api;
      position();
      const selected = options.find(option => option.dataset.value === getValue());
      const target = options[index] || selected || options[0];
      target.focus({ preventScroll: true });
      if (target.offsetTop < menu.scrollTop) menu.scrollTop = target.offsetTop;
      else if (target.offsetTop + target.offsetHeight > menu.scrollTop + menu.clientHeight) {
        menu.scrollTop = target.offsetTop + target.offsetHeight - menu.clientHeight;
      }
    }
    const api = { sync, close, position, wrap };
    button.addEventListener('click', () => menu.hidden ? open() : close(true));
    button.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        open(e.key === 'ArrowDown' ? 0 : options.length - 1);
      }
    });
    menu.addEventListener('keydown', e => {
      const i = options.indexOf(document.activeElement);
      let next;
      if (e.key === 'ArrowDown') next = (i + 1) % options.length;
      else if (e.key === 'ArrowUp') next = (i + options.length - 1) % options.length;
      else if (e.key === 'Home') next = 0;
      else if (e.key === 'End') next = options.length - 1;
      else if (e.key === 'Escape') { e.preventDefault(); close(true); return; }
      else if (e.key === 'Tab') {
        // Leave the menu via its trigger; native Tab moves to the adjacent control.
        close(true);
        return;
      } else return;
      e.preventDefault();
      options[next].focus();
    });
    wrap.addEventListener('focusout', e => {
      if (opened === api && e.relatedTarget && !wrap.contains(e.relatedTarget)) close(false);
    });
    sync();
    return api;
  }
  let viewMenu;
  function applyViewClasses() {
    repoGrid.classList.remove('view-cards', 'view-list', 'view-icons');
    if (s.activeView !== 'cards') repoGrid.classList.add('view-' + s.activeView);
    if (viewMenu) viewMenu.sync();
  }
  function setView(view, persist) {
    if (!['cards', 'list', 'icons'].includes(view)) return;
    s.activeView = view;
    if (persist) B.storage.set('libraryView', view);
    applyViewClasses();
    B.renderer.renderRepos();
  }
  function loadView() {
    const v = B.storage.get('libraryView');
    if (v === 'cards' || v === 'list' || v === 'icons') s.activeView = v;
  }
  function setupViewSwitch() {
    viewMenu = dropdown('viewSelect', 'Ansicht', [['cards', 'Karten'], ['list', 'Liste'], ['icons', 'Icons']],
      'cards', () => s.activeView, value => { if (value !== s.activeView) setView(value, true); });
    dropdown('librarySort', 'Sortierung', [['original', 'Kuratierte Reihenfolge'], ['name', 'Name A–Z'], ['newest', 'Neueste zuerst'], ['type', 'Typ A–Z']],
      'original', () => s.librarySort, value => { if (value !== s.librarySort) { s.librarySort = value; B.renderer.renderRepos(); } });
    document.addEventListener('pointerdown', e => { if (opened && !opened.wrap.contains(e.target)) closeMenus(); });
    document.addEventListener('keydown', e => { if (opened && e.key === 'Escape') { e.preventDefault(); closeMenus(true); } });
    window.addEventListener('resize', () => { if (opened) opened.position(); });
    window.addEventListener('scroll', () => { if (opened) opened.position(); }, { passive: true });
  }
  B.views = { applyClasses: applyViewClasses, setView, load: loadView, setup: setupViewSwitch, closeMenus };
})(window.BoilerRoom);
