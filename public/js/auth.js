// ── auth.js — Authentication module ──────────────────────────────
import { api, saveAccessToken, getAccessToken, clearAccessToken, navigate, toast } from './utils.js';

// ── Register ────────────────────────────────────────────────────

export async function handleRegister(e) {
  e.preventDefault();
  const form = e.target;
  const btn = form.querySelector('[type="submit"]');

  const fullName     = form.querySelector('#inp-fullname')?.value.trim();
  const email        = form.querySelector('#inp-email')?.value.trim();
  const phoneNumber  = form.querySelector('#inp-phone')?.value.trim();
  const password     = form.querySelector('#inp-password')?.value;
  const monthlyIncome = Number(form.querySelector('#inp-income')?.value);

  // Clear previous errors
  clearErrors(form);

  // Validate
  let valid = true;
  if (!fullName) { showError(form, 'fullname', 'Full name is required.'); valid = false; }
  if (!email || !email.includes('@')) { showError(form, 'email', 'Enter a valid email.'); valid = false; }
  if (!password || password.length < 8) { showError(form, 'password', 'Password must be at least 8 characters.'); valid = false; }
  if (!monthlyIncome || monthlyIncome < 1) { showError(form, 'income', 'Enter your monthly income.'); valid = false; }
  if (!valid) return;

  btn.classList.add('btn-loading');

  try {
    const body = { fullName, email, password, monthlyIncome };
    if (phoneNumber) body.phoneNumber = phoneNumber;
    await api('POST', '/users/register', body, { noRefresh: true });

    // Auto-login after register
    const loginData = await api('POST', '/users/login', { email, password }, { noRefresh: true });
    if (loginData?.accessToken) saveAccessToken(loginData.accessToken);
    navigate('/pages/dashboard.html');
  } catch (err) {
    btn.classList.remove('btn-loading');
    const msg = err.message || 'Registration failed. Please try again.';
    showFormError(form, msg);
  }
}

// ── Login ────────────────────────────────────────────────────────

export async function handleLogin(e) {
  e.preventDefault();
  const form = e.target;
  const btn = form.querySelector('[type="submit"]');

  const email    = form.querySelector('#inp-email')?.value.trim();
  const password = form.querySelector('#inp-password')?.value;

  clearErrors(form);

  let valid = true;
  if (!email) { showError(form, 'email', 'Email is required.'); valid = false; }
  if (!password) { showError(form, 'password', 'Password is required.'); valid = false; }
  if (!valid) return;

  btn.classList.add('btn-loading');

  try {
    const data = await api('POST', '/users/login', { email, password }, { noRefresh: true });
    if (data?.accessToken) saveAccessToken(data.accessToken);
    navigate('/pages/dashboard.html');
  } catch (err) {
    btn.classList.remove('btn-loading');
    const msg = err.message || 'Login failed. Please check your credentials.';
    showFormError(form, msg);
  }
}

// ── Logout ───────────────────────────────────────────────────────

export async function logout() {
  try {
    await api('POST', '/users/logout');
  } catch { /* ignore */ }
  clearAccessToken();
  navigate('/pages/login.html');
}

// ── Forgot Password (Email Link Flow) ──────────────────────────────

export async function handleForgotPassword(e) {
  e.preventDefault();
  const form = e.target;
  const btn = form.querySelector('[type="submit"]');
  const errBox = form.querySelector('#forgot-form-error');
  const emailInput = form.querySelector('#forgot-email');
  const email = emailInput?.value.trim();

  // Clear previous errors
  if (errBox) { errBox.textContent = ''; errBox.classList.add('hidden'); }
  form.querySelectorAll('.input-error-msg').forEach(el => { el.textContent = ''; el.classList.remove('show'); });

  if (!email || !email.includes('@')) {
    const el = form.querySelector('#err-forgot-email');
    if (el) { el.textContent = 'Enter a valid registered email address.'; el.classList.add('show'); }
    return;
  }

  btn.classList.add('btn-loading');

  try {
    const res = await api('POST', '/users/forgot-password', { email }, { noRefresh: true });
    btn.classList.remove('btn-loading');

    // Switch modal content to "Email Sent" confirmation view
    const promptView = document.getElementById('forgot-prompt-view');
    const sentView = document.getElementById('forgot-sent-view');
    const sentEmailDisplay = document.getElementById('forgot-sent-email-display');

    if (sentEmailDisplay) sentEmailDisplay.textContent = email;
    if (promptView) promptView.classList.add('hidden');
    if (sentView) sentView.classList.remove('hidden');

    toast('Password reset email sent!', 'success');

  } catch (err) {
    btn.classList.remove('btn-loading');
    const msg = err.message || 'Could not send reset email. Please check your email address.';
    if (errBox) {
      errBox.textContent = msg;
      errBox.classList.remove('hidden');
    } else {
      toast(msg, 'error');
    }
  }
}

// ── Helpers ──────────────────────────────────────────────────────

function showError(form, fieldId, msg) {
  const inp = form.querySelector(`#inp-${fieldId}`);
  const err = form.querySelector(`#err-${fieldId}`);
  if (inp) inp.classList.add('input-error');
  if (err) { err.textContent = msg; err.classList.add('show'); }
}

function clearErrors(form) {
  form.querySelectorAll('.input-error').forEach(el => el.classList.remove('input-error'));
  form.querySelectorAll('.input-error-msg').forEach(el => { el.textContent = ''; el.classList.remove('show'); });
  const formErr = form.querySelector('#form-error');
  if (formErr) { formErr.textContent = ''; formErr.classList.add('hidden'); }
}

function showFormError(form, msg) {
  const el = form.querySelector('#form-error');
  if (el) { el.textContent = msg; el.classList.remove('hidden'); }
  else toast(msg, 'error');
}
