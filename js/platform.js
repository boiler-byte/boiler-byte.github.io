/* Bereiche: Entdecken, Bibliothek, Mein Launcher und Ueber. */
(function (B) {
  'use strict';
  const s = B.state;
  const sections = new Set(['discover', 'library', 'launcher', 'about']);

  function switchTo(section) {
    if (!sections.has(section)) return;
    if (section !== 'library') B.views.closeMenus();
    if (section !== 'discover') B.discoverPreview.close();
    if (section !== 'launcher') {
      if (s.section === 'launcher') B.drag.cancelIconDrag();
      B.launcher.closeAddMenu();
      B.launcher.closeInfo();
    }
    s.section = section;
    B.storage.set('lastSection', section);
    B.dom.discoverPage.hidden = section !== 'discover';
    B.dom.libraryPage.hidden = section !== 'library';
    B.dom.launcherPage.hidden = section !== 'launcher';
    B.dom.aboutPage.hidden = section !== 'about';
    document.querySelectorAll('.platform-tab').forEach(tab => {
      const selected = tab.dataset.section === section;
      tab.classList.toggle('is-active', selected);
      if (selected) tab.setAttribute('aria-current', 'page');
      else tab.removeAttribute('aria-current');
    });

    if (section === 'discover') B.discover.render();
    if (section === 'launcher') B.renderer.renderLauncher();
    if (section === 'library') {
      B.renderer.renderRepos();
      B.focus.refresh();
    } else {
      B.focus.clear();
    }
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  function init() {
    const nav = document.querySelector('.platform-nav');
    // Touch-Pointer explizit behandeln: :active allein ist auf Mobilbrowsern
    // nicht immer schon beim Aufsetzen des Fingers sichtbar.
    let pressedTab = null;
    let pressedPointer = null;
    function clearTouchPress(e) {
      if (e && e.type !== 'blur' && e.pointerId !== pressedPointer) return;
      if (pressedTab) pressedTab.classList.remove('is-touch-pressed');
      pressedTab = null;
      pressedPointer = null;
    }
    nav.addEventListener('pointerdown', e => {
      if (e.pointerType === 'mouse' || !e.isPrimary) return;
      const tab = e.target.closest('.platform-tab');
      if (!tab || tab.classList.contains('is-active')) return;
      clearTouchPress();
      pressedTab = tab;
      pressedPointer = e.pointerId;
      tab.classList.add('is-touch-pressed');
    });
    window.addEventListener('pointerup', clearTouchPress, true);
    window.addEventListener('pointercancel', clearTouchPress, true);
    nav.addEventListener('lostpointercapture', clearTouchPress);
    window.addEventListener('blur', clearTouchPress);
    nav.addEventListener('click', e => {
      const tab = e.target.closest('[data-section]');
      if (tab) switchTo(tab.dataset.section);
    });
    B.filters.updateFavCount();
    switchTo(B.storage.get('lastSection') || 'discover');
  }

  B.platform = { init, switchTo };
})(window.BoilerRoom);
