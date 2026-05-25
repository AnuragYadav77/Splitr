// ── app.js — page boot: fade in, month-end check ─────────────────
import { api, navigate } from './utils.js';

document.addEventListener('DOMContentLoaded', async () => {
  // Fade in
  document.body.style.opacity = '0';
  document.body.style.transition = 'opacity 250ms ease';
  requestAnimationFrame(() => {
    document.body.style.opacity = '1';
  });

  // If on onboarding, skip the rest
  const isOnboarding = window.location.pathname.includes('onboarding');
  const isMonthEnd   = window.location.pathname.includes('month-end');
  if (isOnboarding || isMonthEnd) return;

  // Check if app is set up
  try {
    const dash = await api('GET', '/dashboard');
    if (!dash.user) {
      navigate('/pages/onboarding.html');
      return;
    }

    // Month-end check
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear  = now.getFullYear();
    const { settings } = dash;

    if (settings.month && settings.year) {
      if (settings.month !== currentMonth || settings.year !== currentYear) {
        navigate('/pages/month-end.html');
        return;
      }
    }
  } catch (e) {
    console.warn('App check failed', e);
  }
});
