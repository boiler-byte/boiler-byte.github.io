/* Gruppen-Karten, Collagen, Orbit-Dialog und dessen History-Zustaende. */
(function (B) {
  'use strict';

  const s = B.state;
  const repogroups = B.data.repogroups;
  const repos = B.data.repos;
  const GROUP_HISTORY_KEY = B.historyKeys.group;
  const createCard = (...args) => B.cards.createCard(...args);
  const getFilteredRepos = () => B.renderer.getFilteredRepos();
  const handleHistoryBack = state => B.navigation.handleHistoryBack(state);

  // ---------- GRUPPENKARTEN + KREISFÖRMIGE GRUPPENÜBERSICHT ----------
  // In anderen Ansichten werden die Repos ganz normal einzeln ausgegeben.

  const groupState = {
    id: null, members: [], previewLabel: null, persistentPreview: false,
    trigger: null, backdrop: null, overlay: null, orbit: null, preview: null,
    title: null,
    previewHideTimer: null, hoverExitTimer: null, hoverShowTimer: null,
    isClosing: false, closeTimer: null, openFrame: null
  };
  const GROUP_HOVER_DELAY_MS = 600;
  const GROUP_CLOSE_MS = 960; // Rückflug und Backdrop-Fade (820ms) + Puffer

  // Dieselbe Collage für das Gruppenbild, das Hover-Preview und die Orbit-Mitte.
  function createGroupCollage(members, className, loading = 'lazy') {
    const sources = members.map(repo => repo.img)
      .filter(src => typeof src === 'string' && src.trim());
    if (!sources.length) return null;

    const collage = document.createElement('div');
    collage.className = `group-collage ${className}`;
    collage.setAttribute('aria-hidden', 'true');

    const arrangeCollage = () => {
      const count = collage.childElementCount;
      if (!count) { collage.remove(); return; }

      let columns, rows;
      if (count <= 4) { columns = 2; rows = 2; }
      else if (count <= 6) { columns = 3; rows = 2; }
      else if (count <= 9) { columns = 3; rows = 3; }
      else {
        // Auch Gruppen mit mehr als neun Repos vollständig darstellen.
        columns = Math.ceil(Math.sqrt(count));
        rows = Math.ceil(count / columns);
      }
      collage.style.setProperty('--collage-columns', columns);
      collage.style.setProperty('--collage-rows', rows);

      const tiles = Array.from(collage.children);
      tiles.forEach(tile => { tile.style.gridColumn = ''; tile.style.gridRow = ''; });
      // Einzelne Bilder füllen die verfügbare Rasterfläche ohne Leerstellen.
      if (count === 1) {
        tiles[0].style.gridColumn = '1 / -1';
        tiles[0].style.gridRow = '1 / -1';
      } else if (count === 2) {
        tiles.forEach(tile => { tile.style.gridRow = '1 / -1'; });
      } else {
        const remainder = count % columns;
        if (remainder) tiles[tiles.length - 1].style.gridColumn = `span ${columns - remainder + 1}`;
      }
    };

    sources.forEach(src => {
      const tile = document.createElement('img');
      tile.src = src.trim();
      tile.alt = '';
      tile.loading = loading;
      tile.decoding = 'async';
      tile.addEventListener('error', () => {
        tile.remove();
        arrangeCollage();
      }, { once: true });
      collage.appendChild(tile);
    });
    arrangeCollage();
    return collage;
  }

  function createGroupCard(id, members, index) {
    const definition = repogroups[id];
    const card = document.createElement('article');
    card.className = 'card group-card';
    card.dataset.group = id;
    card.dataset.label = definition.label;
    card.tabIndex = 0;
    card.setAttribute('role', 'button');
    card.setAttribute('aria-haspopup', 'dialog');
    card.setAttribute('aria-label', `${definition.label} – ${members.length} Projekte anzeigen`);
    card.style.setProperty('--accent', 'var(--violet-base)');
    card.style.setProperty('--accent-dim', 'var(--violet-dim)');
    card.style.setProperty('--accent-glow', 'var(--violet-glow)');
    card.style.setProperty('--accent-border', 'var(--violet-border)');
    card.style.transitionDelay = `${(index % 12) * 60}ms`;

    const imageDiv = document.createElement('div');
    imageDiv.className = 'card-image';
    const imageSrc = typeof definition.img === 'string' ? definition.img.trim() : '';
    const previewSrc = typeof definition.preview === 'string' ? definition.preview.trim() : '';

    if (imageSrc === 'all') {
      const collage = createGroupCollage(members, 'group-image-collage');
      if (collage) imageDiv.appendChild(collage);
    } else {
      const image = document.createElement('img');
      image.src = imageSrc;
      image.alt = '';
      image.loading = 'lazy';
      image.width = 800;
      image.height = 500;
      imageDiv.appendChild(image);
    }

    // "all" beim Preview: dieselbe Collage zusätzlich beim Hover/Fokus.
    // Ist img bereits "all", ist das Bildraster dauerhaft sichtbar.
    if (previewSrc === 'all' && imageSrc !== 'all') {
      const collage = createGroupCollage(members, 'group-preview-collage');
      if (collage) imageDiv.appendChild(collage);
    } else if (previewSrc && previewSrc !== 'all') {
      const hoverImg = document.createElement('img');
      hoverImg.className = 'card-preview-image';
      hoverImg.src = previewSrc;
      hoverImg.alt = '';
      hoverImg.setAttribute('aria-hidden', 'true');
      hoverImg.loading = 'lazy';
      hoverImg.decoding = 'async';
      hoverImg.width = 800;
      hoverImg.height = 500;
      hoverImg.addEventListener('error', () => hoverImg.remove(), { once: true });
      imageDiv.appendChild(hoverImg);
    }

    const badge = document.createElement('span');
    badge.className = 'type-badge';
    badge.textContent = 'Gruppe';
    imageDiv.appendChild(badge);
    const count = document.createElement('span');
    count.className = 'group-card-count';
    count.textContent = `${members.length} ${members.length === 1 ? 'Projekt' : 'Projekte'}`;
    imageDiv.appendChild(count);

    const content = document.createElement('div');
    content.className = 'card-content';
    const heading = document.createElement('h3');
    heading.className = 'group-card-title';
    heading.textContent = definition.label;
    const description = document.createElement('p');
    description.className = 'description';
    description.textContent = members.map(repo => repo.label).join(' · ');
    content.append(heading, description);
    card.append(imageDiv, content);

    const open = () => openGroup(id, members, card);
    card.addEventListener('click', open);
    card.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        open();
      }
    });
    return card;
  }

  function ensureGroupOverlay() {
    if (groupState.overlay) return;
    // Geschwisterebene statt ::before: der Backdrop darf nicht von der
    // Clip-Path-/Zoom-Maske des Overlays mittransformiert werden.
    const backdrop = document.createElement('div');
    backdrop.className = 'group-backdrop';
    backdrop.hidden = true;
    backdrop.setAttribute('aria-hidden', 'true');
    document.body.appendChild(backdrop);
    groupState.backdrop = backdrop;
    const overlay = document.createElement('div');
    overlay.className = 'group-overlay';
    overlay.hidden = true;
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'groupOverlayTitle');
    // Die statischen UI-Elemente enthalten keine Repo-Daten / HTML-Injection.
    overlay.innerHTML = `
      <div class="group-overlay-header">
        <div><span class="group-overlay-eyebrow">Repo-Gruppe</span>
          <h2 id="groupOverlayTitle"></h2></div>
        <button type="button" class="group-overlay-close" aria-label="Gruppe schließen">✕ Schließen</button>
      </div>
      <div class="group-stage">
        <div class="group-orbit"></div>
        <div class="group-preview" id="groupRepoPreview" hidden></div>
      </div>`;
    document.body.appendChild(overlay);
    groupState.overlay = overlay;
    groupState.orbit = overlay.querySelector('.group-orbit');
    groupState.preview = overlay.querySelector('.group-preview');
    groupState.title = overlay.querySelector('#groupOverlayTitle');
    groupState.preview.addEventListener('mouseenter', () => {
      clearTimeout(groupState.hoverExitTimer);
      clearTimeout(groupState.hoverShowTimer);
    });
    groupState.preview.addEventListener('mouseleave', () => {
      if (!groupState.persistentPreview) scheduleHoverPreviewHide();
    });

    overlay.querySelector('.group-overlay-close').addEventListener('click', closeEntireGroup);
    overlay.addEventListener('click', e => {
      if (!groupState.id || groupState.isClosing) return;
      // Die Projekt-Icons und das Gruppenbild haben eigene Klickfunktionen.
      // Auch Klicks in der geöffneten Vorschau dürfen diese nicht schließen.
      if (e.target.closest('.group-thumb, .group-center, .group-overlay-close, .group-preview')) return;
      // Jede freie Fläche schließt den kompletten Orbit: sowohl der Bereich
      // hinter dem Orbit als auch leere Stellen zwischen den Icons.
      closeEntireGroup();
    });
    window.addEventListener('resize', () => {
      if (groupState.id) {
        positionGroupThumbs();
        updateGroupCardOrigin();
      }
    });
    document.addEventListener('keydown', e => {
      if (!groupState.id || groupState.isClosing) return;
      if (e.key === 'Tab') {
        const focusables = Array.from(overlay.querySelectorAll('button:not([disabled])'))
          .filter(el => el.getClientRects().length > 0);
        if (!focusables.length) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && (document.activeElement === first || !overlay.contains(document.activeElement))) {
          e.preventDefault(); last.focus();
        } else if (!e.shiftKey && (document.activeElement === last || !overlay.contains(document.activeElement))) {
          e.preventDefault(); first.focus();
        }
        return;
      }
      if (e.key !== 'Escape') return;
      e.preventDefault();
      if (groupState.persistentPreview) closeGroupPreview();
      else closeEntireGroup();
    });
    window.addEventListener('popstate', e => handleHistoryBack(e.state));
  }

  function positionGroupThumbs() {
    if (!groupState.orbit) return;
    const buttons = Array.from(groupState.orbit.querySelectorAll('.group-thumb'));
    const n = buttons.length;
    if (!n) return;
    const rect = groupState.orbit.getBoundingClientRect();
    const small = window.innerWidth <= 620;
    const buttonWidth = small ? 114 : 148;
    const buttonHeight = small ? 140 : 170;
    const rx = Math.max(0, rect.width / 2 - buttonWidth / 2 - 15);
    const ry = Math.max(0, rect.height / 2 - buttonHeight / 2 - 12);
    const placements = buttons.map((button, i) => {
      // Zwei Projekte auf kleinen Displays oben/unten statt zu nah am Zentrum.
      const angle = n === 1 ? -Math.PI / 2 :
        (small && n === 2 ? -Math.PI / 2 + i * Math.PI :
          -Math.PI / 2 + (2 * Math.PI * i / n));
      return { button, i, x: Math.cos(angle) * rx, y: Math.sin(angle) * ry };
    });
    placements.forEach(({ button, i, x, y }) => {
      button.style.setProperty('--x', `${x.toFixed(1)}px`);
      button.style.setProperty('--y', `${y.toFixed(1)}px`);
      button.style.setProperty('--delay', `${Math.min(i * 45, 450)}ms`);
    });
    // Untere Thumbnails liegen hinter den oberen. So bleiben die Labels
    // der oberen Buttons auch bei überlappenden Bildern sichtbar.
    [...placements]
      .sort((a, b) => b.y - a.y || a.i - b.i)
      .forEach(({ button }, rank) => {
        button.style.setProperty('--orbit-z', String(rank + 2));
      });
    // Aktiver Thumb vor anderen Thumbs, aber weiterhin hinter der Preview.
    const stage = groupState.orbit.parentElement;
    stage.style.setProperty('--orbit-active-z', String(n + 2));
    stage.style.setProperty('--orbit-preview-z', String(n + 3));
  }

  function updateGroupCardOrigin() {
    if (!groupState.overlay || !groupState.orbit || !groupState.id) return;

    // Bei History-Navigation dieselbe Card als Ursprung verwenden.
    if (!groupState.trigger?.isConnected || groupState.trigger.dataset.group !== groupState.id) {
      groupState.trigger = Array.from(document.querySelectorAll('.group-card'))
        .find(card => card.dataset.group === groupState.id) || null;
    }

    const vw = document.documentElement.clientWidth;
    const vh = window.innerHeight;
    const card = groupState.trigger?.getBoundingClientRect();
    const valid = card && card.width > 0 && card.height > 0 &&
      card.right > 0 && card.bottom > 0 && card.left < vw && card.top < vh;
    // Fallback für Gruppen ohne sichtbare Quell-Card (z. B. History-Restore).
    const left = valid ? Math.max(0, Math.min(vw - 1, card.left)) : vw / 2 - 28;
    const top = valid ? Math.max(0, Math.min(vh - 1, card.top)) : vh / 2 - 28;
    const right = valid ? Math.max(left + 1, Math.min(vw, card.right)) : vw / 2 + 28;
    const bottom = valid ? Math.max(top + 1, Math.min(vh, card.bottom)) : vh / 2 + 28;
    groupState.overlay.style.setProperty('--group-card-clip',
      `inset(${top.toFixed(1)}px ${(vw - right).toFixed(1)}px ` +
      `${(vh - bottom).toFixed(1)}px ${left.toFixed(1)}px round 12px)`);

    const orbitRect = groupState.orbit.getBoundingClientRect();
    const cardX = (left + right) / 2;
    const cardY = (top + bottom) / 2;
    groupState.orbit.style.setProperty('--group-from-x',
      `${(cardX - orbitRect.left - orbitRect.width / 2).toFixed(1)}px`);
    groupState.orbit.style.setProperty('--group-from-y',
      `${(cardY - orbitRect.top - orbitRect.height / 2).toFixed(1)}px`);
  }

  function groupPreviewWidth(repo) {
    if (repo.featured === true || repo.featured === 'wide') return '660px';
    return '370px';
  }

  function updatePreview(repo, persistent) {
    const preview = groupState.preview;
    if (!preview || !groupState.id) return;
    clearTimeout(groupState.previewHideTimer);
    clearTimeout(groupState.hoverExitTimer);
    clearTimeout(groupState.hoverShowTimer);
    groupState.previewLabel = repo.label;
    groupState.persistentPreview = persistent;
    groupState.orbit.classList.add('has-preview');
    preview.replaceChildren();
    const card = createCard(repo, 0, { groupPreview: true });
    card.classList.add('visible');
    card.style.transitionDelay = '0ms';
    card.setAttribute('tabindex', '-1');
    preview.style.setProperty('--preview-width', groupPreviewWidth(repo));
    const back = document.createElement('button');
    back.type = 'button';
    back.className = 'group-preview-back';
    back.textContent = '✕';
    back.setAttribute('aria-label', 'Vorschau verkleinern');
    back.addEventListener('click', e => {
      e.stopPropagation();
      closeGroupPreview();
    });
    preview.append(card, back);
    preview.hidden = false;
    requestAnimationFrame(() => preview.classList.add('is-visible'));
    groupState.orbit.querySelectorAll('.group-thumb').forEach(btn => {
      const selected = btn.dataset.label === repo.label;
      btn.classList.toggle('is-selected', selected);
      btn.setAttribute('aria-pressed', String(selected && persistent));
    });
  }

  function hidePreview() {
    const preview = groupState.preview;
    if (!preview) return;
    clearTimeout(groupState.hoverExitTimer);
    clearTimeout(groupState.hoverShowTimer);
    preview.classList.remove('is-visible');
    groupState.previewLabel = null;
    groupState.persistentPreview = false;
    groupState.orbit?.classList.remove('has-preview');
    groupState.orbit?.querySelectorAll('.group-thumb').forEach(btn => {
      btn.classList.remove('is-selected');
      btn.setAttribute('aria-pressed', 'false');
    });
    // Die Karte verkleinert sich zuerst; danach wird sie aus dem DOM entfernt.
    clearTimeout(groupState.previewHideTimer);
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      preview.hidden = true;
      preview.replaceChildren();
    } else {
      groupState.previewHideTimer = setTimeout(() => {
        if (!preview.classList.contains('is-visible')) {
          preview.hidden = true;
          preview.replaceChildren();
        }
      }, 270);
    }
  }

  function scheduleHoverPreviewHide() {
    clearTimeout(groupState.hoverExitTimer);
    groupState.hoverExitTimer = setTimeout(() => {
      if (groupState.persistentPreview) return;
      const hoveredThumb = groupState.orbit?.querySelector('.group-thumb:hover');
      if (!hoveredThumb && !groupState.preview?.matches(':hover')) hidePreview();
    }, 350);
  }

  function makeHistoryState(groupId, repoLabel = null) {
    const base = history.state && typeof history.state === 'object' ? history.state : {};
    return { ...base, [GROUP_HISTORY_KEY]: { group: groupId, repo: repoLabel } };
  }

  function selectGroupThumb(repo) {
    // Einheitlicher Toggle-Button auf Touch und Desktop: Der Thumb öffnet
    // oder schließt ausschließlich die große Vorschau, nie das Projekt.
    clearTimeout(groupState.hoverShowTimer);
    if (groupState.persistentPreview && groupState.previewLabel === repo.label) {
      closeGroupPreview();
      return;
    }
    updatePreview(repo, true);
    const current = history.state?.[GROUP_HISTORY_KEY];
    try {
      if (current?.group === groupState.id && current.repo) {
        history.replaceState(makeHistoryState(groupState.id, repo.label), '');
      } else {
        history.pushState(makeHistoryState(groupState.id, repo.label), '');
      }
    } catch (e) { /* History ist in einzelnen Einbettungen nicht verfügbar. */ }
  }

  function drawGroup(id, members) {
    const definition = repogroups[id];
    groupState.id = id;
    groupState.members = members;
    groupState.title.textContent = definition.label;
    groupState.orbit.replaceChildren();

    const center = document.createElement('button');
    center.type = 'button';
    center.className = 'group-center';
    center.setAttribute('aria-label', `${definition.label} – Gruppenansicht schließen`);
    center.title = 'Gruppe schließen';
    center.addEventListener('click', () => {
      // Ein Klick außerhalb einer vergrößerten Karte verkleinert diese zuerst.
      // Erst der nächste Klick auf die Gruppenmitte schließt die Gruppe.
      if (groupState.previewLabel) closeGroupPreview();
      else closeEntireGroup();
    });
    if (typeof definition.img === 'string' && definition.img.trim() === 'all') {
      const collage = createGroupCollage(members, 'group-image-collage', 'eager');
      if (collage) center.appendChild(collage);
    } else if (definition.img) {
      const centerImage = document.createElement('img');
      centerImage.src = definition.img;
      centerImage.alt = '';
      center.appendChild(centerImage);
    }
    // Gruppenname und Projektanzahl bleiben über aria-label für Screenreader
    // zugänglich, werden in der Orbit-Mitte aber nicht angezeigt.
    groupState.orbit.appendChild(center);

    members.forEach(repo => {
      const thumb = document.createElement('button');
      thumb.type = 'button';
      thumb.className = 'group-thumb';
      thumb.dataset.label = repo.label;
      thumb.setAttribute('aria-label', `${repo.label}: Vorschau ein- oder ausklappen`);
      thumb.setAttribute('aria-pressed', 'false');
      thumb.setAttribute('aria-controls', 'groupRepoPreview');
      const img = document.createElement('img');
      img.src = repo.img || '';
      img.alt = '';
      img.loading = 'eager';
      const text = document.createElement('span');
      text.textContent = repo.label;
      thumb.append(img, text);
      thumb.addEventListener('mouseenter', () => {
        if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches ||
            groupState.persistentPreview) return;
        // Kleine Mausbewegungen sollen keine großflächige Karte aufblenden.
        clearTimeout(groupState.hoverShowTimer);
        groupState.hoverShowTimer = setTimeout(() => {
          if (groupState.id === id && !groupState.isClosing &&
              !groupState.persistentPreview && thumb.matches(':hover')) {
            updatePreview(repo, false);
          }
        }, GROUP_HOVER_DELAY_MS);
      });
      thumb.addEventListener('mouseleave', () => {
        clearTimeout(groupState.hoverShowTimer);
        if (!groupState.persistentPreview && groupState.previewLabel === repo.label) {
          scheduleHoverPreviewHide();
        }
      });
      thumb.addEventListener('click', () => selectGroupThumb(repo));
      groupState.orbit.appendChild(thumb);
    });
    positionGroupThumbs();
  }

  function showGroup(id, members, trigger = null) {
    if (!repogroups[id] || !members.length) return;
    ensureGroupOverlay();
    const sameGroup = groupState.id === id &&
      groupState.members.map(r => r.label).join('\0') === members.map(r => r.label).join('\0');
    if (trigger) groupState.trigger = trigger;
    // Browser-Vor/Zurück innerhalb einer bereits offenen Gruppe darf die
    // Öffnungsanimation und den Backdrop-Fade nicht neu starten.
    if (sameGroup && !groupState.overlay.hidden && !groupState.isClosing &&
        groupState.overlay.classList.contains('is-open')) return;

    // History-Vorwärts während einer Schließanimation kann erneut öffnen.
    clearTimeout(groupState.closeTimer);
    groupState.closeTimer = null;
    groupState.isClosing = false;
    if (groupState.openFrame !== null) cancelAnimationFrame(groupState.openFrame);
    groupState.openFrame = null;
    // Beim ersten Öffnen dürfen die frisch gesetzten Startkoordinaten
    // noch keine eigene Transition auslösen (sonst startet der Orbit
    // fälschlich aus der Bildschirmmitte statt aus der Gruppen-Card).
    groupState.overlay.classList.add('is-preparing');
    groupState.overlay.classList.remove('is-open', 'is-closing');
    groupState.backdrop.classList.remove('is-visible', 'is-closing');
    if (!sameGroup) {
      hidePreview();
      drawGroup(id, members);
    }
    groupState.backdrop.hidden = false;
    groupState.overlay.hidden = false;
    // Zuerst Scroll-Lock aktivieren: alle Koordinaten müssen sich bereits
    // auf das endgültige Desktop-/Mobil-Layout beziehen.
    document.documentElement.classList.add('group-dialog-open');
    positionGroupThumbs();
    updateGroupCardOrigin();
    // Computed Styles der echten Card-Position fixieren, bevor die
    // reguläre Clip-/Orbit-Transition wieder freigegeben wird.
    void getComputedStyle(groupState.overlay).clipPath;
    void getComputedStyle(groupState.orbit.querySelector('.group-center')).transform;
    groupState.overlay.classList.remove('is-preparing');
    void groupState.overlay.offsetWidth;
    groupState.openFrame = requestAnimationFrame(() => {
      groupState.openFrame = null;
      if (groupState.id !== id || groupState.isClosing) return;
      // Orbit und eigenständiger Backdrop starten im selben Frame.
      groupState.overlay.classList.add('is-open');
      groupState.backdrop.classList.add('is-visible');
    });
    if (!sameGroup) groupState.overlay.querySelector('.group-overlay-close').focus({preventScroll: true});
  }

  function openGroup(id, members, trigger) {
    showGroup(id, members, trigger);
    try { history.pushState(makeHistoryState(id), ''); }
    catch (e) { /* Overlay funktioniert auch ohne History-Unterstützung. */ }
  }

  function finishGroupClose() {
    if (!groupState.isClosing) return;
    clearTimeout(groupState.closeTimer);
    groupState.closeTimer = null;
    groupState.overlay.hidden = true;
    groupState.backdrop.hidden = true;
    groupState.overlay.classList.remove('is-open', 'is-closing');
    groupState.backdrop.classList.remove('is-visible', 'is-closing');
    groupState.id = null;
    groupState.members = [];
    groupState.isClosing = false;
    // Fallback, falls die Animation ohne regulären Schließablauf endet.
    document.documentElement.classList.remove('group-dialog-open');
  }

  function hideGroup() {
    if (!groupState.overlay || !groupState.id || groupState.isClosing) return;
    groupState.isClosing = true;
    if (groupState.openFrame !== null) {
      cancelAnimationFrame(groupState.openFrame);
      groupState.openFrame = null;
    }
    clearTimeout(groupState.hoverShowTimer);
    hidePreview();
    // Die Card kann sich seit dem Öffnen verschoben haben (Resize/Scroll).
    updateGroupCardOrigin();
    // Fokus und Seiten-Scroll schon zu Beginn des Rückflugs freigeben.
    // Dadurch funktionieren Mausrad, Touch und Tastatur sofort wieder.
    if (groupState.trigger?.isConnected) groupState.trigger.focus({preventScroll: true});
    document.documentElement.classList.remove('group-dialog-open');
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      finishGroupClose();
      return;
    }
    // Orbit-Rückflug und reiner Backdrop-Fade laufen parallel.
    groupState.overlay.classList.add('is-closing');
    groupState.overlay.classList.remove('is-open');
    groupState.backdrop.classList.add('is-closing');
    groupState.backdrop.classList.remove('is-visible');
    groupState.closeTimer = setTimeout(finishGroupClose, GROUP_CLOSE_MS);
  }

  function syncGroupHistory(state) {
    const value = state?.[GROUP_HISTORY_KEY];
    if (!value?.group || !repogroups[value.group] || s.section !== 'library' || s.activeView !== 'cards' || s.activeFilter !== 'all' || s.activeSearch) {
      hideGroup();
      return;
    }
    const filtered = getFilteredRepos().filter(r => r.group === value.group);
    const members = filtered.length ? filtered : repos.filter(r => r.group === value.group);
    if (!members.length) { hideGroup(); return; }
    showGroup(value.group, members);
    const selected = members.find(r => r.label === value.repo);
    if (selected) updatePreview(selected, true);
    else hidePreview();
  }

  function closeGroupPreview() {
    if (!groupState.previewLabel) return;
    const current = history.state?.[GROUP_HISTORY_KEY];
    const hasHistoryEntry = groupState.persistentPreview &&
      current?.group === groupState.id && current.repo;
    // Sofort visuell verkleinern, unabhängig vom asynchronen popstate.
    hidePreview();
    if (hasHistoryEntry) {
      try { history.back(); } // Browser-Zurück bleibt konsistent mit dem Toggle.
      catch (e) { /* Funktioniert auch ohne History-Zugriff. */ }
    }
  }

  function closeEntireGroup() {
    if (!groupState.id || groupState.isClosing) return;
    const current = history.state?.[GROUP_HISTORY_KEY];
    // Sofort animieren; das asynchrone popstate darf den Ablauf nicht unterbrechen.
    hideGroup();
    if (current?.group === groupState.id) {
      history.go(current.repo ? -2 : -1);
    }
  }

  B.groups = {
    createGroupCard,
    ensureOverlay: ensureGroupOverlay,
    syncHistory: syncGroupHistory,
    closeEntireGroup,
    isOpen: () => Boolean(groupState.id)
  };
})(window.BoilerRoom);
