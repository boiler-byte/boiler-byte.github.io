/* Entdecken: responsive Highlights und Regale aus Typen und Tags. */
(function (B) {
  'use strict';
  const repos = B.data.repos;
  const types = B.data.types;
  const groups = B.groups.catalog;
  let cleanupScrollControls = [];

  function addAttributes(container, repo, maxTags) {
    if (repo.type) container.appendChild(B.icons.attribute('type', types[repo.type]?.label || repo.type));
    B.data.groupIds(repo).forEach(id => container.appendChild(B.icons.attribute('group', groups.get(id)?.label || id)));
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
    B.data.groupIds(repo).slice(0, 1).forEach(id => meta.appendChild(B.icons.attribute('group', groups.get(id)?.label || id)));
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

  // Desktop: Drag-to-Scroll mit kurzem, natuerlichem Nachlauf (wie ein Swipe).
  // Touch/Trackpad bleiben nativ; Wheel-Events werden NICHT umgelenkt.
  function enableMouseDrag(rail) {
    let gesture = null;
    let coastFrame = 0;
    let suppressClick = false;
    let suppressTimer = null;
    const threshold = 7;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

    function stopCoasting() {
      if (coastFrame) cancelAnimationFrame(coastFrame);
      coastFrame = 0;
      rail.classList.remove('is-coasting');
    }

    function settle() {
      stopCoasting();
      // Browser-Snap uebernimmt das Ausrichten an der linken Kartenkante.
      // Auch nach Maus-Drags greift damit dieselbe Regel wie beim Touch-Swipe.
      rail.classList.remove('is-grab-scrolling');
    }

    function coast(velocity) {
      if (reduceMotion.matches || Math.abs(velocity) < .28) {
        settle();
        return;
      }
      // Geschwindigkeit in px/ms; Drosselung macht den Nachlauf vorhersagbar.
      let speed = Math.max(-1.8, Math.min(1.8, velocity)) * 16.667;
      let last = 0;
      rail.classList.add('is-coasting');
      rail.classList.remove('is-grab-scrolling');
      function frame(time) {
        const delta = last ? Math.min(32, time - last) : 16.667;
        last = time;
        const before = rail.scrollLeft;
        rail.scrollLeft += speed * (delta / 16.667);
        speed *= Math.pow(.94, delta / 16.667);
        if (Math.abs(speed) < .45 || Math.abs(rail.scrollLeft - before) < .1) {
          settle();
          return;
        }
        coastFrame = requestAnimationFrame(frame);
      }
      coastFrame = requestAnimationFrame(frame);
    }

    function pointerDown(event) {
      if (event.pointerType !== 'mouse') { stopCoasting(); return; }
      if (event.button !== 0 ||
          event.target.closest('button, input, select, textarea, [contenteditable]') ||
          rail.scrollWidth - rail.clientWidth <= 2) return;
      stopCoasting();
      gesture = {
        pointerId: event.pointerId, x: event.clientX, y: event.clientY,
        scrollLeft: rail.scrollLeft, dragging: false,
        samples: [{ x: event.clientX, time: performance.now() }]
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
      const now = performance.now();
      gesture.samples.push({ x: event.clientX, time: now });
      gesture.samples = gesture.samples.filter(sample => now - sample.time <= 110);
    }

    function pointerEnd(event) {
      if (!gesture || event.pointerId !== gesture.pointerId) return;
      const current = gesture;
      gesture = null;
      if (!current.dragging || event.type === 'pointercancel') {
        settle();
        return;
      }
      // Den nach dem Pointerup generierten Link-Klick sicher unterdruecken.
      suppressClick = true;
      clearTimeout(suppressTimer);
      suppressTimer = setTimeout(() => { suppressClick = false; }, 0);
      const first = current.samples[0];
      const last = current.samples[current.samples.length - 1];
      const age = performance.now() - last.time;
      const velocity = age < 110 && last.time > first.time
        ? -(last.x - first.x) / (last.time - first.time) : 0;
      coast(velocity);
    }

    function cancelDrag() {
      gesture = null;
      settle();
    }

    function clickCapture(event) {
      if (!suppressClick) return;
      suppressClick = false;
      event.preventDefault();
      event.stopImmediatePropagation();
    }

    function preventNativeDrag(event) { event.preventDefault(); }
    function onWheel() { stopCoasting(); } // Keine wheel.preventDefault()/Delta-Umleitung.

    rail.addEventListener('pointerdown', pointerDown);
    window.addEventListener('pointermove', pointerMove, { passive: false });
    window.addEventListener('pointerup', pointerEnd);
    window.addEventListener('pointercancel', pointerEnd);
    window.addEventListener('blur', cancelDrag);
    rail.addEventListener('click', clickCapture, true);
    rail.addEventListener('dragstart', preventNativeDrag);
    rail.addEventListener('wheel', onWheel, { passive: true });

    cleanupScrollControls.push(() => {
      rail.removeEventListener('pointerdown', pointerDown);
      window.removeEventListener('pointermove', pointerMove);
      window.removeEventListener('pointerup', pointerEnd);
      window.removeEventListener('pointercancel', pointerEnd);
      window.removeEventListener('blur', cancelDrag);
      rail.removeEventListener('click', clickCapture, true);
      rail.removeEventListener('dragstart', preventNativeDrag);
      rail.removeEventListener('wheel', onWheel);
      clearTimeout(suppressTimer);
      cancelDrag();
    });
  }

  // Highlights rotieren nur, solange sie sichtbar und nicht in Benutzung sind.
  // Jede Unterbrechung beginnt nach ihrem Ende einen NEUEN 6-Sekunden-Takt.
  function enableHighlightAutoplay(area, rail) {
    const INTERVAL = 6000;
    const SCROLL_IDLE = 260;
    const blocked = new Set();
    const pressedPointers = new Set();
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let timer = 0;
    let scrollIdleTimer = 0;

    function canPlay() {
      return !blocked.size && !document.hidden &&
        !document.documentElement.classList.contains('discover-preview-active') &&
        rail.scrollWidth - rail.clientWidth > 2 && rail.children.length > 1;
    }

    function clearTimer() {
      if (timer) clearTimeout(timer);
      timer = 0;
    }

    function nextPosition() {
      const max = Math.max(0, rail.scrollWidth - rail.clientWidth);
      const railRect = rail.getBoundingClientRect();
      const inset = parseFloat(getComputedStyle(rail).scrollPaddingLeft) || 0;
      const candidates = Array.from(rail.children, item => {
        const left = rail.scrollLeft + item.getBoundingClientRect().left - railRect.left - rail.clientLeft - inset;
        return Math.min(max, Math.max(0, left));
      });
      // Auf dem letzten erreichbaren Snap-Punkt zur ersten Karte zurueck.
      return candidates.find(x => x > rail.scrollLeft + 2) ?? 0;
    }

    function schedule() {
      clearTimer();
      if (!canPlay()) return;
      timer = setTimeout(() => {
        timer = 0;
        if (!canPlay()) return;
        const position = nextPosition();
        if (Math.abs(rail.scrollLeft - position) < 2) {
          schedule();
          return;
        }
        markScrolling();
        rail.scrollTo({ left: position, behavior: 'smooth' });
      }, INTERVAL);
    }

    function block(reason, active) {
      if (active) {
        blocked.add(reason);
        clearTimer();
      } else if (blocked.delete(reason)) {
        schedule();
      }
    }

    function markScrolling() {
      block('scroll', true);
      clearTimeout(scrollIdleTimer);
      scrollIdleTimer = setTimeout(() => block('scroll', false), SCROLL_IDLE);
    }

    function onPointerDown(event) {
      pressedPointers.add(event.pointerId);
      block('contact', true);
    }
    function onPointerEnd(event) {
      pressedPointers.delete(event.pointerId);
      if (!pressedPointers.size) block('contact', false);
    }
    function onPointerEnter(event) {
      if (event.pointerType === 'mouse') block('hover', true);
    }
    function onPointerLeave(event) {
      if (event.pointerType === 'mouse') block('hover', false);
    }
    function onFocusIn() { block('focus', true); }
    function onFocusOut(event) {
      if (!area.contains(event.relatedTarget)) block('focus', false);
    }
    function onVisibility() { block('hidden', document.hidden); }
    function onMotionChange() { block('motion', reduceMotion.matches); }
    function onResize() { schedule(); }
    function onWindowBlur() { block('window', true); }
    function onWindowFocus() { block('window', false); }

    area.addEventListener('pointerenter', onPointerEnter);
    area.addEventListener('pointerleave', onPointerLeave);
    area.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointerup', onPointerEnd);
    window.addEventListener('pointercancel', onPointerEnd);
    area.addEventListener('focusin', onFocusIn);
    area.addEventListener('focusout', onFocusOut);
    // Auch das Scrollen anderer Entdecken-Regale unterbricht den Autoplay-Takt.
    document.addEventListener('scroll', markScrolling, { capture: true, passive: true });
    window.addEventListener('scroll', markScrolling, { passive: true });
    window.addEventListener('blur', onWindowBlur);
    window.addEventListener('focus', onWindowFocus);
    document.addEventListener('visibilitychange', onVisibility);
    reduceMotion.addEventListener('change', onMotionChange);

    const resizeObserver = typeof ResizeObserver === 'function'
      ? new ResizeObserver(onResize) : null;
    if (resizeObserver) resizeObserver.observe(rail);
    const intersectionObserver = typeof IntersectionObserver === 'function'
      ? new IntersectionObserver(entries => {
        const visible = entries[0]?.intersectionRatio >= .25;
        block('offscreen', !visible);
      }, { threshold: [0, .25, .5] }) : null;
    if (intersectionObserver) {
      blocked.add('offscreen');
      intersectionObserver.observe(area);
    }
    onMotionChange();
    onVisibility();
    schedule();

    cleanupScrollControls.push(() => {
      clearTimer();
      clearTimeout(scrollIdleTimer);
      area.removeEventListener('pointerenter', onPointerEnter);
      area.removeEventListener('pointerleave', onPointerLeave);
      area.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointerup', onPointerEnd);
      window.removeEventListener('pointercancel', onPointerEnd);
      area.removeEventListener('focusin', onFocusIn);
      area.removeEventListener('focusout', onFocusOut);
      document.removeEventListener('scroll', markScrolling, true);
      window.removeEventListener('scroll', markScrolling);
      window.removeEventListener('blur', onWindowBlur);
      window.removeEventListener('focus', onWindowFocus);
      document.removeEventListener('visibilitychange', onVisibility);
      reduceMotion.removeEventListener('change', onMotionChange);
      resizeObserver?.disconnect();
      intersectionObserver?.disconnect();
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
    enableHighlightAutoplay(area, rail);
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
    const tags = new Map();
    repos.forEach(repo => (Array.isArray(repo.tags) ? repo.tags : []).forEach(tag => {
      if (typeof tag !== 'string' || !tag.trim()) return;
      if (!tags.has(tag)) tags.set(tag, []);
      tags.get(tag).push(repo);
    }));
    Array.from(tags.entries()).filter(([, entries]) => entries.length >= 2)
      .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0], 'de'))
      .slice(0, 8).forEach(([tag, entries]) => shelves.push({
        key: 'tag-' + tag, title: tag, entries, priority: 1, kind: 'tag'
      }));

    // Typ und Tag bleiben abwechselnde Reihen.
    const buckets = [0, 1].map(priority => shelves.filter(shelf => shelf.priority === priority));
    while (buckets.some(bucket => bucket.length)) {
      buckets.forEach(bucket => {
        const next = bucket.shift();
        if (next) root.appendChild(section(next.title, next.entries, next.key, next.kind));
      });
    }
  }
  B.discover = { render };
})(window.BoilerRoom);
