// ── dashboard.js ──────────────────────────────────────────────────
import {
  api, formatINR, formatDate, timeAgo,
  sectionColour, getRemaining, getPctSpent,
  getGreeting, navigate, toast, errorState
} from './utils.js';

let cachedUser = null;
let cachedSections = [];

async function loadDashboard() {
  try {
    const [user, sections, txData, bills] = await Promise.all([
      api('GET', '/users/me'),
      api('GET', '/sections'),
      api('GET', '/transactions?limit=8').catch(() => []),
      api('GET', '/bills').catch(() => []),
    ]);

    cachedUser = user;
    cachedSections = sections || [];

    // Greeting
    const firstName = (user?.fullName || 'there').split(' ')[0];
    document.getElementById('greeting').textContent = `${getGreeting()}, ${firstName}`;
    document.getElementById('today-date').textContent = formatDate();

    // Update mobile header avatar
    const avatar = document.getElementById('nav-avatar');
    if (avatar) avatar.textContent = firstName.charAt(0).toUpperCase();

    // Summary
    renderSummary(user, sections);

    // Sections
    renderSections(sections || []);

    // Insight
    renderInsight(user, sections || []);

    // Transactions
    renderTransactions(txData || []);

    // Bills
    renderBills(bills || []);

    // Setup income modal listeners once
    setupIncomeModal();

  } catch (e) {
    console.error('Dashboard error:', e);
    if (e.type !== 'auth') {
      document.getElementById('sections-grid').innerHTML = errorState('Could not load your data.');
      toast('Something went wrong. Please try again.', 'error');
    }
  }
}

function renderSummary(user, sections) {
  const income    = user?.monthlyIncome || 0;
  const isZero    = !income || income <= 0;
  const totalBudget = (sections || []).reduce((s, sec) => s + (sec.monthlyBudget || 0), 0);
  const totalSpent  = (sections || []).reduce((s, sec) => s + (sec.spent || 0), 0);
  const remaining   = (sections || []).reduce((s, sec) => s + getRemaining(sec.monthlyBudget, sec.spent), 0);
  const unallocated = Math.max(0, income - totalBudget);

  document.getElementById('summary-grid').innerHTML = `
    <div class="summary-card" id="card-monthly-income" role="button" tabindex="0" title="Click to set or change monthly income" style="cursor:pointer;position:relative;transition:all 0.2s ease;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
        <div class="summary-card-label" style="margin-bottom:0;">Monthly income</div>
        <span style="font-size:11px;font-weight:600;padding:2px 6px;border-radius:4px;background:${isZero ? 'var(--amber-100)' : 'var(--indigo-50)'};color:${isZero ? 'var(--amber-600)' : 'var(--indigo-600)'};display:inline-flex;align-items:center;gap:3px;">
          ${isZero ? '⚠️ Set income' : 'Edit ✏️'}
        </span>
      </div>
      <div class="summary-card-value">${formatINR(income)}</div>
      <div class="summary-card-sub">${isZero ? 'Click to configure your income' : 'This month'}</div>
    </div>
    <div class="summary-card">
      <div class="summary-card-label">Allocated</div>
      <div class="summary-card-value">${formatINR(totalBudget)}</div>
      <div class="summary-card-sub">${income > 0 ? `${formatINR(unallocated)} unallocated` : 'Across all sections'}</div>
    </div>
    <div class="summary-card">
      <div class="summary-card-label">Spent</div>
      <div class="summary-card-value" style="color:var(--n-700);">${formatINR(totalSpent)}</div>
      <div class="summary-card-sub">${income > 0 ? Math.round((totalSpent/income)*100) : 0}% of income</div>
    </div>
    <div class="summary-card">
      <div class="summary-card-label">Remaining</div>
      <div class="summary-card-value" style="color:var(--green-600);">${formatINR(remaining)}</div>
      <div class="summary-card-sub">Across all sections</div>
    </div>
  `;

  // Attach click listener to monthly income card
  const incomeCard = document.getElementById('card-monthly-income');
  if (incomeCard) {
    incomeCard.addEventListener('click', openIncomeModal);
    incomeCard.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openIncomeModal();
      }
    });
  }
}

function openIncomeModal() {
  const overlay = document.getElementById('dashboard-income-overlay');
  const input = document.getElementById('dash-inc-amount');
  const errEl = document.getElementById('dash-inc-error');
  if (!overlay || !input) return;

  input.value = cachedUser?.monthlyIncome || '';
  if (errEl) errEl.textContent = '';
  overlay.classList.add('show');
  setTimeout(() => input.focus(), 250);
}

function closeIncomeModal() {
  const overlay = document.getElementById('dashboard-income-overlay');
  if (overlay) overlay.classList.remove('show');
}

let incomeModalInitialized = false;
function setupIncomeModal() {
  if (incomeModalInitialized) return;
  incomeModalInitialized = true;

  const overlay = document.getElementById('dashboard-income-overlay');
  const cancelBtn = document.getElementById('btn-dash-inc-cancel');
  const saveBtn = document.getElementById('btn-dash-inc-save');
  const input = document.getElementById('dash-inc-amount');
  const errEl = document.getElementById('dash-inc-error');

  if (cancelBtn) cancelBtn.addEventListener('click', closeIncomeModal);

  if (overlay) {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeIncomeModal();
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && overlay?.classList.contains('show')) {
      closeIncomeModal();
    }
  });

  if (input) {
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        saveBtn?.click();
      }
    });
  }

  if (saveBtn) {
    saveBtn.addEventListener('click', async () => {
      const incomeVal = Number(input.value);
      if (!incomeVal || incomeVal <= 0) {
        if (errEl) errEl.textContent = 'Please enter a valid monthly income greater than 0.';
        return;
      }
      if (errEl) errEl.textContent = '';

      saveBtn.classList.add('btn-loading');
      try {
        const updated = await api('PATCH', '/users/update-profile', { monthlyIncome: incomeVal });
        if (cachedUser) {
          cachedUser.monthlyIncome = incomeVal;
        } else {
          cachedUser = updated;
        }
        renderSummary(cachedUser, cachedSections);
        renderInsight(cachedUser, cachedSections);
        closeIncomeModal();
        toast('Monthly income updated successfully!', 'success');
      } catch (err) {
        if (errEl) errEl.textContent = err.message || 'Could not update monthly income.';
      } finally {
        saveBtn.classList.remove('btn-loading');
      }
    });
  }
}

function renderSections(sections) {
  const grid = document.getElementById('sections-grid');

  if (!sections || sections.length === 0) {
    grid.innerHTML = `
      <div style="grid-column:1/-1;">
        <div class="empty-state">
          <div class="empty-state-icon">
            <svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/></svg>
          </div>
          <div class="empty-state-title">No sections yet</div>
          <div class="empty-state-desc">Give your money a purpose. Create sections for Food, Transport, Entertainment — whatever fits your life.</div>
          <a href="/pages/sections.html" class="btn btn-primary">Create your first section</a>
        </div>
      </div>
    `;
    return;
  }

  grid.innerHTML = sections.map(sec => {
    const remaining = getRemaining(sec.monthlyBudget, sec.spent);
    const pctSpent  = getPctSpent(sec.monthlyBudget, sec.spent);
    const colour    = sectionColour(sec.monthlyBudget, sec.spent);
    const isDrained = remaining <= 0;

    return `
      <div class="section-card card-clickable" data-id="${sec._id}" tabindex="0" role="button" aria-label="${sec.name}: ${formatINR(remaining)} remaining">
        <div class="section-card-header">
          <span class="section-card-emoji">${sec.emoji || '📦'}</span>
          <span class="section-status-dot ${colour}"></span>
        </div>
        <div class="section-card-name">${sec.name}</div>
        <div class="section-card-remaining ${colour}">
          ${isDrained ? '₹0' : formatINR(remaining)}
        </div>
        <div class="section-card-detail">
          ${isDrained ? 'Budget used' : `${pctSpent}% used · ${formatINR(sec.monthlyBudget)} budget`}
        </div>
        <div class="progress-track">
          <div class="progress-fill ${colour}" style="width:${pctSpent}%"></div>
        </div>
      </div>
    `;
  }).join('');

  // Click handlers
  grid.querySelectorAll('.section-card').forEach(card => {
    const handler = () => navigate(`/pages/section-detail.html?id=${card.dataset.id}`);
    card.addEventListener('click', handler);
    card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') handler(); });
  });
}

function renderInsight(user, sections) {
  const wrap = document.getElementById('insight-wrap');
  if (!sections || sections.length === 0) return;

  // Find section closest to budget
  const mostUsed = sections
    .filter(s => s.monthlyBudget > 0)
    .sort((a, b) => (b.spent/b.monthlyBudget) - (a.spent/a.monthlyBudget))[0];

  if (!mostUsed) return;

  const pct = getPctSpent(mostUsed.monthlyBudget, mostUsed.spent);
  const remaining = getRemaining(mostUsed.monthlyBudget, mostUsed.spent);

  let msg;
  if (pct >= 100) {
    msg = `<strong>${mostUsed.name}</strong> has reached its budget limit this month.`;
  } else if (pct >= 80) {
    msg = `<strong>${mostUsed.name}</strong> is at ${pct}% — only <strong>${formatINR(remaining)}</strong> left.`;
  } else {
    const totalRemaining = sections.reduce((s, sec) => s + getRemaining(sec.monthlyBudget, sec.spent), 0);
    msg = `You have <strong>${formatINR(totalRemaining)}</strong> available across all your sections.`;
  }

  wrap.innerHTML = `
    <div class="insight-card">
      <div class="insight-icon">
        <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
      </div>
      <div class="insight-text">${msg}</div>
    </div>
  `;
  wrap.classList.remove('hidden');
}

function renderTransactions(transactions) {
  const list  = document.getElementById('tx-list');
  const empty = document.getElementById('tx-empty');

  if (!transactions || transactions.length === 0) {
    list.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  list.innerHTML = transactions.slice(0, 8).map(tx => {
    const isCredit = tx.direction === 'credit';
    const sectionEmoji = tx.section?.emoji || '';
    const sectionName  = tx.section?.name  || tx.sectionName || '';

    return `
      <div class="tx-row">
        <div class="tx-icon-wrap">${sectionEmoji || '💳'}</div>
        <div class="tx-info">
          <div class="tx-merchant">${tx.merchant}</div>
          <div class="tx-meta">
            ${sectionName ? `<span>${sectionName}</span><span class="dot-sep"></span>` : ''}
            <span>${timeAgo(tx.createdAt)}</span>
            ${tx.isOverride ? `<span class="dot-sep"></span><span style="color:var(--amber-600);">Override</span>` : ''}
          </div>
        </div>
        <div class="tx-amount-wrap">
          <div class="tx-amount ${isCredit ? 'credit' : ''}">${isCredit ? '+' : '-'}${formatINR(tx.amount)}</div>
        </div>
      </div>
    `;
  }).join('');
}

function renderBills(bills) {
  const section = document.getElementById('bills-section');
  const list    = document.getElementById('bills-list');

  const unpaid = (bills || []).filter(b => !b.isPaid);
  if (unpaid.length === 0) return;

  section.classList.remove('hidden');
  const today = new Date().getDate();

  list.innerHTML = unpaid.slice(0, 4).map(b => {
    const daysLeft = b.dueDay - today;
    let badge = '', badgeClass = '';
    if (daysLeft < 0) { badge = 'Overdue'; badgeClass = 'badge-red'; }
    else if (daysLeft === 0) { badge = 'Due today'; badgeClass = 'badge-red'; }
    else if (daysLeft <= 3) { badge = `${daysLeft}d left`; badgeClass = 'badge-amber'; }
    else { badge = `Due ${ordinal(b.dueDay)}`; badgeClass = 'badge-neutral'; }

    return `
      <div class="bill-row">
        <div class="bill-icon">
          <svg viewBox="0 0 24 24"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
        </div>
        <div class="bill-info">
          <div class="bill-name">${b.name}</div>
          <div class="bill-due-text">Due on the ${ordinal(b.dueDay)}</div>
        </div>
        <div class="bill-amount-wrap">
          <div class="bill-amount">${formatINR(b.amount)}</div>
          <div style="text-align:right;margin-top:3px;"><span class="badge ${badgeClass}">${badge}</span></div>
        </div>
      </div>
    `;
  }).join('');
}

function ordinal(n) {
  const s = ['th','st','nd','rd'], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

loadDashboard();
