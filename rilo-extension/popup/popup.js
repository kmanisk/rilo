document.addEventListener('DOMContentLoaded', async () => {
  const toggleEl = document.getElementById('catch-links-toggle');
  const statusDescEl = document.getElementById('status-desc');
  const connectionDotEl = document.getElementById('connection-dot');
  const connectionTextEl = document.getElementById('connection-text');

  // Load persisted Catch Links setting (Default: true)
  chrome.storage.sync.get({ catchLinks: true, autoIntercept: true }, (res) => {
    const isEnabled = res.catchLinks !== undefined ? res.catchLinks : res.autoIntercept;
    toggleEl.checked = !!isEnabled;
    updateStatusText(!!isEnabled);
  });

  // Listen for toggle changes and persist immediately
  toggleEl.addEventListener('change', (e) => {
    const isChecked = e.target.checked;
    chrome.storage.sync.set({ catchLinks: isChecked, autoIntercept: isChecked }, () => {
      updateStatusText(isChecked);
    });
  });

  // Check Rilo desktop application connection state
  chrome.runtime.sendMessage({ action: 'check_connection' }, (response) => {
    if (response && response.connected) {
      connectionDotEl.className = 'dot online';
      connectionTextEl.textContent = 'Rilo connected';
    } else {
      connectionDotEl.className = 'dot offline';
      connectionTextEl.textContent = 'Rilo unavailable';
    }
  });

  function updateStatusText(enabled) {
    if (enabled) {
      statusDescEl.textContent = 'Catching supported downloads';
      statusDescEl.className = 'toggle-desc active';
    } else {
      statusDescEl.textContent = 'Not catching browser downloads';
      statusDescEl.className = 'toggle-desc inactive';
    }
  }
});
