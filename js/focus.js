/* Touch-Fokus bei Scrollen der Kartenansicht. */
(function (B) {
  'use strict';

  const s = B.state;
  const repoGrid = B.dom.repoGrid;

  let focusObserver = null;
  let focusedCard = null;

  function setupFocusObserver() {
    if (!window.matchMedia('(hover: none)').matches) return; // Desktop: aus
  
    // Nur in der Card-Ansicht sinnvoll
    if (s.activeView !== 'cards') {
      clearFocus();
      if (focusObserver) { focusObserver.disconnect(); focusObserver = null; }
      return;
    }

    if (focusObserver) focusObserver.disconnect();

    focusObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        const card = entry.target;
        if (entry.isIntersecting) {
          // Neue Karte im Fokus-Streifen
          if (focusedCard && focusedCard !== card) {
            focusedCard.classList.remove('in-focus');
          }
          focusedCard = card;
          card.classList.add('in-focus');
        } else if (focusedCard === card) {
          card.classList.remove('in-focus');
          focusedCard = null;
        }
      });
    }, {
      // Fokus-Streifen: obere und untere Grenze je ~40% vom Viewport
      // => nur die mittleren ~20% zählen.
      rootMargin: '-60% 0px -30% 0px',
      threshold: 0
    });

    repoGrid.querySelectorAll('.card').forEach(c => focusObserver.observe(c));
  }

  function clearFocus() {
    if (focusedCard) {
      focusedCard.classList.remove('in-focus');
      focusedCard = null;
    }
  }

  B.focus = { refresh: setupFocusObserver, clear: clearFocus };
})(window.BoilerRoom);
