// ── savings.js ────────────────────────────────────────────────────
import { formatINR, formatDate, api, navigate, toast, monthName } from './utils.js';

document.getElementById('back-btn').addEventListener('click', () => navigate('/pages/dashboard.html'));

let savingsData = null;

async function loadSavings() {
  try {
    const data = await api('GET', '/savings');
    savingsData = data;
    render(data);
  } catch (e) {
    toast('Could not load savings', 'error');
  }
}

function render(data) {
  const balance = data.balance || 0;
  document.getElementById('savings-balance').textContent = formatINR(balance);

  // Show withdraw FAB if balance > 0
  const fab = document.getElementById('withdraw-fab');
  fab.style.display = balance > 0 ? 'block' : 'none';

  // Goal card
  renderGoalCard(data.goal, balance);

  // Chart
  renderChart(data.history || []);

  // History list
  renderHistory(data.history || []);
}

function renderGoalCard(goal, balance) {
  const card = document.getElementById('goal-card');

  if (!goal) {
    card.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;">
        <div>
          <div style="font-size:13px;font-weight:600;color:var(--slate-700);margin-bottom:4px;">No goal set</div>
          <div style="font-size:12px;color:var(--slate-400);">Set a target to stay motivated.</div>
        </div>
        <button id="btn-set-goal" style="padding:8px 16px;border-radius:10px;background:var(--orange-light);color:var(--orange);border:none;cursor:pointer;font-size:12px;font-weight:600;white-space:nowrap;">
          Set Goal 🎯
        </button>
      </div>
    `;
    document.getElementById('btn-set-goal').addEventListener('click', openGoalSheet);
    return;
  }

  const pct = Math.min(100, (balance / goal.target) * 100);
  const remaining = Math.max(0, goal.target - balance);

  card.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:4px;">
      <div>
        <div style="font-size:14px;font-weight:700;color:var(--slate-800);">🎯 ${goal.name}</div>
        <div style="font-size:12px;color:var(--slate-400);">Target: ${formatINR(goal.target)}</div>
      </div>
      <button id="btn-edit-goal" style="padding:6px 12px;border-radius:8px;background:var(--slate-100);color:var(--slate-600);border:none;cursor:pointer;font-size:11px;font-weight:600;">
        Edit
      </button>
    </div>
    <div class="goal-progress-track">
      <div class="goal-progress-fill" id="goal-fill" style="width:0%"></div>
    </div>
    <div style="display:flex;justify-content:space-between;font-size:12px;">
      <span style="color:var(--green);font-weight:600;">${Math.round(pct)}% reached</span>
      <span style="color:var(--slate-400);">${remaining > 0 ? formatINR(remaining) + ' to go' : '🎉 Goal reached!'}</span>
    </div>
  `;
  // Animate
  setTimeout(() => {
    const fill = document.getElementById('goal-fill');
    if (fill) fill.style.width = pct + '%';
  }, 100);

  document.getElementById('btn-edit-goal').addEventListener('click', openGoalSheet);
}

function renderChart(history) {
  const chart = document.getElementById('savings-chart');
  const sweeps = history
    .filter(h => h.type === 'month-sweep' || h.type === 'sweep')
    .slice(-6);

  if (sweeps.length === 0) {
    chart.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;color:var(--slate-300);font-size:13px;">No sweep history yet.</div>`;
    return;
  }

  const maxAmt = Math.max(...sweeps.map(s => s.amount), 1);

  chart.innerHTML = sweeps.map((s, i) => {
    const heightPct = Math.max(8, (s.amount / maxAmt) * 100);
    const isLast = i === sweeps.length - 1;
    const d = new Date(s.createdAt);
    const label = d.toLocaleDateString('en-IN', { month: 'short' });
    return `
      <div class="chart-bar-wrap">
        <div class="chart-bar-amount">${formatINR(s.amount)}</div>
        <div class="chart-bar${isLast ? ' current' : ''}" style="height:${heightPct}%"></div>
        <div class="chart-bar-label">${label}</div>
      </div>
    `;
  }).join('');
}

function renderHistory(history) {
  const list = document.getElementById('history-list');
  const empty = document.getElementById('history-empty');

  if (!history || history.length === 0) {
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  const sorted = [...history].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  list.innerHTML = sorted.map(item => {
    const isWithdraw = item.type === 'withdrawal';
    const icon = isWithdraw ? '💸' : '🪙';
    const iconClass = isWithdraw ? 'withdraw' : 'sweep';
    const amtColour = isWithdraw ? 'var(--red)' : 'var(--green)';
    const amtPrefix = isWithdraw ? '-' : '+';
    const label = isWithdraw
      ? (item.note || 'Withdrawal')
      : (item.month ? `${monthName(item.month)} sweep` : (item.note || 'Sweep'));

    return `
      <div class="history-item">
        <div class="history-icon ${iconClass}">${icon}</div>
        <div style="flex:1;min-width:0;">
          <div style="font-weight:600;font-size:14px;color:var(--slate-800);">${label}</div>
          <div style="font-size:11px;color:var(--slate-400);">${formatDate(item.createdAt)}</div>
        </div>
        <div style="font-weight:700;font-size:15px;color:${amtColour};flex-shrink:0;">
          ${amtPrefix}${formatINR(item.amount)}
        </div>
      </div>
    `;
  }).join('');
}

// ── Goal Sheet ─────────────────────────────────────────────────────
function openGoalSheet() {
  const goal = savingsData?.goal;
  if (goal) {
    document.getElementById('goal-name').value = goal.name || '';
    document.getElementById('goal-target').value = goal.target || '';
  } else {
    document.getElementById('goal-name').value = '';
    document.getElementById('goal-target').value = '';
  }
  document.getElementById('goal-overlay').classList.add('show');
}

document.getElementById('btn-goal-cancel').addEventListener('click', () => {
  document.getElementById('goal-overlay').classList.remove('show');
});

document.getElementById('btn-goal-save').addEventListener('click', async () => {
  const name = document.getElementById('goal-name').value.trim();
  const target = parseFloat(document.getElementById('goal-target').value);
  if (!name || !target || target <= 0) {
    toast('Please enter a goal name and target amount.', 'warning');
    return;
  }
  try {
    await api('POST', '/savings/goal', { name, target });
    toast('Goal saved! 🎯', 'success');
    document.getElementById('goal-overlay').classList.remove('show');
    loadSavings();
  } catch (e) {
    toast('Failed to save goal', 'error');
  }
});

document.getElementById('btn-goal-clear').addEventListener('click', async () => {
  try {
    await api('POST', '/savings/goal', {});
    toast('Goal cleared.', 'info');
    document.getElementById('goal-overlay').classList.remove('show');
    loadSavings();
  } catch (e) {
    toast('Failed to clear goal', 'error');
  }
});

document.getElementById('goal-overlay').addEventListener('click', function(e) {
  if (e.target === this) this.classList.remove('show');
});

// ── Withdraw Sheet ─────────────────────────────────────────────────
document.getElementById('btn-withdraw').addEventListener('click', () => {
  const balance = savingsData?.balance || 0;
  document.getElementById('withdraw-avail-msg').textContent = `Available: ${formatINR(balance)}`;
  document.getElementById('withdraw-amount').value = '';
  document.getElementById('withdraw-reason').value = '';
  document.getElementById('withdraw-err').classList.add('hidden');
  document.getElementById('withdraw-overlay').classList.add('show');
});

document.getElementById('btn-withdraw-cancel').addEventListener('click', () => {
  document.getElementById('withdraw-overlay').classList.remove('show');
});

document.getElementById('btn-withdraw-confirm').addEventListener('click', async () => {
  const amount = parseFloat(document.getElementById('withdraw-amount').value);
  const reason = document.getElementById('withdraw-reason').value.trim();
  const balance = savingsData?.balance || 0;
  const errEl = document.getElementById('withdraw-err');
  errEl.classList.add('hidden');

  if (!amount || amount <= 0) {
    errEl.textContent = 'Please enter a valid amount.';
    errEl.classList.remove('hidden');
    return;
  }
  if (amount > balance) {
    errEl.textContent = `You only have ${formatINR(balance)} available.`;
    errEl.classList.remove('hidden');
    return;
  }

  const btn = document.getElementById('btn-withdraw-confirm');
  btn.textContent = 'Processing…';
  btn.disabled = true;

  try {
    await api('POST', '/savings/withdraw', { amount, reason: reason || 'Withdrawal' });
    toast(`${formatINR(amount)} withdrawn from savings.`, 'success');
    document.getElementById('withdraw-overlay').classList.remove('show');
    loadSavings();
  } catch (e) {
    toast(e.data?.error || 'Withdrawal failed', 'error');
  } finally {
    btn.textContent = 'Withdraw';
    btn.disabled = false;
  }
});

document.getElementById('withdraw-overlay').addEventListener('click', function(e) {
  if (e.target === this) this.classList.remove('show');
});

loadSavings();
