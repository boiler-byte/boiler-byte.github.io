/* Listen-DnD und Long-Press-Sortierung der kreisrunden Launcher-App-Symbole. */
(function (B) {
  'use strict';

  const grid = B.dom.launcherGrid;
  const HOLD_MS = 460;
  const MOVE_TOLERANCE = 10;
  let draggedCard = null;
  let press = null;
  let ghost = null;
  let suppressClickUntil = 0;

  function getLabels(selector) {
    return Array.from(grid.querySelectorAll(selector)).map(item => item.dataset.label);
  }

  function persistIcons() {
    B.favorites.setOrder(getLabels('.launcher-app'));
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
        if (B.state.launcherView !== 'list') { e.preventDefault(); return; }
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

  function restoreIconOrder(labels) {
    const byLabel = new Map(Array.from(grid.querySelectorAll('.launcher-app'))
      .map(tile => [tile.dataset.label, tile]));
    labels.forEach(label => { if (byLabel.has(label)) grid.appendChild(byLabel.get(label)); });
  }

  function finishIconDrag(commit) {
    if (!press) return;
    const state = press;
    clearPressTimer();
    press = null;
    if (state.active) {
      suppressClickUntil = Date.now() + 500;
      state.tile.classList.remove('is-dragging');
      grid.classList.remove('is-sorting');
      removeGhost();
      try {
        if (state.tile.hasPointerCapture(state.pointerId)) state.tile.releasePointerCapture(state.pointerId);
      } catch (e) {}
      if (!commit) restoreIconOrder(state.originalOrder);
      else if (state.originalOrder.join('\0') !== getLabels('.launcher-app').join('\0')) {
        persistIcons();
        announcePosition(state.tile);
      }
    }
  }

  function cancelIconDrag() {
    finishIconDrag(false);
    draggedCard = null;
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
    state.originalOrder = getLabels('.launcher-app');
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
    try { state.tile.setPointerCapture(state.pointerId); } catch (e) {}
  }

  function onIconPointerDown(e) {
    if (B.state.section !== 'launcher' || B.state.launcherView !== 'apps') return;
    if (!e.isPrimary || e.button !== 0) return;
    const icon = e.target.closest('.launcher-app-icon');
    const tile = icon?.closest('.launcher-app');
    if (!tile || !grid.contains(tile)) return;
    if (press) finishIconDrag(false);
    const state = {
      pointerId: e.pointerId, tile, startX: e.clientX, startY: e.clientY,
      lastX: e.clientX, lastY: e.clientY, timer: null,
      active: false, originalOrder: []
    };
    press = state;
    state.timer = setTimeout(() => startIconDrag(state), HOLD_MS);
    // touch-action:none auf dem Icon verhindert nur waehrend der Geste Browser-Scroll.
  }

  function onIconPointerMove(e) {
    if (!press || e.pointerId !== press.pointerId) return;
    const state = press;
    state.lastX = e.clientX;
    state.lastY = e.clientY;
    if (!state.active) {
      if (Math.hypot(e.clientX - state.startX, e.clientY - state.startY) > MOVE_TOLERANCE) {
        clearPressTimer();
        press = null;
        suppressClickUntil = Date.now() + 400;
      }
      return;
    }
    e.preventDefault();
    positionGhost(e.clientX, e.clientY);
    // Der Ghost faengt keine Pointer-Events ab, ebenso wenig der Platzhalter.
    const target = document.elementFromPoint(e.clientX, e.clientY)?.closest('.launcher-app');
    if (!target || target === state.tile || target.parentElement !== grid) return;
    const items = Array.from(grid.querySelectorAll('.launcher-app'));
    const from = items.indexOf(state.tile);
    const to = items.indexOf(target);
    grid.insertBefore(state.tile, from < to ? target.nextSibling : target);
  }

  function onIconPointerUp(e) {
    if (!press || e.pointerId !== press.pointerId) return;
    if (press.active) { e.preventDefault(); finishIconDrag(true); }
    else { clearPressTimer(); press = null; }
  }

  function onIconPointerCancel(e) {
    if (press && e.pointerId === press.pointerId) {
      suppressClickUntil = Date.now() + 400;
      finishIconDrag(false);
    }
  }

  function onIconKeyDown(e) {
    if (B.state.section !== 'launcher' || B.state.launcherView !== 'apps' || !e.altKey) return;
    const tile = e.target.closest('.launcher-app');
    if (!tile || tile.parentElement !== grid) return;
    const tiles = Array.from(grid.querySelectorAll('.launcher-app'));
    const current = tiles.indexOf(tile);
    const firstTop = tiles[0]?.getBoundingClientRect().top;
    const columns = Math.max(1, tiles.filter(item =>
      Math.abs(item.getBoundingClientRect().top - firstTop) < 4).length);
    const moves = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -columns, ArrowDown: columns };
    if (!(e.key in moves)) return;
    e.preventDefault();
    const next = Math.max(0, Math.min(tiles.length - 1, current + moves[e.key]));
    if (next === current) return;
    grid.insertBefore(tile, next > current ? tiles[next].nextSibling : tiles[next]);
    persistIcons();
    announcePosition(tile);
    tile.focus({ preventScroll: true });
  }

  function setupGridDnd() {
    grid.addEventListener('dragover', e => {
      if (B.state.launcherView !== 'list' || !draggedCard || draggedCard.parentElement !== grid) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
      const target = e.target.closest('.card');
      if (!target || target === draggedCard) return;
      grid.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
      target.classList.add('drag-over');
      const rect = target.getBoundingClientRect();
      grid.insertBefore(draggedCard, e.clientY - rect.top < rect.height / 2 ? target : target.nextSibling);
    });
    grid.addEventListener('drop', e => { if (draggedCard) e.preventDefault(); });
    grid.addEventListener('dragleave', e => {
      if (e.target === grid) grid.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
    });
    // Delegation: funktioniert auch nach jedem neuen renderLauncher().
    grid.addEventListener('pointerdown', onIconPointerDown);
    // Dokumentebene ist notwendig: Das Verschieben des gekapselten Elements
    // im DOM kann auf Touch-Browsern die Pointer-Capture aufheben.
    document.addEventListener('pointermove', onIconPointerMove, { passive: false });
    document.addEventListener('pointerup', onIconPointerUp);
    document.addEventListener('pointercancel', onIconPointerCancel);
    document.addEventListener('touchend', e => {
      // Safari/Chromium-Fallback, falls nach DOM-Umsortierung kein pointerup folgt.
      if (press?.active) { e.preventDefault(); finishIconDrag(true); }
    }, { passive: false });
    document.addEventListener('touchcancel', () => finishIconDrag(false));
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
    setup: setupGridDnd,
    cancelIconDrag,
    suppressIconClick: () => Date.now() < suppressClickUntil
  };
})(window.BoilerRoom);
