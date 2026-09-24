// ── transactions.js — Activity page ───────────────────────────────
import {
  api, formatINR, timeAgo, navigate, toast, errorState
} from './utils.js';

let allTransactions = [];
let sections = [];
let currentFilter = 'all';
let currentSection = '';

async function load() {
  try {
    const [txs, secs] = await Promise.all([
      api('GET', '/transactions'),
      api('GET', '/sections'),
    ]);
    allTransactions = txs || [];
    sections = secs || [];

    document.getElementById('tx-subtitle').textContent =
      `${allTransactions.length} transaction${allTransactions.length !== 1 ? 's' : ''}`;

    populateSectionFilter();
    render();
  } catch (e) {
    if (e.type !== 'auth') {
      document.getElementById('tx-list').innerHTML = errorState('Could not load transactions.');
    }
  }
}

function populateSectionFilter() {
  const sel = document.getElementById('section-filter');
  sections.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s._id;
    opt.textContent = `${s.emoji || ''} ${s.name}`.trim();
    sel.appendChild(opt);
  });
  // Also populate add-tx section dropdown
  const txSel = document.getElementById('tx-section');
  sections.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s._id;
    opt.textContent = `${s.emoji || ''} ${s.name}`.trim();
    txSel.appendChild(opt);
  });
}

function getFiltered() {
  return allTransactions.filter(tx => {
    const dirMatch = currentFilter === 'all' || tx.direction === currentFilter;
    const secMatch = !currentSection || (tx.section?._id || tx.section) === currentSection;
    return dirMatch && secMatch;
  });
}

function render() {
  const list  = document.getElementById('tx-list');
  const empty = document.getElementById('tx-empty');
  const filtered = getFiltered();

  if (!filtered || filtered.length === 0) {
    list.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  list.innerHTML = filtered.map(tx => {
    const isCredit = tx.direction === 'credit';
    const sec = tx.section;
    const sectionName  = sec?.name  || '';
    const sectionEmoji = sec?.emoji || '';

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
          <div class="tx-time">${new Date(tx.createdAt).toLocaleDateString('en-IN',{day:'numeric',month:'short'})}</div>
        </div>
      </div>
    `;
  }).join('');
}

// ── Filters ──────────────────────────────────────────────────────

document.querySelectorAll('.pill-filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.pill-filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentFilter = btn.dataset.filter;
    render();
  });
});

document.getElementById('section-filter').addEventListener('change', e => {
  currentSection = e.target.value;
  render();
});

// ── Add Transaction Modal ────────────────────────────────────────

function openModal() {
  document.getElementById('tx-merchant').value = '';
  document.getElementById('tx-amount').value   = '';
  document.getElementById('tx-section').value  = '';
  document.querySelector('input[name="tx-direction"][value="debit"]').checked = true;
  clearErrors();
  document.getElementById('add-tx-overlay').classList.add('show');
  setTimeout(() => document.getElementById('tx-merchant').focus(), 300);
}

function closeModal() {
  document.getElementById('add-tx-overlay').classList.remove('show');
}

function clearErrors() {
  ['tx-merchant', 'tx-amount', 'tx-section'].forEach(id => {
    const el = document.getElementById(`err-${id}`);
    if (el) { el.textContent = ''; el.classList.remove('show'); }
  });
  const fe = document.getElementById('tx-form-error');
  if (fe) fe.classList.add('hidden');
}

async function createTransaction() {
  clearErrors();
  const merchant   = document.getElementById('tx-merchant').value.trim();
  const amount     = parseFloat(document.getElementById('tx-amount').value);
  const sectionId  = document.getElementById('tx-section').value;
  const direction  = document.querySelector('input[name="tx-direction"]:checked')?.value || 'debit';

  let valid = true;
  if (!merchant) { showErr('tx-merchant', 'Merchant name is required.'); valid = false; }
  if (!amount || amount <= 0) { showErr('tx-amount', 'Enter a valid amount.'); valid = false; }
  if (!sectionId) { showErr('tx-section', 'Select a section.'); valid = false; }
  if (!valid) return;

  const btn = document.getElementById('btn-tx-create');
  btn.classList.add('btn-loading');

  try {
    const tx = await api('POST', '/transactions', {
      merchant, amount, section: sectionId, direction
    });
    // Populate section info on the returned tx for rendering
    const sec = sections.find(s => s._id === sectionId);
    tx.section = sec || { _id: sectionId };
    allTransactions.unshift(tx);
    render();
    closeModal();
    toast(`Transaction added.`, 'success');
  } catch (err) {
    const errEl = document.getElementById('tx-form-error');
    errEl.textContent = err.message || 'Could not add transaction.';
    errEl.classList.remove('hidden');
  } finally {
    btn.classList.remove('btn-loading');
  }
}

function showErr(id, msg) {
  const el = document.getElementById(`err-${id}`);
  if (el) { el.textContent = msg; el.classList.add('show'); }
}

document.getElementById('btn-add-tx').addEventListener('click', openModal);
document.getElementById('btn-tx-cancel').addEventListener('click', closeModal);
document.getElementById('btn-tx-create').addEventListener('click', createTransaction);
document.getElementById('empty-add-btn')?.addEventListener('click', openModal);

document.getElementById('add-tx-overlay').addEventListener('click', e => {
  if (e.target === e.currentTarget) closeModal();
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeModal();
});

load();
