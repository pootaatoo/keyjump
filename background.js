const REFRESH_WIDGET_MESSAGE = { type: 'REFRESH_WIDGET' };
const TOGGLE_WIDGET_MESSAGE = 'TOGGLE_WIDGET';
const GET_WIDGET_STATE_MESSAGE = { type: 'GET_WIDGET_STATE' };
const WIDGET_STATE_CHANGED_MESSAGE = 'WIDGET_STATE_CHANGED';

const ICONS = {
  on: {
    16: 'icons/icon-16.png',
    48: 'icons/icon-48.png',
    128: 'icons/icon-128.png',
  },
  off: {
    16: 'icons/icon-gray-16.png',
    48: 'icons/icon-gray-48.png',
    128: 'icons/icon-gray-128.png',
  },
};

const widgetEnabledByTab = new Map();

chrome.action.onClicked.addListener(async tab => {
  if (!tab.id || isRestrictedUrl(tab.url)) {
    return;
  }

  try {
    const isEnabled = await getWidgetEnabledInTab(tab.id);
    const nextEnabled = !isEnabled;

    await sendWidgetToggle(tab.id, nextEnabled);
    widgetEnabledByTab.set(tab.id, nextEnabled);
    await updateActionIcon(tab.id, nextEnabled);
  } catch (error) {
    console.debug('keyjump cannot toggle on this page:', error.message);
  }
});

chrome.runtime.onMessage.addListener((message, sender) => {
  if (message?.type !== WIDGET_STATE_CHANGED_MESSAGE || !sender.tab?.id) {
    return false;
  }

  const isEnabled = Boolean(message.enabled);
  widgetEnabledByTab.set(sender.tab.id, isEnabled);
  updateActionIcon(sender.tab.id, isEnabled);

  return false;
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'loading') {
    return;
  }

  widgetEnabledByTab.delete(tabId);

  if (!isRestrictedUrl(tab.url)) {
    updateActionIcon(tabId, true);
  }
});

chrome.tabs.onRemoved.addListener(tabId => {
  widgetEnabledByTab.delete(tabId);
});

function refreshWidgetInTab(tabId) {
  return chrome.tabs.sendMessage(tabId, REFRESH_WIDGET_MESSAGE);
}

async function getWidgetEnabledInTab(tabId) {
  try {
    const response = await chrome.tabs.sendMessage(tabId, GET_WIDGET_STATE_MESSAGE);
    if (typeof response?.widgetEnabled === 'boolean') {
      return response.widgetEnabled;
    }
  } catch (_error) {
    // Fall back to the background's last known state when the page cannot answer.
  }

  return widgetEnabledByTab.get(tabId) ?? true;
}

async function sendWidgetToggle(tabId, enabled) {
  try {
    return await toggleWidgetInTab(tabId, enabled);
  } catch (_messageError) {
    await chrome.scripting.insertCSS({
      target: { tabId },
      files: ['content.css'],
    });

    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content.js'],
    });

    return toggleWidgetInTab(tabId, enabled);
  }
}

function toggleWidgetInTab(tabId, enabled) {
  return chrome.tabs.sendMessage(tabId, {
    type: TOGGLE_WIDGET_MESSAGE,
    enabled,
  });
}

function updateActionIcon(tabId, enabled) {
  return chrome.action.setIcon({
    tabId,
    path: enabled ? ICONS.on : ICONS.off,
  }).catch(error => {
    console.debug('keyjump cannot update icon:', error.message);
  });
}

function isRestrictedUrl(url = '') {
  return /^(chrome|edge|brave|about|chrome-extension):/i.test(url)
    || url.startsWith('https://chrome.google.com/webstore')
    || url.startsWith('https://chromewebstore.google.com');
}
