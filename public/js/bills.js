// ── bills.js — Bills page ─────────────────────────────────────────
import { api, formatINR, toast, errorState } from './utils.js';

let bills = [];

function ordinal(n) {
  const s = ['th','st','nd','rd'], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

async function load() {
  try {
    bills = await api('GET', '/bills');
    bills = bills || [];
    render();
  } catch (e) {
    if (e.type !== 'auth') {
      document.getElementById('bills-loading').innerHTML = errorState('Could not load bills.');
    }
  }
}

function render() {
  document.getElementById('bills-loading').classList.add('hidden');
  const today = new Date().getDate();

  if (bills.length === 0) {
    document.getElementById('bills-empty').classList.remove('hidden');
    return;
  }

  document.getElementById('bills-empty').classList.add('hidden');

  // Summary
  const totalAmt  = bills.reduce((s, b) => s + b.amount, 0);
  const paidAmt   = bills.filter(b => b.isPaid).reduce((s, b) => s + b.amount, 0);
  const unpaidAmt = bills.filter(b => !b.isPaid).reduce((s, b) => s + b.amount, 0);
  document.getElementById('sum-total').textContent  = formatINR(totalAmt);
  document.getElementById('sum-paid').textContent   = formatINR(paidAmt);
  document.getElementById('sum-unpaid').textContent = formatINR(unpaidAmt);
  document.getElementById('bills-subtitle').textContent = `${bills.length} bill${bills.length !== 1 ? 's' : ''}`;
  document.getElementById('bills-summary').classList.remove('hidden');

  const unpaid = bills.filter(b => !b.isPaid);
  const paid   = bills.filter(b => b.isPaid);

  const upaidSec = document.getElementById('unpaid-section');
  const paidSec  = document.getElementById('paid-section');

  if (unpaid.length > 0) {
    upaidSec.classList.remove('hidden');
    document.getElementById('unpaid-list').innerHTML = unpaid.map(b => billRow(b, today)).join('');
  }

  if (paid.length > 0) {
    paidSec.classList.remove('hidden');
    document.getElementById('paid-list').innerHTML = paid.map(b => billRow(b, today)).join('');
  }

  // Pay/unpay buttons
  document.querySelectorAll('[data-pay-id]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id     = btn.dataset.payId;
      const isPaid = btn.dataset.paid === 'true';
      btn.disabled = true;
      try {
        if (isPaid) {
          await api('PATCH', `/bills/${id}/unpay`);
        } else {
          await api('PATCH', `/bills/${id}/pay`);
        }
        bills = await api('GET', '/bills');
        document.getElementById('unpaid-section').classList.add('hidden');
        document.getElementById('paid-section').classList.add('hidden');
        render();
        toast(isPaid ? 'Marked as unpaid.' : 'Marked as paid.', 'success');
      } catch (err) {
        toast(err.message || 'Could not update bill.', 'error');
        btn.disabled = false;
      }
    });
  });

  // Delete buttons
  document.querySelectorAll('[data-del-id]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.delId;
      if (!confirm('Delete this bill?')) return;
      btn.disabled = true;
      try {
        await api('DELETE', `/bills/${id}`);
        bills = bills.filter(b => b._id !== id);
        document.getElementById('unpaid-section').classList.add('hidden');
        document.getElementById('paid-section').classList.add('hidden');
        render();
        toast('Bill deleted.', 'success');
      } catch (err) {
        toast(err.message || 'Could not delete bill.', 'error');
        btn.disabled = false;
      }
    });
  });
}

function billRow(b, today) {
  const daysLeft = b.dueDay - today;
  let badge = '', badgeClass = '';
  if (b.isPaid) { badge = 'Paid'; badgeClass = 'badge-green'; }
  else if (daysLeft < 0) { badge = 'Overdue'; badgeClass = 'badge-red'; }
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
        <div style="display:flex;align-items:center;gap:6px;justify-content:flex-end;margin-top:4px;">
          <span class="badge ${badgeClass}">${badge}</span>
        </div>
      </div>
      <div style="display:flex;flex-direction:column;gap:4px;margin-left:6px;flex-shrink:0;">
        <button class="icon-btn" data-pay-id="${b._id}" data-paid="${b.isPaid}" title="${b.isPaid ? 'Mark unpaid' : 'Mark paid'}">
          <svg viewBox="0 0 24 24"><polyline points="${b.isPaid ? '9 14 4 9 9 4' : '20 6 9 17 4 12'}"/>${b.isPaid ? '<line x1="20" y1="9" x2="4" y2="9"/>' : ''}</svg>
        </button>
        <button class="icon-btn danger" data-del-id="${b._id}" title="Delete">
          <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6M10 11v6M14 11v6M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
        </button>
      </div>
    </div>
  `;
}

// ── Add Bill ──────────────────────────────────────────────────────

function openModal() {
  ['bill-name', 'bill-amount', 'bill-due'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  ['bill-name', 'bill-amount', 'bill-due'].forEach(id => {
    const el = document.getElementById(`err-${id}`); if (el) { el.textContent=''; el.classList.remove('show'); }
  });
  document.getElementById('bill-form-error').classList.add('hidden');
  document.getElementById('add-bill-overlay').classList.add('show');
  setTimeout(() => document.getElementById('bill-name').focus(), 300);
}

function closeModal() {
  document.getElementById('add-bill-overlay').classList.remove('show');
}

async function createBill() {
  const name   = document.getElementById('bill-name').value.trim();
  const amount = Number(document.getElementById('bill-amount').value);
  const dueDay = Number(document.getElementById('bill-due').value);

  let valid = true;
  ['bill-name', 'bill-amount', 'bill-due'].forEach(id => {
    const el = document.getElementById(`err-${id}`); if (el) { el.textContent=''; el.classList.remove('show'); }
  });

  if (!name) { showErr('bill-name', 'Bill name required.'); valid = false; }
  if (!amount || amount < 1) { showErr('bill-amount', 'Enter a valid amount.'); valid = false; }
  if (!dueDay || dueDay < 1 || dueDay > 31) { showErr('bill-due', 'Enter a day between 1 and 31.'); valid = false; }
  if (!valid) return;

  const btn = document.getElementById('btn-bill-create');
  btn.classList.add('btn-loading');

  try {
    const bill = await api('POST', '/bills', { name, amount, dueDay });
    bills.unshift(bill);
    document.getElementById('unpaid-section').classList.add('hidden');
    document.getElementById('paid-section').classList.add('hidden');
    render();
    closeModal();
    toast(`${name} added.`, 'success');
  } catch (err) {
    const errEl = document.getElementById('bill-form-error');
    errEl.textContent = err.message || 'Could not add bill.';
    errEl.classList.remove('hidden');
  } finally {
    btn.classList.remove('btn-loading');
  }
}

function showErr(id, msg) {
  const el = document.getElementById(`err-${id}`);
  if (el) { el.textContent = msg; el.classList.add('show'); }
}

document.getElementById('btn-add-bill').addEventListener('click', openModal);
document.getElementById('empty-add-bill')?.addEventListener('click', openModal);
document.getElementById('btn-bill-cancel').addEventListener('click', closeModal);
document.getElementById('btn-bill-create').addEventListener('click', createBill);

document.getElementById('add-bill-overlay').addEventListener('click', e => {
  if (e.target === e.currentTarget) closeModal();
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

load();
