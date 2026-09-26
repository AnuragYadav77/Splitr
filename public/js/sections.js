// ── sections.js — Sections list page ──────────────────────────────
import {
  api, formatINR, sectionColour, getRemaining, getPctSpent,
  navigate, toast, errorState
} from './utils.js';
import { setupEmojiDropdown } from './emoji-picker.js';

let sections = [];
let userIncome = 0;
let emojiPicker = null;

async function load() {
  try {
    const [user, secs] = await Promise.all([
      api('GET', '/users/me'),
      api('GET', '/sections'),
    ]);
    sections = secs || [];
    userIncome = user?.monthlyIncome || 0;
    render();
    renderAllocationBar();
  } catch (e) {
    if (e.type !== 'auth') {
      document.getElementById('sections-grid').innerHTML = errorState('Could not load sections.');
    }
  }
}

function render() {
  const grid = document.getElementById('sections-grid');
  const subtitle = document.getElementById('sections-subtitle');

  subtitle.textContent = sections.length === 0
    ? 'Create sections to organise your spending'
    : `${sections.length} section${sections.length !== 1 ? 's' : ''}`;

  if (sections.length === 0) {
    grid.innerHTML = `
      <div style="grid-column:1/-1;">
        <div class="empty-state">
          <div class="empty-state-icon">
            <svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/></svg>
          </div>
          <div class="empty-state-title">No sections yet</div>
          <div class="empty-state-desc">Give your money a purpose. Create your first budget section.</div>
          <button class="btn btn-primary" id="empty-add-btn">Create section</button>
        </div>
      </div>
    `;
    document.getElementById('empty-add-btn')?.addEventListener('click', openModal);
    return;
  }

  grid.innerHTML = sections.map(sec => {
    const remaining = getRemaining(sec.monthlyBudget, sec.spent);
    const pctSpent  = getPctSpent(sec.monthlyBudget, sec.spent);
    const colour    = sectionColour(sec.monthlyBudget, sec.spent);
    const isDrained = remaining <= 0;

    return `
      <div class="section-card card-clickable" data-id="${sec._id}" tabindex="0" role="button" aria-label="${sec.name}: ${formatINR(remaining)} remaining">
        <div class="section-card-header">
          <span class="section-card-emoji">${sec.emoji || '📦'}</span>
          <span class="section-status-dot ${colour}"></span>
        </div>
        <div class="section-card-name">${sec.name}</div>
        <div class="section-card-remaining ${colour}">${isDrained ? '₹0' : formatINR(remaining)}</div>
        <div class="section-card-detail">${pctSpent}% used · ${formatINR(sec.monthlyBudget)} budget</div>
        <div class="progress-track">
          <div class="progress-fill ${colour}" style="width:${pctSpent}%"></div>
        </div>
      </div>
    `;
  }).join('');

  grid.querySelectorAll('.section-card').forEach(card => {
    const handler = () => navigate(`/pages/section-detail.html?id=${card.dataset.id}`);
    card.addEventListener('click', handler);
    card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') handler(); });
  });
}

function renderAllocationBar() {
  const bar = document.getElementById('allocation-bar');
  if (!userIncome || sections.length === 0) return;

  const totalAllocated = sections.reduce((s, sec) => s + (sec.monthlyBudget || 0), 0);
  const pct = Math.min(100, Math.round((totalAllocated / userIncome) * 100));
  const unallocated = Math.max(0, userIncome - totalAllocated);

  document.getElementById('alloc-text').textContent = `${formatINR(totalAllocated)} of ${formatINR(userIncome)} allocated`;
  document.getElementById('alloc-fill').style.width = `${pct}%`;
  bar.classList.remove('hidden');
}

// ── Add Section Modal ─────────────────────────────────────────────

function initPickerIfNeeded() {
  if (!emojiPicker) {
    emojiPicker = setupEmojiDropdown({
      container: '#sec-emoji-dropdown',
      input: '#inp-sec-emoji',
      defaultEmoji: '🍔'
    });
  }
}

function openModal() {
  initPickerIfNeeded();
  document.getElementById('inp-sec-name').value = '';
  document.getElementById('inp-sec-budget').value = '';
  emojiPicker?.setEmoji('🍔');
  clearErrors();
  document.getElementById('add-section-overlay').classList.add('show');
  setTimeout(() => document.getElementById('inp-sec-name').focus(), 300);
}

function closeModal() {
  document.getElementById('add-section-overlay').classList.remove('show');
}

function clearErrors() {
  ['sec-name', 'sec-budget'].forEach(id => {
    const el = document.getElementById(`err-${id}`);
    if (el) { el.textContent = ''; el.classList.remove('show'); }
  });
  const formErr = document.getElementById('sec-form-error');
  if (formErr) formErr.classList.add('hidden');
}

async function createSection() {
  clearErrors();
  const name   = document.getElementById('inp-sec-name').value.trim();
  const emoji  = document.getElementById('inp-sec-emoji').value.trim() || '🍔';
  const budget = Number(document.getElementById('inp-sec-budget').value);

  let valid = true;
  if (!name) {
    showErr('sec-name', 'Section name is required.');
    valid = false;
  }
  if (!budget || budget < 1) {
    showErr('sec-budget', 'Enter a valid monthly budget.');
    valid = false;
  }
  if (!valid) return;

  const btn = document.getElementById('btn-sec-create');
  btn.classList.add('btn-loading');

  try {
    const sec = await api('POST', '/sections', { name, emoji, monthlyBudget: budget });
    sections.unshift(sec);
    render();
    renderAllocationBar();
    closeModal();
    toast(`${name} section created.`, 'success');
  } catch (err) {
    const errEl = document.getElementById('sec-form-error');
    errEl.textContent = err.message || 'Could not create section.';
    errEl.classList.remove('hidden');
  } finally {
    btn.classList.remove('btn-loading');
  }
}

function showErr(id, msg) {
  const el = document.getElementById(`err-${id}`);
  if (el) { el.textContent = msg; el.classList.add('show'); }
  const inp = document.getElementById(`inp-${id}`);
  if (inp) inp.classList.add('input-error');
}

// ── Events ───────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  initPickerIfNeeded();
  document.getElementById('btn-add-section').addEventListener('click', openModal);
  document.getElementById('btn-sec-cancel').addEventListener('click', closeModal);
  document.getElementById('btn-sec-create').addEventListener('click', createSection);

  // Close on overlay click
  document.getElementById('add-section-overlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeModal();
  });

  // Close on Escape
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeModal();
  });
});

load();
