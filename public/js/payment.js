// ── payment.js ───────────────────────────────────────────────────
import { formatINR, api, navigate, toast, sectionColour } from './utils.js';

const MERCHANTS = ['Swiggy', 'Zomato', 'BigBasket', 'IRCTC', 'Myntra', 'PharmEasy', 'BookMyShow', 'Uber', 'BSES Electricity', 'DMart'];

let state = {
  step: 1,
  merchant: '',
  amount: 0,
  sections: [],
  selectedSection: null,
  isOverride: false,
  overrideSections: [], // section IDs allowed via override
};

// ── Step navigation ───────────────────────────────────────────────
function showStep(n) {
  document.querySelectorAll('.pay-step').forEach(s => s.classList.remove('active'));
  document.getElementById(`pstep-${n}`).classList.add('active');
  state.step = n;

  const titles = { 1: 'Scan & Pay', 2: 'Enter Amount', 3: 'Choose Section', 4: 'Confirm Payment', 5: '' };
  document.getElementById('pay-step-title').textContent = titles[n] || '';

  // Hide header/nav on success
  const header = document.getElementById('pay-header');
  const nav = document.getElementById('main-nav');
  if (n === 5) {
    header.style.display = 'none';
    nav.style.display = 'none';
  } else {
    header.style.display = '';
    nav.style.display = '';
  }
}

// ── Back button ───────────────────────────────────────────────────
document.getElementById('back-btn').addEventListener('click', () => {
  if (state.step === 1) { navigate('/pages/dashboard.html'); }
  else { showStep(state.step - 1); }
});

// ── STEP 1: QR Scanner + Merchant ─────────────────────────────────
function startScanner() {
  // Auto-fill a random merchant after 2.5s
  setTimeout(() => {
    const m = MERCHANTS[Math.floor(Math.random() * MERCHANTS.length)];
    setMerchant(m, true);
  }, 2500);
}

function setMerchant(name, fromQr = false) {
  state.merchant = name;
  document.getElementById('inp-merchant').value = name;
  document.getElementById('detected-name').textContent = name;
  document.getElementById('merchant-detected').classList.remove('hidden');
  document.getElementById('btn-p1-continue').disabled = false;

  if (fromQr) {
    const center = document.getElementById('qr-center');
    center.innerHTML = `<div style="font-size:20px;">✅</div><div style="font-size:12px;color:var(--green);font-weight:600;">${name}</div>`;
  }
}

document.getElementById('inp-merchant').addEventListener('input', function() {
  const v = this.value.trim();
  state.merchant = v;
  document.getElementById('btn-p1-continue').disabled = !v;
  if (v) {
    document.getElementById('detected-name').textContent = v;
    document.getElementById('merchant-detected').classList.remove('hidden');
  } else {
    document.getElementById('merchant-detected').classList.add('hidden');
  }
});

document.getElementById('btn-p1-continue').addEventListener('click', () => {
  if (!state.merchant) return;
  document.getElementById('amt-merchant-name').textContent = state.merchant;
  showStep(2);
  setTimeout(() => document.getElementById('inp-amount').focus(), 100);
});

// ── STEP 2: Amount ─────────────────────────────────────────────────
document.getElementById('btn-p2-continue').addEventListener('click', () => {
  const v = parseFloat(document.getElementById('inp-amount').value);
  const err = document.getElementById('amt-err');
  if (!v || v <= 0) { err.classList.remove('hidden'); return; }
  err.classList.add('hidden');
  state.amount = v;
  loadSections();
  showStep(3);
});

document.getElementById('inp-amount').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('btn-p2-continue').click();
});

// ── STEP 3: Section Select ─────────────────────────────────────────
async function loadSections() {
  try {
    state.sections = await api('GET', '/sections');
    renderSectionGrid();
  } catch (e) {
    toast('Could not load sections', 'error');
  }
}

function renderSectionGrid() {
  const grid = document.getElementById('section-select-grid');
  grid.innerHTML = '';
  state.selectedSection = null;
  document.getElementById('btn-p3-continue').disabled = true;

  const sub = document.getElementById('p3-subtitle');
  sub.textContent = `Paying ${formatINR(state.amount)} from…`;

  state.sections.forEach(section => {
    const remaining = section.budget - section.spent;
    const isDrained = remaining <= 0;
    const isOverrideAllowed = state.overrideSections.includes(section.id);
    const colour = isDrained ? 'red' : sectionColour(section.budget, section.spent);

    const card = document.createElement('div');
    card.className = 'section-select-card' + (isDrained && !isOverrideAllowed ? ' drained' : '');
    card.dataset.id = section.id;

    const colourHex = colour === 'green' ? '#22C55E' : colour === 'amber' ? '#EAB308' : '#EF4444';

    card.innerHTML = `
      <div style="font-size:28px;margin-bottom:6px;">${section.emoji}</div>
      <div style="font-weight:600;font-size:13px;color:var(--slate-700);margin-bottom:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${section.name}</div>
      ${isDrained && !isOverrideAllowed
        ? `<div style="font-size:10px;color:var(--slate-400);">Done for this month</div>`
        : `<div style="font-size:12px;font-weight:600;color:${colourHex};">${formatINR(remaining)} left</div>`
      }
      ${isOverrideAllowed ? `<div style="font-size:10px;color:var(--orange);margin-top:4px;font-weight:600;">Emergency</div>` : ''}
    `;

    if (!isDrained || isOverrideAllowed) {
      card.addEventListener('click', () => selectSection(section, card));
    }
    grid.appendChild(card);
  });
}

function selectSection(section, cardEl) {
  state.selectedSection = section;
  document.querySelectorAll('.section-select-card').forEach(c => {
    c.classList.remove('selected');
    c.querySelector('.selected-check')?.remove();
  });
  cardEl.classList.add('selected');

  // Add check
  const check = document.createElement('div');
  check.className = 'selected-check';
  check.textContent = '✓';
  cardEl.appendChild(check);

  document.getElementById('btn-p3-continue').disabled = false;
}

document.getElementById('btn-p3-continue').addEventListener('click', () => {
  if (!state.selectedSection) return;
  renderConfirmation();
  showStep(4);
});

// ── STEP 4: Confirmation ───────────────────────────────────────────
function renderConfirmation() {
  const s = state.selectedSection;
  const remaining = s.budget - s.spent;
  const afterPayment = remaining - state.amount;

  document.getElementById('conf-merchant').textContent = state.merchant;
  document.getElementById('conf-amount').textContent = formatINR(state.amount);
  document.getElementById('conf-section-from').textContent = `From: ${s.emoji} ${s.name}`;

  const nudge = document.getElementById('conf-nudge');
  const block = document.getElementById('conf-block');
  const pinBtn = document.getElementById('btn-enter-pin');

  if (afterPayment < 0) {
    // Block
    nudge.classList.add('hidden');
    block.classList.remove('hidden');
    document.getElementById('conf-block-msg').textContent =
      `Not enough budget in ${s.name} (${formatINR(Math.abs(afterPayment))} short). Select a different section.`;
    pinBtn.disabled = true;
    pinBtn.style.opacity = '0.4';
    return;
  }

  block.classList.add('hidden');
  pinBtn.disabled = false;
  pinBtn.style.opacity = '1';

  const pct = s.budget > 0 ? (afterPayment / s.budget) * 100 : 0;
  let nudgeClass = '', nudgeText = '';

  if (s.budget - s.spent === state.amount) {
    nudgeClass = 'danger';
    nudgeText = `⚠️ This will finish your <strong>${s.name}</strong> budget for the month.`;
  } else if (pct < 20) {
    nudgeClass = 'warning';
    nudgeText = `After this payment: <strong>${formatINR(afterPayment)}</strong> left in <strong>${s.name}</strong> this month. ⚠️ Running low on this section.`;
  } else {
    nudgeClass = '';
    nudgeText = `After this payment: <strong>${formatINR(afterPayment)}</strong> left in <strong>${s.name}</strong> this month.`;
  }

  nudge.className = 'confirmation-nudge' + (nudgeClass ? ` ${nudgeClass}` : '');
  nudge.innerHTML = nudgeText;
  nudge.classList.remove('hidden');
}

document.getElementById('btn-change-section').addEventListener('click', () => showStep(3));

// ── PIN Overlay ────────────────────────────────────────────────────
let pinValue = '';

function updatePinDots() {
  for (let i = 0; i < 4; i++) {
    const dot = document.getElementById(`dot-${i}`);
    dot.classList.toggle('filled', i < pinValue.length);
  }
}

document.getElementById('btn-enter-pin').addEventListener('click', () => {
  pinValue = '';
  updatePinDots();
  document.getElementById('pin-error').textContent = '';
  document.getElementById('pin-overlay').classList.add('show');
});

document.getElementById('pin-cancel').addEventListener('click', () => {
  document.getElementById('pin-overlay').classList.remove('show');
  pinValue = '';
  updatePinDots();
});

document.querySelectorAll('.pin-key').forEach(key => {
  key.addEventListener('click', async () => {
    const k = key.dataset.k;
    if (k === 'back') {
      pinValue = pinValue.slice(0, -1);
      updatePinDots();
    } else if (k === '') {
      return;
    } else {
      if (pinValue.length >= 4) return;
      pinValue += k;
      updatePinDots();
      if (pinValue.length === 4) {
        await verifyAndPay();
      }
    }
  });
});

async function verifyAndPay() {
  try {
    const result = await api('POST', '/verify-pin', { pin: pinValue });
    if (!result.valid) {
      // Shake and show error
      const dots = document.getElementById('pin-dots');
      dots.classList.add('pin-shake');
      setTimeout(() => dots.classList.remove('pin-shake'), 500);
      document.getElementById('pin-error').textContent = 'Incorrect PIN. Try again.';
      pinValue = '';
      updatePinDots();
      return;
    }

    // Process payment
    document.getElementById('pin-overlay').classList.remove('show');
    await processPayment();
  } catch (e) {
    toast('Error verifying PIN', 'error');
    pinValue = '';
    updatePinDots();
  }
}

async function processPayment() {
  try {
    const result = await api('POST', '/pay', {
      merchant: state.merchant,
      amount: state.amount,
      sectionId: state.selectedSection.id,
      isOverride: state.isOverride
    });

    const section = result.section;
    const remaining = section.budget - section.spent;

    // Show success
    document.getElementById('succ-merchant').textContent = state.merchant;
    document.getElementById('succ-amount').textContent = formatINR(state.amount);
    document.getElementById('succ-section-name').textContent = `${section.emoji} ${section.name}`;
    document.getElementById('succ-section-remaining').textContent = `${formatINR(Math.max(0, remaining))} remaining this month`;

    const banner = document.getElementById('succ-drained-banner');
    if (remaining <= 0) {
      banner.textContent = `Your ${section.name} budget is done for this month 🔴`;
      banner.classList.remove('hidden');
    } else {
      banner.classList.add('hidden');
    }

    showStep(5);

    // Auto-redirect after 3 seconds
    setTimeout(() => navigate('/pages/dashboard.html'), 3000);
  } catch (e) {
    toast('Payment failed: ' + e.message, 'error');
  }
}

document.getElementById('btn-back-home').addEventListener('click', () => navigate('/pages/dashboard.html'));

// ── Emergency Override ────────────────────────────────────────────
document.getElementById('btn-emergency').addEventListener('click', () => {
  document.getElementById('emergency-overlay').classList.add('show');
  document.getElementById('emergency-input').value = '';
  document.getElementById('btn-emergency-confirm').disabled = true;
});

document.getElementById('emergency-input').addEventListener('input', function() {
  const match = this.value.trim().toLowerCase() === 'i am going over my budget';
  document.getElementById('btn-emergency-confirm').disabled = !match;
});

document.getElementById('btn-emergency-cancel').addEventListener('click', () => {
  document.getElementById('emergency-overlay').classList.remove('show');
});

document.getElementById('btn-emergency-confirm').addEventListener('click', () => {
  document.getElementById('emergency-overlay').classList.remove('show');
  // Allow all drained sections for this payment
  state.isOverride = true;
  state.overrideSections = state.sections.filter(s => s.budget - s.spent <= 0).map(s => s.id);
  renderSectionGrid();
  toast('Emergency override activated. All sections are now selectable.', 'warning');
});

// ── Close overlay on bg click ─────────────────────────────────────
document.getElementById('emergency-overlay').addEventListener('click', function(e) {
  if (e.target === this) this.classList.remove('show');
});

// ── Boot ──────────────────────────────────────────────────────────
startScanner();
