// ── sections.js (section-detail.html) ───────────────────────────
import { formatINR, api, navigate, toast, timeAgo, sectionHex } from './utils.js';

const params = new URLSearchParams(window.location.search);
const sectionId = params.get('id');

if (!sectionId) navigate('/pages/dashboard.html');

document.getElementById('back-btn').addEventListener('click', () => navigate('/pages/dashboard.html'));

let sectionData = null;

async function loadSection() {
  try {
    const data = await api('GET', `/section/${sectionId}`);
    sectionData = data;
    renderSection(data.section, data.transactions || []);
  } catch (e) {
    toast('Could not load section', 'error');
    navigate('/pages/dashboard.html');
  }
}

function renderSection(section, txns) {
  document.title = `Splitr — ${section.name}`;
  document.getElementById('section-title').textContent = section.name;
  document.getElementById('hero-emoji').textContent = section.emoji;
  document.getElementById('hero-name').textContent = section.name;

  const remaining = Math.max(0, section.budget - section.spent);
  const pct = section.budget > 0 ? Math.max(0, Math.min(100, (remaining / section.budget) * 100)) : 0;

  // Circular progress
  const circumference = 326.7;
  const offset = circumference - (pct / 100) * circumference;
  const fill = document.getElementById('circ-fill');
  const hex = sectionHex(section.budget, section.spent);
  fill.style.stroke = hex;
  setTimeout(() => { fill.style.strokeDashoffset = offset; }, 100);

  document.getElementById('circ-pct').textContent = Math.round(pct) + '%';
  document.getElementById('circ-pct').style.color = hex;

  // Stats
  document.getElementById('stat-budget').textContent = formatINR(section.budget);
  document.getElementById('stat-spent').textContent = formatINR(section.spent);
  document.getElementById('stat-remaining').textContent = formatINR(remaining);
  if (remaining <= 0) {
    document.getElementById('stat-remaining').className = 'stat-value text-red';
  } else {
    document.getElementById('stat-remaining').className = 'stat-value text-green';
  }

  // Show top-up CTA banner when section is drained
  const topupCta = document.getElementById('topup-cta');
  if (remaining <= 0) {
    topupCta.classList.remove('hidden');
  } else {
    topupCta.classList.add('hidden');
  }

  // Pace indicator
  const now = new Date();
  const daysElapsed = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysRemaining = daysInMonth - daysElapsed;
  const paceBox = document.getElementById('pace-box');

  if (section.spent > 0 && daysElapsed > 0) {
    paceBox.classList.remove('hidden');
    const dailyRate = section.spent / daysElapsed;
    const projected = dailyRate * daysInMonth;

    if (projected > section.budget) {
      const daysLeft = Math.max(0, Math.floor((section.budget - section.spent) / dailyRate));
      paceBox.className = 'pace-box pace-warn';
      paceBox.textContent = `⚠️ At this pace, ${section.name} runs out in ~${daysLeft} day${daysLeft !== 1 ? 's' : ''}.`;
    } else {
      const projectedSave = section.budget - projected;
      paceBox.className = 'pace-box pace-good';
      paceBox.textContent = `✅ On track to save ~${formatINR(projectedSave)} in ${section.name} this month.`;
    }
  }

  // Transactions
  renderTransactions(txns);
}

function renderTransactions(txns) {
  const container = document.getElementById('tx-history');
  const empty = document.getElementById('tx-empty');

  if (!txns || txns.length === 0) {
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  container.innerHTML = txns.map(tx => {
    const isTopup = tx.type === 'topup';
    return `
    <div class="tx-item">
      <div class="tx-icon" style="${isTopup ? 'background:var(--green-light);' : ''}">${isTopup ? '💰' : (tx.sectionEmoji || '💳')}</div>
      <div style="flex:1;min-width:0;">
        <div class="tx-merchant">${tx.merchant}</div>
        <div class="tx-section">${timeAgo(tx.createdAt)}${tx.isOverride ? ' · <span style="color:var(--orange);">Override</span>' : ''}${isTopup ? ' · <span style="color:var(--green);">Top-up</span>' : ''}</div>
      </div>
      <div class="tx-amount" style="${isTopup ? 'color:var(--green);' : ''}">${isTopup ? '+' : '-'}${formatINR(tx.amount)}</div>
    </div>
  `;
  }).join('');

}

// ── Delete Section ─────────────────────────────────────────────────
document.getElementById('btn-delete-section').addEventListener('click', () => {
  const section = sectionData?.section;
  if (!section) return;
  const remaining = Math.max(0, section.budget - section.spent);
  document.getElementById('delete-msg').innerHTML =
    remaining > 0
      ? `<strong>${formatINR(remaining)}</strong> remaining will be moved to your Savings Jar. This cannot be undone.`
      : `This section has no remaining budget. Deleting it is permanent.`;
  document.getElementById('delete-confirm-input').value = '';
  document.getElementById('btn-delete-confirm').disabled = true;
  document.getElementById('delete-overlay').classList.add('show');
});

document.getElementById('delete-confirm-input').addEventListener('input', function() {
  document.getElementById('btn-delete-confirm').disabled = this.value.trim() !== 'Delete';
});

document.getElementById('btn-delete-cancel').addEventListener('click', () => {
  document.getElementById('delete-overlay').classList.remove('show');
});

document.getElementById('btn-delete-confirm').addEventListener('click', async () => {
  const btn = document.getElementById('btn-delete-confirm');
  btn.textContent = 'Deleting…';
  btn.disabled = true;
  try {
    const res = await api('DELETE', `/sections/${sectionId}`);
    toast(`Section deleted. ${res.swept > 0 ? formatINR(res.swept) + ' moved to Savings.' : ''}`, 'success');
    navigate('/pages/dashboard.html');
  } catch (e) {
    toast('Failed to delete section: ' + e.message, 'error');
    btn.textContent = 'Delete Section';
    btn.disabled = false;
  }
});

document.getElementById('delete-overlay').addEventListener('click', function(e) {
  if (e.target === this) this.classList.remove('show');
});

// ── Top Up Budget ──────────────────────────────────────────────────
function openTopupModal() {
  const section = sectionData?.section;
  if (!section) return;
  const remaining = Math.max(0, section.budget - section.spent);
  const subtext = remaining <= 0
    ? `${section.emoji} ${section.name} is at its limit. Add more to continue spending.`
    : `${section.emoji} ${section.name} has ${formatINR(remaining)} left. Top up to increase the cap.`;
  document.getElementById('topup-subtext').textContent = subtext;
  document.getElementById('topup-amount').value = '';
  document.getElementById('btn-topup-confirm').disabled = true;
  document.getElementById('topup-overlay').classList.add('show');
  setTimeout(() => document.getElementById('topup-amount').focus(), 350);
}

document.getElementById('btn-topup-main').addEventListener('click', openTopupModal);
document.getElementById('btn-topup-quick').addEventListener('click', openTopupModal);

document.getElementById('topup-amount').addEventListener('input', function() {
  const val = parseFloat(this.value);
  document.getElementById('btn-topup-confirm').disabled = !(val > 0);
});

// Quick-amount chips
document.getElementById('quick-amounts').addEventListener('click', (e) => {
  const chip = e.target.closest('.quick-chip');
  if (!chip) return;
  const amount = chip.dataset.amount;
  document.getElementById('topup-amount').value = amount;
  document.getElementById('btn-topup-confirm').disabled = false;
  // Highlight selected chip
  document.querySelectorAll('.quick-chip').forEach(c => c.style.cssText = '');
  chip.style.cssText = 'border-color:var(--orange);color:var(--orange);background:var(--orange-light);';
});

document.getElementById('btn-topup-cancel').addEventListener('click', () => {
  document.getElementById('topup-overlay').classList.remove('show');
});

document.getElementById('topup-overlay').addEventListener('click', function(e) {
  if (e.target === this) this.classList.remove('show');
});

document.getElementById('btn-topup-confirm').addEventListener('click', async () => {
  const amount = parseFloat(document.getElementById('topup-amount').value);
  if (!amount || amount <= 0) return;

  const btn = document.getElementById('btn-topup-confirm');
  btn.textContent = 'Adding…';
  btn.disabled = true;

  try {
    const res = await api('PATCH', `/sections/${sectionId}/topup`, { amount });
    document.getElementById('topup-overlay').classList.remove('show');
    toast(`✅ Added ${formatINR(amount)} to ${sectionData.section.name}!`, 'success');
    // Reload section data to reflect the new budget
    await loadSection();
  } catch (e) {
    toast('Top-up failed: ' + e.message, 'error');
    btn.textContent = 'Add to Budget';
    btn.disabled = false;
  }
});

loadSection();
