// ── app.js — Page boot: auth guard + fade in ─────────────────────
import { getAccessToken, navigate, api, injectNav, getInitials } from './utils.js';

document.addEventListener('DOMContentLoaded', async () => {
  // Fade in
  document.body.style.opacity = '0';
  document.body.style.transition = 'opacity 200ms ease';
  requestAnimationFrame(() => { document.body.style.opacity = '1'; });

  const path = window.location.pathname;
  const isPublic = path.includes('onboarding') ||
                   path.includes('login') ||
                   path.includes('register');

  if (isPublic) return;

  // Require auth for all app pages
  if (!getAccessToken()) {
    navigate('/pages/login.html');
    return;
  }

  // Inject navigation
  const activePage = getActivePage(path);
  injectNav(activePage);

  // Load user info to update avatar
  try {
    const user = await api('GET', '/users/me');
    const initials = getInitials(user?.fullName || user?.name || '');
    const avatar = document.getElementById('nav-avatar');
    if (avatar) avatar.textContent = initials;
    // Store for pages to use
    window._splitrUser = user;
  } catch { /* non-critical */ }
});

function getActivePage(path) {
  if (path.includes('dashboard'))          return 'home';
  if (path.includes('sections'))           return 'sections';
  if (path.includes('transaction'))        return 'activity';
  if (path.includes('payment'))            return 'activity';
  if (path.includes('bills'))              return 'bills';
  if (path.includes('recurring'))          return 'recurring';
  if (path.includes('savings'))            return 'savings';
  if (path.includes('history'))            return 'history';
  if (path.includes('notification'))       return 'notifications';
  if (path.includes('settings'))           return 'settings';
  if (path.includes('month-end'))          return 'home';
  return 'home';
}
