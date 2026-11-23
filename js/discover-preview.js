/* App-Vorschau im Entdecken-Bereich: klassisches Skript, ohne ES-Module. */
(function (B) {
  'use strict';

  const HISTORY_KEY = '__boilerRoomDiscoverPreview';
  let overlay = null;
  let shell = null;
  let cardHost = null;
  let openButton = null;
  let closeButton = null;
  let selected = null;
  let origin = null;

  function ensureOverlay() {
    if (overlay) return;
    overlay = document.createElement('div');
    overlay.className = 'discover-preview-backdrop';
    overlay.hidden = true;
    // Dieses Markup ist statisch; Repo-Daten werden ausschliesslich als Text/DOM eingefuegt.
    overlay.innerHTML = `
      <div class="discover-preview-shell" role="dialog" aria-modal="true"
           aria-label="App-Vorschau">
        <button type="button" class="discover-preview-close" aria-label="Vorschau schliessen">&#10005;</button>
        <div class="discover-preview-card-host"></div>
        <button type="button" class="discover-preview-open">App oeffnen &#8599;</button>
      </div>`;
    document.body.appendChild(overlay);
    shell = overlay.querySelector('.discover-preview-shell');
    cardHost = overlay.querySelector('.discover-preview-card-host');
    closeButton = overlay.querySelector('.discover-preview-close');
    openButton = overlay.querySelector('.discover-preview-open');

    closeButton.addEventListener('click', () => close());
    openButton.addEventListener('click', activate);
    overlay.addEventListener('click', event => {
      // Auch freie Flaechen innerhalb der Shell schliessen die Vorschau.
      if (!event.target.closest('.discover-preview-card-host, .discover-preview-close, .discover-preview-open')) {
        close();
      }
    });
    document.addEventListener('keydown', event => {
      if (!selected) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        close();
      } else if (event.key === 'Tab') {
        // Fokus bleibt im Modal (inkl. Favoriten-Stern und oeffnen-Button).
        const items = Array.from(shell.querySelectorAll('button:not([hidden]):not([disabled]), .card[tabindex]'))
          .filter(el => el.getClientRects().length);
        if (!items.length) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (event.shiftKey && (document.activeElement === first || !shell.contains(document.activeElement))) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && (document.activeElement === last || !shell.contains(document.activeElement))) {
          event.preventDefault();
          first.focus();
        }
      }
    });
  }

  function activate() {
    if (!selected) return;
    const url = selected.url;
    close();
    // Synchron zum User-Click oeffnen, damit Pop-up-Blocker den Link nicht verhindern.
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
  }

  function close(skipHistory = false) {
    if (!selected) return;
    selected = null;
    if (overlay) {
      overlay.hidden = true;
      cardHost.replaceChildren();
    }
    document.documentElement.classList.remove('discover-preview-active');
    const focusTarget = origin;
    origin = null;
    if (focusTarget?.isConnected) focusTarget.focus({ preventScroll: true });
    // Nur eigene Preview-Eintraege entfernen; der vorhandene Navigation-Anker
    // der Bibliothek bleibt erhalten und wird nicht beeinflusst.
    if (!skipHistory) {
      try {
        if (history.state?.[HISTORY_KEY]) history.back();
      } catch (error) {
        console.warn('[Boiler] App-Vorschau: Zurueck-Navigation nicht moeglich:', error);
      }
    }
  }

  function show(repo, trigger = null) {
    ensureOverlay();
    if (selected) close(true);
    selected = repo;
    origin = trigger;
    cardHost.replaceChildren();

    const card = B.cards.createCard(repo, 0);
    card.classList.remove('featured', 'featured-wide', 'featured-tall');
    card.classList.add('visible', 'discover-preview-card');
    card.style.transitionDelay = '0ms';
    card.querySelectorAll('.card-image img').forEach(img => { img.loading = 'eager'; });
    card.setAttribute('aria-label', repo.label + (repo.url ? ' – App oeffnen' : ' – Vorschau schliessen'));

    // Die Bibliotheks-Karte bleibt der Ursprung fuer Markup und Favoriten.
    // Im Overlay steuern wir die Klickaktion in der Capture-Phase, damit nicht
    // zusaetzlich der Karten-Listener den Link ein zweites Mal oeffnet.
    card.addEventListener('click', event => {
      if (event.target.closest('.fav-btn')) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      activate();
    }, true);
    card.addEventListener('keydown', event => {
      if (event.target.closest('.fav-btn')) return;
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        event.stopImmediatePropagation();
        activate();
      }
    }, true);
    cardHost.appendChild(card);
    openButton.textContent = repo.url ? 'App öffnen ↗' : 'Vorschau schließen';
    shell.setAttribute('aria-label', 'Vorschau: ' + repo.label);
    overlay.hidden = false;
    document.documentElement.classList.add('discover-preview-active');
    closeButton.focus({ preventScroll: true });
  }

  function open(repo, trigger) {
    if (B.state.section !== 'discover') return;
    if (selected) return;
    show(repo, trigger);
    try {
      const state = history.state && typeof history.state === 'object' ? history.state : {};
      history.pushState({ ...state, [HISTORY_KEY]: repo.label }, '');
    } catch (error) {
      console.warn('[Boiler] App-Vorschau ohne History:', error);
    }
  }

  // Browser-Zurueck blendet die App aus; Vorwaerts kann dieselbe Vorschau
  // wiederherstellen. Keine zusaetzlichen History-Eintraege beim Restore.
  window.addEventListener('popstate', event => {
    const label = event.state?.[HISTORY_KEY];
    if (label && B.state.section === 'discover') {
      const repo = B.data.repos.find(item => item.label === label);
      if (repo && (!selected || selected.label !== label)) show(repo);
      if (!repo) close(true);
    } else {
      close(true);
    }
  });

  B.discoverPreview = { open, close };
})(window.BoilerRoom);
