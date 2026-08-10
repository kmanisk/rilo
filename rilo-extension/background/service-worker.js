const NATIVE_HOST_ID = 'com.rilo.downloader';

// Prevent infinite loops when handling downloads
const recentlyIntercepted = new Set();

// Initialize Right-Click Context Menu
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'rilo-download-link',
    title: 'Download with Rilo',
    contexts: ['link', 'image', 'video', 'audio', 'selection'],
  });

  chrome.contextMenus.create({
    id: 'rilo-download-page',
    title: 'Download Page with Rilo',
    contexts: ['page'],
  });
});

// Automatic Browser Download Interception
if (chrome.downloads && chrome.downloads.onCreated) {
  chrome.downloads.onCreated.addListener(async (item) => {
    // Read user Catch Links setting preference (Default: ON)
    const settings = await new Promise((resolve) => {
      chrome.storage.sync.get({ catchLinks: true, autoIntercept: true }, resolve);
    });

    const isCatchLinksEnabled = settings.catchLinks !== undefined ? settings.catchLinks : settings.autoIntercept;
    if (!isCatchLinksEnabled) return;

    const url = item.finalUrl || item.url || '';
    if (!url || !/^https?:\/\//i.test(url)) return;

    // Exclude internal browser pages and unsupported schemes
    if (
      url.startsWith('chrome://') ||
      url.startsWith('edge://') ||
      url.startsWith('about:') ||
      url.startsWith('javascript:') ||
      url.startsWith('mailto:') ||
      url.startsWith('chrome-extension://')
    ) {
      return;
    }

    // Skip if recently intercepted to prevent loops
    if (recentlyIntercepted.has(url)) {
      recentlyIntercepted.delete(url);
      return;
    }

    // Verify Rilo desktop application is connected before intercepting
    const isConnected = await checkRiloConnection();
    if (!isConnected) {
      // Fallback safely to browser native download if Rilo is not running
      return;
    }

    // Cancel & erase browser download so exactly ONE download occurs (in Rilo)
    chrome.downloads.cancel(item.id, () => {
      if (chrome.downloads.erase) {
        chrome.downloads.erase({ id: item.id });
      }
    });

    recentlyIntercepted.add(url);
    setTimeout(() => recentlyIntercepted.delete(url), 10000);

    sendDownloadToRilo(url, item.referrer || '', item.filename || '');
  });
}

// Handle Context Menu Clicks (Always operational even if Catch Links is OFF)
chrome.contextMenus.onClicked.addListener((info, tab) => {
  let targetUrl = '';
  if (info.linkUrl) {
    targetUrl = info.linkUrl;
  } else if (info.srcUrl) {
    targetUrl = info.srcUrl;
  } else if (info.selectionText && /^https?:\/\//i.test(info.selectionText.trim())) {
    targetUrl = info.selectionText.trim();
  } else if (info.menuItemId === 'rilo-download-page' && tab && tab.url) {
    targetUrl = tab.url;
  }

  if (targetUrl) {
    sendDownloadToRilo(targetUrl, tab ? tab.url : '', tab ? tab.title : '');
  }
});

// Communication with Rilo via WebExtension Native Messaging
async function sendDownloadToRilo(url, pageUrl, pageTitle) {
  const payload = {
    version: 1,
    type: 'download_request',
    url: url,
    filename: extractFilename(url),
    page_url: pageUrl || '',
    referrer: pageUrl || '',
    source: 'browser',
  };

  if (chrome.runtime.sendNativeMessage) {
    chrome.runtime.sendNativeMessage(NATIVE_HOST_ID, payload, (response) => {
      if (chrome.runtime.lastError) {
        console.warn('[Rilo Extension] Native Host error:', chrome.runtime.lastError.message);
        fallbackHttpSend(payload);
      } else if (response && response.success) {
        showNotification('Rilo Download Manager', `Sent download to Rilo: ${payload.filename}`);
      } else if (response && response.message) {
        showNotification('Rilo Error', response.message);
      } else {
        fallbackHttpSend(payload);
      }
    });
  } else {
    fallbackHttpSend(payload);
  }
}

async function fallbackHttpSend(payload) {
  try {
    const res = await fetch('http://127.0.0.1:7899/api/download', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      showNotification('Rilo Download Manager', `Sent download to Rilo: ${payload.filename}`);
    } else {
      showNotification('Rilo Download Manager', 'Failed connecting to Rilo. Ensure Rilo desktop is running.');
    }
  } catch {
    showNotification('Rilo Not Running', 'Rilo desktop application is not active. Please start Rilo.');
  }
}

function showNotification(title, message) {
  if (chrome.notifications) {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: '../icons/icon48.png',
      title: title,
      message: message,
    });
  }
}

function extractFilename(urlStr) {
  try {
    const url = new URL(urlStr);
    const parts = url.pathname.split('/').filter(Boolean);
    if (parts.length > 0) {
      return decodeURIComponent(parts[parts.length - 1]);
    }
  } catch {}
  return 'download.bin';
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'send_download') {
    sendDownloadToRilo(message.url, message.pageUrl, message.pageTitle);
    sendResponse({ status: 'sent' });
  } else if (message.action === 'check_connection') {
    checkRiloConnection().then((connected) => sendResponse({ connected }));
    return true;
  }
});

async function checkRiloConnection() {
  return new Promise((resolve) => {
    if (chrome.runtime.sendNativeMessage) {
      chrome.runtime.sendNativeMessage(NATIVE_HOST_ID, { version: 1, type: 'ping' }, (res) => {
        if (chrome.runtime.lastError || !res || !res.success) {
          fetch('http://127.0.0.1:7899/api/ping')
            .then((r) => resolve(r.ok))
            .catch(() => resolve(false));
        } else {
          resolve(true);
        }
      });
    } else {
      fetch('http://127.0.0.1:7899/api/ping')
        .then((r) => resolve(r.ok))
        .catch(() => resolve(false));
    }
  });
}
