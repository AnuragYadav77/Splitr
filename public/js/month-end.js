// ── month-end.js ──────────────────────────────────────────────────
import { formatINR, api, navigate, toast, monthName } from './utils.js';

// Fade in
document.body.style.opacity = '0';
document.body.style.transition = 'opacity 250ms ease';
requestAnimationFrame(() => { document.body.style.opacity = '1'; });

let sections = [];
let dashData = null;

async function loadMonthEnd() {
  try {
    dashData = await api('GET', '/dashboard');
    sections = dashData.sections || [];
    renderSummary(dashData);
    renderBudgetEditor(sections);
  } catch (e) {
    toast('Could not load data', 'error');
  }
}

function renderSummary(data) {
  const settings = data.settings || {};
  const month = settings.month;
  const year  = settings.year;

  if (month && year) {
    document.getElementById('month-label').textContent =
      `Here's how ${monthName(month)} ${year} went.`;
  }

  // Calculate sweep total
  let totalSwept = 0;
  (data.sections || []).forEach(s => {
    const rem = s.budget - s.spent;
    if (rem > 0) totalSwept += rem;
  });

  document.getElementById('sweep-badge').innerHTML =
    `🪙 ${formatINR(totalSwept)} sweeping to savings`;

  // Totals
  const totalBudget = (data.sections || []).reduce((s, sec) => s + sec.budget, 0);
  const totalSpent  = (data.sections || []).reduce((s, sec) => s + sec.spent, 0);
  const txCount = (data.recentTransactions || []).length;
  const overrides = data.overrides || 0;

  document.getElementById('summary-card').innerHTML = `
    <div class="summary-row">
      <span class="summary-row-label">Total Budget</span>
      <span class="summary-row-val">${formatINR(totalBudget)}</span>
    </div>
    <div class="summary-row">
      <span class="summary-row-label">Total Spent</span>
      <span class="summary-row-val text-red">${formatINR(totalSpent)}</span>
    </div>
    <div class="summary-row">
      <span class="summary-row-label">Sweeping to Savings</span>
      <span class="summary-row-val text-green">${formatINR(totalSwept)}</span>
    </div>
    <div class="summary-row">
      <span class="summary-row-label">Transactions</span>
      <span class="summary-row-val">${txCount}</span>
    </div>
    ${overrides > 0 ? `
    <div class="summary-row">
      <span class="summary-row-label">Emergency Overrides</span>
      <span class="summary-row-val text-red">⚠️ ${overrides}</span>
    </div>` : ''}
  `;
}

function renderBudgetEditor(secs) {
  const container = document.getElementById('budgets-list');

  if (!secs || secs.length === 0) {
    container.innerHTML = `<div style="color:var(--slate-400);font-size:13px;text-align:center;padding:20px 0;">No sections to edit.</div>`;
    return;
  }

  container.innerHTML = secs.map(s => `
    <div class="budget-row">
      <span class="budget-row-emoji">${s.emoji}</span>
      <span class="budget-row-name">${s.name}</span>
      <input
        type="number"
        class="budget-inp"
        id="budget-${s.id}"
        value="${s.budget}"
        min="1"
        data-id="${s.id}"
        placeholder="₹"
      >
    </div>
  `).join('');
}

// ── Confirm rollover ────────────────────────────────────────────────
document.getElementById('btn-confirm-rollover').addEventListener('click', async () => {
  const btn = document.getElementById('btn-confirm-rollover');
  btn.textContent = 'Rolling over…';
  btn.disabled = true;

  // Collect new budgets
  const newBudgets = sections.map(s => {
    const inp = document.getElementById(`budget-${s.id}`);
    const val = parseFloat(inp?.value);
    return {
      id: s.id,
      budget: (!val || val <= 0) ? s.budget : val
    };
  });

  try {
    const result = await api('POST', '/month-end', { sections: newBudgets });
    toast(`Month rolled over! ${formatINR(result.swept)} swept to savings.`, 'success');
    setTimeout(() => navigate('/pages/dashboard.html'), 1200);
  } catch (e) {
    toast('Rollover failed: ' + (e.data?.error || e.message), 'error');
    btn.textContent = '🚀 Start New Month';
    btn.disabled = false;
  }
});

loadMonthEnd();
