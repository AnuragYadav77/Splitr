// ── onboarding.js ──────────────────────────────────────────────
import { formatINR, api, navigate } from './utils.js';

const EMOJIS = ['🍔','🛍️','🚗','💊','🎬','📚','✈️','🏋️','🐶','🎮','🏠','💻','🎁','🌿','🍺','💐','🧴','🍕','🎨','🛒'];
const TOTAL_STEPS = 6; // 0..5

let currentStep = 0;
let userData = { name: '', income: 0, sections: [], bills: [], pin: '' };
let selectedEmoji = '';

// ── Step nav ──────────────────────────────────────────────────
function showStep(n) {
  document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
  document.getElementById(`step-${n}`).classList.add('active');
  currentStep = n;
  updateIndicators(n);
}

function updateIndicators(n) {
  for (let i = 1; i <= 5; i++) {
    const el = document.getElementById(`indicator-${i}`);
    if (!el) continue;
    el.innerHTML = '';
    for (let j = 1; j <= 5; j++) {
      const dot = document.createElement('div');
      dot.className = 'step-dot' + (j < i ? ' done' : j === i ? ' active' : '');
      el.appendChild(dot);
    }
  }
}

// ── Demo loader ───────────────────────────────────────────────
document.getElementById('btn-demo').addEventListener('click', async () => {
  const btn = document.getElementById('btn-demo');
  btn.textContent = 'Loading...';
  btn.disabled = true;
  try {
    await api('POST', '/demo', {});
    navigate('/pages/dashboard.html');
  } catch (e) {
    btn.textContent = '⚡ Load Demo Account';
    btn.disabled = false;
    alert('Failed to load demo: ' + e.message);
  }
});

document.getElementById('btn-getstarted').addEventListener('click', () => showStep(1));

// ── Step 1: Name + Income ─────────────────────────────────────
document.getElementById('btn-step1-next').addEventListener('click', () => {
  const name   = document.getElementById('inp-name').value.trim();
  const income = parseFloat(document.getElementById('inp-income').value);
  const err    = document.getElementById('income-err');

  if (!name) { document.getElementById('inp-name').classList.add('error'); return; }
  if (!income || income <= 0) { err.classList.remove('hidden'); return; }
  err.classList.add('hidden');
  document.getElementById('inp-name').classList.remove('error');

  userData.name   = name;
  userData.income = income;
  showStep(2);
  renderAllocated();
});

// ── Step 2: Sections ──────────────────────────────────────────
function renderAllocated() {
  const total     = userData.sections.reduce((s, x) => s + x.budget, 0);
  const income    = userData.income;
  const bar       = document.getElementById('allocated-bar');
  const over      = total > income;
  bar.className   = 'allocated-bar' + (over ? ' over' : '');
  bar.innerHTML   = over
    ? `⚠️ Allocated: ${formatINR(total)} of ${formatINR(income)} — <strong>over by ${formatINR(total - income)}</strong>`
    : `Allocated: <strong>${formatINR(total)}</strong> of ${formatINR(income)} income`;
}

function renderSectionList() {
  const el = document.getElementById('sections-list');
  el.innerHTML = '';
  userData.sections.forEach((s, i) => {
    const row = document.createElement('div');
    row.className = 'section-list-item';
    row.innerHTML = `
      <span style="font-size:22px;">${s.emoji}</span>
      <div>
        <div style="font-weight:600;font-size:14px;">${s.name}</div>
        <div style="font-size:12px;color:var(--slate-400);">${formatINR(s.budget)}/month</div>
      </div>
      <button class="delete-btn" data-i="${i}" title="Remove">✕</button>
    `;
    el.appendChild(row);
  });
  el.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      userData.sections.splice(+btn.dataset.i, 1);
      renderSectionList();
      renderAllocated();
    });
  });
}

// Build emoji grid
const emojiGrid = document.getElementById('emoji-grid');
EMOJIS.forEach(e => {
  const btn = document.createElement('button');
  btn.className = 'emoji-btn';
  btn.textContent = e;
  btn.addEventListener('click', () => {
    document.querySelectorAll('.emoji-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    selectedEmoji = e;
  });
  emojiGrid.appendChild(btn);
});

document.getElementById('btn-show-sec-form').addEventListener('click', () => {
  document.getElementById('section-inline-form').classList.remove('hidden');
  document.getElementById('btn-show-sec-form').classList.add('hidden');
  document.getElementById('sec-name').focus();
  selectedEmoji = '';
  document.querySelectorAll('.emoji-btn').forEach(b => b.classList.remove('selected'));
});

document.getElementById('btn-sec-cancel').addEventListener('click', () => {
  document.getElementById('section-inline-form').classList.add('hidden');
  document.getElementById('btn-show-sec-form').classList.remove('hidden');
});

document.getElementById('btn-sec-add').addEventListener('click', () => {
  const name   = document.getElementById('sec-name').value.trim();
  const budget = parseFloat(document.getElementById('sec-budget').value);
  if (!name || !selectedEmoji || !budget || budget <= 0) {
    document.getElementById('sec-err').textContent = 'Please fill all fields and choose an emoji.';
    document.getElementById('sec-err').classList.remove('hidden');
    return;
  }
  document.getElementById('sec-err').classList.add('hidden');
  userData.sections.push({ name, emoji: selectedEmoji, budget });
  document.getElementById('sec-name').value = '';
  document.getElementById('sec-budget').value = '';
  selectedEmoji = '';
  document.querySelectorAll('.emoji-btn').forEach(b => b.classList.remove('selected'));
  document.getElementById('section-inline-form').classList.add('hidden');
  document.getElementById('btn-show-sec-form').classList.remove('hidden');
  renderSectionList();
  renderAllocated();
});

document.getElementById('btn-step2-next').addEventListener('click', () => {
  const err = document.getElementById('sec-err');
  if (userData.sections.length === 0) {
    err.textContent = 'Add at least one section to continue.';
    err.classList.remove('hidden');
    return;
  }
  const total = userData.sections.reduce((s, x) => s + x.budget, 0);
  if (total > userData.income) {
    err.textContent = "You've allocated more than your income. Adjust before continuing.";
    err.classList.remove('hidden');
    return;
  }
  err.classList.add('hidden');
  showStep(3);
});

// ── Step 3: Bills ──────────────────────────────────────────────
function renderBillList() {
  const el = document.getElementById('bills-list');
  el.innerHTML = '';
  userData.bills.forEach((b, i) => {
    const row = document.createElement('div');
    row.className = 'bill-item-row';
    row.innerHTML = `
      <span style="font-size:20px;">📋</span>
      <div style="flex:1;">
        <div style="font-weight:600;font-size:14px;">${b.name}</div>
        <div style="font-size:12px;color:var(--slate-400);">${formatINR(b.amount)} · Due: ${b.dueDay}${ordinal(b.dueDay)} of month</div>
      </div>
      <button class="delete-btn" data-i="${i}" title="Remove">✕</button>
    `;
    el.appendChild(row);
  });
  el.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      userData.bills.splice(+btn.dataset.i, 1);
      renderBillList();
    });
  });
}

function ordinal(n) {
  const s = ['th','st','nd','rd'], v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

document.getElementById('btn-show-bill-form').addEventListener('click', () => {
  document.getElementById('bill-inline-form').classList.remove('hidden');
  document.getElementById('btn-show-bill-form').classList.add('hidden');
  document.getElementById('bill-name').focus();
});

document.getElementById('btn-bill-cancel').addEventListener('click', () => {
  document.getElementById('bill-inline-form').classList.add('hidden');
  document.getElementById('btn-show-bill-form').classList.remove('hidden');
});

document.getElementById('btn-bill-add').addEventListener('click', () => {
  const name   = document.getElementById('bill-name').value.trim();
  const amount = parseFloat(document.getElementById('bill-amount').value);
  const dueDay = parseInt(document.getElementById('bill-due').value);
  if (!name || !amount || amount <= 0 || !dueDay || dueDay < 1 || dueDay > 31) return;
  userData.bills.push({ name, amount, dueDay });
  document.getElementById('bill-name').value = '';
  document.getElementById('bill-amount').value = '';
  document.getElementById('bill-due').value = '';
  document.getElementById('bill-inline-form').classList.add('hidden');
  document.getElementById('btn-show-bill-form').classList.remove('hidden');
  renderBillList();
});

document.getElementById('btn-step3-next').addEventListener('click', () => showStep(4));
document.getElementById('btn-step3-skip').addEventListener('click', () => showStep(4));

// ── Step 4: PIN ────────────────────────────────────────────────
function setupPinInputs(rowId) {
  const boxes = document.querySelectorAll(`#${rowId} .pin-box`);
  boxes.forEach((box, i) => {
    box.addEventListener('input', () => {
      const v = box.value.replace(/\D/g, '');
      box.value = v.slice(-1);
      if (v && i < boxes.length - 1) boxes[i + 1].focus();
    });
    box.addEventListener('keydown', e => {
      if (e.key === 'Backspace' && !box.value && i > 0) boxes[i - 1].focus();
    });
  });
}
function getPinValue(rowId) {
  return [...document.querySelectorAll(`#${rowId} .pin-box`)].map(b => b.value).join('');
}

setupPinInputs('pin-set-row');
setupPinInputs('pin-confirm-row');

document.getElementById('btn-step4-next').addEventListener('click', () => {
  const pin1 = getPinValue('pin-set-row');
  const pin2 = getPinValue('pin-confirm-row');
  const err  = document.getElementById('pin-err');
  if (pin1.length !== 4) { err.textContent = 'PIN must be 4 digits.'; err.classList.remove('hidden'); return; }
  if (pin1 !== pin2)     { err.textContent = 'PINs do not match. Try again.'; err.classList.remove('hidden'); return; }
  err.classList.add('hidden');
  userData.pin = pin1;
  renderSummary();
  showStep(5);
});

// ── Step 5: Summary ────────────────────────────────────────────
function renderSummary() {
  const totalSections = userData.sections.reduce((s, x) => s + x.budget, 0);
  const totalBills    = userData.bills.reduce((s, x) => s + x.amount, 0);
  const savings       = userData.income - totalSections - totalBills;
  const el            = document.getElementById('summary-content');
  el.innerHTML = `
    <div class="card" style="margin-bottom:12px;">
      <div class="label-sm" style="margin-bottom:12px;">YOUR SECTIONS</div>
      ${userData.sections.map(s => `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--slate-50);">
          <span>${s.emoji} ${s.name}</span>
          <span style="font-weight:600;">${formatINR(s.budget)}</span>
        </div>
      `).join('')}
    </div>
    ${userData.bills.length > 0 ? `
    <div class="card" style="margin-bottom:12px;">
      <div class="label-sm" style="margin-bottom:12px;">FIXED BILLS</div>
      ${userData.bills.map(b => `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--slate-50);">
          <span>📋 ${b.name}</span>
          <span style="font-weight:600;">${formatINR(b.amount)}</span>
        </div>
      `).join('')}
    </div>` : ''}
    <div class="card card-green" style="margin-bottom:12px;">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <span>🫙 Starting Savings Jar</span>
        <span style="font-weight:700;color:var(--green);font-size:16px;">${formatINR(Math.max(0, savings))}</span>
      </div>
      <div style="font-size:11px;color:var(--slate-500);margin-top:4px;">Income minus allocations</div>
    </div>
    <div class="card card-orange">
      <div style="display:flex;justify-content:space-between;">
        <span>Monthly Income</span>
        <span style="font-weight:700;">${formatINR(userData.income)}</span>
      </div>
    </div>
  `;
}

document.getElementById('btn-confirm').addEventListener('click', async () => {
  const btn = document.getElementById('btn-confirm');
  btn.textContent = 'Saving...';
  btn.disabled = true;
  try {
    await api('POST', '/setup', {
      name:     userData.name,
      income:   userData.income,
      pin:      userData.pin,
      sections: userData.sections,
      bills:    userData.bills
    });
    navigate('/pages/dashboard.html');
  } catch (e) {
    btn.textContent = 'Confirm & Start →';
    btn.disabled = false;
    alert('Error: ' + e.message);
  }
});

// Fade in
document.body.style.opacity = '0';
document.body.style.transition = 'opacity 250ms ease';
requestAnimationFrame(() => { document.body.style.opacity = '1'; });
