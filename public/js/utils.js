// ── utils.js — shared utility functions ──────────────────────────

const BASE = '/api/v1';

/**
 * Format a number as Indian Rupee (₹1,20,000)
 */
export function formatINR(amount) {
  if (amount === null || amount === undefined || isNaN(amount)) return '₹0';
  const num = Math.abs(Math.round(Number(amount)));
  const str = num.toString();
  let result = '';
  if (str.length <= 3) {
    result = str;
  } else {
    result = str.slice(-3);
    let remaining = str.slice(0, -3);
    while (remaining.length > 2) {
      result = remaining.slice(-2) + ',' + result;
      remaining = remaining.slice(0, -2);
    }
    result = remaining + ',' + result;
  }
  return (amount < 0 ? '-₹' : '₹') + result;
}

/**
 * Format a date as "19 September 2026"
 */
export function formatDate(dateStr) {
  const d = dateStr ? new Date(dateStr) : new Date();
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
}

/**
 * Format date as "19 Sep"
 */
export function formatDateShort(dateStr) {
  const d = dateStr ? new Date(dateStr) : new Date();
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

/**
 * Return relative time string ("2 hours ago", "Yesterday")
 */
export function timeAgo(dateStr) {
  if (!dateStr) return '';
  const now = new Date();
  const d = new Date(dateStr);
  const diffMs = now - d;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr  = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffMin < 1)  return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24)  return `${diffHr}h ago`;
  if (diffDay === 1) return 'Yesterday';
  if (diffDay < 7)  return `${diffDay} days ago`;
  return formatDateShort(dateStr);
}

/**
 * Get colour key for section based on % spent
 */
export function sectionColour(monthlyBudget, spent) {
  if (!monthlyBudget || monthlyBudget <= 0) return 'red';
  const pctSpent = (spent / monthlyBudget) * 100;
  if (pctSpent >= 100) return 'red';
  if (pctSpent >= 80)  return 'amber';
  return 'green';
}

/**
 * Get remaining amount
 */
export function getRemaining(monthlyBudget, spent) {
  return Math.max(0, (monthlyBudget || 0) - (spent || 0));
}

/**
 * Get % spent (0-100, capped)
 */
export function getPctSpent(monthlyBudget, spent) {
  if (!monthlyBudget || monthlyBudget <= 0) return 100;
  return Math.min(100, Math.round((spent / monthlyBudget) * 100));
}

/**
 * Get initials from full name
 */
export function getInitials(fullName) {
  if (!fullName) return '?';
  return fullName.trim().split(/\s+/).map(w => w[0]).join('').slice(0,2).toUpperCase();
}

/**
 * Get greeting based on time of day
 */
export function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

/**
 * Get month name
 */
export function monthName(month) {
  return ['January','February','March','April','May','June',
          'July','August','September','October','November','December'][month - 1] || '';
}

/**
 * Ordinal suffix
 */
export function ordinal(n) {
  const s = ['th','st','nd','rd'], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

// ── Auth Token Management ───────────────────────────────────────

const ACCESS_TOKEN_KEY = 'splitr_access_token';

export function saveAccessToken(token) {
  localStorage.setItem(ACCESS_TOKEN_KEY, token);
}

export function getAccessToken() {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function clearAccessToken() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
}

// ── API Client ──────────────────────────────────────────────────

/**
 * Core API fetch with auth and error handling
 */
export async function api(method, path, body, options = {}) {
  const token = getAccessToken();
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);

  let res;
  try {
    res = await fetch(`${BASE}${path}`, opts);
  } catch (err) {
    throw Object.assign(new Error('Network error. Please check your connection.'), { type: 'network' });
  }

  // Try to refresh token on 401
  if (res.status === 401 && !options.noRefresh) {
    const refreshed = await tryRefreshToken();
    if (refreshed) {
      return api(method, path, body, { ...options, noRefresh: true });
    } else {
      clearAccessToken();
      navigate('/pages/login.html');
      throw Object.assign(new Error('Session expired. Please log in again.'), { type: 'auth' });
    }
  }

  let data;
  try {
    data = await res.json();
  } catch {
    throw new Error('Invalid server response.');
  }

  if (!res.ok) {
    const msg = data?.message || data?.error || 'Something went wrong.';
    throw Object.assign(new Error(msg), { status: res.status, data });
  }

  // ApiResponse wrapper: { statusCode, data, message, success }
  return data?.data !== undefined ? data.data : data;
}

/**
 * Attempt to refresh the access token using the refresh token cookie
 */
async function tryRefreshToken() {
  try {
    const res = await fetch(`${BASE}/users/refresh-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include'
    });
    if (!res.ok) return false;
    const data = await res.json();
    const newToken = data?.data?.accessToken;
    if (newToken) { saveAccessToken(newToken); return true; }
    return false;
  } catch { return false; }
}

// ── Toast ───────────────────────────────────────────────────────

let toastContainer;

function ensureToastContainer() {
  if (!toastContainer) {
    toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
      toastContainer = document.createElement('div');
      toastContainer.id = 'toast-container';
      document.body.appendChild(toastContainer);
    }
  }
  return toastContainer;
}

export function toast(msg, type = 'info') {
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.textContent = msg;
  ensureToastContainer().appendChild(el);
  setTimeout(() => {
    el.style.transition = 'opacity 0.3s ease';
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 300);
  }, 3000);
}

// ── Navigation ──────────────────────────────────────────────────

export function navigate(url) {
  document.body.style.opacity = '0';
  document.body.style.transition = 'opacity 200ms ease';
  setTimeout(() => { window.location.href = url; }, 180);
}

// ── Auth Guard ──────────────────────────────────────────────────

/**
 * Redirect to login if no access token
 */
export function requireAuth() {
  if (!getAccessToken()) {
    navigate('/pages/login.html');
    return false;
  }
  return true;
}

/**
 * If already logged in, redirect to dashboard
 */
export function requireGuest() {
  if (getAccessToken()) {
    navigate('/pages/dashboard.html');
    return false;
  }
  return true;
}

// ── Skeleton Helpers ────────────────────────────────────────────

export function skeletonText(width = '80%') {
  return `<div class="skeleton skeleton-text" style="width:${width};margin-bottom:6px;"></div>`;
}

export function skeletonBlock(h = '80px') {
  return `<div class="skeleton skeleton-block" style="height:${h};margin-bottom:10px;"></div>`;
}

// ── Empty State ─────────────────────────────────────────────────

export function emptyState({ title, desc, ctaText, ctaClick, iconPath }) {
  const iconSvg = iconPath || `<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 01-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 011-.99 11.57 11.57 0 007-2.02A11.57 11.57 0 0019 5a1 1 0 011 1v7z"/>`;
  return `
    <div class="empty-state">
      <div class="empty-state-icon">
        <svg viewBox="0 0 24 24">${iconSvg}</svg>
      </div>
      <div class="empty-state-title">${title}</div>
      <div class="empty-state-desc">${desc}</div>
      ${ctaText ? `<button class="btn btn-primary" id="empty-cta">${ctaText}</button>` : ''}
    </div>
  `;
}

// ── Error State ─────────────────────────────────────────────────

export function errorState(msg = 'Something went wrong.') {
  return `
    <div class="error-state">
      <div class="error-state-title">${msg}</div>
      <button class="btn btn-secondary" onclick="window.location.reload()">Try again</button>
    </div>
  `;
}

// ── Sidebar HTML ────────────────────────────────────────────────

export function renderSidebar(activePage) {
  const links = [
    { id: 'home',       href: '/pages/dashboard.html',          label: 'Home',               icon: 'M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" /><polyline points="9 22 9 12 15 12 15 22' },
    { id: 'sections',   href: '/pages/sections.html',           label: 'Sections',            icon: 'M4 6h16M4 10h16M4 14h16M4 18h16' },
    { id: 'activity',   href: '/pages/transactions.html',       label: 'Activity',            icon: 'M12 5v14M5 12h14' },
    { id: 'bills',      href: '/pages/bills.html',              label: 'Bills',               icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4' },
    { id: 'recurring',  href: '/pages/recurring-payments.html', label: 'Recurring',           icon: 'M1 4v6h6M23 20v-6h-6M20.49 9A9 9 0 005.64 5.64L1 10M23 14l-4.64 4.36A9 9 0 013.51 15' },
    { id: 'savings',    href: '/pages/savings.html',            label: 'Savings',             icon: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.31-8.86c-1.77-.45-2.34-.94-2.34-1.67 0-.84.79-1.43 2.1-1.43 1.38 0 1.9.66 1.94 1.64h1.71c-.05-1.34-.87-2.57-2.49-2.97V5H10.9v1.69c-1.51.32-2.72 1.3-2.72 2.81 0 1.79 1.49 2.69 3.66 3.21 1.95.46 2.34 1.15 2.34 1.86 0 .53-.39 1.39-2.1 1.39-1.6 0-2.23-.72-2.32-1.64H8.04c.1 1.7 1.36 2.66 2.86 2.97V19h2.34v-1.67c1.52-.29 2.72-1.16 2.73-2.77-.01-2.2-1.9-2.96-3.66-3.42z' },
    { id: 'history',    href: '/pages/history.html',            label: 'History',             icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
    { id: 'notifications', href: '/pages/notifications.html',   label: 'Notifications',       icon: 'M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0' },
    { id: 'settings',   href: '/pages/settings.html',          label: 'Settings',            icon: 'M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z' },
  ];

  const mainLinks = links.slice(0, 4);   // Home, Sections, Activity, Bills
  const moreLinks = links.slice(4, 8);   // Recurring, Savings, History, Notifications
  const bottomLinks = links.slice(8);    // Settings

  function linkHtml(l) {
    const isActive = l.id === activePage;
    return `
      <a href="${l.href}" class="nav-link${isActive ? ' active' : ''}" aria-current="${isActive ? 'page' : 'false'}">
        <svg viewBox="0 0 24 24"><path d="${l.icon}"/></svg>
        ${l.label}
      </a>`;
  }

  return `
    <div class="sidebar">
      <div class="sidebar-logo">
        <div class="sidebar-logo-mark">
          <div class="sidebar-logo-icon">
            <svg viewBox="0 0 24 24"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
          </div>
          <span class="sidebar-logo-text">Splitr</span>
        </div>
      </div>
      <nav class="sidebar-nav">
        ${mainLinks.map(linkHtml).join('')}
        <div class="nav-group-label" style="margin-top:8px;">More</div>
        ${moreLinks.map(linkHtml).join('')}
      </nav>
      <div class="sidebar-bottom">
        ${bottomLinks.map(linkHtml).join('')}
      </div>
    </div>
  `;
}

/**
 * Render the mobile bottom nav
 */
export function renderBottomNav(activePage) {
  const items = [
    { id: 'home',     href: '/pages/dashboard.html',    label: 'Home',     icon: 'M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" /><polyline points="9 22 9 12 15 12 15 22' },
    { id: 'sections', href: '/pages/sections.html',     label: 'Sections', icon: 'M4 6h16M4 10h16M4 14h16M4 18h16' },
    { id: 'activity', href: '/pages/transactions.html', label: 'Activity', icon: 'M12 5v14M5 12h14' },
    { id: 'more',     href: '/pages/settings.html',     label: 'More',     icon: 'M4 6h16M4 12h16M4 18h7' },
  ];

  return `
    <nav class="bottom-nav" aria-label="Main navigation">
      ${items.map(i => `
        <a href="${i.href}" class="bottom-nav-item${i.id === activePage ? ' active' : ''}" aria-current="${i.id === activePage ? 'page' : 'false'}">
          <svg viewBox="0 0 24 24"><path d="${i.icon}"/></svg>
          <span>${i.label}</span>
        </a>
      `).join('')}
    </nav>
  `;
}

/**
 * Render the mobile header
 */
export function renderMobileHeader(userInitials = '?') {
  return `
    <header class="mobile-header">
      <div class="mobile-header-logo">
        <div class="mobile-header-logo-icon">
          <svg viewBox="0 0 24 24"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
        </div>
        <span class="mobile-header-logo-text">Splitr</span>
      </div>
      <div class="mobile-header-actions">
        <a href="/pages/notifications.html" class="icon-btn" aria-label="Notifications">
          <svg viewBox="0 0 24 24"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0"/></svg>
        </a>
        <a href="/pages/settings.html" class="avatar" aria-label="Profile" id="nav-avatar">${userInitials}</a>
      </div>
    </header>
  `;
}

/**
 * Inject navigation into the page
 */
export function injectNav(activePage) {
  const sidebarEl = document.getElementById('sidebar-container');
  const bottomNavEl = document.getElementById('bottom-nav-container');
  const mobileHeaderEl = document.getElementById('mobile-header-container');

  if (sidebarEl) sidebarEl.innerHTML = renderSidebar(activePage);
  if (bottomNavEl) bottomNavEl.innerHTML = renderBottomNav(activePage);
  if (mobileHeaderEl) {
    // Will be updated once user data is loaded
    mobileHeaderEl.innerHTML = renderMobileHeader('?');
  }
}
