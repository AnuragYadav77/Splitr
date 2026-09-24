// ── dashboard.js ──────────────────────────────────────────────────
import {
  api, formatINR, formatDate, timeAgo,
  sectionColour, getRemaining, getPctSpent,
  getGreeting, navigate, toast, errorState
} from './utils.js';

async function loadDashboard() {
  try {
    const [user, sections, txData, bills] = await Promise.all([
      api('GET', '/users/me'),
      api('GET', '/sections'),
      api('GET', '/transactions?limit=8').catch(() => []),
      api('GET', '/bills').catch(() => []),
    ]);

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
  const totalBudget = (sections || []).reduce((s, sec) => s + (sec.monthlyBudget || 0), 0);
  const totalSpent  = (sections || []).reduce((s, sec) => s + (sec.spent || 0), 0);
  const remaining   = (sections || []).reduce((s, sec) => s + getRemaining(sec.monthlyBudget, sec.spent), 0);
  const unallocated = Math.max(0, income - totalBudget);

  document.getElementById('summary-grid').innerHTML = `
    <div class="summary-card">
      <div class="summary-card-label">Monthly income</div>
      <div class="summary-card-value">${formatINR(income)}</div>
      <div class="summary-card-sub">This month</div>
    </div>
    <div class="summary-card">
      <div class="summary-card-label">Allocated</div>
      <div class="summary-card-value">${formatINR(totalBudget)}</div>
      <div class="summary-card-sub">${formatINR(unallocated)} unallocated</div>
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
