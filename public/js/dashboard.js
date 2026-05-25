// ── dashboard.js ─────────────────────────────────────────────────
import { formatINR, formatDate, timeAgo, sectionColour, navigate, api, toast } from './utils.js';

async function loadDashboard() {
  try {
    const data = await api('GET', '/dashboard');

    // Greeting + date
    const name = data.user?.name?.split(' ')[0] || 'there';
    document.getElementById('greeting').textContent = `Hi, ${name} 👋`;
    document.getElementById('today-date').textContent = formatDate();

    // Total balance
    const totalRemaining = (data.sections || []).reduce((sum, s) => sum + Math.max(0, s.budget - s.spent), 0);
    document.getElementById('total-balance').textContent = formatINR(totalRemaining + (data.savings?.balance || 0));

    // Sections grid
    renderSections(data.sections || []);

    // Bills
    renderBills(data.bills || []);

    // Savings
    const savings = data.savings?.balance || 0;
    document.getElementById('savings-amount').textContent = formatINR(savings);
    document.getElementById('savings-card').addEventListener('click', () => navigate('/pages/savings.html'));

    // Recent transactions
    renderTransactions(data.recentTransactions || []);

  } catch (e) {
    console.error('Dashboard load error:', e);
    toast('Could not load dashboard', 'error');
  }
}

function renderSections(sections) {
  const grid = document.getElementById('sections-grid');
  grid.innerHTML = '';

  if (sections.length === 0) {
    grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:32px 0;color:var(--slate-300);font-size:13px;">No sections yet. Go to Settings to add some.</div>`;
    return;
  }

  sections.forEach(section => {
    const remaining = section.budget - section.spent;
    const pct = section.budget > 0 ? Math.max(0, Math.min(100, (remaining / section.budget) * 100)) : 0;
    const isDrained = remaining <= 0;
    const colour = sectionColour(section.budget, section.spent);

    const card = document.createElement('div');
    card.className = 'section-card' + (isDrained ? ' drained' : '');
    card.innerHTML = `
      ${isDrained ? '<div class="done-badge">DONE</div>' : ''}
      <span class="section-emoji">${section.emoji}</span>
      <div style="font-weight:600;font-size:13px;color:var(--slate-700);margin-bottom:8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" class="section-name">${section.name}</div>
      ${isDrained
        ? `<div style="font-size:11px;color:var(--slate-400);margin-top:4px;">Budget finished</div>`
        : `<div class="progress-track" style="margin-bottom:6px;">
             <div class="progress-fill ${colour}" style="width:${100 - pct}%"></div>
           </div>
           <div style="font-size:12px;font-weight:600;color:var(--${colour === 'green' ? 'green' : colour === 'amber' ? 'amber' : 'red'});">
             ${formatINR(remaining)} left
           </div>`
      }
    `;

    if (!isDrained) {
      card.style.cursor = 'pointer';
      card.addEventListener('click', () => navigate(`/pages/section-detail.html?id=${section.id}`));
    } else {
      card.addEventListener('click', () => navigate(`/pages/section-detail.html?id=${section.id}`));
    }

    grid.appendChild(card);
  });
}

function renderBills(bills) {
  const wrap = document.getElementById('bills-card-wrap');
  if (!bills || bills.length === 0) {
    wrap.classList.add('hidden');
    return;
  }
  wrap.classList.remove('hidden');

  const today = new Date().getDate();
  const billsCard = document.getElementById('bills-card');

  const unpaid = bills.filter(b => !b.paid);
  const total = unpaid.reduce((s, b) => s + b.amount, 0);

  billsCard.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
      <div style="font-size:13px;font-weight:600;">📋 Fixed Bills</div>
      <div style="font-size:12px;color:var(--slate-400);">${unpaid.length} pending · ${formatINR(total)}</div>
    </div>
    ${bills.map(b => {
      const daysUntil = b.dueDay - today;
      let dueCls = 'ok', dueLabel = `Due ${b.dueDay}${ordinal(b.dueDay)}`;
      if (b.paid) { dueCls = 'paid'; dueLabel = 'Paid ✓'; }
      else if (daysUntil < 0) { dueCls = 'urgent'; dueLabel = 'Overdue!'; }
      else if (daysUntil <= 3) { dueCls = 'urgent'; dueLabel = daysUntil === 0 ? 'Due today!' : `${daysUntil}d left`; }
      else if (daysUntil <= 7) { dueCls = 'soon'; dueLabel = `${daysUntil}d left`; }

      return `<div class="bill-item">
        <div>
          <div style="font-size:13px;font-weight:500;">${b.name}</div>
          <div style="font-size:11px;color:var(--slate-400);">${formatINR(b.amount)}</div>
        </div>
        <span class="bill-due ${dueCls}">${dueLabel}</span>
      </div>`;
    }).join('')}
  `;
}

function renderTransactions(transactions) {
  const list = document.getElementById('tx-list');
  const empty = document.getElementById('tx-empty');

  if (!transactions || transactions.length === 0) {
    list.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  list.innerHTML = transactions.map(tx => `
    <div class="tx-item">
      <div class="tx-icon">${tx.sectionEmoji || '💳'}</div>
      <div style="flex:1;min-width:0;">
        <div class="tx-merchant">${tx.merchant}</div>
        <div class="tx-section">${tx.sectionEmoji || ''} ${tx.sectionName || ''}${tx.isOverride ? ' · <span style="color:var(--orange);">Override</span>' : ''}</div>
      </div>
      <div style="text-align:right;flex-shrink:0;">
        <div class="tx-amount">-${formatINR(tx.amount)}</div>
        <div class="tx-time">${timeAgo(tx.createdAt)}</div>
      </div>
    </div>
  `).join('');
}

function ordinal(n) {
  const s = ['th','st','nd','rd'], v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

loadDashboard();
