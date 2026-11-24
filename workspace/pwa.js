/* Optional native install prompt; Safari uses its own browser menu. */
(function () {
  'use strict';
  const installButton = document.getElementById('installWorkspace');
  const offlineNotice = document.getElementById('offlineNotice');
  const standalone = window.matchMedia('(display-mode: standalone)');
  let promptEvent = null;
  let prompting = false;

  function updateInstallButton() {
    installButton.hidden = !promptEvent || standalone.matches || navigator.standalone === true;
    installButton.disabled = prompting;
  }
  function updateOfflineNotice() {
    offlineNotice.hidden = navigator.onLine;
  }
  window.addEventListener('beforeinstallprompt', event => {
    if (standalone.matches || navigator.standalone === true) return;
    event.preventDefault();
    promptEvent = event;
    updateInstallButton();
  });
  installButton.addEventListener('click', async () => {
    if (!promptEvent || prompting) return;
    const event = promptEvent;
    promptEvent = null;
    prompting = true;
    updateInstallButton();
    try { await event.prompt(); await event.userChoice; }
    catch (_) { /* browser dismissed or invalidated the prompt */ }
    finally { prompting = false; updateInstallButton(); }
  });
  window.addEventListener('appinstalled', () => { promptEvent = null; updateInstallButton(); });
  if (standalone.addEventListener) standalone.addEventListener('change', updateInstallButton);
  window.addEventListener('online', updateOfflineNotice);
  window.addEventListener('offline', updateOfflineNotice);
  updateInstallButton();
  updateOfflineNotice();

  if (window.BoilerRoom.offline.supported) {
    window.BoilerRoom.offline.register()
      .catch(error => console.warn('Workspace-PWA: Service Worker nicht verfügbar.', error));
  }
})();
