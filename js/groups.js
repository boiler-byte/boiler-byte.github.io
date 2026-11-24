/* Repo-Gruppen: gemeinsame Workspace-Links, Bilder und Collagen; kein Orbit-Dialog. */
(function (B) {
  'use strict';
  const catalog = B.data.getGroups();
  const href = id => 'workspace/index.html?group=' + encodeURIComponent(id);
  const countText = group => `${group.repos.length} ${group.repos.length === 1 ? 'App' : 'Apps'}`;

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

  function groupImage(group, container) {
    const fallback = document.createElement('span');
    fallback.className = 'group-image-fallback';
    fallback.setAttribute('aria-hidden', 'true');
    const symbol = B.icons.create('group');
    if (symbol) fallback.appendChild(symbol);
    container.appendChild(fallback);

    const imageSrc = typeof group.img === 'string' ? group.img.trim() : '';
    const previewSrc = typeof group.preview === 'string' ? group.preview.trim() : '';
    function addImage(src, className) {
      const image = document.createElement('img');
      image.src = src;
      image.alt = '';
      image.className = className;
      image.loading = 'lazy';
      image.decoding = 'async';
      image.addEventListener('error', () => image.remove(), { once: true });
      container.appendChild(image);
    }
    function addCollage(className) {
      const collage = createGroupCollage(group.repos, className);
      if (collage) container.appendChild(collage);
    }
    if (imageSrc === 'all') addCollage('group-image-collage');
    else if (imageSrc) addImage(imageSrc, 'group-image');
    else addCollage('group-image-collage');
    if (previewSrc === 'all' && imageSrc !== 'all') addCollage('group-preview-collage');
    else if (previewSrc && previewSrc !== 'all') addImage(previewSrc, 'card-preview-image');
  }

  function createLink(group, className) {
    const link = document.createElement('a');
    link.className = className;
    link.href = href(group.id);
    link.dataset.group = group.id;
    link.setAttribute('aria-label', `${group.label} – Workspace öffnen (${countText(group)})`);
    return link;
  }

  function createGroupCard(group, index) {
    const card = createLink(group, 'card group-card');
    card.style.setProperty('--accent', 'var(--violet-base)');
    card.style.setProperty('--accent-dim', 'var(--violet-dim)');
    card.style.setProperty('--accent-glow', 'var(--violet-glow)');
    card.style.setProperty('--accent-border', 'var(--violet-border)');
    card.style.transitionDelay = `${(index % 12) * 60}ms`;
    const image = document.createElement('div');
    image.className = 'card-image group-art';
    groupImage(group, image);
    const badge = document.createElement('span');
    badge.className = 'type-badge';
    badge.textContent = 'Workspace';
    image.appendChild(badge);
    const content = document.createElement('div');
    content.className = 'card-content';
    const heading = document.createElement('h3');
    heading.className = 'group-card-title';
    const symbol = B.icons.create('group');
    if (symbol) { symbol.classList.add('group-title-icon'); heading.appendChild(symbol); }
    heading.append(document.createTextNode(group.label));
    const description = document.createElement('p');
    description.className = 'description';
    description.textContent = group.description || group.repos.map(repo => repo.label).join(' · ') || 'Noch keine Apps zugeordnet.';
    const meta = document.createElement('div');
    meta.className = 'group-card-meta';
    meta.textContent = countText(group) + ' · Workspace';
    content.append(heading, description, meta);
    card.append(image, content);
    return card;
  }

  B.groups = { catalog, href, createGroupCard };
})(window.BoilerRoom);
