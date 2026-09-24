// ── payment.js — Payment flow ──────────────────────────────────────
import {
  api, formatINR, sectionColour, getRemaining, getPctSpent, navigate, toast
} from './utils.js';

let sections = [];
let selectedSection = null;
let step = 1;

// Step elements
const steps = [null, 'pstep-1', 'pstep-2', 'pstep-3', 'pstep-4'];

function showStep(n) {
  step = n;
  steps.forEach((id, i) => {
    if (!id) return;
    document.getElementById(id).classList.toggle('active', i === n);
  });
  const titles = ['', 'Log a payment', 'Choose section', 'Confirm payment', 'Done'];
  document.getElementById('step-title').textContent = titles[n] || 'Log a payment';
}

// ── Load Sections ─────────────────────────────────────────────────

async function loadSections() {
  try {
    sections = await api('GET', '/sections');
    renderSectionGrid();
  } catch {
    document.getElementById('section-select-grid').innerHTML =
      '<div style="grid-column:1/-1;text-align:center;color:var(--n-400);padding:20px 0;">Could not load sections.</div>';
  }
}

function renderSectionGrid() {
  const amount = parseFloat(document.getElementById('inp-amount').value) || 0;
  const grid = document.getElementById('section-select-grid');

  if (!sections || sections.length === 0) {
    grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;color:var(--n-400);padding:20px;">
      No sections. <a href="/pages/sections.html" class="text-indigo" style="font-weight:600;">Create one</a>
    </div>`;
    return;
  }

  grid.innerHTML = sections.map(sec => {
    const remaining = getRemaining(sec.monthlyBudget, sec.spent);
    const colour    = sectionColour(sec.monthlyBudget, sec.spent);
    const insufficient = amount > 0 && remaining < amount;

    return `
      <div
        class="section-option${insufficient ? ' drained' : ''}"
        data-id="${sec._id}"
        role="button"
        tabindex="${insufficient ? -1 : 0}"
        aria-label="${sec.name}: ${formatINR(remaining)} remaining"
        aria-disabled="${insufficient}"
      >
        <div style="font-size:20px;margin-bottom:4px;">${sec.emoji || '📦'}</div>
        <div class="section-option-name">${sec.name}</div>
        <div class="section-option-remaining ${colour}">${formatINR(remaining)}</div>
        <div style="font-size:10px;color:var(--n-300);margin-top:1px;">remaining</div>
        ${insufficient ? '<div style="font-size:10px;color:var(--red-500);margin-top:3px;">Insufficient</div>' : ''}
      </div>
    `;
  }).join('');

  grid.querySelectorAll('.section-option:not(.drained)').forEach(card => {
    const handler = () => selectSection(card.dataset.id);
    card.addEventListener('click', handler);
    card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') handler(); });
  });
}

function selectSection(id) {
  selectedSection = sections.find(s => s._id === id);
  if (!selectedSection) return;

  const amount     = parseFloat(document.getElementById('inp-amount').value) || 0;
  const remaining  = getRemaining(selectedSection.monthlyBudget, selectedSection.spent);
  const afterSpend = remaining - amount;

  // Highlight selected
  document.querySelectorAll('.section-option').forEach(card => {
    card.classList.toggle('selected', card.dataset.id === id);
  });

  // Budget warning
  const warn = document.getElementById('budget-warning');
  if (amount > remaining) {
    warn.textContent = `${selectedSection.name} only has ${formatINR(remaining)} — this payment exceeds the budget.`;
    warn.classList.remove('hidden');
    warn.className = 'spend-nudge danger';
  } else if (afterSpend < remaining * 0.2) {
    warn.textContent = `After this payment, only ${formatINR(afterSpend)} will remain in ${selectedSection.name}.`;
    warn.classList.remove('hidden');
    warn.className = 'spend-nudge warn';
  } else {
    warn.classList.add('hidden');
  }

  document.getElementById('btn-p2-confirm').disabled = false;
}

// ── Step Navigation ───────────────────────────────────────────────

// Step 1 → 2
document.getElementById('btn-p1-next').addEventListener('click', () => {
  const merchant = document.getElementById('inp-merchant').value.trim();
  const amount   = parseFloat(document.getElementById('inp-amount').value);

  let valid = true;
  clearErr('merchant'); clearErr('amount');
  if (!merchant) { showErr('merchant', 'Enter a merchant name.'); valid = false; }
  if (!amount || amount <= 0) { showErr('amount', 'Enter a valid amount.'); valid = false; }
  if (!valid) return;

  document.getElementById('conf-amount-display').textContent = formatINR(amount);
  document.getElementById('conf-merchant-display').textContent = merchant;

  loadSections();
  renderSectionGrid();
  showStep(2);
});

// Step 2 → 3
document.getElementById('btn-p2-confirm').addEventListener('click', () => {
  if (!selectedSection) return;

  const amount   = parseFloat(document.getElementById('inp-amount').value);
  const merchant = document.getElementById('inp-merchant').value.trim();
  const remaining = getRemaining(selectedSection.monthlyBudget, selectedSection.spent);
  const afterSpend = Math.max(0, remaining - amount);

  document.getElementById('conf-amount').textContent   = formatINR(amount);
  document.getElementById('conf-merchant').textContent = merchant;
  document.getElementById('conf-section-name').textContent = `${selectedSection.emoji || ''} ${selectedSection.name}`.trim();
  document.getElementById('conf-section-after').textContent =
    `${formatINR(afterSpend)} will remain after this payment`;

  // Awareness nudge
  const awareness = document.getElementById('conf-awareness');
  if (amount > remaining) {
    awareness.textContent = `This exceeds the ${selectedSection.name} budget by ${formatINR(amount - remaining)}.`;
    awareness.className = 'spend-nudge danger';
  } else if (afterSpend < remaining * 0.2) {
    awareness.textContent = `You'll have ${formatINR(afterSpend)} left in ${selectedSection.name} after this.`;
    awareness.className = 'spend-nudge warn';
  } else {
    awareness.textContent = `${selectedSection.name} has ${formatINR(remaining)} available. You'll have ${formatINR(afterSpend)} left.`;
    awareness.className = 'spend-nudge ok';
  }

  showStep(3);
});

// Step 3 → back or confirm
document.getElementById('btn-p3-back').addEventListener('click', () => showStep(2));

document.getElementById('btn-p3-confirm').addEventListener('click', async () => {
  const amount   = parseFloat(document.getElementById('inp-amount').value);
  const merchant = document.getElementById('inp-merchant').value.trim();
  const btn      = document.getElementById('btn-p3-confirm');

  btn.classList.add('btn-loading');
  try {
    await api('POST', '/transactions', {
      merchant,
      amount,
      section: selectedSection._id,
      direction: 'debit',
    });

    // Update local section spent
    selectedSection.spent = (selectedSection.spent || 0) + amount;
    const remaining = getRemaining(selectedSection.monthlyBudget, selectedSection.spent);

    document.getElementById('succ-amount').textContent = formatINR(amount);
    document.getElementById('succ-section').textContent = `${selectedSection.emoji || ''} ${selectedSection.name}`.trim();
    document.getElementById('succ-remaining').textContent = `${formatINR(remaining)} remaining in this section`;

    showStep(4);
  } catch (err) {
    toast(err.message || 'Payment failed. Try again.', 'error');
  } finally {
    btn.classList.remove('btn-loading');
  }
});

// Log another
document.getElementById('btn-pay-another').addEventListener('click', () => {
  document.getElementById('inp-merchant').value = '';
  document.getElementById('inp-amount').value   = '';
  selectedSection = null;
  showStep(1);
});

// Back button
document.getElementById('back-btn').addEventListener('click', () => {
  if (step > 1 && step < 4) showStep(step - 1);
  else navigate('/pages/dashboard.html');
});

// ── Helpers ───────────────────────────────────────────────────────

function showErr(id, msg) {
  const el = document.getElementById(`err-${id}`);
  if (el) { el.textContent = msg; el.classList.add('show'); }
}

function clearErr(id) {
  const el = document.getElementById(`err-${id}`);
  if (el) { el.textContent = ''; el.classList.remove('show'); }
}
