// ── utils.js — shared utility functions ──────────────────────────

/**
 * Format a number as Indian Rupee (₹1,20,000)
 */
export function formatINR(amount) {
  if (amount === null || amount === undefined || isNaN(amount)) return '₹0';
  const num = Math.abs(Math.round(amount));
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
 * Format a date as "19 May, 2026"
 */
export function formatDate(dateStr) {
  const d = dateStr ? new Date(dateStr) : new Date();
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
}

/**
 * Format date as "19 May"
 */
export function formatDateShort(dateStr) {
  const d = dateStr ? new Date(dateStr) : new Date();
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

/**
 * Return relative time string ("2 hours ago", "Yesterday")
 */
export function timeAgo(dateStr) {
  const now = new Date();
  const d = new Date(dateStr);
  const diffMs = now - d;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr  = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffMin < 1)  return 'Just now';
  if (diffMin < 60) return `${diffMin} min ago`;
  if (diffHr < 24)  return `${diffHr} hour${diffHr !== 1 ? 's' : ''} ago`;
  if (diffDay === 1) return 'Yesterday';
  if (diffDay < 7)  return `${diffDay} days ago`;
  return formatDateShort(dateStr);
}

/**
 * Get colour class for section based on % remaining
 */
export function sectionColour(budget, spent) {
  if (budget <= 0) return 'red';
  const pct = ((budget - spent) / budget) * 100;
  if (pct <= 0)  return 'red';
  if (pct < 10)  return 'red';
  if (pct < 30)  return 'amber';
  return 'green';
}

/**
 * Get CSS hex colour for section progress
 */
export function sectionHex(budget, spent) {
  const col = sectionColour(budget, spent);
  return col === 'green' ? '#22C55E' : col === 'amber' ? '#EAB308' : '#EF4444';
}

/**
 * Make an API call and return JSON
 */
export async function api(method, path, body) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' }
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`/api${path}`, opts);
  const data = await res.json();
  if (!res.ok) throw Object.assign(new Error(data.error || 'Request failed'), { status: res.status, data });
  return data;
}

/**
 * Show a toast notification
 */
export function toast(msg, type = 'info') {
  const existing = document.getElementById('toast');
  if (existing) existing.remove();

  const el = document.createElement('div');
  el.id = 'toast';
  el.textContent = msg;
  const colours = { info: '#334155', success: '#22C55E', error: '#EF4444', warning: '#EAB308' };
  el.style.cssText = `
    position:fixed; bottom:96px; left:50%; transform:translateX(-50%);
    background:${colours[type] || colours.info}; color:#fff;
    padding:10px 20px; border-radius:100px; font-size:13px; font-weight:500;
    z-index:1000; box-shadow:0 4px 20px rgba(0,0,0,0.2);
    animation:toastIn 0.3s ease;white-space:nowrap;max-width:320px;text-align:center;
  `;
  const style = document.createElement('style');
  style.textContent = `
    @keyframes toastIn { from { opacity:0; transform:translateX(-50%) translateY(10px); }
                         to   { opacity:1; transform:translateX(-50%) translateY(0); } }
  `;
  document.head.appendChild(style);
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

/**
 * Navigate to a page with a fade transition
 */
export function navigate(url) {
  document.body.style.opacity = '0';
  document.body.style.transition = 'opacity 250ms ease';
  setTimeout(() => { window.location.href = url; }, 240);
}

/**
 * Get today's day of month (1-31)
 */
export function todayDay() {
  return new Date().getDate();
}

/**
 * Get month name
 */
export function monthName(month) {
  return ['January','February','March','April','May','June',
          'July','August','September','October','November','December'][month - 1] || '';
}
