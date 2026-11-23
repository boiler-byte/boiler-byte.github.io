/* Bibliotheksansichten und gespeicherte Darstellung (ohne Gruppen-Overlay). */
(function (B) {
  'use strict';
  const s = B.state;
  const repoGrid = B.dom.repoGrid;
  const viewSelect = B.dom.viewSelect;

  function applyViewClasses() {
    repoGrid.classList.remove('view-cards', 'view-list', 'view-icons');
    if (s.activeView !== 'cards') repoGrid.classList.add('view-' + s.activeView);
    if (viewSelect) viewSelect.value = s.activeView;
  }
  function setView(view, persist) {
    if (!['cards', 'list', 'icons'].includes(view)) return;
    s.activeView = view;
    if (persist) B.storage.set('libraryView', view);
    applyViewClasses();
    B.renderer.renderRepos();
  }
  function loadView() {
    const v = B.storage.get('libraryView');
    if (v === 'cards' || v === 'list' || v === 'icons') s.activeView = v;
  }
  function setupViewSwitch() {
    viewSelect.addEventListener('change', () => {
      if (viewSelect.value !== s.activeView) setView(viewSelect.value, true);
    });
  }
  B.views = { applyClasses: applyViewClasses, setView, load: loadView, setup: setupViewSwitch };
})(window.BoilerRoom);
