document.addEventListener('DOMContentLoaded', async () => {
  const toggleEl = document.getElementById('catch-links-toggle');
  const statusDescEl = document.getElementById('status-desc');
  const connectionDotEl = document.getElementById('connection-dot');
  const connectionTextEl = document.getElementById('connection-text');
  const openAppBtn = document.getElementById('open-app-btn');
  const settingsBtn = document.getElementById('settings-btn');
  const footerPrefBtn = document.getElementById('footer-pref-btn');
  const quickForm = document.getElementById('quick-download-form');
  const urlInput = document.getElementById('url-input');
  const quickFeedback = document.getElementById('quick-feedback');
  const recentsListEl = document.getElementById('recents-list');
  const clearRecentsBtn = document.getElementById('clear-recents-btn');
  const downloadPageBtn = document.getElementById('download-page-btn');

  // Load persisted Catch Links setting
  chrome.storage.sync.get({ catchLinks: true, autoIntercept: true }, (res) => {
    const isEnabled = res.catchLinks !== undefined ? res.catchLinks : res.autoIntercept;
    toggleEl.checked = !!isEnabled;
    updateStatusText(!!isEnabled);
  });

  // Listen for toggle changes
  toggleEl.addEventListener('change', (e) => {
    const isChecked = e.target.checked;
    chrome.storage.sync.set({ catchLinks: isChecked, autoIntercept: isChecked }, () => {
      updateStatusText(isChecked);
    });
  });

  function updateStatusText(enabled) {
    if (enabled) {
      statusDescEl.textContent = 'Catching browser links';
      statusDescEl.className = 'toggle-desc active';
    } else {
      statusDescEl.textContent = 'Link catching paused';
      statusDescEl.className = 'toggle-desc inactive';
    }
  }

  // Check Rilo desktop application connection state
  async function checkConnection() {
    chrome.runtime.sendMessage({ action: 'check_connection' }, (response) => {
      if (response && response.connected) {
        connectionDotEl.className = 'dot online';
        connectionTextEl.textContent = 'Rilo Connected';
      } else {
        connectionDotEl.className = 'dot offline';
        connectionTextEl.textContent = 'Rilo Unavailable';
      }
    });
  }

  checkConnection();

  // Open settings
  const openSettings = () => {
    if (chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    } else {
      window.open(chrome.runtime.getURL('options/index.html'));
    }
  };

  settingsBtn?.addEventListener('click', openSettings);
  footerPrefBtn?.addEventListener('click', openSettings);

  // Open desktop app or trigger focus
  openAppBtn?.addEventListener('click', async () => {
    fetch('http://127.0.0.1:7899/api/ping').catch(() => {});
    chrome.runtime.sendMessage({ action: 'check_connection' });
  });

  // Quick download URL submission
  quickForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    const url = urlInput.value.trim();
    if (!url) return;

    chrome.runtime.sendMessage({ action: 'send_download', url }, (res) => {
      urlInput.value = '';
      quickFeedback.textContent = 'Sent to Rilo!';
      quickFeedback.style.display = 'block';
      setTimeout(() => {
        quickFeedback.style.display = 'none';
        loadRecents();
      }, 1200);
    });
  });

  // Download page media
  downloadPageBtn?.addEventListener('click', async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab && tab.url) {
        chrome.runtime.sendMessage({
          action: 'send_download',
          url: tab.url,
          pageUrl: tab.url,
          pageTitle: tab.title || 'Web Page',
        });
        downloadPageBtn.textContent = 'Sent!';
        setTimeout(() => {
          downloadPageBtn.innerHTML = `
            <svg class="svg-icon-xs" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="12" y1="18" x2="12" y2="12"></line>
              <line x1="9" y1="15" x2="15" y2="15"></line>
            </svg>
            <span>Catch Page Media</span>
          `;
          loadRecents();
        }, 1500);
      }
    } catch (err) {
      console.error(err);
    }
  });

  // Load Recent Downloads
  function loadRecents() {
    chrome.storage.local.get({ recentDownloads: [] }, (res) => {
      const items = res.recentDownloads || [];
      if (!items.length) {
        recentsListEl.innerHTML = `
          <div class="empty-state">
            <span class="empty-state-title">No recent downloads</span>
            <span class="empty-state-sub">Downloads caught from your browser will appear here.</span>
          </div>
        `;
        clearRecentsBtn.style.display = 'none';
        return;
      }

      clearRecentsBtn.style.display = 'block';
      recentsListEl.innerHTML = items
        .slice(0, 4)
        .map(
          (item) => `
          <div class="recent-item" title="Click to copy link" data-url="${escapeHtml(item.url)}">
            <div class="recent-info">
              <span class="recent-name">${escapeHtml(item.filename || 'download')}</span>
              <span class="recent-time">${formatTimeAgo(item.timestamp)}</span>
            </div>
            <span class="recent-tag">${escapeHtml(item.status || 'Sent')}</span>
          </div>
        `
        )
        .join('');

      // Add click to copy link
      recentsListEl.querySelectorAll('.recent-item').forEach((el) => {
        el.addEventListener('click', () => {
          const url = el.getAttribute('data-url');
          if (url) {
            navigator.clipboard.writeText(url).then(() => {
              const tag = el.querySelector('.recent-tag');
              if (tag) {
                const prev = tag.textContent;
                tag.textContent = 'Copied!';
                setTimeout(() => (tag.textContent = prev), 1200);
              }
            });
          }
        });
      });
    });
  }

  clearRecentsBtn?.addEventListener('click', () => {
    chrome.storage.local.set({ recentDownloads: [] }, () => {
      loadRecents();
    });
  });

  function formatTimeAgo(timestamp) {
    if (!timestamp) return 'Recently';
    const diff = Math.floor((Date.now() - timestamp) / 1000);
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  loadRecents();
});
