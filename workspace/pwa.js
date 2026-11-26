/* Workspace installation: native prompt when available, browser-menu help otherwise. */
(function () {
  'use strict';
  const installButton = document.getElementById('installWorkspace');
  const installHelp = document.getElementById('installWorkspaceHelp');
  const offlineNotice = document.getElementById('offlineNotice');
  const standalone = window.matchMedia('(display-mode: standalone)');
  let promptEvent = null;
  let prompting = false;
  let installedHere = false;

  const isInstalled = () => installedHere || standalone.matches || navigator.standalone === true;

  function updateInstallButton() {
    installButton.hidden = isInstalled();
    installButton.disabled = prompting;
    if (installButton.hidden || promptEvent || prompting) installHelp.hidden = true;
    if (promptEvent || prompting || installButton.hidden) installButton.removeAttribute('aria-expanded');
    else installButton.setAttribute('aria-expanded', String(!installHelp.hidden));
  }
  function updateOfflineNotice() {
    offlineNotice.hidden = navigator.onLine;
  }
  window.addEventListener('beforeinstallprompt', event => {
    if (isInstalled()) return;
    event.preventDefault();
    promptEvent = event;
    updateInstallButton();
  });
  installButton.addEventListener('click', async () => {
    if (isInstalled() || prompting) return;
    if (!promptEvent) {
      installHelp.hidden = !installHelp.hidden;
      updateInstallButton();
      return;
    }
    const event = promptEvent;
    promptEvent = null;
    prompting = true;
    updateInstallButton();
    try { await event.prompt(); await event.userChoice; }
    catch (_) { /* browser dismissed or invalidated the prompt */ }
    finally { prompting = false; updateInstallButton(); }
  });
  window.addEventListener('appinstalled', () => { installedHere = true; promptEvent = null; updateInstallButton(); });
  if (standalone.addEventListener) standalone.addEventListener('change', updateInstallButton);
  else if (standalone.addListener) standalone.addListener(updateInstallButton);
  window.addEventListener('online', updateOfflineNotice);
  window.addEventListener('offline', updateOfflineNotice);
  updateInstallButton();
  updateOfflineNotice();

  if (window.BoilerRoom.offline.supported) {
    window.BoilerRoom.offline.register()
      .catch(error => console.warn('Workspace-PWA: Service Worker nicht verfügbar.', error));
  }
})();
