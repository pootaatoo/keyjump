const REFRESH_WIDGET_MESSAGE = { type: 'REFRESH_WIDGET' };

chrome.action.onClicked.addListener(async tab => {
  if (!tab.id || isRestrictedUrl(tab.url)) {
    return;
  }

  try {
    await refreshWidgetInTab(tab.id);
  } catch (_messageError) {
    try {
      await chrome.scripting.insertCSS({
        target: { tabId: tab.id },
        files: ['content.css'],
      });

      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js'],
      });

      await refreshWidgetInTab(tab.id);
    } catch (error) {
      console.debug('keyjump cannot refresh on this page:', error.message);
    }
  }
});

function refreshWidgetInTab(tabId) {
  return chrome.tabs.sendMessage(tabId, REFRESH_WIDGET_MESSAGE);
}

function isRestrictedUrl(url = '') {
  return /^(chrome|edge|brave|about|chrome-extension):/i.test(url)
    || url.startsWith('https://chrome.google.com/webstore')
    || url.startsWith('https://chromewebstore.google.com');
}
