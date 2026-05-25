// ── settings.js ───────────────────────────────────────────────────
import { formatINR, api, navigate, toast } from './utils.js';

let userData = null;
let sectionsData = [];
let billsData = [];

async function loadSettings() {
  try {
    const [settingsRes, sectionsRes, billsRes] = await Promise.all([
      api('GET', '/settings'),
      api('GET', '/sections'),
      api('GET', '/bills')
    ]);

    userData = settingsRes.user;
    sectionsData = sectionsRes;
    billsData = billsRes;
    renderProfile(userData);
    renderSections(sectionsData);
    renderBills(billsData);
  } catch (e) {
    toast('Could not load settings', 'error');
  }
}

function renderProfile(user) {
  if (!user) return;
  const initial = (user.name || '?')[0].toUpperCase();
  document.getElementById('profile-avatar').textContent = initial;
  document.getElementById('profile-name').textContent = user.name;
  document.getElementById('profile-income').textContent = `Monthly income: ${formatINR(user.income)}`;
  document.getElementById('row-name-sub').textContent = user.name;
}

function renderSections(sections) {
  const container = document.getElementById('sections-settings-list');
  if (!sections || sections.length === 0) {
    container.innerHTML = `<div style="font-size:13px;color:var(--slate-400);padding:12px 0;">No sections yet.</div>`;
    return;
  }

  container.innerHTML = sections.map(s => {
    const remaining = s.budget - s.spent;
    const pct = s.budget > 0 ? Math.round((remaining / s.budget) * 100) : 0;
    return `
      <a class="settings-row" href="/pages/section-detail.html?id=${s.id}" style="text-decoration:none;">
        <div class="settings-row-left">
          <div class="settings-row-icon" style="background:var(--slate-50);font-size:22px;">${s.emoji}</div>
          <div>
            <div class="settings-row-title">${s.name}</div>
            <div class="settings-row-subtitle">${formatINR(remaining)} left of ${formatINR(s.budget)} · ${pct}%</div>
          </div>
        </div>
        <span class="settings-arrow">›</span>
      </a>
    `;
  }).join('');
}

function renderBills(bills) {
  const container = document.getElementById('bills-settings-list');
  if (!bills || bills.length === 0) {
    container.innerHTML = '';
    return;
  }

  const today = new Date().getDate();
  container.innerHTML = `<div class="label-sm" style="margin:12px 0 8px;">FIXED BILLS</div>` +
    bills.map(b => {
      const daysLeft = b.dueDay - today;
      let badge = '';
      if (b.paid) badge = `<span style="font-size:11px;padding:2px 8px;border-radius:20px;background:var(--slate-100);color:var(--slate-400);font-weight:600;">Paid ✓</span>`;
      else if (daysLeft < 0) badge = `<span style="font-size:11px;padding:2px 8px;border-radius:20px;background:var(--red-light);color:var(--red);font-weight:600;">Overdue!</span>`;
      else if (daysLeft <= 3) badge = `<span style="font-size:11px;padding:2px 8px;border-radius:20px;background:var(--red-light);color:var(--red);font-weight:600;">${daysLeft}d left</span>`;
      else badge = `<span style="font-size:11px;padding:2px 8px;border-radius:20px;background:var(--green-light);color:var(--green);font-weight:600;">Due ${b.dueDay}th</span>`;

      return `
        <div class="settings-row" style="cursor:default;" data-bill-id="${b.id}">
          <div class="settings-row-left">
            <div class="settings-row-icon" style="background:var(--amber-light);">📋</div>
            <div>
              <div class="settings-row-title">${b.name}</div>
              <div class="settings-row-subtitle">${formatINR(b.amount)} / month</div>
            </div>
          </div>
          ${badge}
        </div>
      `;
    }).join('');
}

// ── Month-end ──────────────────────────────────────────────────────
document.getElementById('row-month-end').addEventListener('click', () => {
  navigate('/pages/month-end.html');
});

// ── Edit Name ─────────────────────────────────────────────────────
document.getElementById('row-edit-profile').addEventListener('click', () => {
  document.getElementById('inp-new-name').value = userData?.name || '';
  document.getElementById('name-overlay').classList.add('show');
});

document.getElementById('btn-name-cancel').addEventListener('click', () => {
  document.getElementById('name-overlay').classList.remove('show');
});

document.getElementById('btn-name-save').addEventListener('click', async () => {
  const name = document.getElementById('inp-new-name').value.trim();
  if (!name) { toast('Please enter a name', 'warning'); return; }

  try {
    await api('POST', '/settings', { name });
    userData.name = name;
    renderProfile(userData);
    toast('Name updated!', 'success');
    document.getElementById('name-overlay').classList.remove('show');
  } catch (e) {
    toast('Failed to update name', 'error');
  }
});

document.getElementById('name-overlay').addEventListener('click', function(e) {
  if (e.target === this) this.classList.remove('show');
});

// ── PIN Change ─────────────────────────────────────────────────────
function getPinValue(rowId) {
  return [...document.querySelectorAll(`[data-row="${rowId}"]`)]
    .map(i => i.value).join('');
}

function clearPinRow(rowId) {
  document.querySelectorAll(`[data-row="${rowId}"]`).forEach(i => i.value = '');
}

function setupPinRow(rowId) {
  const inputs = [...document.querySelectorAll(`[data-row="${rowId}"]`)];
  inputs.forEach((inp, idx) => {
    inp.addEventListener('input', () => {
      if (inp.value.length === 1 && idx < inputs.length - 1) {
        inputs[idx + 1].focus();
      }
    });
    inp.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !inp.value && idx > 0) {
        inputs[idx - 1].focus();
      }
    });
  });
}

setupPinRow('current');
setupPinRow('new');
setupPinRow('confirm');

document.getElementById('row-change-pin').addEventListener('click', () => {
  clearPinRow('current');
  clearPinRow('new');
  clearPinRow('confirm');
  document.getElementById('pin-err').classList.add('hidden');
  document.getElementById('pin-overlay').classList.add('show');
  setTimeout(() => {
    document.querySelector('[data-row="current"][data-idx="0"]').focus();
  }, 300);
});

document.getElementById('btn-pin-cancel').addEventListener('click', () => {
  document.getElementById('pin-overlay').classList.remove('show');
});

document.getElementById('btn-pin-save').addEventListener('click', async () => {
  const currentPin = getPinValue('current');
  const newPin = getPinValue('new');
  const confirmPin = getPinValue('confirm');
  const errEl = document.getElementById('pin-err');
  errEl.classList.add('hidden');

  if (currentPin.length !== 4 || newPin.length !== 4 || confirmPin.length !== 4) {
    errEl.textContent = 'All PIN fields must be 4 digits.';
    errEl.classList.remove('hidden');
    return;
  }
  if (newPin !== confirmPin) {
    errEl.textContent = 'New PIN and confirmation do not match.';
    errEl.classList.remove('hidden');
    return;
  }

  try {
    await api('POST', '/settings', { newPin, currentPin });
    toast('PIN updated!', 'success');
    document.getElementById('pin-overlay').classList.remove('show');
  } catch (e) {
    errEl.textContent = e.data?.error || 'Failed to update PIN.';
    errEl.classList.remove('hidden');
  }
});

document.getElementById('pin-overlay').addEventListener('click', function(e) {
  if (e.target === this) this.classList.remove('show');
});

// ── Reset ──────────────────────────────────────────────────────────
document.getElementById('row-reset').addEventListener('click', () => {
  document.getElementById('reset-confirm-input').value = '';
  document.getElementById('btn-reset-confirm').disabled = true;
  document.getElementById('reset-overlay').classList.add('show');
});

document.getElementById('reset-confirm-input').addEventListener('input', function() {
  document.getElementById('btn-reset-confirm').disabled = this.value.trim() !== 'RESET';
});

document.getElementById('btn-reset-cancel').addEventListener('click', () => {
  document.getElementById('reset-overlay').classList.remove('show');
});

document.getElementById('btn-reset-confirm').addEventListener('click', async () => {
  const btn = document.getElementById('btn-reset-confirm');
  btn.textContent = 'Resetting…';
  btn.disabled = true;
  try {
    await api('POST', '/reset');
    navigate('/pages/onboarding.html');
  } catch (e) {
    toast('Reset failed', 'error');
    btn.textContent = 'Reset App';
    btn.disabled = false;
  }
});

document.getElementById('reset-overlay').addEventListener('click', function(e) {
  if (e.target === this) this.classList.remove('show');
});

loadSettings();

// ── Add Section Sheet ──────────────────────────────────────────────
const EMOJIS = ['🍔','🛍️','🚗','💊','🎬','📚','✈️','🏋️','🐶','🎮','🏠','💻','🎁','🌿','🍺','💐','🧴','🍕','🎨','🛒'];
let newSecEmoji = '';

// Build emoji grid once
const emojiGrid = document.getElementById('new-sec-emoji-grid');
EMOJIS.forEach(e => {
  const btn = document.createElement('button');
  btn.className = 'emoji-btn';
  btn.textContent = e;
  btn.type = 'button';
  btn.addEventListener('click', () => {
    emojiGrid.querySelectorAll('.emoji-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    newSecEmoji = e;
  });
  emojiGrid.appendChild(btn);
});

function openAddSection() {
  document.getElementById('new-sec-name').value = '';
  document.getElementById('new-sec-budget').value = '';
  document.getElementById('new-sec-err').classList.add('hidden');
  emojiGrid.querySelectorAll('.emoji-btn').forEach(b => b.classList.remove('selected'));
  newSecEmoji = '';
  document.getElementById('add-section-overlay').classList.add('show');
  setTimeout(() => document.getElementById('new-sec-name').focus(), 300);
}

document.getElementById('btn-add-section').addEventListener('click', openAddSection);

document.getElementById('btn-add-sec-cancel').addEventListener('click', () => {
  document.getElementById('add-section-overlay').classList.remove('show');
});

document.getElementById('add-section-overlay').addEventListener('click', function(e) {
  if (e.target === this) this.classList.remove('show');
});

document.getElementById('btn-add-sec-save').addEventListener('click', async () => {
  const name   = document.getElementById('new-sec-name').value.trim();
  const budget = parseFloat(document.getElementById('new-sec-budget').value);
  const errEl  = document.getElementById('new-sec-err');
  errEl.classList.add('hidden');

  if (!name) {
    errEl.textContent = 'Please enter a section name.';
    errEl.classList.remove('hidden');
    return;
  }
  if (!newSecEmoji) {
    errEl.textContent = 'Please choose an emoji for this section.';
    errEl.classList.remove('hidden');
    return;
  }
  if (!budget || budget <= 0) {
    errEl.textContent = 'Please enter a valid monthly budget.';
    errEl.classList.remove('hidden');
    return;
  }

  const btn = document.getElementById('btn-add-sec-save');
  btn.textContent = 'Adding…';
  btn.disabled = true;

  try {
    await api('POST', '/sections', { name, emoji: newSecEmoji, budget });
    toast(`${newSecEmoji} ${name} added!`, 'success');
    document.getElementById('add-section-overlay').classList.remove('show');
    // Refresh sections list
    const sections = await api('GET', '/sections');
    sectionsData = sections;
    renderSections(sections);
  } catch (e) {
    errEl.textContent = e.data?.error || 'Failed to add section.';
    errEl.classList.remove('hidden');
  } finally {
    btn.textContent = 'Add Section';
    btn.disabled = false;
  }
});

