// ── savings.js — Savings Goals page ───────────────────────────────
import { api, formatINR, formatDate, toast, errorState } from './utils.js';

let goals = [];
let depositType = 'deposit';

async function load() {
  try {
    goals = await api('GET', '/savings-goals');
    goals = goals || [];
    render();
  } catch (e) {
    if (e.type !== 'auth') {
      document.getElementById('goals-grid').innerHTML = errorState('Could not load savings goals.');
    }
  }
}

function render() {
  const grid  = document.getElementById('goals-grid');
  const empty = document.getElementById('goals-empty');

  if (goals.length === 0) {
    grid.innerHTML = '';
    empty.classList.remove('hidden');
    document.getElementById('savings-summary').classList.add('hidden');
    return;
  }

  empty.classList.add('hidden');

  // Summary
  const totalSaved = goals.reduce((s, g) => s + (g.currentAmount || 0), 0);
  document.getElementById('total-saved').textContent = formatINR(totalSaved);
  document.getElementById('goals-count').textContent = `Across ${goals.length} goal${goals.length !== 1 ? 's' : ''}`;
  document.getElementById('savings-summary').classList.remove('hidden');

  grid.innerHTML = goals.map(g => {
    const pct  = g.targetAmount > 0 ? Math.min(100, Math.round((g.currentAmount / g.targetAmount) * 100)) : 0;
    const done = g.isCompleted || pct >= 100;

    return `
      <div class="goal-card">
        ${done ? '<div class="goal-complete-badge"><svg viewBox="0 0 16 16" width="12" style="stroke:#16A34A;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;"><polyline points="2 8 6 12 14 4"/></svg>Goal reached</div>' : ''}
        <div class="goal-card-name">${g.name || 'Unnamed Goal'}</div>
        <div class="goal-card-amounts">
          <span class="goal-current">${formatINR(g.currentAmount)}</span>
          <span class="goal-target"> / ${formatINR(g.targetAmount)}</span>
        </div>
        <div class="goal-progress-track">
          <div class="goal-progress-fill" style="width:${pct}%;background:${done ? 'var(--green-500)' : 'var(--indigo-500)'};"></div>
        </div>
        <div class="goal-meta">
          <span>${pct}% complete</span>
          ${g.deadline ? `<span>By ${formatDate(g.deadline)}</span>` : ''}
        </div>
        <div class="card-actions" style="margin-top:14px;padding-top:12px;border-top:1px solid var(--n-100);">
          <button class="btn btn-secondary" data-dep-id="${g._id}" data-dep-name="${g.name}" data-dep-current="${g.currentAmount}" data-dep-target="${g.targetAmount}">Add / Withdraw</button>
          <button class="icon-btn danger" data-del-goal-id="${g._id}" title="Delete goal">
            <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6M10 11v6M14 11v6"/></svg>
          </button>
        </div>
      </div>
    `;
  }).join('');

  // Deposit/withdraw buttons
  grid.querySelectorAll('[data-dep-id]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id     = btn.dataset.depId;
      const name   = btn.dataset.depName;
      const current = Number(btn.dataset.depCurrent);
      const target  = Number(btn.dataset.depTarget);
      openDepositModal(id, name, current, target);
    });
  });

  // Delete goal buttons
  grid.querySelectorAll('[data-del-goal-id]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.delGoalId;
      if (!confirm('Delete this savings goal?')) return;
      btn.disabled = true;
      try {
        await api('DELETE', `/savings-goals/${id}`);
        goals = goals.filter(g => g._id !== id);
        render();
        toast('Goal deleted.', 'success');
      } catch (err) {
        toast(err.message || 'Could not delete goal.', 'error');
        btn.disabled = false;
      }
    });
  });
}

// ── Create Goal ───────────────────────────────────────────────────

function openCreateModal() {
  document.getElementById('goal-name').value     = '';
  document.getElementById('goal-target').value   = '';
  document.getElementById('goal-deadline').value = '';
  ['goal-name', 'goal-target'].forEach(id => {
    const el = document.getElementById(`err-${id}`);
    if (el) { el.textContent = ''; el.classList.remove('show'); }
  });
  document.getElementById('goal-form-error').classList.add('hidden');
  document.getElementById('add-goal-overlay').classList.add('show');
  setTimeout(() => document.getElementById('goal-name').focus(), 300);
}

function closeCreateModal() {
  document.getElementById('add-goal-overlay').classList.remove('show');
}

async function createGoal() {
  const name     = document.getElementById('goal-name').value.trim();
  const target   = Number(document.getElementById('goal-target').value);
  const deadline = document.getElementById('goal-deadline').value;

  let valid = true;
  ['goal-name', 'goal-target'].forEach(id => {
    const el = document.getElementById(`err-${id}`); if (el) { el.textContent=''; el.classList.remove('show'); }
  });

  if (!name) { showErr('goal-name', 'Goal name required.'); valid = false; }
  if (!target || target < 1) { showErr('goal-target', 'Enter a valid target amount.'); valid = false; }
  if (!valid) return;

  const btn = document.getElementById('btn-goal-create');
  btn.classList.add('btn-loading');

  try {
    const body = { name, targetAmount: target };
    if (deadline) body.deadline = deadline;
    const goal = await api('POST', '/savings-goals', body);
    goals.unshift(goal);
    render();
    closeCreateModal();
    toast(`${name} goal created.`, 'success');
  } catch (err) {
    const errEl = document.getElementById('goal-form-error');
    errEl.textContent = err.message || 'Could not create goal.';
    errEl.classList.remove('hidden');
  } finally {
    btn.classList.remove('btn-loading');
  }
}

// ── Deposit / Withdraw ────────────────────────────────────────────

function openDepositModal(id, name, current, target) {
  document.getElementById('deposit-goal-id').value = id;
  document.getElementById('deposit-title').textContent = name;
  document.getElementById('deposit-subtitle').textContent =
    `${formatINR(current)} saved of ${formatINR(target)}`;
  document.getElementById('deposit-amount').value = '';
  document.getElementById('err-deposit-amount').textContent = '';
  document.getElementById('err-deposit-amount').classList.remove('show');
  document.getElementById('deposit-error').classList.add('hidden');
  depositType = 'deposit';
  document.getElementById('tab-deposit').classList.add('active');
  document.getElementById('tab-withdraw').classList.remove('active');
  document.getElementById('deposit-overlay').classList.add('show');
  setTimeout(() => document.getElementById('deposit-amount').focus(), 300);
}

function closeDepositModal() {
  document.getElementById('deposit-overlay').classList.remove('show');
}

document.getElementById('tab-deposit').addEventListener('click', () => {
  depositType = 'deposit';
  document.getElementById('tab-deposit').classList.add('active');
  document.getElementById('tab-withdraw').classList.remove('active');
});

document.getElementById('tab-withdraw').addEventListener('click', () => {
  depositType = 'withdraw';
  document.getElementById('tab-withdraw').classList.add('active');
  document.getElementById('tab-deposit').classList.remove('active');
});

document.getElementById('btn-deposit-confirm').addEventListener('click', async () => {
  const id     = document.getElementById('deposit-goal-id').value;
  const amount = Number(document.getElementById('deposit-amount').value);

  if (!amount || amount < 1) {
    const el = document.getElementById('err-deposit-amount');
    el.textContent = 'Enter a valid amount.';
    el.classList.add('show');
    return;
  }

  const btn = document.getElementById('btn-deposit-confirm');
  btn.classList.add('btn-loading');

  try {
    const url = depositType === 'deposit'
      ? `/savings-goals/${id}/deposit`
      : `/savings-goals/${id}/withdraw`;
    const updated = await api('POST', url, { amount });

    // Update local state
    const idx = goals.findIndex(g => g._id === id);
    if (idx !== -1) goals[idx] = updated;
    render();
    closeDepositModal();
    toast(depositType === 'deposit' ? `${formatINR(amount)} deposited.` : `${formatINR(amount)} withdrawn.`, 'success');
  } catch (err) {
    const errEl = document.getElementById('deposit-error');
    errEl.textContent = err.message || 'Could not update goal.';
    errEl.classList.remove('hidden');
  } finally {
    btn.classList.remove('btn-loading');
  }
});

function showErr(id, msg) {
  const el = document.getElementById(`err-${id}`);
  if (el) { el.textContent = msg; el.classList.add('show'); }
}

document.getElementById('btn-add-goal').addEventListener('click', openCreateModal);
document.getElementById('empty-add-goal')?.addEventListener('click', openCreateModal);
document.getElementById('btn-goal-cancel').addEventListener('click', closeCreateModal);
document.getElementById('btn-goal-create').addEventListener('click', createGoal);
document.getElementById('btn-deposit-cancel').addEventListener('click', closeDepositModal);

['add-goal-overlay', 'deposit-overlay'].forEach(id => {
  document.getElementById(id).addEventListener('click', e => {
    if (e.target === e.currentTarget) e.currentTarget.classList.remove('show');
  });
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') document.querySelectorAll('.overlay.show').forEach(el => el.classList.remove('show'));
});

load();
