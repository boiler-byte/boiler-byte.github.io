/* Einzelkarten, Vorschau-Bilder, Metadaten und Favoritenaktion. */
(function (B) {
  'use strict';

  const s = B.state;
  const types = B.data.types;
  const STATUS = B.data.STATUS;
  const isFavorite = label => B.favorites.isFavorite(label);
  const toggleFavorite = label => B.favorites.toggleFavorite(label);

  // ---------- SVG-Stern ----------
  const STAR_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5l2.95 5.98 6.6.96-4.78 4.66 1.13 6.57L12 17.58l-5.9 3.09 1.13-6.57L2.45 9.44l6.6-.96L12 2.5z"/></svg>';
  const TRASH_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2m3 0-1 14H6L5 6m5 4v6m4-6v6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  function syncFavoriteButton(button, favorite, label) {
    const trash = button.classList.contains('is-trash');
    button.classList.toggle('is-fav', favorite);
    button.setAttribute('aria-pressed', String(favorite));
    const action = trash ? 'Aus Launcher entfernen: ' :
      (favorite ? 'Aus Favoriten entfernen: ' : 'Zu Favoriten hinzufügen: ');
    button.setAttribute('aria-label', action + label);
    button.title = trash ? 'Aus Launcher entfernen' :
      (favorite ? 'Aus Favoriten entfernen' : 'Zu Favoriten hinzufügen');
  }

  // ---------- KARTEN ERZEUGEN ----------
  function createCard(repo, index, { groupPreview = false, favoriteVariant = 'star' } = {}) {
    const card = document.createElement('article');
    card.className = 'card';

    if (repo.featured === true) {
      card.classList.add('featured');
    } else if (repo.featured === 'wide') {
      card.classList.add('featured-wide');
    } else if (repo.featured === 'tall') {
      card.classList.add('featured-tall');
    }

    card.dataset.type = repo.type;
    card.dataset.label = repo.label;
    card.setAttribute('tabindex', '0');
    card.setAttribute('aria-label', `${repo.label} – ${repo.description}`);

    const t = types[repo.type]?.color || 'green';
    card.style.setProperty('--accent', `var(--${t}-base)`);
    card.style.setProperty('--accent-dim', `var(--${t}-dim)`);
    card.style.setProperty('--accent-glow', `var(--${t}-glow)`);
    card.style.setProperty('--accent-border', `var(--${t}-border)`);

    card.style.transitionDelay = `${(index % 12) * 60}ms`;

    // Standardbild. In der großen Gruppen-Vorschau hat "preview" Vorrang.
    const imageDiv = document.createElement('div');
    imageDiv.className = 'card-image';
    const previewSrc = typeof repo.preview === 'string' ? repo.preview.trim() : '';
    const img = document.createElement('img');
    img.src = groupPreview && previewSrc ? previewSrc : repo.img;
    img.alt = repo.label;
    img.loading = groupPreview ? 'eager' : 'lazy';
    img.width = 800;
    img.height = 500;
    if (groupPreview && previewSrc) {
      // Falls die Preview-Datei fehlt, bleibt das normale Repo-Bild verfügbar.
      img.addEventListener('error', () => { img.src = repo.img; }, { once: true });
    }
    imageDiv.appendChild(img);

    if (previewSrc && !groupPreview) {
      // Separates Bild für einen weichen Wechsel beim Hover, ohne src-Umschalten.
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

    // Badge (Typ)
    const badge = document.createElement('span');
    badge.className = 'type-badge';
    badge.textContent = types[repo.type]?.label || repo.type;
    imageDiv.appendChild(badge);

    // Status-Badge (optional)
    if (repo.status && STATUS[repo.status]) {
      const sBadge = document.createElement('span');
      sBadge.className = 'status-badge status-' + repo.status;
      sBadge.textContent = STATUS[repo.status].symbol + ' ' + STATUS[repo.status].label;
      imageDiv.appendChild(sBadge);
    }

    // Stern auf normalen Karten; Muelleimer nur in der Launcher-Liste.
    const favBtn = document.createElement('button');
    favBtn.type = 'button';
    favBtn.className = 'fav-btn' + (favoriteVariant === 'trash' ? ' is-trash' : '');
    favBtn.innerHTML = favoriteVariant === 'trash' ? TRASH_SVG : STAR_SVG;
    syncFavoriteButton(favBtn, isFavorite(repo.label), repo.label);

    favBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      const nowFav = toggleFavorite(repo.label);
      syncFavoriteButton(favBtn, nowFav, repo.label);
      favBtn.classList.remove('pop');
      void favBtn.offsetWidth; // reflow, um Animation neu zu starten
      favBtn.classList.add('pop');
      // Favoriten-Sterne in bereits gerenderten, versteckten Bereichen synchron halten.
      document.querySelectorAll('.card[data-label] .fav-btn').forEach(button => {
        if (button.closest('.card').dataset.label !== repo.label) return;
        syncFavoriteButton(button, nowFav, repo.label);
      });

      // Nur im Launcher verschwindet eine entfernte Favoritenkarte.
      if (s.section === 'launcher' && !nowFav) {
        card.style.opacity = '0';
        card.style.transform = 'scale(0.95)';
        setTimeout(() => {
          if (s.section === 'launcher') B.renderer.renderLauncher();
        }, 220);
      }
    });

    // Verhindert, dass der Stern das Karten-Keyboard-Event auslöst
    favBtn.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.stopPropagation();
      }
    });

    imageDiv.appendChild(favBtn);

    // Inhalt
    const content = document.createElement('div');
    content.className = 'card-content';

    // Icon (optional, für Liste & Icon-Ansicht)
    const title = document.createElement('h3');
    const icon = document.createElement('span');
      icon.className = 'repo-icon';
      icon.textContent = repo.icon ?? '';
      title.append(icon, document.createTextNode(repo.label));

    const desc = document.createElement('p');
    desc.className = 'description';
    desc.textContent = repo.description;

    const meta = document.createElement('div');
    meta.className = 'card-meta';
    if (repo.year) {
      const yearSpan = document.createElement('span');
      yearSpan.textContent = `📅 ${repo.year}`;
      meta.appendChild(yearSpan);
    }
    if (repo.tags && repo.tags.length) {
      const tagsSpan = document.createElement('span');
      tagsSpan.textContent = `🏷️ ${repo.tags.slice(0, 2).join(' · ')}`;
      meta.appendChild(tagsSpan);
    }

    content.appendChild(title);
    content.appendChild(desc);
    content.appendChild(meta);

    // Tooltip
    const tooltip = document.createElement('div');
    tooltip.className = 'card-tooltip';
    const tooltipParts = [];
    if (repo.tags && repo.tags.length) tooltipParts.push(repo.tags.join(' · '));
    if (repo.year) tooltipParts.push(repo.year);
    tooltip.textContent = tooltipParts.length ? tooltipParts.join('  |  ') : 'Keine Details';

    card.appendChild(imageDiv);
    card.appendChild(content);
    card.appendChild(tooltip);

    // Link / Klick
    if (repo.url) {
      card.style.cursor = 'pointer';
      card.addEventListener('click', (e) => {
        if (e.target.closest('a')) return;
        if (e.target.closest('.fav-btn')) return;
        if (e.target.closest('.drag-handle')) return;
        window.open(repo.url, '_blank', 'noopener,noreferrer');
      });
      card.addEventListener('keydown', (e) => {
        if (e.target.closest('.fav-btn')) return;
        if (e.target.closest('.drag-handle')) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          window.open(repo.url, '_blank', 'noopener,noreferrer');
        }
      });
    }

    return card;
  }

  B.cards = { createCard, syncFavoriteButton };
})(window.BoilerRoom);
