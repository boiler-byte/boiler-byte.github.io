/* Bereiche: Entdecken, Bibliothek, Mein Launcher und Ueber. */
(function (B) {
  'use strict';
  const s = B.state;
  const sections = new Set(['discover', 'library', 'launcher', 'about']);

  function switchTo(section) {
    if (!sections.has(section)) return;
    if (section !== 'discover') B.discoverPreview.close();
    if (section !== 'launcher') B.launcher.closeAddMenu();
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
    const sort = document.getElementById('librarySort');
    const names = {
      original: 'Kuratierte Reihenfolge',
      name: 'Name A–Z',
      newest: 'Neueste zuerst',
      type: 'Typ A–Z'
    };
    sort.addEventListener('change', () => {
      s.librarySort = sort.value;
      sort.title = 'Sortierung: ' + names[sort.value];
      B.renderer.renderRepos();
    });
    document.querySelector('.platform-nav').addEventListener('click', e => {
      const tab = e.target.closest('[data-section]');
      if (tab) switchTo(tab.dataset.section);
    });
    B.filters.updateFavCount();
    switchTo(B.storage.get('lastSection') || 'discover');
  }

  B.platform = { init, switchTo };
})(window.BoilerRoom);
