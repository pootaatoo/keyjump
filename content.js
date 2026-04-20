// Content script for keyjump
// In-page floating widget version

const KEYJUMP_WIDGET_ID = 'keyjump-widget';
const SOFT_HIGHLIGHT_CLASS = 'kw-highlight';
const ACTIVE_HIGHLIGHT_CLASS = 'kw-highlight-active';
const REFRESH_WIDGET_MESSAGE = 'REFRESH_WIDGET';
const RESCAN_DEBOUNCE_MS = 250;
const CLOSED_FLAG = '__keywordWidgetClosed';

let widgetElement = null;
let extensionSettings = null;
let keywordMatchState = {};
let currentActiveHighlight = null; 
let rescanTimer = null;
let cleanupDragListeners = null;
let settingsCollapsed = false;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeWidget);
} else {
  initializeWidget();
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== REFRESH_WIDGET_MESSAGE) {
    return false;
  }

  refreshWidget()
    .then(() => sendResponse({ ok: true }))
    .catch(error => {
      console.error('Error refreshing widget:', error);
      sendResponse({ ok: false, error: error.message });
    });

  return true;
});

async function initializeWidget() {
  if (isWidgetClosedForPage()) {
    return;
  }

  try {
    const stored = await chrome.storage.local.get([
      'keywords',
      'caseSensitive',
      'wholeWord',
      'autoScan',
    ]);

    extensionSettings = {
      keywords: parseKeywords(stored.keywords || ''),
      caseSensitive: Boolean(stored.caseSensitive),
      wholeWord: Boolean(stored.wholeWord),
      autoScan: stored.autoScan !== false,
    };

    createWidget();

    if (extensionSettings.keywords.length > 0 && extensionSettings.autoScan) {
      window.setTimeout(() => {
        performInternalScan();
      }, 300);
    }
  } catch (error) {
    console.error('Error initializing widget:', error);
  }
}

async function refreshWidget() {
  setWidgetClosedForPage(false);
  settingsCollapsed = false;
  resetWidgetSession();

  await initializeWidget();
}

function createWidget() {
  if (isWidgetClosedForPage() || widgetElement || !document.body) {
    return;
  }

  widgetElement = document.createElement('div');
  widgetElement.id = KEYJUMP_WIDGET_ID;
  widgetElement.className = 'keyjump-widget';
  widgetElement.innerHTML = `
    <div class="keyjump-header">
      <span class="keyjump-title">keyjump</span>
      <button class="keyjump-close-btn" id="keyjump-close" type="button" aria-label="Close widget">&times;</button>
    </div>
    <div class="keyjump-content">
      <div class="keyjump-settings">
        <button class="keyjump-settings-toggle" id="keyjump-settings-toggle" type="button" aria-expanded="true">
          <span>Settings</span>
          <span class="keyjump-settings-chevron" aria-hidden="true">v</span>
        </button>
        <div class="keyjump-settings-panel" id="keyjump-settings-panel">
          <div class="keyjump-setting-group">
            <label class="keyjump-label" for="keyjump-keywords">Keywords (one per line)</label>
            <textarea class="keyjump-keywords-input" id="keyjump-keywords" rows="3" placeholder="Enter keywords here..."></textarea>
          </div>
          <div class="keyjump-setting-group keyjump-inline-settings">
            <label class="keyjump-checkbox-label">
              <input type="checkbox" id="keyjump-case-sensitive">
              <span>Case sensitive</span>
            </label>
            <label class="keyjump-checkbox-label">
              <input type="checkbox" id="keyjump-whole-word">
              <span>Whole word only</span>
            </label>
            <label class="keyjump-checkbox-label">
              <input type="checkbox" id="keyjump-auto-scan">
              <span>Auto Scan on Page Load</span>
            </label>
          </div>
          <button class="keyjump-save-btn" id="keyjump-save">Save &amp; Scan</button>
        </div>
      </div>
      <div class="keyjump-body">
        <div class="keyjump-results-header">
          <div class="keyjump-summary">Ready to scan</div>
        </div>
        <div class="keyjump-list"></div>
      </div>
    </div>
  `;

  document.body.appendChild(widgetElement);
  populateSettings();
  attachWidgetListeners();
  makeWidgetDraggable(widgetElement);
}

function populateSettings() {
  if (!widgetElement || !extensionSettings) {
    return;
  }

  widgetElement.querySelector('#keyjump-keywords').value = extensionSettings.keywords.join('\n');
  widgetElement.querySelector('#keyjump-case-sensitive').checked = extensionSettings.caseSensitive;
  widgetElement.querySelector('#keyjump-whole-word').checked = extensionSettings.wholeWord;
  widgetElement.querySelector('#keyjump-auto-scan').checked = extensionSettings.autoScan;
  updateSettingsFoldState();
}

function attachWidgetListeners() {
  widgetElement.querySelector('#keyjump-settings-toggle').addEventListener('click', toggleSettingsSection);
  widgetElement.querySelector('#keyjump-save').addEventListener('click', saveSettingsAndScan);
  widgetElement.querySelector('#keyjump-keywords').addEventListener('input', handleEditorChange);
  widgetElement.querySelector('#keyjump-case-sensitive').addEventListener('change', handleEditorChange);
  widgetElement.querySelector('#keyjump-whole-word').addEventListener('change', handleEditorChange);
  widgetElement.querySelector('#keyjump-auto-scan').addEventListener('change', handleEditorChange);

  const closeButton = widgetElement.querySelector('#keyjump-close');
  closeButton.addEventListener('mousedown', handleCloseButtonPointer);
  closeButton.addEventListener('click', handleCloseWidget);
}

function toggleSettingsSection(event) {
  event.preventDefault();
  settingsCollapsed = !settingsCollapsed;
  updateSettingsFoldState();
}

function updateSettingsFoldState() {
  if (!widgetElement) {
    return;
  }

  const settings = widgetElement.querySelector('.keyjump-settings');
  const toggle = widgetElement.querySelector('#keyjump-settings-toggle');
  const chevron = widgetElement.querySelector('.keyjump-settings-chevron');

  settings.classList.toggle('keyjump-settings-collapsed', settingsCollapsed);
  toggle.setAttribute('aria-expanded', String(!settingsCollapsed));
  chevron.textContent = settingsCollapsed ? '>' : 'v';
}

function handleCloseButtonPointer(event) {
  event.stopPropagation();
}

function handleCloseWidget(event) {
  event.preventDefault();
  event.stopPropagation();
  setWidgetClosedForPage(true);
  resetWidgetSession();
}

function resetWidgetSession() {
  window.clearTimeout(rescanTimer);
  rescanTimer = null;

  if (cleanupDragListeners) {
    cleanupDragListeners();
    cleanupDragListeners = null;
  }

  if (widgetElement && widgetElement.parentNode) {
    widgetElement.parentNode.removeChild(widgetElement);
  }

  widgetElement = null;
  extensionSettings = null;
  clearAllHighlights();
}

function handleEditorChange() {
  if (isWidgetClosedForPage()) {
    return;
  }

  syncSettingsFromWidget();
  debounceScan();
}

function debounceScan() {
  window.clearTimeout(rescanTimer);
  rescanTimer = window.setTimeout(() => {
    performInternalScan();
  }, RESCAN_DEBOUNCE_MS);
}

function syncSettingsFromWidget() {
  if (!widgetElement) {
    return;
  }

  extensionSettings = {
    keywords: parseKeywords(widgetElement.querySelector('#keyjump-keywords').value),
    caseSensitive: widgetElement.querySelector('#keyjump-case-sensitive').checked,
    wholeWord: widgetElement.querySelector('#keyjump-whole-word').checked,
    autoScan: widgetElement.querySelector('#keyjump-auto-scan').checked,
  };
}

async function saveSettingsAndScan() {
  try {
    if (isWidgetClosedForPage()) {
      return;
    }

    syncSettingsFromWidget();

    await chrome.storage.local.set({
      keywords: extensionSettings.keywords.join('\n'),
      caseSensitive: extensionSettings.caseSensitive,
      wholeWord: extensionSettings.wholeWord,
      autoScan: extensionSettings.autoScan,
    });

    performInternalScan();
  } catch (error) {
    console.error('Error saving settings:', error);
    alert(`Error saving settings: ${error.message}`);
  }
}

function performInternalScan() {
  if (isWidgetClosedForPage() || !extensionSettings) {
    return;
  }

  clearAllHighlights();

  if (!extensionSettings.keywords.length) {
    updateWidget(createResultsMap([]));
    return;
  }

  try {
    const results = scanPageForKeywordsAndHighlight(
      extensionSettings.keywords,
      extensionSettings.caseSensitive,
      extensionSettings.wholeWord
    );

    keywordMatchState = createKeywordMatchState(results, extensionSettings.keywords);
    updateWidget(results);
  } catch (error) {
    console.error('Internal scan error:', error);
  }
}

function updateWidget(results) {
  if (isWidgetClosedForPage() || !widgetElement || !extensionSettings) {
    return;
  }

  const summary = widgetElement.querySelector('.keyjump-summary');
  const list = widgetElement.querySelector('.keyjump-list');
  const foundKeywords = extensionSettings.keywords.filter(keyword => (results[keyword] || []).length > 0);

  summary.textContent = `${foundKeywords.length} of ${extensionSettings.keywords.length} keywords found`;
  list.innerHTML = '';

  const sortedKeywords = [...extensionSettings.keywords].sort((left, right) => {
    const leftFound = (results[left] || []).length > 0;
    const rightFound = (results[right] || []).length > 0;
    return Number(rightFound) - Number(leftFound);
  });

  sortedKeywords.forEach(keyword => {
    const matches = results[keyword] || [];
    if (!matches.length) {
      return;
    }

    const matchLabel = matches.length === 1 ? '1 match' : `${matches.length} matches`;

    const item = document.createElement('div');
    item.className = 'keyjump-keyword-item keyjump-matched';
    const meta = document.createElement('div');
    meta.className = 'keyjump-keyword-meta';

    const name = document.createElement('div');
    name.className = 'keyjump-keyword-name';
    name.textContent = keyword;

    const count = document.createElement('div');
    count.className = 'keyjump-match-count';
    count.textContent = matchLabel;

    const button = document.createElement('button');
    button.className = 'keyjump-go-btn';
    button.type = 'button';
    button.textContent = 'Go to';

    meta.appendChild(name);
    meta.appendChild(count);
    item.appendChild(meta);
    item.appendChild(button);

    button.addEventListener('click', () => {
      jumpToKeywordInternal(keyword);
    });

    list.appendChild(item);
  });

  const missingCount = extensionSettings.keywords.length - foundKeywords.length;
  if (missingCount > 0) {
    const unmatched = document.createElement('div');
    unmatched.className = 'keyjump-unmatched-info';
    unmatched.textContent = `${missingCount} more not found`;
    list.appendChild(unmatched);
  }
}

function jumpToKeywordInternal(keyword) {
  if (isWidgetClosedForPage()) {
    return;
  }

  let keywordState = keywordMatchState[keyword];
  let matches = getKeywordMatchesFromDom(keyword);

  if (!matches.length) {
    performInternalScan();
    keywordState = keywordMatchState[keyword];
    matches = getKeywordMatchesFromDom(keyword);
  }

  if (!matches.length) {
    alert(`Keyword "${keyword}" not found on page`);
    return;
  }

  if (!keywordState) {
    keywordState = {
      matches: matches,
      currentIndex: -1,
    };
    keywordMatchState[keyword] = keywordState;
  }

  keywordState.matches = matches;
  keywordState.currentIndex = (keywordState.currentIndex + 1) % matches.length;
  const target = matches[keywordState.currentIndex];
  setActiveHighlight(target);
  target.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
}

function setActiveHighlight(target) {
  if (currentActiveHighlight && currentActiveHighlight.isConnected && currentActiveHighlight !== target) {
    currentActiveHighlight.classList.remove(ACTIVE_HIGHLIGHT_CLASS);
  }

  if (target.classList.contains(ACTIVE_HIGHLIGHT_CLASS)) {
    target.classList.remove(ACTIVE_HIGHLIGHT_CLASS);
    void target.offsetWidth;
  }

  target.classList.add(ACTIVE_HIGHLIGHT_CLASS);
  currentActiveHighlight = target;
}

function scanPageForKeywordsAndHighlight(keywords, caseSensitive, wholeWord) {
  const results = createResultsMap(keywords);
  const keywordConfigs = buildKeywordConfigs(keywords, caseSensitive, wholeWord);

  if (!document.body || !keywordConfigs.length) {
    return results;
  }

  const textNodes = getSearchableTextNodes();
  textNodes.forEach(node => {
    const matches = collectMatchesForNode(node.textContent, keywordConfigs);
    if (!matches.length) {
      return;
    }

    wrapMatchesInTextNode(node, matches, results);
  });

  return results;
}

function buildKeywordConfigs(keywords, caseSensitive, wholeWord) {
  return keywords
    .filter(Boolean)
    .map((keyword, index) => ({
      keyword,
      order: index,
      regex: buildSearchPattern(keyword, caseSensitive, wholeWord),
    }))
    .sort((left, right) => {
      if (right.keyword.length !== left.keyword.length) {
        return right.keyword.length - left.keyword.length;
      }

      return left.order - right.order;
    });
}

function getSearchableTextNodes() {
  const nodes = [];
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode(node) {
        return shouldSkipNode(node) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
      },
    }
  );

  let currentNode;
  while ((currentNode = walker.nextNode())) {
    nodes.push(currentNode);
  }

  return nodes;
}

function collectMatchesForNode(text, keywordConfigs) {
  const candidates = [];

  keywordConfigs.forEach(config => {
    config.regex.lastIndex = 0;

    let match;
    while ((match = config.regex.exec(text)) !== null) {
      if (!match[0]) {
        break;
      }

      candidates.push({
        keyword: config.keyword,
        start: match.index,
        end: match.index + match[0].length,
        order: config.order,
      });
    }
  });

  candidates.sort((left, right) => {
    if (left.start !== right.start) {
      return left.start - right.start;
    }

    const leftLength = left.end - left.start;
    const rightLength = right.end - right.start;
    if (rightLength !== leftLength) {
      return rightLength - leftLength;
    }

    return left.order - right.order;
  });

  const filtered = [];
  let lastEnd = -1;
  candidates.forEach(candidate => {
    if (candidate.start < lastEnd) {
      return;
    }

    filtered.push(candidate);
    lastEnd = candidate.end;
  });

  return filtered;
}

function wrapMatchesInTextNode(node, matches, results) {
  const fragment = document.createDocumentFragment();
  const text = node.textContent;
  let cursor = 0;

  matches.forEach(match => {
    if (cursor < match.start) {
      fragment.appendChild(document.createTextNode(text.slice(cursor, match.start)));
    }

    const span = document.createElement('span');
    span.className = SOFT_HIGHLIGHT_CLASS;
    span.dataset.keyword = match.keyword;
    span.textContent = text.slice(match.start, match.end);

    fragment.appendChild(span);
    results[match.keyword].push(span);
    cursor = match.end;
  });

  if (cursor < text.length) {
    fragment.appendChild(document.createTextNode(text.slice(cursor)));
  }

  node.parentNode.replaceChild(fragment, node);
}

function clearAllHighlights() {
  document.querySelectorAll(`span.${SOFT_HIGHLIGHT_CLASS}`).forEach(span => {
    const parent = span.parentNode;
    if (!parent) {
      return;
    }

    parent.replaceChild(document.createTextNode(span.textContent), span);
    parent.normalize();
  });

  currentActiveHighlight = null;
  keywordMatchState = {};
}

function buildSearchPattern(keyword, caseSensitive, wholeWord) {
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const source = wholeWord ? `\\b${escaped}\\b` : escaped;
  return new RegExp(source, caseSensitive ? 'g' : 'gi');
}

function shouldSkipNode(node) {
  if (!node || !node.parentElement || !node.textContent.trim()) {
    return true;
  }

  const parent = node.parentElement;
  if (parent.closest(`#${KEYJUMP_WIDGET_ID}`) || parent.closest(`.${SOFT_HIGHLIGHT_CLASS}`)) {
    return true;
  }

  if (parent.closest('[contenteditable="true"]')) {
    return true;
  }

  let current = parent;
  while (current && current !== document.body) {
    const tag = current.tagName.toLowerCase();
    if (['script', 'style', 'noscript', 'textarea', 'input', 'select', 'option'].includes(tag)) {
      return true;
    }

    if (current.getAttribute('aria-hidden') === 'true') {
      return true;
    }

    const style = window.getComputedStyle(current);
    if (style.display === 'none' || style.visibility === 'hidden') {
      return true;
    }

    current = current.parentElement;
  }

  return false;
}

function createResultsMap(keywords) {
  return keywords.reduce((accumulator, keyword) => {
    accumulator[keyword] = [];
    return accumulator;
  }, {});
}

function createKeywordMatchState(results, keywords) {
  return keywords.reduce((accumulator, keyword) => {
    accumulator[keyword] = {
      matches: results[keyword] || [],
      currentIndex: -1,
    };
    return accumulator;
  }, {});
}

function getKeywordMatchesFromDom(keyword) {
  if (!keyword) {
    return [];
  }

  const escapedKeyword = typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
    ? CSS.escape(keyword)
    : keyword.replace(/["\\]/g, '\\$&');

  return Array.from(
    document.querySelectorAll(`span.${SOFT_HIGHLIGHT_CLASS}[data-keyword="${escapedKeyword}"]`)
  ).filter(node => node && node.isConnected);
}

function parseKeywords(value) {
  return value
    .split('\n')
    .map(keyword => keyword.trim())
    .filter(Boolean);
}

function makeWidgetDraggable(element) {
  let isDragging = false;
  let posX = 0;
  let posY = 0;
  let initialX = 0;
  let initialY = 0;

  const header = element.querySelector('.keyjump-header');
  const handleMouseDown = event => {
    isDragging = true;
    initialX = event.clientX - posX;
    initialY = event.clientY - posY;
  };

  const handleMouseMove = event => {
    if (!isDragging) {
      return;
    }

    posX = event.clientX - initialX;
    posY = event.clientY - initialY;
    element.style.transform = `translate(${posX}px, ${posY}px)`;
  };

  const handleMouseUp = () => {
    isDragging = false;
  };

  header.addEventListener('mousedown', handleMouseDown);
  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('mouseup', handleMouseUp);

  cleanupDragListeners = () => {
    header.removeEventListener('mousedown', handleMouseDown);
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  };
}

function isWidgetClosedForPage() {
  return window[CLOSED_FLAG] === true;
}

function setWidgetClosedForPage(value) {
  window[CLOSED_FLAG] = value === true;
}
