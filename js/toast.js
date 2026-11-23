/* Dezente Rueckmeldungen zu Favoriten-Aenderungen, ohne fremde Libraries. */
(function (B) {
  'use strict';

  const stack = document.getElementById('toastStack');
  const MAX_TOASTS = 3;
  const DURATION_MS = 3300;

  function dismiss(toast) {
    if (!toast || !toast.isConnected || toast.classList.contains('toast-leaving')) return;
    clearTimeout(toast._dismissTimer);
    toast.classList.add('toast-leaving');
    setTimeout(() => toast.remove(), 210);
  }

  function showFavorite(label, added) {
    if (!stack) return;
    const toast = document.createElement('div');
    toast.className = 'toast' + (added ? ' toast-added' : ' toast-removed');
    const symbol = document.createElement('span');
    symbol.className = 'toast-symbol';
    symbol.textContent = added ? '★' : '☆';
    symbol.setAttribute('aria-hidden', 'true');
    const message = document.createElement('span');
    message.className = 'toast-message';
    message.textContent = '„' + label + '“ ' + (added ? 'zu Favoriten hinzugefügt' : 'aus Favoriten entfernt');
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'toast-close';
    close.textContent = '×';
    close.setAttribute('aria-label', 'Meldung schließen');
    close.addEventListener('click', () => dismiss(toast));
    toast.append(symbol, message, close);
    stack.prepend(toast);
    Array.from(stack.children).slice(MAX_TOASTS).forEach(dismiss);
    toast._dismissTimer = setTimeout(() => dismiss(toast), DURATION_MS);
  }

  B.toast = { showFavorite };
})(window.BoilerRoom);
