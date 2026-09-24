// ── month-end.js — Month-End Review page ──────────────────────────
import { api, formatINR, navigate, toast, monthName } from './utils.js';

let sections = [];
const newBudgets = {};

async function load() {
  try {
    const [user, secs] = await Promise.all([
      api('GET', '/users/me'),
      api('GET', '/sections'),
    ]);

    sections = secs || [];

    const now = new Date();
    document.getElementById('month-label').textContent =
      `Reviewing ${monthName(now.getMonth() + 1)} ${now.getFullYear()}`;

    renderSummary(user, sections);
    renderBudgets(sections);

    document.getElementById('me-loading').classList.add('hidden');
    document.getElementById('me-content').classList.remove('hidden');

  } catch (e) {
    if (e.type !== 'auth') {
      document.getElementById('me-loading').innerHTML =
        '<div style="text-align:center;color:var(--n-400);padding:40px 0;">Could not load data.</div>';
    }
  }
}

function renderSummary(user, sections) {
  const totalBudget  = sections.reduce((s, sec) => s + (sec.monthlyBudget || 0), 0);
  const totalSpent   = sections.reduce((s, sec) => s + (sec.spent || 0), 0);
  const totalRemaining = sections.reduce((s, sec) => s + Math.max(0, (sec.monthlyBudget || 0) - (sec.spent || 0)), 0);

  document.getElementById('month-summary').innerHTML = `
    <div style="display:flex;flex-direction:column;gap:0;">
      <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--n-100);font-size:13px;">
        <span style="color:var(--n-500);">Total budget</span>
        <span style="font-weight:700;">${formatINR(totalBudget)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--n-100);font-size:13px;">
        <span style="color:var(--n-500);">Total spent</span>
        <span style="font-weight:700;color:var(--red-500);">${formatINR(totalSpent)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;font-size:13px;">
        <span style="color:var(--n-500);">Remaining (will be swept)</span>
        <span style="font-weight:700;color:var(--green-600);">${formatINR(totalRemaining)}</span>
      </div>
    </div>
  `;

  document.getElementById('sweep-text').innerHTML =
    totalRemaining > 0
      ? `<strong>${formatINR(totalRemaining)}</strong> of remaining budget will be swept to your savings when you start the new month.`
      : 'All budgets were fully used this month. No amount will be swept to savings.';
}

function renderBudgets(sections) {
  const list = document.getElementById('budgets-list');

  if (sections.length === 0) {
    list.innerHTML = '<p style="font-size:13px;color:var(--n-400);">No sections to configure.</p>';
    return;
  }

  list.innerHTML = sections.map(sec => {
    newBudgets[sec._id] = sec.monthlyBudget;
    return `
      <div class="month-end-section-row">
        <span style="font-size:22px;flex-shrink:0;">${sec.emoji || '📦'}</span>
        <div style="flex:1;min-width:0;">
          <div style="font-size:14px;font-weight:600;color:var(--n-800);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${sec.name}</div>
          <div style="font-size:11px;color:var(--n-400);">Was ${formatINR(sec.monthlyBudget)}</div>
        </div>
        <div class="input-prefix-wrap" style="flex-shrink:0;width:110px;">
          <span class="input-prefix">₹</span>
          <input
            type="number"
            class="month-budget-inp input"
            data-sec-id="${sec._id}"
            value="${sec.monthlyBudget}"
            min="0"
            inputmode="numeric"
            style="width:110px;padding-left:22px;"
          >
        </div>
      </div>
    `;
  }).join('');

  // Track budget changes
  list.querySelectorAll('.month-budget-inp').forEach(inp => {
    inp.addEventListener('input', e => {
      newBudgets[e.target.dataset.secId] = Number(e.target.value) || 0;
    });
  });
}

// ── Confirm Rollover ──────────────────────────────────────────────

document.getElementById('btn-confirm-rollover').addEventListener('click', async () => {
  const btn = document.getElementById('btn-confirm-rollover');
  btn.classList.add('btn-loading');

  try {
    // 1. Update each section's budget
    await Promise.all(sections.map(sec => {
      const newBudget = newBudgets[sec._id] ?? sec.monthlyBudget;
      const updates = {};
      // Reset spent to 0 and update budget
      updates.monthlyBudget = newBudget;
      return api('PATCH', `/sections/${sec._id}`, updates);
    }));

    // 2. Reset all section spending individually
    await Promise.all(sections.map(sec =>
      api('PATCH', `/sections/${sec._id}`, { spent: 0 }).catch(() => {})
    ));

    // 3. Reset bills
    await api('POST', '/bills/reset').catch(() => {});

    toast('New month started successfully!', 'success');
    setTimeout(() => navigate('/pages/dashboard.html'), 1200);

  } catch (err) {
    toast(err.message || 'Could not complete month-end rollover.', 'error');
    btn.classList.remove('btn-loading');
  }
});

document.getElementById('back-btn').addEventListener('click', () => navigate('/pages/settings.html'));

function monthName(month) {
  return ['January','February','March','April','May','June','July','August','September','October','November','December'][month - 1] || '';
}

load();
