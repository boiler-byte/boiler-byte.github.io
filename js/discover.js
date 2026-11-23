/* Entdecken: responsive Highlights und Regale aus Typen, Gruppen und Tags. */
(function (B) {
  'use strict';
  const repos = B.data.repos;
  const types = B.data.types;
  const groups = B.data.repogroups;
  let cleanupScrollControls = [];

  function addAttributes(container, repo, maxTags) {
    if (repo.type) container.appendChild(B.icons.attribute('type', types[repo.type]?.label || repo.type));
    if (repo.group) container.appendChild(B.icons.attribute('group', groups[repo.group]?.label || repo.group));
    if (Array.isArray(repo.tags)) {
      repo.tags.filter(tag => typeof tag === 'string' && tag.trim())
        .slice(0, maxTags)
        .forEach(tag => container.appendChild(B.icons.attribute('tag', tag)));
    }
  }

  function thumbnail(repo) {
    // Ein Link bleibt per Maus ziehbar: der Drag-Handler ignoriert echte Buttons.
    // JS faengt den normalen Klick ab und zeigt die App-Vorschau.
    const tile = document.createElement('a');
    tile.href = repo.url || '#discoverPage';
    tile.rel = 'noopener noreferrer';
    tile.className = 'discover-thumb';
    tile.dataset.label = repo.label;
    tile.setAttribute('aria-label', repo.label + ' – App-Vorschau anzeigen');
    tile.addEventListener('click', event => {
      event.preventDefault();
      B.discoverPreview.open(repo, tile);
    });
    const image = document.createElement('div');
    image.className = 'discover-thumb-image';
    if (repo.img) {
      const img = document.createElement('img');
      img.src = repo.img;
      img.alt = '';
      img.loading = 'lazy';
      img.decoding = 'async';
      img.width = 320;
      img.height = 224;
      image.appendChild(img);
    } else image.textContent = repo.icon || '◈';
    const name = document.createElement('strong');
    name.textContent = repo.label;
    const meta = document.createElement('div');
    meta.className = 'discover-thumb-meta';
    // In Thumbnail-Reihen nur Tag und Gruppe, nicht den Typ anzeigen.
    if (repo.group) meta.appendChild(B.icons.attribute('group', groups[repo.group]?.label || repo.group));
    if (Array.isArray(repo.tags)) {
      const tag = repo.tags.find(value => typeof value === 'string' && value.trim());
      if (tag) meta.appendChild(B.icons.attribute('tag', tag));
    }
    tile.append(image, name, meta);
    return tile;
  }

  function createHeading(title, kind) {
    const heading = document.createElement('div');
    heading.className = 'discover-shelf-heading';
    const copy = document.createElement('div');
    copy.className = 'discover-heading-copy';
    const titleRow = document.createElement('div');
    titleRow.className = 'discover-heading-title';
    if (kind) {
      const icon = B.icons.create(kind);
      if (icon) {
        const iconBox = document.createElement('span');
        iconBox.className = 'discover-heading-icon';
        iconBox.appendChild(icon);
        titleRow.appendChild(iconBox);
      }
    }
    const h = document.createElement('h2');
    h.textContent = title;
    titleRow.appendChild(h);
    copy.appendChild(titleRow);
    heading.appendChild(copy);
    return heading;
  }

  function createArrow(direction, label, rail, distance) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'shelf-arrow';
    button.innerHTML = direction === -1 ? '&#8249;' : '&#8250;';
    button.setAttribute('aria-label', label + (direction === -1 ? ': zurück scrollen' : ': weiter scrollen'));
    button.addEventListener('click', () => {
      const motion = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
      rail.scrollBy({ left: direction * distance(), behavior: motion });
    });
    return button;
  }

  // Unsichtbare Pfeile muessen auch aus dem Flex-Layout verschwinden.
  // Dieselbe Grenzlogik gilt fuer Highlight- und Thumbnail-Reihen.
  function watchScrollControls(rail, controls, previous, next) {
    let frame = 0;

    function update() {
      frame = 0;
      const maxScroll = Math.max(0, rail.scrollWidth - rail.clientWidth);
      const position = Math.max(0, rail.scrollLeft);
      const hasOverflow = maxScroll > 2;
      previous.hidden = !hasOverflow || position <= 2;
      next.hidden = !hasOverflow || position >= maxScroll - 2;
      previous.disabled = previous.hidden;
      next.disabled = next.hidden;
      controls.hidden = previous.hidden && next.hidden;
    }

    function scheduleUpdate() {
      if (!frame) frame = requestAnimationFrame(update);
    }

    rail.addEventListener('scroll', scheduleUpdate, { passive: true });
    window.addEventListener('resize', scheduleUpdate);
    const observer = typeof ResizeObserver === 'function'
      ? new ResizeObserver(scheduleUpdate) : null;
    if (observer) observer.observe(rail);
    // Nach dem Einhaengen in den sichtbaren DOM messen.
    scheduleUpdate();

    cleanupScrollControls.push(() => {
      rail.removeEventListener('scroll', scheduleUpdate);
      window.removeEventListener('resize', scheduleUpdate);
      if (observer) observer.disconnect();
      if (frame) cancelAnimationFrame(frame);
    });
  }

  // Maus-Drag-to-Scroll fuer beide Entdecken-Rail-Typen. Auf Touchgeraeten
  // bleibt das native Swipen unangetastet. Ein echter Drag darf weder Links
  // oeffnen noch die Favoriten-Buttons versehentlich aktivieren.
  function enableMouseDrag(rail) {
    let gesture = null;
    let suppressClick = false;
    let suppressTimer = null;
    const threshold = 7;

    function pointerDown(event) {
      if (event.pointerType !== 'mouse' || event.button !== 0 ||
          event.target.closest('button, input, select, textarea, [contenteditable]') ||
          rail.scrollWidth - rail.clientWidth <= 2) return;
      gesture = {
        pointerId: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        scrollLeft: rail.scrollLeft,
        dragging: false
      };
    }

    function pointerMove(event) {
      if (!gesture || event.pointerId !== gesture.pointerId || !(event.buttons & 1)) return;
      const dx = event.clientX - gesture.x;
      const dy = event.clientY - gesture.y;
      if (!gesture.dragging) {
        if (Math.abs(dx) < threshold || Math.abs(dx) <= Math.abs(dy)) return;
        gesture.dragging = true;
        rail.classList.add('is-grab-scrolling');
      }
      event.preventDefault();
      rail.scrollLeft = gesture.scrollLeft - dx;
    }

    function pointerEnd(event) {
      if (!gesture || event.pointerId !== gesture.pointerId) return;
      const dragged = gesture.dragging;
      gesture = null;
      rail.classList.remove('is-grab-scrolling');
      if (dragged && event.type === 'pointerup') {
        suppressClick = true;
        clearTimeout(suppressTimer);
        // Der zugehoerige Click folgt unmittelbar auf pointerup.
        suppressTimer = setTimeout(() => { suppressClick = false; }, 0);
      }
    }

    function cancelDrag() {
      gesture = null;
      rail.classList.remove('is-grab-scrolling');
    }

    function clickCapture(event) {
      if (!suppressClick) return;
      suppressClick = false;
      event.preventDefault();
      event.stopImmediatePropagation();
    }

    function preventNativeDrag(event) { event.preventDefault(); }

    rail.addEventListener('pointerdown', pointerDown);
    // Die Maus darf beim Ziehen ausserhalb der Rail landen.
    window.addEventListener('pointermove', pointerMove, { passive: false });
    window.addEventListener('pointerup', pointerEnd);
    window.addEventListener('pointercancel', pointerEnd);
    window.addEventListener('blur', cancelDrag);
    rail.addEventListener('click', clickCapture, true);
    rail.addEventListener('dragstart', preventNativeDrag);

    cleanupScrollControls.push(() => {
      rail.removeEventListener('pointerdown', pointerDown);
      window.removeEventListener('pointermove', pointerMove);
      window.removeEventListener('pointerup', pointerEnd);
      window.removeEventListener('pointercancel', pointerEnd);
      window.removeEventListener('blur', cancelDrag);
      rail.removeEventListener('click', clickCapture, true);
      rail.removeEventListener('dragstart', preventNativeDrag);
      clearTimeout(suppressTimer);
      cancelDrag();
    });
  }

  function section(title, entries, key, kind) {
    if (!entries.length) return null;
    const area = document.createElement('section');
    area.className = 'discover-shelf';
    area.dataset.shelf = key;
    area.dataset.kind = kind;
    const heading = createHeading(title, kind);
    const rail = document.createElement('div');
    rail.className = 'discover-rail';
    rail.tabIndex = 0;
    rail.setAttribute('role', 'region');
    rail.setAttribute('aria-label', title + ', horizontal scrollbare App-Liste');

    const controls = document.createElement('div');
    controls.className = 'shelf-controls';
    const distance = () => Math.max(240, rail.clientWidth * 0.8);
    const previous = createArrow(-1, title, rail, distance);
    const next = createArrow(1, title, rail, distance);
    controls.append(previous, next);
    heading.appendChild(controls);
    entries.forEach(repo => rail.appendChild(thumbnail(repo)));
    area.append(heading, rail);
    watchScrollControls(rail, controls, previous, next);
    enableMouseDrag(rail);
    return area;
  }

  function highlightControls(heading, rail) {
    const controls = document.createElement('div');
    controls.className = 'highlight-controls';
    const distance = () => {
      const item = rail.querySelector('.highlight-card');
      if (!item) return rail.clientWidth;
      const gap = parseFloat(getComputedStyle(rail).columnGap) || 0;
      return item.getBoundingClientRect().width + gap;
    };
    const previous = createArrow(-1, 'Highlights', rail, distance);
    const next = createArrow(1, 'Highlights', rail, distance);
    controls.append(previous, next);
    heading.appendChild(controls);
    watchScrollControls(rail, controls, previous, next);
  }

  function highlights() {
    const featured = repos.filter(repo => repo.featured);
    // Auch externe Daten ohne Markierung bekommen einen kuratierten Einstieg.
    const entries = (featured.length ? featured : repos).slice(0, 10);
    if (!entries.length) return null;

    const area = document.createElement('section');
    area.className = 'highlights-area';
    const heading = createHeading('Highlights');
    const rail = document.createElement('div');
    rail.className = 'highlight-rail';
    rail.dataset.count = String(Math.min(entries.length, 3));
    rail.setAttribute('role', 'region');
    rail.setAttribute('aria-label', 'Highlights, horizontal scrollbare Auswahl');
    rail.tabIndex = 0;

    entries.forEach((repo, i) => {
      const item = B.cards.createCard(repo, i);
      item.classList.remove('featured', 'featured-wide', 'featured-tall');
      item.classList.add('visible', 'highlight-card');
      item.style.transitionDelay = '0ms';
      const img = item.querySelector('.card-image > img');
      if (img && i < 2) img.loading = 'eager';
      const content = item.querySelector('.card-content');
      const attributes = document.createElement('div');
      attributes.className = 'discover-attributes';
      addAttributes(attributes, repo, 2);
      const meta = content.querySelector('.card-meta');
      if (meta) content.insertBefore(attributes, meta);
      else content.appendChild(attributes);
      rail.appendChild(item);
    });
    highlightControls(heading, rail);
    enableMouseDrag(rail);
    area.append(heading, rail);
    return area;
  }

  function render() {
    cleanupScrollControls.forEach(cleanup => cleanup());
    cleanupScrollControls = [];
    const root = B.dom.discoverPage;
    root.replaceChildren();
    if (!repos.length) {
      const empty = document.createElement('p');
      empty.className = 'empty-state';
      empty.textContent = 'Noch keine Apps vorhanden.';
      root.appendChild(empty);
      return;
    }
    const top = highlights();
    if (top) root.appendChild(top);
    const shelves = [];
    Object.entries(types).forEach(([type, meta]) => {
      const entries = repos.filter(repo => repo.type === type);
      if (entries.length) shelves.push({ key: 'type-' + type, title: meta.label, entries, priority: 0, kind: 'type' });
    });
    Object.entries(groups).forEach(([id, group]) => {
      const entries = repos.filter(repo => repo.group === id);
      if (entries.length) shelves.push({ key: 'group-' + id, title: group.label || id, entries, priority: 1, kind: 'group' });
    });
    const tags = new Map();
    repos.forEach(repo => (Array.isArray(repo.tags) ? repo.tags : []).forEach(tag => {
      if (typeof tag !== 'string' || !tag.trim()) return;
      if (!tags.has(tag)) tags.set(tag, []);
      tags.get(tag).push(repo);
    }));
    Array.from(tags.entries()).filter(([, entries]) => entries.length >= 2)
      .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0], 'de'))
      .slice(0, 8).forEach(([tag, entries]) => shelves.push({
        key: 'tag-' + tag, title: tag, entries, priority: 2, kind: 'tag'
      }));

    // Typ, Gruppe und Tag bleiben abwechselnde Reihen.
    const buckets = [0, 1, 2].map(priority => shelves.filter(shelf => shelf.priority === priority));
    while (buckets.some(bucket => bucket.length)) {
      buckets.forEach(bucket => {
        const next = bucket.shift();
        if (next) root.appendChild(section(next.title, next.entries, next.key, next.kind));
      });
    }
  }
  B.discover = { render };
})(window.BoilerRoom);
