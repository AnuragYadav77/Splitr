// ── settings.js — Settings page ───────────────────────────────────
import {
  api, formatINR, getInitials, navigate, toast
} from './utils.js';
import { logout } from './auth.js';

let user = null;

async function load() {
  try {
    user = await api('GET', '/users/me');
    renderProfile(user);
  } catch (e) {
    if (e.type !== 'auth') toast('Could not load profile.', 'error');
  }
}

function renderProfile(u) {
  document.getElementById('profile-name').textContent  = u.fullName || '—';
  document.getElementById('profile-email').textContent = u.email || '—';
  document.getElementById('profile-avatar').textContent = getInitials(u.fullName || '');
  document.getElementById('income-sub').textContent    = u.monthlyIncome ? formatINR(u.monthlyIncome) + ' per month' : 'Not set';
}

// ── Edit Profile ──────────────────────────────────────────────────

document.getElementById('btn-edit-profile').addEventListener('click', () => {
  if (!user) return;
  document.getElementById('prf-name').value  = user.fullName || '';
  document.getElementById('prf-phone').value = user.phoneNumber || '';
  document.getElementById('prf-error').classList.add('hidden');
  document.getElementById('profile-overlay').classList.add('show');
  setTimeout(() => document.getElementById('prf-name').focus(), 300);
});

document.getElementById('btn-prf-cancel').addEventListener('click', () => {
  document.getElementById('profile-overlay').classList.remove('show');
});

document.getElementById('btn-prf-save').addEventListener('click', async () => {
  const name  = document.getElementById('prf-name').value.trim();
  const phone = document.getElementById('prf-phone').value.trim();
  const btn   = document.getElementById('btn-prf-save');
  const errEl = document.getElementById('prf-error');

  if (!name) { errEl.textContent = 'Full name is required.'; errEl.classList.remove('hidden'); return; }
  errEl.classList.add('hidden');
  btn.classList.add('btn-loading');

  try {
    const body = { fullName: name };
    if (phone) body.phoneNumber = phone;
    user = await api('PATCH', '/users/update-profile', body);
    renderProfile(user);
    document.getElementById('profile-overlay').classList.remove('show');
    toast('Profile updated.', 'success');
  } catch (err) {
    errEl.textContent = err.message || 'Could not update profile.';
    errEl.classList.remove('hidden');
  } finally {
    btn.classList.remove('btn-loading');
  }
});

// ── Edit Income ───────────────────────────────────────────────────

document.getElementById('item-income').addEventListener('click', () => {
  document.getElementById('inc-amount').value = user?.monthlyIncome || '';
  document.getElementById('inc-error').classList.add('hidden');
  document.getElementById('income-overlay').classList.add('show');
  setTimeout(() => document.getElementById('inc-amount').focus(), 300);
});

document.getElementById('btn-inc-cancel').addEventListener('click', () => {
  document.getElementById('income-overlay').classList.remove('show');
});

document.getElementById('btn-inc-save').addEventListener('click', async () => {
  const income = Number(document.getElementById('inc-amount').value);
  const btn    = document.getElementById('btn-inc-save');
  const errEl  = document.getElementById('inc-error');

  if (!income || income < 1) {
    errEl.textContent = 'Enter a valid income.';
    errEl.classList.remove('hidden');
    return;
  }
  errEl.classList.add('hidden');
  btn.classList.add('btn-loading');

  try {
    user = await api('PATCH', '/users/update-profile', { monthlyIncome: income });
    renderProfile(user);
    document.getElementById('income-overlay').classList.remove('show');
    toast('Monthly income updated.', 'success');
  } catch (err) {
    errEl.textContent = err.message || 'Could not update income.';
    errEl.classList.remove('hidden');
  } finally {
    btn.classList.remove('btn-loading');
  }
});

// ── Month-end ─────────────────────────────────────────────────────

document.getElementById('item-month-end').addEventListener('click', () => {
  navigate('/pages/month-end.html');
});

// ── Logout ────────────────────────────────────────────────────────

document.getElementById('btn-logout').addEventListener('click', () => {
  if (confirm('Log out of Splitr?')) logout();
});

// ── Close modals ──────────────────────────────────────────────────

['profile-overlay', 'income-overlay'].forEach(id => {
  document.getElementById(id).addEventListener('click', e => {
    if (e.target === e.currentTarget) e.currentTarget.classList.remove('show');
  });
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') document.querySelectorAll('.overlay.show').forEach(el => el.classList.remove('show'));
});

load();
