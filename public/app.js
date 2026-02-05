const API_BASE = '/api';

// State
let rules = [];
let currentPrice = null;
let currentType = 'threshold_above';

// DOM Elements
const currentPriceEl = document.getElementById('current-price');
const priceChangeEl = document.getElementById('price-change');
const connectionStatus = document.getElementById('connection-status');
const rulesListEl = document.getElementById('rules-list');
const historyListEl = document.getElementById('history-list');
const ruleCountEl = document.getElementById('rule-count');
const ruleForm = document.getElementById('rule-form');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  setupTypeSelector();
  setupForm();
  setupModeToggle();
  setupSliders();
  loadRules();
  loadHistory();
  connectWebSocket();
});

// Type Selector
function setupTypeSelector() {
  document.querySelectorAll('.type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentType = btn.dataset.type;
      updateFormFields(currentType);
    });
  });
}

function updateFormFields(type) {
  const isVolatility = type === 'volatility';
  const isFibonacci = type === 'fibonacci';
  const isRange = type === 'range';
  const isThreshold = type === 'threshold_above' || type === 'threshold_below';

  document.getElementById('threshold-fields').style.display = isThreshold ? 'block' : 'none';
  document.getElementById('volatility-fields').style.display = isVolatility ? 'block' : 'none';
  document.getElementById('fibonacci-fields').style.display = isFibonacci ? 'block' : 'none';
  document.getElementById('range-fields').style.display = isRange ? 'block' : 'none';

  // Update visuals
  if (isThreshold) updateThresholdVisual();
  if (isFibonacci) updateFibonacciVisual();
  if (isRange) updateRangeVisual();
  if (isVolatility) updateVolatilityVisual();
}

// Mode Toggle for Range
function setupModeToggle() {
  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('rule-range-mode').value = btn.dataset.mode;
      document.getElementById('confirm-percent-group').style.display =
        btn.dataset.mode === 'breakout' ? 'block' : 'none';
    });
  });
}

// Sliders
function setupSliders() {
  const cooldownSlider = document.getElementById('rule-cooldown-slider');
  const cooldownDisplay = document.getElementById('cooldown-display');
  const cooldownInput = document.getElementById('rule-cooldown');

  cooldownSlider.addEventListener('input', () => {
    cooldownDisplay.textContent = cooldownSlider.value;
    cooldownInput.value = cooldownSlider.value;
  });

  // Volatility inputs
  const windowInput = document.getElementById('rule-window');
  const percentInput = document.getElementById('rule-percent');
  const windowDisplay = document.getElementById('window-display');
  const volatilityDisplay = document.getElementById('volatility-display');

  windowInput?.addEventListener('input', () => {
    if (windowDisplay) windowDisplay.textContent = windowInput.value;
    updateVolatilityVisual();
  });

  percentInput?.addEventListener('input', () => {
    if (volatilityDisplay) volatilityDisplay.textContent = parseFloat(percentInput.value).toFixed(1);
    updateVolatilityVisual();
  });

  // Threshold input
  document.getElementById('rule-threshold')?.addEventListener('input', updateThresholdVisual);

  // Fibonacci inputs
  document.getElementById('rule-start-price')?.addEventListener('input', updateFibonacciVisual);
  document.getElementById('rule-end-price')?.addEventListener('input', updateFibonacciVisual);

  // Range inputs
  document.getElementById('rule-upper-price')?.addEventListener('input', updateRangeVisual);
  document.getElementById('rule-lower-price')?.addEventListener('input', updateRangeVisual);
}

// Visual Updates
function updateThresholdVisual() {
  if (!currentPrice) return;
  const target = parseFloat(document.getElementById('rule-threshold')?.value) || 0;
  const current = currentPrice;

  document.getElementById('threshold-current-label').textContent = current.toLocaleString();
  document.getElementById('threshold-target-label').textContent = target ? target.toLocaleString() : '--';

  if (target > 0) {
    const min = Math.min(current, target) * 0.995;
    const max = Math.max(current, target) * 1.005;
    const range = max - min;

    const currentPos = ((current - min) / range) * 100;
    const targetPos = ((target - min) / range) * 100;

    document.getElementById('threshold-current-marker').style.left = `${currentPos}%`;
    document.getElementById('threshold-target-marker').style.left = `${targetPos}%`;
  }
}

function updateVolatilityVisual() {
  const percent = parseFloat(document.getElementById('rule-percent')?.value) || 1;
  const zone = document.getElementById('volatility-zone');
  if (zone) {
    zone.style.width = `${Math.min(percent * 20, 100)}%`;
  }
}

function updateFibonacciVisual() {
  const startPrice = parseFloat(document.getElementById('rule-start-price')?.value) || 0;
  const endPrice = parseFloat(document.getElementById('rule-end-price')?.value) || 0;

  if (startPrice > 0 && endPrice > 0) {
    const range = endPrice - startPrice;
    const levels = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
    const ids = ['fib-price-0', 'fib-price-236', 'fib-price-382', 'fib-price-50', 'fib-price-618', 'fib-price-786', 'fib-price-100'];

    levels.forEach((level, i) => {
      const price = startPrice + range * level;
      const el = document.getElementById(ids[i]);
      if (el) el.textContent = price.toLocaleString(undefined, { maximumFractionDigits: 0 });
    });

    // Update current price marker
    if (currentPrice) {
      const pos = ((currentPrice - startPrice) / range) * 100;
      const marker = document.getElementById('fib-current-marker');
      if (marker) {
        marker.style.top = `${Math.max(5, Math.min(90, pos * 0.85 + 5))}%`;
      }
    }
  }
}

function updateRangeVisual() {
  const upper = parseFloat(document.getElementById('rule-upper-price')?.value) || 0;
  const lower = parseFloat(document.getElementById('rule-lower-price')?.value) || 0;

  document.getElementById('range-upper-price').textContent = upper ? upper.toLocaleString() : '--';
  document.getElementById('range-lower-price').textContent = lower ? lower.toLocaleString() : '--';

  if (upper > 0 && lower > 0) {
    const width = ((upper - lower) / lower * 100).toFixed(2);
    document.getElementById('range-width-display').textContent = width;

    // Update current price marker
    if (currentPrice) {
      const range = upper - lower;
      const pos = ((upper - currentPrice) / range) * 100;
      const marker = document.getElementById('range-current-marker');
      if (marker) {
        marker.style.top = `${Math.max(10, Math.min(90, 34 + pos * 0.32))}%`;
      }
      document.getElementById('range-current-price').textContent = currentPrice.toLocaleString();
    }
  }
}

// Form Setup
function setupForm() {
  const cancelBtn = document.getElementById('cancel-btn');
  const submitBtn = document.getElementById('submit-btn');

  cancelBtn.addEventListener('click', () => {
    resetForm();
  });

  ruleForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const editingId = document.getElementById('rule-id').value;
    const data = {
      name: document.getElementById('rule-name').value,
      type: currentType,
      cooldown_minutes: parseInt(document.getElementById('rule-cooldown').value),
      is_one_time: document.getElementById('rule-onetime').checked,
      with_volume: document.getElementById('rule-with-volume').checked,
    };

    if (currentType === 'volatility') {
      data.volatility_window = parseInt(document.getElementById('rule-window').value);
      data.volatility_percent = parseFloat(document.getElementById('rule-percent').value);
    } else if (currentType === 'fibonacci') {
      data.start_price = parseFloat(document.getElementById('rule-start-price').value);
      data.end_price = parseFloat(document.getElementById('rule-end-price').value);
      data.alert_distance = parseFloat(document.getElementById('rule-alert-distance').value) || 0;
    } else if (currentType === 'range') {
      data.upper_price = parseFloat(document.getElementById('rule-upper-price').value);
      data.lower_price = parseFloat(document.getElementById('rule-lower-price').value);
      data.range_mode = document.getElementById('rule-range-mode').value;
      data.confirm_percent = parseFloat(document.getElementById('rule-confirm-percent').value);
      data.alert_distance = parseFloat(document.getElementById('rule-alert-distance').value) || 0;
    } else {
      data.threshold = parseFloat(document.getElementById('rule-threshold').value);
      data.alert_distance = parseFloat(document.getElementById('rule-alert-distance').value) || 0;
    }

    try {
      if (editingId) {
        await fetch(`${API_BASE}/rules/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
      } else {
        await fetch(`${API_BASE}/rules`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
      }
      resetForm();
      loadRules();
    } catch (err) {
      alert('保存失败: ' + err.message);
    }
  });
}

function resetForm() {
  ruleForm.reset();
  document.getElementById('rule-id').value = '';
  document.getElementById('rule-cooldown-slider').value = 5;
  document.getElementById('cooldown-display').textContent = '5';
  document.getElementById('rule-cooldown').value = 5;
  document.getElementById('rule-alert-distance').value = 0;
  document.getElementById('cancel-btn').style.display = 'none';
  document.querySelector('.btn-text').textContent = '创建规则';

  // Reset type selector
  document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
  document.querySelector('.type-btn[data-type="threshold_above"]').classList.add('active');
  currentType = 'threshold_above';
  updateFormFields('threshold_above');
}

// Load Rules
async function loadRules() {
  try {
    const res = await fetch(`${API_BASE}/rules`);
    rules = await res.json();
    ruleCountEl.textContent = rules.length;
    renderRules();
  } catch (err) {
    console.error('Failed to load rules:', err);
  }
}

function renderRules() {
  if (rules.length === 0) {
    rulesListEl.innerHTML = `
      <div class="empty-state">
        <svg class="empty-icon" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.5">
          <circle cx="24" cy="24" r="20"/>
          <path d="M24 14v10l7 7"/>
        </svg>
        <p>暂无规则</p>
        <span>在左侧创建你的第一个提醒规则</span>
      </div>
    `;
    return;
  }

  const typeLabels = {
    threshold_above: '突破',
    threshold_below: '跌破',
    volatility: '波动',
    fibonacci: '斐波那契',
    range: '区间',
  };

  const typeIcons = {
    threshold_above: '<polyline points="22,7 13.5,15.5 8.5,10.5 2,17"/><polyline points="16,7 22,7 22,13"/>',
    threshold_below: '<polyline points="22,17 13.5,8.5 8.5,13.5 2,7"/><polyline points="16,17 22,17 22,11"/>',
    volatility: '<polyline points="2,12 6,8 10,16 14,6 18,14 22,10"/>',
    fibonacci: '<rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="12" x2="21" y2="12"/>',
    range: '<rect x="3" y="6" width="18" height="12" rx="1"/><line x1="3" y1="12" x2="21" y2="12" stroke-dasharray="3,3"/>',
  };

  rulesListEl.innerHTML = rules.map(rule => {
    let conditionText = '';
    let distanceHtml = '';

    if (rule.type === 'volatility') {
      conditionText = `±${rule.volatility_percent}% / ${rule.volatility_window}分钟`;
    } else if (rule.type === 'fibonacci') {
      conditionText = `${rule.start_price?.toLocaleString()} → ${rule.end_price?.toLocaleString()}`;
      // Calculate nearest fib level distance
      if (currentPrice && rule.start_price && rule.end_price) {
        const fibLevels = [0.236, 0.382, 0.5, 0.618, 0.786];
        const range = rule.end_price - rule.start_price;
        let nearestDist = Infinity;
        let nearestLevel = 0;
        let nearestPrice = 0;
        fibLevels.forEach(level => {
          const levelPrice = rule.end_price - range * level;
          const dist = Math.abs(currentPrice - levelPrice);
          if (dist < nearestDist) {
            nearestDist = dist;
            nearestLevel = level;
            nearestPrice = levelPrice;
          }
        });
        const distPercent = ((nearestPrice - currentPrice) / currentPrice * 100);
        const distDir = distPercent > 0 ? '↑' : '↓';
        distanceHtml = `<div class="rule-distance">
          <span class="distance-label">距 ${(nearestLevel * 100).toFixed(1)}%位</span>
          <span class="distance-value ${distPercent > 0 ? 'up' : 'down'}">${distDir} ${Math.abs(distPercent).toFixed(2)}%</span>
          <span class="distance-price">${nearestPrice.toLocaleString(undefined, {maximumFractionDigits: 0})}</span>
        </div>`;
      }
    } else if (rule.type === 'range') {
      const modeText = rule.range_mode === 'breakout' ? '突破' : '触碰';
      conditionText = `${rule.lower_price?.toLocaleString()} - ${rule.upper_price?.toLocaleString()} (${modeText})`;
      // Calculate distance to nearest boundary
      if (currentPrice && rule.upper_price && rule.lower_price) {
        const distToUpper = ((rule.upper_price - currentPrice) / currentPrice * 100);
        const distToLower = ((currentPrice - rule.lower_price) / currentPrice * 100);
        const rangeWidth = ((rule.upper_price - rule.lower_price) / rule.lower_price * 100).toFixed(1);
        distanceHtml = `<div class="rule-distance range-distance">
          <span class="distance-item up">
            <span class="distance-label">距上轨</span>
            <span class="distance-value">${distToUpper > 0 ? '↑' : '↓'} ${Math.abs(distToUpper).toFixed(2)}%</span>
          </span>
          <span class="distance-item down">
            <span class="distance-label">距下轨</span>
            <span class="distance-value">${distToLower > 0 ? '↓' : '↑'} ${Math.abs(distToLower).toFixed(2)}%</span>
          </span>
          <span class="distance-item width">
            <span class="distance-label">区间</span>
            <span class="distance-value">${rangeWidth}%</span>
          </span>
        </div>`;
      }
    } else {
      // threshold_above or threshold_below
      conditionText = `${rule.threshold?.toLocaleString()} USDT`;
      if (currentPrice && rule.threshold) {
        const distPercent = ((rule.threshold - currentPrice) / currentPrice * 100);
        const distDir = distPercent > 0 ? '↑' : '↓';
        const distClass = (rule.type === 'threshold_above' && distPercent > 0) ||
                          (rule.type === 'threshold_below' && distPercent < 0) ? 'pending' : 'reached';
        distanceHtml = `<div class="rule-distance">
          <span class="distance-label">距目标</span>
          <span class="distance-value ${distClass}">${distDir} ${Math.abs(distPercent).toFixed(2)}%</span>
          <span class="distance-abs">${Math.abs(rule.threshold - currentPrice).toLocaleString(undefined, {maximumFractionDigits: 0})} USDT</span>
        </div>`;
      }
    }

    const volumeTag = rule.with_volume ? `
      <span class="meta-tag volume">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="4" y="14" width="4" height="6"/><rect x="10" y="10" width="4" height="10"/><rect x="16" y="6" width="4" height="14"/>
        </svg>
        带量
      </span>
    ` : '';

    const onetimeTag = rule.is_one_time ? `
      <span class="meta-tag onetime">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
        </svg>
        一次性
      </span>
    ` : '';

    return `
      <div class="rule-card">
        <div class="rule-card-header">
          <span class="rule-name">${rule.name}</span>
          <span class="rule-type-badge ${rule.type}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${typeIcons[rule.type]}</svg>
            ${typeLabels[rule.type]}
          </span>
        </div>
        <div class="rule-condition">
          <span class="condition-value">${conditionText}</span>
          <span class="rule-status ${rule.status}">${rule.status === 'active' ? '运行中' : '已暂停'}</span>
        </div>
        ${distanceHtml}
        <div class="rule-meta">
          <span class="meta-tag">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
            </svg>
            ${rule.cooldown_minutes}分钟冷却
          </span>
          ${volumeTag}
          ${onetimeTag}
        </div>
        <div class="rule-actions">
          <button class="rule-btn" onclick="toggleRule('${rule.id}')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              ${rule.status === 'active' ? '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>' : '<polygon points="5,3 19,12 5,21"/>'}
            </svg>
            ${rule.status === 'active' ? '暂停' : '启用'}
          </button>
          <button class="rule-btn" onclick="editRule('${rule.id}')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
            编辑
          </button>
          <button class="rule-btn delete" onclick="deleteRule('${rule.id}')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            </svg>
            删除
          </button>
        </div>
      </div>
    `;
  }).join('');
}

// Rule Actions
async function toggleRule(id) {
  try {
    await fetch(`${API_BASE}/rules/${id}/toggle`, { method: 'POST' });
    loadRules();
  } catch (err) {
    alert('操作失败: ' + err.message);
  }
}

function editRule(id) {
  const rule = rules.find(r => r.id === id);
  if (!rule) return;

  document.getElementById('rule-id').value = rule.id;
  document.getElementById('rule-name').value = rule.name;

  // Set type
  document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
  document.querySelector(`.type-btn[data-type="${rule.type}"]`)?.classList.add('active');
  currentType = rule.type;

  // Set values based on type
  if (rule.type === 'volatility') {
    document.getElementById('rule-window').value = rule.volatility_window || 5;
    document.getElementById('rule-percent').value = rule.volatility_percent || 1;
  } else if (rule.type === 'fibonacci') {
    document.getElementById('rule-start-price').value = rule.start_price || '';
    document.getElementById('rule-end-price').value = rule.end_price || '';
    document.getElementById('rule-alert-distance').value = rule.alert_distance || 0;
  } else if (rule.type === 'range') {
    document.getElementById('rule-upper-price').value = rule.upper_price || '';
    document.getElementById('rule-lower-price').value = rule.lower_price || '';
    document.getElementById('rule-range-mode').value = rule.range_mode || 'touch';
    document.getElementById('rule-confirm-percent').value = rule.confirm_percent || 0.3;
    document.getElementById('rule-alert-distance').value = rule.alert_distance || 0;
    // Update mode buttons
    document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
    document.querySelector(`.mode-btn[data-mode="${rule.range_mode || 'touch'}"]`)?.classList.add('active');
    document.getElementById('confirm-percent-group').style.display =
      rule.range_mode === 'breakout' ? 'block' : 'none';
  } else {
    document.getElementById('rule-threshold').value = rule.threshold || '';
    document.getElementById('rule-alert-distance').value = rule.alert_distance || 0;
  }

  // Common fields
  document.getElementById('rule-cooldown-slider').value = rule.cooldown_minutes;
  document.getElementById('cooldown-display').textContent = rule.cooldown_minutes;
  document.getElementById('rule-cooldown').value = rule.cooldown_minutes;
  document.getElementById('rule-onetime').checked = rule.is_one_time === 1;
  document.getElementById('rule-with-volume').checked = rule.with_volume === 1;

  // Update UI
  document.getElementById('cancel-btn').style.display = 'block';
  document.querySelector('.btn-text').textContent = '保存修改';
  updateFormFields(rule.type);

  // Scroll to form
  document.querySelector('.panel-creator').scrollTo({ top: 0, behavior: 'smooth' });
}

async function deleteRule(id) {
  if (!confirm('确定要删除这条规则吗？')) return;
  try {
    await fetch(`${API_BASE}/rules/${id}`, { method: 'DELETE' });
    loadRules();
  } catch (err) {
    alert('删除失败: ' + err.message);
  }
}

// Load History
async function loadHistory() {
  try {
    const res = await fetch(`${API_BASE}/alerts?limit=50`);
    const history = await res.json();
    renderHistory(history);
  } catch (err) {
    console.error('Failed to load history:', err);
  }
}

function renderHistory(history) {
  if (history.length === 0) {
    historyListEl.innerHTML = `
      <div class="empty-state">
        <svg class="empty-icon" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.5">
          <rect x="8" y="8" width="32" height="32" rx="4"/>
          <line x1="16" y1="18" x2="32" y2="18"/>
          <line x1="16" y1="26" x2="28" y2="26"/>
          <line x1="16" y1="34" x2="24" y2="34"/>
        </svg>
        <p>暂无记录</p>
      </div>
    `;
    return;
  }

  historyListEl.innerHTML = history.map(item => {
    const time = new Date(item.triggered_at).toLocaleString('zh-CN', {
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    return `
      <div class="history-card">
        <div class="history-info">
          <div class="history-name">${item.rule_name}</div>
          <div class="history-message">${item.message.split('\n')[0]}</div>
        </div>
        <div class="history-right">
          <div class="history-price">${item.current_price.toLocaleString()}</div>
          <div class="history-time">${time}</div>
        </div>
      </div>
    `;
  }).join('');
}

// WebSocket Connection
function connectWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const ws = new WebSocket(`${protocol}//${window.location.host}`);

  ws.onopen = () => {
    connectionStatus.classList.add('connected');
    connectionStatus.classList.remove('disconnected');
    connectionStatus.querySelector('.status-text').textContent = '已连接';
  };

  ws.onclose = () => {
    connectionStatus.classList.remove('connected');
    connectionStatus.classList.add('disconnected');
    connectionStatus.querySelector('.status-text').textContent = '已断开';
    // Reconnect after 3 seconds
    setTimeout(connectWebSocket, 3000);
  };

  ws.onerror = () => {
    connectionStatus.classList.remove('connected');
    connectionStatus.classList.add('disconnected');
  };

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);

      if (data.type === 'price') {
        updatePrice(data.price, data.change24h);
      } else if (data.type === 'alert') {
        loadHistory();
        showNotification(data);
      }
    } catch (err) {
      console.error('WebSocket message error:', err);
    }
  };
}

function updatePrice(price, change24h) {
  currentPrice = price;
  currentPriceEl.textContent = price.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

  if (change24h !== undefined) {
    const changeEl = priceChangeEl;
    const isUp = change24h >= 0;
    changeEl.className = `ticker-change ${isUp ? 'up' : 'down'}`;
    changeEl.querySelector('.change-value').textContent = `${isUp ? '+' : ''}${change24h.toFixed(2)}%`;
  }

  // Update visuals
  updateThresholdVisual();
  updateFibonacciVisual();
  updateRangeVisual();

  // Re-render rules to update distance display
  if (rules.length > 0) {
    renderRules();
  }
}

function showNotification(data) {
  if (Notification.permission === 'granted') {
    new Notification('BTC Alert', {
      body: data.message,
      icon: '/favicon.ico'
    });
  }
}

// Request notification permission
if ('Notification' in window && Notification.permission === 'default') {
  Notification.requestPermission();
}
