const API_BASE = '/api';

// State
let rules = [];
let editingRuleId = null;

// DOM Elements
const currentPriceEl = document.getElementById('current-price');
const rulesListEl = document.getElementById('rules-list');
const historyListEl = document.getElementById('history-list');
const ruleModal = document.getElementById('rule-modal');
const ruleForm = document.getElementById('rule-form');
const modalTitle = document.getElementById('modal-title');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  setupTabs();
  setupModal();
  setupForm();
  loadRules();
  loadHistory();
  startPricePolling();
});

// Tabs
function setupTabs() {
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(`${tab.dataset.tab}-section`).classList.add('active');
    });
  });
}

// Modal
function setupModal() {
  document.getElementById('add-rule-btn').addEventListener('click', () => openModal());
  document.querySelector('.close-btn').addEventListener('click', () => closeModal());
  document.getElementById('cancel-btn').addEventListener('click', () => closeModal());
  ruleModal.addEventListener('click', (e) => {
    if (e.target === ruleModal) closeModal();
  });

  document.getElementById('rule-type').addEventListener('change', (e) => {
    updateFormFields(e.target.value);
  });

  document.getElementById('rule-range-mode').addEventListener('change', (e) => {
    document.getElementById('confirm-percent-group').style.display =
      e.target.value === 'breakout' ? 'block' : 'none';
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
}

function openModal(rule = null) {
  editingRuleId = rule?.id || null;
  modalTitle.textContent = rule ? '编辑规则' : '添加规则';

  if (rule) {
    document.getElementById('rule-id').value = rule.id;
    document.getElementById('rule-name').value = rule.name;
    document.getElementById('rule-type').value = rule.type;
    document.getElementById('rule-threshold').value = rule.threshold || '';
    document.getElementById('rule-window').value = rule.volatility_window || 5;
    document.getElementById('rule-percent').value = rule.volatility_percent || 1;
    document.getElementById('rule-cooldown').value = rule.cooldown_minutes;
    document.getElementById('rule-onetime').checked = rule.is_one_time === 1;
    // Fibonacci fields
    document.getElementById('rule-start-price').value = rule.start_price || '';
    document.getElementById('rule-end-price').value = rule.end_price || '';
    // Range fields
    document.getElementById('rule-upper-price').value = rule.upper_price || '';
    document.getElementById('rule-lower-price').value = rule.lower_price || '';
    document.getElementById('rule-range-mode').value = rule.range_mode || 'touch';
    document.getElementById('rule-confirm-percent').value = rule.confirm_percent || 0.3;
    // Volume
    document.getElementById('rule-with-volume').checked = rule.with_volume === 1;
  } else {
    ruleForm.reset();
    document.getElementById('rule-cooldown').value = 5;
    document.getElementById('rule-window').value = 5;
    document.getElementById('rule-percent').value = 1;
    document.getElementById('rule-confirm-percent').value = 0.3;
  }

  updateFormFields(document.getElementById('rule-type').value);
  document.getElementById('confirm-percent-group').style.display =
    document.getElementById('rule-range-mode').value === 'breakout' ? 'block' : 'none';

  ruleModal.classList.add('show');
}

function closeModal() {
  ruleModal.classList.remove('show');
  editingRuleId = null;
}

// Form
function setupForm() {
  ruleForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const type = document.getElementById('rule-type').value;
    const data = {
      name: document.getElementById('rule-name').value,
      type,
      cooldown_minutes: parseInt(document.getElementById('rule-cooldown').value),
      is_one_time: document.getElementById('rule-onetime').checked,
      with_volume: document.getElementById('rule-with-volume').checked,
    };

    if (type === 'volatility') {
      data.volatility_window = parseInt(document.getElementById('rule-window').value);
      data.volatility_percent = parseFloat(document.getElementById('rule-percent').value);
    } else if (type === 'fibonacci') {
      data.start_price = parseFloat(document.getElementById('rule-start-price').value);
      data.end_price = parseFloat(document.getElementById('rule-end-price').value);
    } else if (type === 'range') {
      data.upper_price = parseFloat(document.getElementById('rule-upper-price').value);
      data.lower_price = parseFloat(document.getElementById('rule-lower-price').value);
      data.range_mode = document.getElementById('rule-range-mode').value;
      data.confirm_percent = parseFloat(document.getElementById('rule-confirm-percent').value);
    } else {
      data.threshold = parseFloat(document.getElementById('rule-threshold').value);
    }

    try {
      if (editingRuleId) {
        await fetch(`${API_BASE}/rules/${editingRuleId}`, {
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
      closeModal();
      loadRules();
    } catch (err) {
      alert('保存失败: ' + err.message);
    }
  });
}

// Load Rules
async function loadRules() {
  try {
    const res = await fetch(`${API_BASE}/rules`);
    rules = await res.json();
    renderRules();
  } catch (err) {
    console.error('Failed to load rules:', err);
  }
}

function renderRules() {
  if (rules.length === 0) {
    rulesListEl.innerHTML = '<div class="empty-state">暂无规则，点击上方按钮添加</div>';
    return;
  }

  rulesListEl.innerHTML = rules.map(rule => {
    const typeLabels = {
      threshold_above: '价格突破',
      threshold_below: '价格跌破',
      volatility: '波动异常',
      fibonacci: '斐波那契',
      range: '震荡区间',
    };

    let conditionText = '';
    if (rule.type === 'volatility') {
      conditionText = `${rule.volatility_window}分钟内波动 ${rule.volatility_percent}%`;
    } else if (rule.type === 'fibonacci') {
      conditionText = `${rule.start_price} → ${rule.end_price}`;
    } else if (rule.type === 'range') {
      const modeText = rule.range_mode === 'breakout' ? '突破' : '触碰';
      conditionText = `${rule.lower_price} - ${rule.upper_price} (${modeText})`;
    } else {
      conditionText = `${rule.threshold} USDT`;
    }

    const volumeTag = rule.with_volume ? '<span class="tag volume-tag">带量</span>' : '';

    return `
      <div class="rule-card">
        <div class="rule-card-header">
          <span class="rule-name">${rule.name}</span>
          <span class="rule-status ${rule.status}">${rule.status === 'active' ? '运行中' : '已暂停'}</span>
        </div>
        <div class="rule-details">
          <div class="rule-detail"><strong>类型:</strong> ${typeLabels[rule.type]} ${volumeTag}</div>
          <div class="rule-detail"><strong>条件:</strong> ${conditionText}</div>
          <div class="rule-detail"><strong>冷却:</strong> ${rule.cooldown_minutes}分钟</div>
          ${rule.is_one_time ? '<div class="rule-detail"><strong>一次性</strong></div>' : ''}
        </div>
        <div class="rule-actions">
          <button class="btn btn-secondary btn-sm" onclick="toggleRule('${rule.id}')">${rule.status === 'active' ? '暂停' : '启用'}</button>
          <button class="btn btn-secondary btn-sm" onclick="editRule('${rule.id}')">编辑</button>
          <button class="btn btn-danger btn-sm" onclick="deleteRule('${rule.id}')">删除</button>
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
  if (rule) openModal(rule);
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
    historyListEl.innerHTML = '<div class="empty-state">暂无提醒记录</div>';
    return;
  }

  historyListEl.innerHTML = history.map(item => {
    const time = new Date(item.triggered_at).toLocaleString('zh-CN');
    return `
      <div class="history-card">
        <div class="history-info">
          <h4>${item.rule_name}</h4>
          <p>${item.message.split('\n')[0]}</p>
        </div>
        <div class="history-time">
          <div class="history-price">${item.current_price.toFixed(2)}</div>
          <div>${time}</div>
        </div>
      </div>
    `;
  }).join('');
}

// Price Polling
function startPricePolling() {
  fetchPrice();
  setInterval(fetchPrice, 2000);
}

async function fetchPrice() {
  try {
    const res = await fetch(`${API_BASE}/prices/current/btcusdt`);
    if (res.ok) {
      const data = await res.json();
      currentPriceEl.textContent = data.price.toFixed(2);
    }
  } catch (err) {
    // Ignore errors
  }
}
