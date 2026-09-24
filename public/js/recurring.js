// ── recurring.js — Recurring Payments page ────────────────────────
import { api, formatINR, formatDate, toast, errorState } from './utils.js';

let payments = [];

async function load() {
  try {
    const [all, upcoming] = await Promise.all([
      api('GET', '/recurring-payments'),
      api('GET', '/recurring-payments/upcoming').catch(() => []),
    ]);
    payments = all || [];
    render(upcoming || []);
  } catch (e) {
    if (e.type !== 'auth') {
      document.getElementById('rec-list').innerHTML = errorState('Could not load recurring payments.');
    }
  }
}

function render(upcoming) {
  const list  = document.getElementById('rec-list');
  const empty = document.getElementById('rec-empty');

  if (upcoming && upcoming.length > 0) {
    const upcomingSec = document.getElementById('upcoming-section');
    upcomingSec.classList.remove('hidden');
    document.getElementById('upcoming-list').innerHTML = upcoming.map(p => paymentCard(p, true)).join('');
  }

  if (payments.length === 0) {
    list.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }

  empty.classList.add('hidden');
  list.innerHTML = payments.map(p => paymentCard(p, false)).join('');
  attachListeners(list);
  attachListeners(document.getElementById('upcoming-list'));
}

function paymentCard(p, isUpcoming) {
  const dueDate = p.nextDueDate ? formatDate(p.nextDueDate) : '—';
  return `
    <div class="recurring-card${isUpcoming ? ' card-clickable' : ''}">
      <div class="recurring-icon">
        <svg viewBox="0 0 24 24"><path d="M1 4v6h6M23 20v-6h-6M20.49 9A9 9 0 005.64 5.64L1 10M23 14l-4.64 4.36A9 9 0 013.51 15"/></svg>
      </div>
      <div class="recurring-info">
        <div class="recurring-name">${p.name}</div>
        <div class="recurring-meta">Next: ${dueDate}</div>
      </div>
      <div>
        <div class="recurring-amount">${formatINR(p.amount)}</div>
        <div class="recurring-freq">${p.frequency}</div>
      </div>
      <div style="display:flex;flex-direction:column;gap:4px;margin-left:6px;">
        <button class="icon-btn ${p.isActive ? '' : 'danger'}" data-toggle-id="${p._id}" title="${p.isActive ? 'Pause' : 'Resume'}">
          <svg viewBox="0 0 24 24">${p.isActive ? '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>' : '<polygon points="5 3 19 12 5 21 5 3"/>'}</svg>
        </button>
        <button class="icon-btn danger" data-del-rec-id="${p._id}" title="Delete">
          <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6M10 11v6M14 11v6"/></svg>
        </button>
      </div>
    </div>
  `;
}

function attachListeners(container) {
  if (!container) return;
  container.querySelectorAll('[data-toggle-id]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.toggleId;
      btn.disabled = true;
      try {
        await api('PATCH', `/recurring-payments/${id}/toggle`);
        payments = await api('GET', '/recurring-payments');
        document.getElementById('upcoming-section').classList.add('hidden');
        const upcoming = await api('GET', '/recurring-payments/upcoming').catch(() => []);
        render(upcoming);
        toast('Payment updated.', 'success');
      } catch (err) {
        toast(err.message || 'Could not update payment.', 'error');
        btn.disabled = false;
      }
    });
  });

  container.querySelectorAll('[data-del-rec-id]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.delRecId;
      if (!confirm('Delete this recurring payment?')) return;
      btn.disabled = true;
      try {
        await api('DELETE', `/recurring-payments/${id}`);
        payments = payments.filter(p => p._id !== id);
        render([]);
        toast('Recurring payment deleted.', 'success');
      } catch (err) {
        toast(err.message || 'Could not delete.', 'error');
        btn.disabled = false;
      }
    });
  });
}

// ── Add Recurring ─────────────────────────────────────────────────

function openModal() {
  ['rec-name', 'rec-amount', 'rec-date'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  document.getElementById('rec-freq').value = 'monthly';
  document.getElementById('rec-form-error').classList.add('hidden');
  // Set default date to tomorrow
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  document.getElementById('rec-date').value = tomorrow.toISOString().split('T')[0];
  document.getElementById('add-rec-overlay').classList.add('show');
  setTimeout(() => document.getElementById('rec-name').focus(), 300);
}

function closeModal() {
  document.getElementById('add-rec-overlay').classList.remove('show');
}

async function createPayment() {
  const name      = document.getElementById('rec-name').value.trim();
  const amount    = Number(document.getElementById('rec-amount').value);
  const frequency = document.getElementById('rec-freq').value;
  const nextDueDate = document.getElementById('rec-date').value;

  let valid = true;
  ['rec-name', 'rec-amount', 'rec-date'].forEach(id => {
    const el = document.getElementById(`err-${id}`); if (el) { el.textContent=''; el.classList.remove('show'); }
  });

  if (!name) { showErr('rec-name', 'Name required.'); valid = false; }
  if (!amount || amount < 1) { showErr('rec-amount', 'Enter a valid amount.'); valid = false; }
  if (!nextDueDate) { showErr('rec-date', 'Select a due date.'); valid = false; }
  if (!valid) return;

  const btn = document.getElementById('btn-rec-create');
  btn.classList.add('btn-loading');

  try {
    const p = await api('POST', '/recurring-payments', { name, amount, frequency, nextDueDate });
    payments.unshift(p);
    document.getElementById('upcoming-section').classList.add('hidden');
    const upcoming = await api('GET', '/recurring-payments/upcoming').catch(() => []);
    render(upcoming);
    closeModal();
    toast(`${name} added.`, 'success');
  } catch (err) {
    const errEl = document.getElementById('rec-form-error');
    errEl.textContent = err.message || 'Could not add payment.';
    errEl.classList.remove('hidden');
  } finally {
    btn.classList.remove('btn-loading');
  }
}

function showErr(id, msg) {
  const el = document.getElementById(`err-${id}`);
  if (el) { el.textContent = msg; el.classList.add('show'); }
}

document.getElementById('btn-add-rec').addEventListener('click', openModal);
document.getElementById('empty-add-rec')?.addEventListener('click', openModal);
document.getElementById('btn-rec-cancel').addEventListener('click', closeModal);
document.getElementById('btn-rec-create').addEventListener('click', createPayment);
document.getElementById('add-rec-overlay').addEventListener('click', e => {
  if (e.target === e.currentTarget) closeModal();
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

load();
