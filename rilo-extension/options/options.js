document.addEventListener('DOMContentLoaded', () => {
  const autoInterceptEl = document.getElementById('auto-intercept');
  const showNotificationsEl = document.getElementById('show-notifications');
  const serverPortEl = document.getElementById('server-port');
  const saveBtn = document.getElementById('save-btn');
  const saveStatusEl = document.getElementById('save-status');

  // Load saved options (Default: autoIntercept = true, showNotifications = true, serverPort = 7899)
  chrome.storage.sync.get(
    {
      autoIntercept: true,
      catchLinks: true,
      showNotifications: true,
      serverPort: 7899,
    },
    (items) => {
      const isIntercept = items.catchLinks !== undefined ? items.catchLinks : items.autoIntercept;
      autoInterceptEl.checked = !!isIntercept;
      showNotificationsEl.checked = !!items.showNotifications;
      serverPortEl.value = items.serverPort || 7899;
    }
  );

  // Save preferences
  saveBtn.addEventListener('click', () => {
    const isIntercept = autoInterceptEl.checked;
    const showNotifs = showNotificationsEl.checked;
    const port = parseInt(serverPortEl.value, 10) || 7899;

    chrome.storage.sync.set(
      {
        autoIntercept: isIntercept,
        catchLinks: isIntercept,
        showNotifications: showNotifs,
        serverPort: port,
      },
      () => {
        saveStatusEl.textContent = 'Preferences saved successfully';
        setTimeout(() => {
          saveStatusEl.textContent = '';
        }, 2500);
      }
    );
  });
});
