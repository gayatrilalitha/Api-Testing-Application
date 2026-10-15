// public/script.js
// JavaScript for API Tester connected to Node.js + MySQL Backend

// 1. Get HTML elements using simple variable names and IDs
const method = document.getElementById('method');
const url = document.getElementById('url');
const send = document.getElementById('send');
const clear = document.getElementById('clear');
const fullUrlPreview = document.getElementById('full-url-preview');

const status = document.getElementById('status');
const responseTime = document.getElementById('response-time');
const response = document.getElementById('response');

const paramsContainer = document.getElementById('params');
const headersContainer = document.getElementById('headers');
const body = document.getElementById('body');

const authModal = document.getElementById('modal-auth');
const settingsModal = document.getElementById('modal-settings');
const navUserArea = document.getElementById('nav-user-area');

// Global cache for latest response and variables
let latestResponse = null;
let cachedVariables = { baseUrl: 'https://jsonplaceholder.typicode.com' };

// Regex constants
const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,20}$/;
const EMAIL_REGEX = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

// 2. Attach event listeners
if (send) send.addEventListener('click', sendRequest);
if (clear) clear.addEventListener('click', clearRequest);

if (url) {
  url.addEventListener('input', function () {
    syncParamsFromUrl();
    updateUrlPreview();
  });

  url.addEventListener('keydown', function (event) {
    if (event.key === 'Enter') {
      sendRequest();
    }
  });
}

window.addEventListener('click', function (event) {
  if (event.target === authModal) closeAuthModal();
  if (event.target === settingsModal) closeSettingsModal();
});

// ----------------------------------------------------
// 3. User Authentication State Helpers
// ----------------------------------------------------

function getCurrentUser() {
  const saved = localStorage.getItem('api_current_user');
  return saved ? JSON.parse(saved) : null;
}

function setCurrentUser(user) {
  if (user) {
    localStorage.setItem('api_current_user', JSON.stringify(user));
  } else {
    localStorage.removeItem('api_current_user');
  }
  updateAuthNavButton();

  renderPerformance();
  renderVariables();
  renderHistory();
  updateUrlPreview();
}

function updateAuthNavButton() {
  const user = getCurrentUser();
  if (!navUserArea) return;

  if (user) {
    navUserArea.innerHTML = `
      <span class="nav-username" title="Logged in as ${escapeHtml(user.username)}">👤 ${escapeHtml(user.username)}</span>
      <button type="button" class="nav-button nav-logout-btn" onclick="handleLogout()">Logout</button>
    `;
  } else {
    navUserArea.innerHTML = `
      <button type="button" class="nav-button nav-login-btn" onclick="openAuthModal()">Login / Signup</button>
    `;
  }

  const currentUsernameInput = document.getElementById('current-username');
  if (currentUsernameInput) {
    currentUsernameInput.value = user ? user.username : 'Not logged in';
  }
}

function openSettingsModal() {
  if (!requireAuth('access Settings')) return;
  const user = getCurrentUser();
  const currentUsernameInput = document.getElementById('current-username');
  if (currentUsernameInput && user) {
    currentUsernameInput.value = user.username;
  }
  const uMsg = document.getElementById('username-msg');
  if (uMsg) uMsg.className = 'message';
  const pMsg = document.getElementById('password-msg');
  if (pMsg) pMsg.className = 'message';
  if (settingsModal) settingsModal.classList.add('active');
}

function closeSettingsModal() {
  if (settingsModal) settingsModal.classList.remove('active');
}

function showLoginBanner(message = 'You have to login or signup to send requests or make changes.') {
  const existing = document.getElementById('login-warning-banner');
  if (existing) existing.remove();

  const banner = document.createElement('div');
  banner.id = 'login-warning-banner';
  banner.className = 'login-warning-banner';
  banner.innerHTML = `
    <span>⚠️ <strong>Access Restricted:</strong> ${message}</span>
    <button type="button" class="button button-small button-primary" onclick="openAuthModal()">Login / Signup Now</button>
  `;

  document.body.prepend(banner);
  openAuthModal();

  setTimeout(() => {
    if (banner) banner.remove();
  }, 6000);
}

function requireAuth(actionDescription = 'perform this action') {
  const user = getCurrentUser();
  if (!user) {
    showLoginBanner(`You have to login or signup to ${actionDescription}.`);
    return false;
  }
  return true;
}

// ----------------------------------------------------
// 4. View Switching
// ----------------------------------------------------
function switchView(viewName) {
  if (viewName === 'settings') {
    openSettingsModal();
    return;
  }

  const navButtons = document.querySelectorAll('.nav-button');
  navButtons.forEach(btn => btn.classList.remove('active'));

  const views = document.querySelectorAll('.view');
  views.forEach(v => v.classList.remove('active'));

  const targetView = document.getElementById('view-' + viewName);
  if (targetView) {
    targetView.classList.add('active');
  }

  if (window.event && window.event.target && window.event.target.classList.contains('nav-button')) {
    window.event.target.classList.add('active');
  }

  if (viewName === 'performance') renderPerformance();
  if (viewName === 'variables') renderVariables();
  if (viewName === 'history') renderHistory();
}

// ----------------------------------------------------
// 5. Query Parameters & Headers Functions
// ----------------------------------------------------
let isSyncingParams = false;

function switchRequestTab(tabName) {
  document.getElementById('tab-btn-params').className =
    tabName === 'params' ? 'tab-button active' : 'tab-button';
  document.getElementById('tab-btn-headers').className =
    tabName === 'headers' ? 'tab-button active' : 'tab-button';
  document.getElementById('tab-btn-body').className =
    tabName === 'body' ? 'tab-button active' : 'tab-button';

  document.getElementById('tab-params').className =
    tabName === 'params' ? 'panel active' : 'panel';
  document.getElementById('tab-headers').className =
    tabName === 'headers' ? 'panel active' : 'panel';
  document.getElementById('tab-body').className =
    tabName === 'body' ? 'panel active' : 'panel';
}

function createParamRowElement(key = '', val = '') {
  const row = document.createElement('div');
  row.className = 'row';
  row.innerHTML = `
    <input type="text" class="input param-key" placeholder="Key (e.g. userId)" value="${escapeHtml(key)}">
    <input type="text" class="input param-val" placeholder="Value (e.g. 1)" value="${escapeHtml(val)}">
    <button type="button" class="btn-remove" title="Remove parameter">✕</button>
  `;

  const keyInput = row.querySelector('.param-key');
  const valInput = row.querySelector('.param-val');
  const removeBtn = row.querySelector('.btn-remove');

  keyInput.addEventListener('input', syncUrlFromParams);
  valInput.addEventListener('input', syncUrlFromParams);

  removeBtn.addEventListener('click', function () {
    row.remove();
    syncUrlFromParams();
  });

  paramsContainer.appendChild(row);
  return row;
}

function addParamRow(key = '', val = '') {
  if (!requireAuth('add query parameters')) return;

  createParamRowElement(key, val);
  syncUrlFromParams();
}

function syncParamsFromUrl() {
  if (isSyncingParams || !url) return;
  isSyncingParams = true;

  const rawUrl = url.value.trim();
  const queryIndex = rawUrl.indexOf('?');

  if (queryIndex !== -1) {
    const queryString = rawUrl.slice(queryIndex + 1);
    const pairs = queryString.split('&');

    const parsedParams = [];
    pairs.forEach(pair => {
      if (pair !== '') {
        const eqIndex = pair.indexOf('=');
        const k = eqIndex > -1 ? decodeURIComponent(pair.slice(0, eqIndex)) : decodeURIComponent(pair);
        const v = eqIndex > -1 ? decodeURIComponent(pair.slice(eqIndex + 1)) : '';
        parsedParams.push({ key: k, value: v });
      }
    });

    const currentRows = paramsContainer.querySelectorAll('.row');
    let isDifferent = currentRows.length !== parsedParams.length;

    if (!isDifferent) {
      for (let i = 0; i < currentRows.length; i++) {
        const k = currentRows[i].querySelector('.param-key').value;
        const v = currentRows[i].querySelector('.param-val').value;
        if (k !== parsedParams[i].key || v !== parsedParams[i].value) {
          isDifferent = true;
          break;
        }
      }
    }

    if (isDifferent) {
      paramsContainer.innerHTML = '';
      parsedParams.forEach(p => {
        createParamRowElement(p.key, p.value);
      });
    }
  } else {
    if (paramsContainer && paramsContainer.children.length > 0) {
      paramsContainer.innerHTML = '';
    }
  }

  isSyncingParams = false;
  updateUrlPreview();
}

function syncUrlFromParams() {
  if (isSyncingParams || !url) return;
  isSyncingParams = true;

  const rawUrl = url.value.trim();
  const queryIndex = rawUrl.indexOf('?');
  const base = queryIndex > -1 ? rawUrl.slice(0, queryIndex) : rawUrl;

  const rows = paramsContainer.querySelectorAll('.row');
  const queryParts = [];

  rows.forEach(r => {
    const k = r.querySelector('.param-key').value.trim();
    const v = r.querySelector('.param-val').value.trim();
    if (k !== '') {
      queryParts.push(encodeURIComponent(k) + (v !== '' ? '=' + encodeURIComponent(v) : ''));
    }
  });

  if (queryParts.length > 0) {
    url.value = base + '?' + queryParts.join('&');
  } else {
    url.value = base;
  }

  isSyncingParams = false;
  updateUrlPreview();
}

function addHeaderRow(key = '', val = '') {
  if (!requireAuth('add request headers')) return;

  const row = document.createElement('div');
  row.className = 'row';
  row.innerHTML = `
    <input type="text" class="input header-key" placeholder="Header (e.g. Content-Type)" value="${escapeHtml(key)}">
    <input type="text" class="input header-val" placeholder="Value (e.g. application/json)" value="${escapeHtml(val)}">
    <button type="button" class="btn-remove" title="Remove header">✕</button>
  `;

  const removeBtn = row.querySelector('.btn-remove');
  removeBtn.addEventListener('click', function () {
    row.remove();
  });

  headersContainer.appendChild(row);
}

function getHeadersObject() {
  if (!headersContainer) return {};
  const rows = headersContainer.querySelectorAll('.row');
  const headers = {};
  rows.forEach(r => {
    const k = r.querySelector('.header-key').value.trim();
    const v = r.querySelector('.header-val').value.trim();
    if (k) headers[k] = v;
  });
  return headers;
}

function buildFullUrl(rawUrl) {
  if (!rawUrl) return '';
  return replaceVariables(rawUrl);
}

function updateUrlPreview() {
  if (!url) return;
  const rawUrl = url.value.trim();
  const fullUrl = buildFullUrl(rawUrl);
  if (fullUrlPreview) {
    fullUrlPreview.textContent = fullUrl || 'https://...';
  }
}

// ----------------------------------------------------
// 6. MySQL Connected Variables System
// ----------------------------------------------------
function replaceVariables(text) {
  if (typeof text !== 'string' || !text) return text;
  let result = text;
  for (const [key, value] of Object.entries(cachedVariables)) {
    result = result.split(`{{${key}}}`).join(value);
  }
  return result;
}

async function renderVariables() {
  const container = document.getElementById('variables-list');
  if (!container) return;
  const user = getCurrentUser();

  if (!user || !user.id) {
    container.innerHTML = '<p class="description">Please log in to view and manage your custom variables.</p>';
    return;
  }

  try {
    const res = await fetch(`/api/variables?userId=${user.id}`);
    if (res.ok) {
      cachedVariables = await res.json();
    }
  } catch (err) {
    console.error('Failed to fetch variables from MySQL:', err);
  }

  container.innerHTML = '';
  const entries = Object.entries(cachedVariables);
  if (entries.length === 0) {
    container.innerHTML = `<p class="description">No variables defined for <strong>${escapeHtml(user.username)}</strong>. Click "+ Add Variable" to create one.</p>`;
    return;
  }

  entries.forEach(([key, value]) => {
    const row = document.createElement('div');
    row.className = 'row';
    row.innerHTML = `
      <input type="text" class="input var-key" value="${escapeHtml(key)}" placeholder="Variable Name">
      <input type="text" class="input var-val" value="${escapeHtml(value)}" placeholder="Variable Value">
      <button type="button" class="button button-small button-primary" onclick="updateVariable(this)">Save</button>
      <button type="button" class="btn-remove" onclick="deleteVariable('${escapeHtml(key)}')">✕</button>
    `;
    container.appendChild(row);
  });

  updateUrlPreview();
}

async function addVariableRow() {
  if (!requireAuth('add variables')) return;
  const user = getCurrentUser();
  const keyName = 'newVar' + Date.now().toString().slice(-4);
  const defaultVal = 'https://...';

  try {
    await fetch('/api/variables', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id, key: keyName, value: defaultVal })
    });
    await renderVariables();
  } catch (err) {
    console.error('Error adding variable:', err);
  }
}

async function updateVariable(btn) {
  if (!requireAuth('update variables')) return;
  const user = getCurrentUser();
  const row = btn.parentElement;
  const k = row.querySelector('.var-key').value.trim();
  const v = row.querySelector('.var-val').value.trim();
  if (!k) return;

  try {
    await fetch('/api/variables', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id, key: k, value: v })
    });
    await renderVariables();
  } catch (err) {
    console.error('Error updating variable:', err);
  }
}

async function deleteVariable(key) {
  if (!requireAuth('delete variables')) return;
  const user = getCurrentUser();
  try {
    await fetch(`/api/variables?userId=${user.id}&key=${encodeURIComponent(key)}`, {
      method: 'DELETE'
    });
    await renderVariables();
  } catch (err) {
    console.error('Error deleting variable:', err);
  }
}

// ----------------------------------------------------
// 7. MySQL Connected Performance Tracker
// ----------------------------------------------------
async function renderPerformance() {
  const user = getCurrentUser();
  const logsContainer = document.getElementById('performance-logs');
  const statTotal = document.getElementById('stat-total');
  const statSuccess = document.getElementById('stat-success');
  const statFail = document.getElementById('stat-fail');
  const statAvg = document.getElementById('stat-avg');
  const statFast = document.getElementById('stat-fast');
  const statSlow = document.getElementById('stat-slow');

  if (!user || !user.id) {
    if (statTotal) statTotal.textContent = '0';
    if (statSuccess) statSuccess.textContent = '0';
    if (statFail) statFail.textContent = '0';
    if (statAvg) statAvg.textContent = '0 ms';
    if (statFast) statFast.textContent = '-';
    if (statSlow) statSlow.textContent = '-';
    if (logsContainer) {
      logsContainer.innerHTML = '<p class="description">Please log in to view detailed performance metrics.</p>';
    }
    return;
  }

  let perf = { total: 0, success: 0, fail: 0, times: [], logs: [] };

  try {
    const res = await fetch(`/api/performance?userId=${user.id}`);
    if (res.ok) {
      perf = await res.json();
    }
  } catch (err) {
    console.error('Failed to fetch performance data:', err);
  }

  if (statTotal) statTotal.textContent = perf.total;
  if (statSuccess) statSuccess.textContent = perf.success;
  if (statFail) statFail.textContent = perf.fail;

  if (perf.times && perf.times.length > 0) {
    const sum = perf.times.reduce((a, b) => a + b, 0);
    const avg = Math.round(sum / perf.times.length);
    if (statAvg) statAvg.textContent = avg + ' ms';
    if (statFast) statFast.textContent = Math.min(...perf.times) + ' ms';
    if (statSlow) statSlow.textContent = Math.max(...perf.times) + ' ms';
  } else {
    if (statAvg) statAvg.textContent = '0 ms';
    if (statFast) statFast.textContent = '-';
    if (statSlow) statSlow.textContent = '-';
  }

  if (logsContainer) {
    if (!perf.logs || perf.logs.length === 0) {
      logsContainer.innerHTML = `<p class="description">No performance records logged yet for <strong>${escapeHtml(user.username)}</strong>.</p>`;
      return;
    }

    let tableHtml = `
      <table class="table">
        <thead>
          <tr>
            <th>Method</th>
            <th>URL</th>
            <th>Status</th>
            <th>Latency</th>
            <th>Timestamp</th>
          </tr>
        </thead>
        <tbody>
    `;

    perf.logs.forEach(log => {
      tableHtml += `
        <tr>
          <td><strong>${escapeHtml(log.method)}</strong></td>
          <td><code>${escapeHtml(log.url)}</code></td>
          <td><span class="badge">${escapeHtml(log.status)}</span></td>
          <td><span class="time-badge">${log.latency} ms</span></td>
          <td>${escapeHtml(log.timestamp)}</td>
        </tr>
      `;
    });

    tableHtml += '</tbody></table>';
    logsContainer.innerHTML = tableHtml;
  }
}

async function recordPerformance(isSuccess, duration, reqMethod = 'GET', reqUrl = '', reqStatus = '200 OK') {
  const user = getCurrentUser();
  if (!user || !user.id) return;

  try {
    await fetch('/api/performance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: user.id,
        isSuccess,
        duration,
        reqMethod,
        reqUrl,
        reqStatus
      })
    });
    renderPerformance();
  } catch (err) {
    console.error('Error recording performance to MySQL:', err);
  }
}

async function clearPerformance() {
  if (!requireAuth('clear performance metrics')) return;
  const user = getCurrentUser();
  try {
    await fetch(`/api/performance?userId=${user.id}`, { method: 'DELETE' });
    renderPerformance();
  } catch (err) {
    console.error('Error clearing performance:', err);
  }
}

// ----------------------------------------------------
// 8. MySQL Connected Request History
// ----------------------------------------------------
async function renderHistory() {
  const container = document.getElementById('history-list');
  if (!container) return;
  const user = getCurrentUser();

  if (!user || !user.id) {
    container.innerHTML = '<p class="description">Please log in to view your request history.</p>';
    return;
  }

  let history = [];
  try {
    const res = await fetch(`/api/history?userId=${user.id}`);
    if (res.ok) {
      history = await res.json();
    }
  } catch (err) {
    console.error('Error fetching history from MySQL:', err);
  }

  if (history.length === 0) {
    container.innerHTML = `<p class="description">No requests logged yet for <strong>${escapeHtml(user.username)}</strong>.</p>`;
    return;
  }

  let tableHtml = `
    <table class="table">
      <thead>
        <tr>
          <th>Method</th>
          <th>URL</th>
          <th>Status</th>
          <th>Time</th>
          <th>Date</th>
        </tr>
      </thead>
      <tbody>
  `;

  history.forEach(item => {
    tableHtml += `
      <tr>
        <td><strong>${escapeHtml(item.method)}</strong></td>
        <td><code>${escapeHtml(item.url)}</code></td>
        <td>${escapeHtml(item.status)}</td>
        <td>${item.responseTime} ms</td>
        <td>${escapeHtml(item.date)}</td>
      </tr>
    `;
  });

  tableHtml += '</tbody></table>';
  container.innerHTML = tableHtml;
}

async function addHistory(item) {
  const user = getCurrentUser();
  if (!user || !user.id) return;

  try {
    await fetch('/api/history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: user.id,
        method: item.method,
        url: item.url,
        status: item.status,
        responseTime: item.responseTime
      })
    });
    renderHistory();
  } catch (err) {
    console.error('Error recording history to MySQL:', err);
  }
}

async function clearHistoryList() {
  if (!requireAuth('clear request history')) return;
  const user = getCurrentUser();
  try {
    await fetch(`/api/history?userId=${user.id}`, { method: 'DELETE' });
    renderHistory();
  } catch (err) {
    console.error('Error clearing history:', err);
  }
}

// ----------------------------------------------------
// 9. Response Tab Switching
// ----------------------------------------------------
function switchResponseTab(tabName) {
  document.getElementById('resp-btn-pretty').className =
    tabName === 'pretty' ? 'tab-button active' : 'tab-button';
  document.getElementById('resp-btn-raw').className =
    tabName === 'raw' ? 'tab-button active' : 'tab-button';
  document.getElementById('resp-btn-headers').className =
    tabName === 'headers' ? 'tab-button active' : 'tab-button';

  if (!latestResponse || !response) return;

  if (tabName === 'pretty') {
    if (typeof latestResponse.data === 'object' && latestResponse.data !== null) {
      response.textContent = JSON.stringify(latestResponse.data, null, 2);
    } else {
      response.textContent = latestResponse.raw || String(latestResponse.data);
    }
  } else if (tabName === 'raw') {
    response.textContent = latestResponse.raw || JSON.stringify(latestResponse.data);
  } else if (tabName === 'headers') {
    const lines = [];
    for (const [key, val] of Object.entries(latestResponse.headers || {})) {
      lines.push(`${key}: ${val}`);
    }
    response.textContent = lines.length > 0 ? lines.join('\n') : 'No response headers.';
  }
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ----------------------------------------------------
// 10. Main Send Request
// ----------------------------------------------------
async function sendRequest() {
  if (!requireAuth('send API requests')) {
    if (status) {
      status.textContent = 'Auth Required';
      status.className = 'status-badge status-4xx';
    }
    if (response) {
      response.textContent = 'Access Restricted: You have to login or signup before sending requests.\nClick the button above or use "Login / Signup" in the navigation bar.';
    }
    return;
  }

  const rawUrl = url.value.trim();
  const requestMethod = method.value;

  if (!rawUrl) {
    if (status) {
      status.textContent = '400 Error';
      status.className = 'status-badge status-4xx';
    }
    if (response) {
      response.textContent = 'Please enter a URL to test.';
    }
    return;
  }

  const fullUrl = buildFullUrl(rawUrl);

  const rawHeaders = getHeadersObject();
  const headers = {};
  for (const [k, v] of Object.entries(rawHeaders)) {
    headers[k] = replaceVariables(v);
  }

  let requestBody = null;
  if (requestMethod === 'POST' || requestMethod === 'PUT' || requestMethod === 'PATCH') {
    const rawBody = body.value.trim();
    if (rawBody) {
      const resolvedBody = replaceVariables(rawBody);
      try {
        requestBody = JSON.parse(resolvedBody);
      } catch (err) {
        if (status) {
          status.textContent = '400 Bad JSON';
          status.className = 'status-badge status-4xx';
        }
        if (response) {
          response.textContent = 'Error: The Request Body is not valid JSON.\n' + err.message;
        }
        switchRequestTab('body');
        return;
      }
    }
  }

  if (send) {
    send.disabled = true;
    send.textContent = 'Sending...';
  }
  if (status) {
    status.textContent = '...';
    status.className = 'status-badge status-empty';
  }
  if (responseTime) responseTime.textContent = '...';
  if (response) response.textContent = `Sending ${requestMethod} request to ${fullUrl}...`;

  const startTime = performance.now();

  try {
    const serverResponse = await fetch('/api/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        method: requestMethod,
        url: fullUrl,
        headers: headers,
        body: requestBody,
      }),
    });

    const endTime = performance.now();
    const duration = Math.round(endTime - startTime);

    const result = await serverResponse.json();
    latestResponse = result;

    const statusCode = result.status || serverResponse.status;
    const statusText = result.statusText || 'OK';

    if (status) {
      status.textContent = `${statusCode} ${statusText}`;
      if (statusCode >= 200 && statusCode < 300) {
        status.className = 'status-badge status-2xx';
      } else {
        status.className = 'status-badge status-4xx';
      }
    }

    if (statusCode >= 200 && statusCode < 300) {
      recordPerformance(true, duration, requestMethod, fullUrl, `${statusCode} ${statusText}`);
    } else {
      recordPerformance(false, duration, requestMethod, fullUrl, `${statusCode} ${statusText}`);
    }

    if (responseTime) responseTime.textContent = `${duration} ms`;
    switchResponseTab('pretty');

    addHistory({
      method: requestMethod,
      url: fullUrl,
      status: `${statusCode} ${statusText}`,
      responseTime: duration,
      date: new Date().toLocaleTimeString(),
    });

  } catch (error) {
    const endTime = performance.now();
    const duration = Math.round(endTime - startTime);

    if (status) {
      status.textContent = 'Error';
      status.className = 'status-badge status-5xx';
    }
    if (responseTime) responseTime.textContent = `${duration} ms`;
    if (response) response.textContent = `Request failed: ${error.message}`;

    recordPerformance(false, duration, requestMethod, fullUrl, 'Error: Failed to fetch');

    addHistory({
      method: requestMethod,
      url: fullUrl,
      status: 'Error',
      responseTime: duration,
      date: new Date().toLocaleTimeString(),
    });
  } finally {
    if (send) {
      send.disabled = false;
      send.textContent = 'Send';
    }
  }
}

function clearRequest() {
  if (url) url.value = 'https://jsonplaceholder.typicode.com/posts';
  if (method) method.value = 'GET';
  if (body) body.value = '';
  if (paramsContainer) paramsContainer.innerHTML = '';
  if (headersContainer) headersContainer.innerHTML = '';
  if (status) {
    status.textContent = '-';
    status.className = 'status-badge status-empty';
  }
  if (responseTime) responseTime.textContent = '-';
  if (response) response.textContent = 'Click "Send" to execute the request.';
  latestResponse = null;
  updateUrlPreview();
  switchRequestTab('params');
  switchResponseTab('pretty');
}

// ----------------------------------------------------
// 11. Login & Signup Modal Handling
// ----------------------------------------------------
function openAuthModal() {
  if (authModal) authModal.classList.add('active');
  switchAuthTab('login');
}

function closeAuthModal() {
  if (authModal) authModal.classList.remove('active');
  const lMsg = document.getElementById('login-msg');
  if (lMsg) lMsg.className = 'message';
  const sMsg = document.getElementById('signup-msg');
  if (sMsg) sMsg.className = 'message';
}

function switchAuthTab(tab) {
  const tabLogin = document.getElementById('auth-tab-login');
  const tabSignup = document.getElementById('auth-tab-signup');
  const formLogin = document.getElementById('form-login');
  const formSignup = document.getElementById('form-signup');

  if (tabLogin) tabLogin.className = tab === 'login' ? 'tab-button active' : 'tab-button';
  if (tabSignup) tabSignup.className = tab === 'signup' ? 'tab-button active' : 'tab-button';

  if (formLogin) formLogin.style.display = tab === 'login' ? 'flex' : 'none';
  if (formSignup) formSignup.style.display = tab === 'signup' ? 'flex' : 'none';
}

async function handleSignup(event) {
  event.preventDefault();

  const usernameInput = document.getElementById('signup-username').value.trim();
  const emailInput = document.getElementById('signup-email').value.trim();
  const passwordInput = document.getElementById('signup-password').value;
  const confirmPasswordInput = document.getElementById('signup-confirm-password').value;
  const msgEl = document.getElementById('signup-msg');

  if (!USERNAME_REGEX.test(usernameInput)) {
    msgEl.className = 'message message-error';
    msgEl.textContent = 'Username must be 3-20 characters and contain only letters, numbers, or underscore (_).';
    return;
  }

  if (!EMAIL_REGEX.test(emailInput)) {
    msgEl.className = 'message message-error';
    msgEl.textContent = 'Please enter a valid email address.';
    return;
  }

  if (!PASSWORD_REGEX.test(passwordInput)) {
    msgEl.className = 'message message-error';
    msgEl.textContent = 'Password must be at least 8 characters, include an uppercase letter, lowercase letter, number, and special character (@$!%*?&).';
    return;
  }

  if (passwordInput !== confirmPasswordInput) {
    msgEl.className = 'message message-error';
    msgEl.textContent = 'Confirm password does not match password.';
    return;
  }

  try {
    msgEl.className = 'message';
    msgEl.textContent = 'Creating account in MySQL...';

    const serverResponse = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: usernameInput,
        email: emailInput,
        password: passwordInput
      })
    });

    const result = await serverResponse.json();

    if (!serverResponse.ok) {
      msgEl.className = 'message message-error';
      msgEl.textContent = result.message || 'Signup failed.';
      return;
    }

    setCurrentUser(result.user);

    msgEl.className = 'message message-success';
    msgEl.textContent = 'Account created successfully! Logging you in...';

    const banner = document.getElementById('login-warning-banner');
    if (banner) banner.remove();

    setTimeout(() => {
      closeAuthModal();
    }, 1000);

  } catch (error) {
    console.error('Signup error:', error);
    msgEl.className = 'message message-error';
    msgEl.textContent = 'Cannot connect to the server. Make sure the backend is running.';
  }
}

async function handleLogin(event) {
  event.preventDefault();

  const emailInput = document.getElementById('login-email').value.trim();
  const passwordInput = document.getElementById('login-password').value;
  const msgEl = document.getElementById('login-msg');

  if (!EMAIL_REGEX.test(emailInput)) {
    msgEl.className = 'message message-error';
    msgEl.textContent = 'Please enter a valid email address format.';
    return;
  }

  try {
    msgEl.className = 'message';
    msgEl.textContent = 'Logging in...';

    const serverResponse = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: emailInput,
        password: passwordInput
      })
    });

    const result = await serverResponse.json();

    if (!serverResponse.ok) {
      msgEl.className = 'message message-error';
      msgEl.textContent = result.message || 'Invalid email or password.';
      return;
    }

    setCurrentUser(result.user);

    msgEl.className = 'message message-success';
    msgEl.textContent = `Welcome back, ${result.user.username}!`;

    const banner = document.getElementById('login-warning-banner');
    if (banner) banner.remove();

    setTimeout(() => {
      closeAuthModal();
    }, 800);

  } catch (error) {
    console.error('Login error:', error);
    msgEl.className = 'message message-error';
    msgEl.textContent = 'Cannot connect to the backend server.';
  }
}

function handleLogout() {
  setCurrentUser(null);
  switchView('dashboard');
  showLoginBanner('You have been logged out. Please log in to view your requests.');
}

// ----------------------------------------------------
// 12. Account Settings
// ----------------------------------------------------
async function handleChangeUsername(event) {
  event.preventDefault();
  if (!requireAuth('change username')) return;

  const newUsername = document.getElementById('new-username').value.trim();
  const msgEl = document.getElementById('username-msg');
  const currentUser = getCurrentUser();

  if (!USERNAME_REGEX.test(newUsername)) {
    msgEl.className = 'message message-error';
    msgEl.textContent = 'New username must be 3-20 characters (letters, numbers, _ only).';
    return;
  }

  if (newUsername.toLowerCase() === currentUser.username.toLowerCase()) {
    msgEl.className = 'message message-error';
    msgEl.textContent = 'New username must be different from current username.';
    return;
  }

  try {
    const res = await fetch('/api/auth/change-username', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: currentUser.id, newUsername })
    });

    const result = await res.json();
    if (!res.ok) {
      msgEl.className = 'message message-error';
      msgEl.textContent = result.message || 'Failed to update username.';
      return;
    }

    currentUser.username = newUsername;
    setCurrentUser(currentUser);

    msgEl.className = 'message message-success';
    msgEl.textContent = 'Username successfully updated in MySQL!';
    document.getElementById('new-username').value = '';
  } catch (err) {
    console.error('Error changing username:', err);
    msgEl.className = 'message message-error';
    msgEl.textContent = 'Server error changing username.';
  }
}

async function handleChangePassword(event) {
  event.preventDefault();
  if (!requireAuth('change password')) return;

  const currentPassword = document.getElementById('current-password').value;
  const newPassword = document.getElementById('new-password').value;
  const confirmNewPassword = document.getElementById('confirm-new-password').value;
  const msgEl = document.getElementById('password-msg');
  const currentUser = getCurrentUser();

  if (!PASSWORD_REGEX.test(newPassword)) {
    msgEl.className = 'message message-error';
    msgEl.textContent = 'New password must be at least 8 characters, with uppercase, lowercase, number, and special character.';
    return;
  }

  if (newPassword !== confirmNewPassword) {
    msgEl.className = 'message message-error';
    msgEl.textContent = 'Confirm new password does not match new password.';
    return;
  }

  try {
    const res = await fetch('/api/auth/change-password', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: currentUser.id,
        currentPassword,
        newPassword
      })
    });

    const result = await res.json();
    if (!res.ok) {
      msgEl.className = 'message message-error';
      msgEl.textContent = result.message || 'Failed to update password.';
      return;
    }

    msgEl.className = 'message message-success';
    msgEl.textContent = 'Password successfully changed in MySQL!';
    document.getElementById('current-password').value = '';
    document.getElementById('new-password').value = '';
    document.getElementById('confirm-new-password').value = '';
  } catch (err) {
    console.error('Error changing password:', err);
    msgEl.className = 'message message-error';
    msgEl.textContent = 'Server error changing password.';
  }
}

// Attach functions to window for inline HTML onclick attributes
window.switchView = switchView;
window.openSettingsModal = openSettingsModal;
window.closeSettingsModal = closeSettingsModal;
window.openAuthModal = openAuthModal;
window.closeAuthModal = closeAuthModal;
window.switchAuthTab = switchAuthTab;
window.handleSignup = handleSignup;
window.handleLogin = handleLogin;
window.handleLogout = handleLogout;
window.handleChangeUsername = handleChangeUsername;
window.handleChangePassword = handleChangePassword;
window.switchRequestTab = switchRequestTab;
window.switchResponseTab = switchResponseTab;
window.addParamRow = addParamRow;
window.addHeaderRow = addHeaderRow;
window.renderVariables = renderVariables;
window.addVariableRow = addVariableRow;
window.updateVariable = updateVariable;
window.deleteVariable = deleteVariable;
window.renderPerformance = renderPerformance;
window.clearPerformance = clearPerformance;
window.renderHistory = renderHistory;
window.clearHistoryList = clearHistoryList;

// ----------------------------------------------------
// 13. Initialize on page load
// ----------------------------------------------------
updateAuthNavButton();
renderPerformance();
renderVariables();
renderHistory();
syncParamsFromUrl();
updateUrlPreview();
