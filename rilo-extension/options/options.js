document.addEventListener('DOMContentLoaded', () => {
  const autoInterceptEl = document.getElementById('auto-intercept');
  const showNotificationsEl = document.getElementById('show-notifications');
  const saveBtn = document.getElementById('save-btn');
  const saveStatusEl = document.getElementById('save-status');

  // Load saved options (Default: autoIntercept = true)
  chrome.storage.sync.get(
    {
      autoIntercept: true,
      showNotifications: true,
    },
    (items) => {
      autoInterceptEl.checked = items.autoIntercept;
      showNotificationsEl.checked = items.showNotifications;
    }
  );

  // Save preferences
  saveBtn.addEventListener('click', () => {
    chrome.storage.sync.set(
      {
        autoIntercept: autoInterceptEl.checked,
        showNotifications: showNotificationsEl.checked,
      },
      () => {
        saveStatusEl.textContent = 'Preferences saved successfully';
        setTimeout(() => {
          saveStatusEl.textContent = '';
        }, 2000);
      }
    );
  });
});
