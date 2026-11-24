/* Typgruppen-DnD sowie Sortierung von Launcher-Listen und App-Symbolen. */
(function (B) {
  'use strict';

  const grid = B.dom.launcherGrid;
  const HOLD_MS = 460;
  const MOVE_TOLERANCE = 10;
  let draggedCard = null;
  let draggedGroup = null;
  let groupDragOriginal = null;
  let touchGroup = null;
  let press = null;
  let ghost = null;
  let suppressClickUntil = 0;

  function getLabels(selector) {
    return Array.from(grid.querySelectorAll(selector)).map(item => item.dataset.label);
  }

  function persistIcons() {
    B.favorites.setOrder(getLabels('.launcher-app'));
  }

  function announceTypePosition(section) {
    const status = document.getElementById('launcherOrderStatus');
    if (!status) return;
    const groups = Array.from(grid.querySelectorAll(':scope > .launcher-type-group'));
    const label = section.querySelector('.launcher-type-name')?.textContent || section.dataset.type;
    status.textContent = 'Gruppe „' + label + '“ auf Position ' +
      (groups.indexOf(section) + 1) + ' von ' + groups.length + ' verschoben.';
  }

  function clearGroupFeedback() {
    grid.querySelectorAll('.is-group-target, .is-group-dragging').forEach(node =>
      node.classList.remove('is-group-target', 'is-group-dragging'));
  }

  function moveGroup(source, target, pointerY) {
    if (!target || source === target || target.parentElement !== grid) return;
    const rect = target.querySelector('.launcher-type-heading').getBoundingClientRect();
    const before = pointerY < rect.top + rect.height / 2;
    const next = before ? target : target.nextSibling;
    if (next !== source) grid.insertBefore(source, next);
    grid.querySelectorAll('.is-group-target').forEach(el => el.classList.remove('is-group-target'));
    target.classList.add('is-group-target');
  }

  function finishNativeGroupDrag(commit = false) {
    if (!draggedGroup) return;
    const group = draggedGroup;
    draggedGroup = null;
    clearGroupFeedback();
    if (!commit) groupDragOriginal?.forEach(section => grid.appendChild(section));
    else {
      B.launcher.persistTypeOrder();
      announceTypePosition(group);
    }
    groupDragOriginal = null;
  }

  function announcePosition(tile) {
    const status = document.getElementById('launcherOrderStatus');
    if (!status) return;
    const icons = Array.from(grid.querySelectorAll('.launcher-app'));
    status.textContent = '„' + tile.dataset.label + '“ auf Position ' +
      (icons.indexOf(tile) + 1) + ' von ' + icons.length + ' verschoben.';
  }

  // Die Liste verwendet wie zuvor natives HTML5-Drag-and-drop.
  function enableListDrag() {
    if (B.state.section !== 'launcher' || B.state.launcherView !== 'list') return;
    grid.querySelectorAll('.card').forEach(card => {
      if (card.draggable) return;
      const handle = document.createElement('div');
      handle.className = 'drag-handle';
      handle.textContent = '⋮⋮';
      handle.setAttribute('aria-hidden', 'true');
      // DOM-Reihenfolge: Grip | App-Name | Entfernen-Button.
      card.prepend(handle);
      card.draggable = true;
      const fav = card.querySelector('.fav-btn');
      if (fav) fav.draggable = false;
      card.addEventListener('dragstart', e => {
        if (B.state.launcherView !== 'list' || !grid.contains(card)) { e.preventDefault(); return; }
        draggedCard = card;
        card.classList.add('dragging');
        if (e.dataTransfer) {
          e.dataTransfer.effectAllowed = 'move';
          try { e.dataTransfer.setData('text/plain', card.dataset.label); } catch (err) {}
        }
      });
      card.addEventListener('dragend', () => {
        if (draggedCard !== card) return;
        card.classList.remove('dragging');
        grid.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
        draggedCard = null;
        B.favorites.setOrder(getLabels('.card'));
      });
    });
  }

  function removeGhost() {
    if (ghost) { ghost.remove(); ghost = null; }
  }

  function clearPressTimer() {
    if (press?.timer) { clearTimeout(press.timer); press.timer = null; }
  }

  function restoreIconOrder(labels, container) {
    if (!container) return;
    const byLabel = new Map(Array.from(container.querySelectorAll(':scope > .launcher-app'))
      .map(tile => [tile.dataset.label, tile]));
    labels.forEach(label => { if (byLabel.has(label)) container.appendChild(byLabel.get(label)); });
  }

  function finishIconDrag(commit) {
    if (!press) return;
    const state = press;
    clearPressTimer();
    press = null;
    if (state.kind === 'touch') document.body.classList.remove('launcher-touch-press');
    if (state.active) {
      suppressClickUntil = Date.now() + 500;
      state.tile.classList.remove('is-dragging');
      grid.classList.remove('is-sorting');
      removeGhost();
      if (state.kind === 'pointer') {
        try {
          if (state.tile.hasPointerCapture(state.pointerId)) state.tile.releasePointerCapture(state.pointerId);
        } catch (e) {}
      }
      if (!commit) restoreIconOrder(state.originalOrder, state.container);
      else if (state.originalOrder.join('\0') !== Array.from(state.container.children).map(el => el.dataset.label).join('\0')) {
        persistIcons();
        announcePosition(state.tile);
      }
    }
  }

  function cancelIconDrag() {
    finishIconDrag(false);
    draggedCard = null;
    finishNativeGroupDrag();
    finishTouchGroupDrag(false);
  }

  function positionGhost(x, y) {
    if (!ghost) return;
    ghost.style.left = (x - ghost.offsetWidth / 2) + 'px';
    ghost.style.top = (y - ghost.offsetHeight / 2) + 'px';
  }

  function startIconDrag(state) {
    if (press !== state || B.state.section !== 'launcher' || B.state.launcherView !== 'apps') return;
    state.active = true;
    state.timer = null;
    state.container = state.tile.parentElement;
    state.originalOrder = Array.from(state.container.children).map(el => el.dataset.label);
    state.tile.classList.add('is-dragging');
    grid.classList.add('is-sorting');
    ghost = state.tile.cloneNode(true);
    ghost.classList.remove('is-dragging');
    ghost.classList.add('launcher-app-ghost');
    ghost.setAttribute('aria-hidden', 'true');
    ghost.tabIndex = -1;
    const rect = state.tile.getBoundingClientRect();
    ghost.style.width = rect.width + 'px';
    ghost.style.height = rect.height + 'px';
    document.body.appendChild(ghost);
    positionGhost(state.lastX, state.lastY);
    if (state.kind === 'pointer') {
      try { state.tile.setPointerCapture(state.pointerId); } catch (e) {}
    }
  }

  function getIconTile(target) {
    const tile = target.closest?.('.launcher-app-icon')?.closest('.launcher-app');
    return tile && grid.contains(tile) ? tile : null;
  }

  function beginIconPress(tile, kind, pointerId, x, y) {
    if (press) finishIconDrag(false);
    const state = {
      kind, pointerId, tile, startX: x, startY: y,
      lastX: x, lastY: y, timer: null, active: false, originalOrder: []
    };
    press = state;
    state.timer = setTimeout(() => startIconDrag(state), HOLD_MS);
    if (kind === 'touch') document.body.classList.add('launcher-touch-press');
  }

  function moveIconPress(state, x, y) {
    state.lastX = x;
    state.lastY = y;
    if (!state.active) {
      if (Math.hypot(x - state.startX, y - state.startY) > MOVE_TOLERANCE) {
        finishIconDrag(false);
        suppressClickUntil = Date.now() + 400;
      }
      return;
    }
    positionGhost(x, y);
    // Der Ghost und der Platzhalter fangen keine Pointer-Events ab.
    const target = document.elementFromPoint(x, y)?.closest('.launcher-app');
    if (!target || target === state.tile || target.parentElement !== state.container) return;
    const items = Array.from(state.container.querySelectorAll(':scope > .launcher-app'));
    const from = items.indexOf(state.tile);
    const to = items.indexOf(target);
    state.container.insertBefore(state.tile, from < to ? target.nextSibling : target);
  }

  function onIconPointerDown(e) {
    if (B.state.section !== 'launcher' || B.state.launcherView !== 'apps') return;
    // Touch hat einen eigenen Pfad: das native Long-Press muss bereits
    // bei touchstart unterbunden werden (insbesondere in Safari/iOS).
    if (e.pointerType === 'touch' || !e.isPrimary || e.button !== 0) return;
    const tile = getIconTile(e.target);
    if (tile) beginIconPress(tile, 'pointer', e.pointerId, e.clientX, e.clientY);
  }

  function onIconPointerMove(e) {
    if (press?.kind !== 'pointer' || e.pointerId !== press.pointerId) return;
    if (press.active) e.preventDefault();
    moveIconPress(press, e.clientX, e.clientY);
  }

  function onIconPointerUp(e) {
    if (press?.kind !== 'pointer' || e.pointerId !== press.pointerId) return;
    if (press.active) e.preventDefault();
    finishIconDrag(true);
  }

  function onIconPointerCancel(e) {
    if (press?.kind === 'pointer' && e.pointerId === press.pointerId) {
      suppressClickUntil = Date.now() + 400;
      finishIconDrag(false);
    }
  }

  // Touch Events statt Pointer-Capture: stabil auch wenn das App-Element
  // beim Sortieren im DOM verschoben wird. Native Taps werden ausschliesslich
  // auf dem Symbol abgefangen und bei kurzem Tippen genau einmal nachgebildet.
  function onIconTouchStart(e) {
    if (press?.kind === 'touch' && e.touches.length !== 1) {
      finishIconDrag(false);
      return;
    }
    if (B.state.section !== 'launcher' || B.state.launcherView !== 'apps' || e.touches.length !== 1) return;
    const tile = getIconTile(e.target);
    if (!tile || !e.cancelable) return;
    e.preventDefault();
    const touch = e.changedTouches[0];
    beginIconPress(tile, 'touch', touch.identifier, touch.clientX, touch.clientY);
  }

  function findChangedTouch(e, state) {
    return Array.from(e.changedTouches).find(touch => touch.identifier === state.pointerId);
  }

  function onIconTouchMove(e) {
    if (press?.kind !== 'touch') return;
    const touch = findChangedTouch(e, press);
    if (!touch) return;
    if (e.cancelable) e.preventDefault();
    moveIconPress(press, touch.clientX, touch.clientY);
  }

  function onIconTouchEnd(e) {
    if (press?.kind !== 'touch') return;
    const state = press;
    const touch = findChangedTouch(e, state);
    if (!touch) return;
    if (e.cancelable) e.preventDefault();
    const tap = !state.active && Math.hypot(touch.clientX - state.startX,
      touch.clientY - state.startY) <= MOVE_TOLERANCE &&
      document.elementFromPoint(touch.clientX, touch.clientY)?.closest('.launcher-app') === state.tile;
    finishIconDrag(true);
    if (tap && grid.contains(state.tile)) {
      // Ein neuer, absichtlicher Tap darf nicht von einer alten Sortiergeste
      // blockiert werden. touchstart.preventDefault verhindert den nativen Klick.
      suppressClickUntil = 0;
      state.tile.click();
    }
  }

  function onIconTouchCancel(e) {
    if (press?.kind === 'touch' && findChangedTouch(e, press)) finishIconDrag(false);
  }

  function onIconKeyDown(e) {
    if (B.state.section !== 'launcher' || B.state.launcherView !== 'apps' || !e.altKey) return;
    const tile = e.target.closest('.launcher-app');
    if (!tile || !grid.contains(tile)) return;
    const container = tile.parentElement;
    const tiles = Array.from(container.querySelectorAll(':scope > .launcher-app'));
    const current = tiles.indexOf(tile);
    const firstTop = tiles[0]?.getBoundingClientRect().top;
    const columns = Math.max(1, tiles.filter(item =>
      Math.abs(item.getBoundingClientRect().top - firstTop) < 4).length);
    const moves = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -columns, ArrowDown: columns };
    if (!(e.key in moves)) return;
    e.preventDefault();
    const next = Math.max(0, Math.min(tiles.length - 1, current + moves[e.key]));
    if (next === current) return;
    container.insertBefore(tile, next > current ? tiles[next].nextSibling : tiles[next]);
    persistIcons();
    announcePosition(tile);
    tile.focus({ preventScroll: true });
  }

  // Touch-DnD: die sechs Punkte der Ueberschrift sind der Touch-Handle.
  // Die native Desktop-Drag-Flaeche bleibt die komplette Ueberschrift.
  function onGroupPointerDown(e) {
    if (B.state.section !== 'launcher' || e.pointerType === 'mouse' || !e.isPrimary) return;
    const grip = e.target.closest('.launcher-type-grip');
    const section = grip?.closest('.launcher-type-group');
    if (!section || !grid.contains(section)) return;
    touchGroup = {
      source: section, pointerId: e.pointerId,
      x: e.clientX, y: e.clientY, active: false,
      original: Array.from(grid.querySelectorAll(':scope > .launcher-type-group'))
    };
  }

  function onGroupPointerMove(e) {
    const state = touchGroup;
    if (!state || e.pointerId !== state.pointerId) return;
    if (!state.active && Math.hypot(e.clientX - state.x, e.clientY - state.y) < 8) return;
    if (!state.active) {
      state.active = true;
      state.source.classList.add('is-group-dragging');
    }
    e.preventDefault();
    const target = document.elementFromPoint(e.clientX, e.clientY)?.closest('.launcher-type-group');
    if (target && grid.contains(target)) moveGroup(state.source, target, e.clientY);
  }

  function finishTouchGroupDrag(commit) {
    if (!touchGroup) return;
    const state = touchGroup;
    touchGroup = null;
    clearGroupFeedback();
    if (!state.active) return;
    if (!commit) state.original.forEach(section => grid.appendChild(section));
    else {
      B.launcher.persistTypeOrder();
      announceTypePosition(state.source);
    }
  }

  function setupGridDnd() {
    grid.addEventListener('dragstart', e => {
      const heading = e.target.closest('.launcher-type-heading');
      if (!heading || !grid.contains(heading) || B.state.section !== 'launcher') return;
      draggedGroup = heading.closest('.launcher-type-group');
      groupDragOriginal = Array.from(grid.querySelectorAll(':scope > .launcher-type-group'));
      draggedGroup.classList.add('is-group-dragging');
      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = 'move';
        try { e.dataTransfer.setData('text/plain', draggedGroup.dataset.type); } catch (err) {}
      }
    });
    grid.addEventListener('dragover', e => {
      if (draggedGroup) {
        e.preventDefault();
        if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
        moveGroup(draggedGroup, e.target.closest('.launcher-type-group'), e.clientY);
        return;
      }
      if (B.state.launcherView !== 'list' || !draggedCard || !grid.contains(draggedCard)) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
      const target = e.target.closest('.card');
      if (!target || target === draggedCard || target.parentElement !== draggedCard.parentElement) return;
      grid.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
      target.classList.add('drag-over');
      const rect = target.getBoundingClientRect();
      draggedCard.parentElement.insertBefore(draggedCard,
        e.clientY - rect.top < rect.height / 2 ? target : target.nextSibling);
    });
    grid.addEventListener('drop', e => {
      if (draggedGroup || draggedCard) e.preventDefault();
      if (draggedGroup) finishNativeGroupDrag(true);
    });
    grid.addEventListener('dragend', e => {
      // Auch wenn DOM-Umsortierung den nativen drop-Event unterdrueckt.
      if (draggedGroup) finishNativeGroupDrag(true);
    });
    grid.addEventListener('dragleave', e => {
      if (e.target === grid) grid.querySelectorAll('.drag-over, .is-group-target')
        .forEach(el => el.classList.remove('drag-over', 'is-group-target'));
    });
    grid.addEventListener('pointerdown', onGroupPointerDown);
    document.addEventListener('pointermove', onGroupPointerMove, { passive: false });
    document.addEventListener('pointerup', e => {
      if (touchGroup && e.pointerId === touchGroup.pointerId) finishTouchGroupDrag(true);
    });
    document.addEventListener('pointercancel', e => {
      if (touchGroup && e.pointerId === touchGroup.pointerId) finishTouchGroupDrag(false);
    });
    // Delegation: funktioniert auch nach jedem neuen renderLauncher().
    grid.addEventListener('pointerdown', onIconPointerDown);
    // Dokumentebene ist notwendig: Das Verschieben des gekapselten Elements
    // im DOM kann auf Touch-Browsern die Pointer-Capture aufheben.
    document.addEventListener('pointermove', onIconPointerMove, { passive: false });
    document.addEventListener('pointerup', onIconPointerUp);
    document.addEventListener('pointercancel', onIconPointerCancel);
    document.addEventListener('touchstart', onIconTouchStart, { passive: false });
    document.addEventListener('touchmove', onIconTouchMove, { passive: false });
    document.addEventListener('touchend', onIconTouchEnd, { passive: false });
    document.addEventListener('touchcancel', onIconTouchCancel);
    grid.addEventListener('keydown', onIconKeyDown);
    grid.addEventListener('contextmenu', e => {
      if (e.target.closest('.launcher-app-icon')) e.preventDefault();
    });
    window.addEventListener('blur', cancelIconDrag);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') cancelIconDrag();
    });
  }

  B.drag = {
    enableList: enableListDrag,
    announceTypePosition,
    setup: setupGridDnd,
    cancelIconDrag,
    suppressIconClick: () => Date.now() < suppressClickUntil
  };
})(window.BoilerRoom);
