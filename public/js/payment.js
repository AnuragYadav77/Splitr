// ── payment.js — Payment flow & Live UPI QR Scanner ───────────────────
import {
  api, formatINR, sectionColour, getRemaining, getPctSpent, navigate, toast
} from './utils.js';

let sections = [];
let selectedSection = null;
let step = 1;
let currentMode = 'scan'; // 'scan' | 'manual'

// QR Scanner State
let html5QrCode = null;
let isScannerRunning = false;
let availableCameras = [];
let currentCameraIndex = 0;
let torchEnabled = false;

// Step elements
const steps = [null, 'pstep-1', 'pstep-2', 'pstep-3', 'pstep-4'];

function showStep(n) {
  step = n;
  steps.forEach((id, i) => {
    if (!id) return;
    document.getElementById(id).classList.toggle('active', i === n);
  });
  const titles = ['', 'Log a payment', 'Choose section', 'Confirm payment', 'Done'];
  document.getElementById('step-title').textContent = titles[n] || 'Log a payment';

  // Toggle mode tabs only on step 1
  const modeTabs = document.getElementById('mode-tabs');
  if (modeTabs) modeTabs.style.display = n === 1 ? 'flex' : 'none';

  if (n !== 1) {
    stopScanner();
  } else if (currentMode === 'scan') {
    startScanner();
  }
}

// ── Audio Feedback ────────────────────────────────────────────────
function playScanSound() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime); // A5
    osc.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.12); // A6

    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.25);
  } catch {}
}

// ── UPI String Parser ─────────────────────────────────────────────
function parseUPI(rawText) {
  if (!rawText) return { merchant: '', amount: 0 };
  const text = rawText.trim();

  let merchant = '';
  let amount = 0;

  if (text.startsWith('upi://') || text.includes('pay?')) {
    try {
      const urlStr = text.startsWith('upi://') ? text.replace('upi://', 'https://upi-splitr.local/') : text;
      const parsed = new URL(urlStr);
      const pn = parsed.searchParams.get('pn');
      const pa = parsed.searchParams.get('pa');
      const am = parsed.searchParams.get('am');

      if (pn) merchant = decodeURIComponent(pn).replace(/\+/g, ' ');
      else if (pa) merchant = pa.split('@')[0];

      if (am) amount = parseFloat(am);
    } catch {
      const pnMatch = text.match(/[?&]pn=([^&]+)/i);
      const paMatch = text.match(/[?&]pa=([^&]+)/i);
      const amMatch = text.match(/[?&]am=([^&]+)/i);

      if (pnMatch) merchant = decodeURIComponent(pnMatch[1]).replace(/\+/g, ' ');
      else if (paMatch) merchant = decodeURIComponent(paMatch[1]).split('@')[0];

      if (amMatch) amount = parseFloat(amMatch[1]);
    }
  } else {
    // Check if format is "Merchant - ₹Amount" or similar
    const clean = text.replace(/₹|,/g, '');
    const numMatch = clean.match(/(\d+(\.\d{1,2})?)/);
    if (numMatch) {
      amount = parseFloat(numMatch[1]);
      merchant = text.replace(numMatch[0], '').replace(/₹|for|paid|to|-/gi, '').trim();
    } else {
      merchant = text.slice(0, 40);
    }
  }

  return {
    merchant: merchant ? merchant.trim() : 'Merchant',
    amount: !isNaN(amount) && amount > 0 ? amount : 0
  };
}

// ── Handle Scan Success ───────────────────────────────────────────
async function handleScanSuccess(decodedText) {
  playScanSound();

  const statusText = document.getElementById('qr-status-text');
  if (statusText) statusText.textContent = '✅ QR code scanned successfully!';

  const { merchant, amount } = parseUPI(decodedText);

  document.getElementById('inp-merchant').value = merchant;
  if (amount > 0) {
    document.getElementById('inp-amount').value = amount;
  }

  toast(`Scanned: ${merchant}${amount > 0 ? ' · ' + formatINR(amount) : ''}!`, 'success');
  stopScanner();

  if (amount > 0) {
    // Directly proceed to section selection!
    document.getElementById('conf-amount-display').textContent = formatINR(amount);
    document.getElementById('conf-merchant-display').textContent = merchant;

    await loadSections();
    renderSectionGrid();
    showStep(2);
  } else {
    // Switch to manual view with merchant pre-filled so user enters amount
    setMode('manual');
    const amtInput = document.getElementById('inp-amount');
    if (amtInput) {
      amtInput.focus();
      toast('Enter the amount to complete payment', 'info');
    }
  }
}

// ── QR Scanner Engine ─────────────────────────────────────────────
async function startScanner() {
  if (isScannerRunning || typeof window.Html5Qrcode === 'undefined') return;

  const readerEl = document.getElementById('qr-reader');
  const statusEl = document.getElementById('qr-status-text');
  if (!readerEl) return;

  try {
    if (!html5QrCode) {
      html5QrCode = new window.Html5Qrcode('qr-reader');
    }

    try {
      availableCameras = await window.Html5Qrcode.getCameras();
    } catch {
      availableCameras = [];
    }

    const cameraConfig = availableCameras.length > 0
      ? availableCameras[currentCameraIndex % availableCameras.length].id
      : { facingMode: 'environment' };

    await html5QrCode.start(
      cameraConfig,
      {
        fps: 15,
        qrbox: { width: 220, height: 220 },
        aspectRatio: 1.0
      },
      (decodedText) => {
        handleScanSuccess(decodedText);
      },
      () => {
        // ignore per-frame scan failures
      }
    );

    isScannerRunning = true;
    if (statusEl) statusEl.textContent = 'Align any UPI QR code within frame';
  } catch (err) {
    console.warn('Camera start error:', err);
    isScannerRunning = false;
    if (statusEl) statusEl.textContent = 'Camera not accessible. Upload an image or use presets.';
  }
}

async function stopScanner() {
  if (html5QrCode && isScannerRunning) {
    try {
      await html5QrCode.stop();
      isScannerRunning = false;
    } catch (e) {
      console.warn('Camera stop error:', e);
    }
  }
}

async function switchCamera() {
  if (availableCameras.length > 1) {
    currentCameraIndex = (currentCameraIndex + 1) % availableCameras.length;
    await stopScanner();
    await startScanner();
    toast('Switched camera', 'info');
  } else {
    toast('Only one camera detected on this device', 'info');
  }
}

async function toggleTorch() {
  if (!html5QrCode || !isScannerRunning) return;
  try {
    torchEnabled = !torchEnabled;
    await html5QrCode.applyVideoConstraints({
      advanced: [{ torch: torchEnabled }]
    });
    toast(torchEnabled ? 'Torch enabled' : 'Torch disabled', 'info');
  } catch {
    toast('Torch not supported on this camera', 'info');
  }
}

function handleFileUpload(e) {
  const file = e.target.files?.[0];
  if (!file) return;

  if (!html5QrCode) {
    html5QrCode = new window.Html5Qrcode('qr-reader');
  }

  const statusEl = document.getElementById('qr-status-text');
  if (statusEl) statusEl.textContent = 'Scanning image file...';

  html5QrCode.scanFile(file, true)
    .then(decodedText => {
      handleScanSuccess(decodedText);
    })
    .catch(() => {
      toast('No UPI QR code found in this image. Try another photo.', 'error');
      if (statusEl) statusEl.textContent = 'Align any UPI QR code within frame';
    })
    .finally(() => {
      e.target.value = '';
    });
}

// ── Mode Switcher ─────────────────────────────────────────────────
function setMode(mode) {
  currentMode = mode;
  const isScan = mode === 'scan';

  const tabScan = document.getElementById('tab-scan-qr');
  const tabManual = document.getElementById('tab-manual-entry');
  const scanSection = document.getElementById('qr-scanner-section');
  const manualSection = document.getElementById('manual-entry-section');

  if (tabScan) {
    tabScan.classList.toggle('active', isScan);
    tabScan.style.background = isScan ? 'var(--bg-card)' : 'transparent';
    tabScan.style.color = isScan ? 'var(--indigo-600)' : 'var(--n-500)';
    tabScan.style.boxShadow = isScan ? '0 1px 3px rgba(0,0,0,0.08)' : 'none';
  }

  if (tabManual) {
    tabManual.classList.toggle('active', !isScan);
    tabManual.style.background = !isScan ? 'var(--bg-card)' : 'transparent';
    tabManual.style.color = !isScan ? 'var(--indigo-600)' : 'var(--n-500)';
    tabManual.style.boxShadow = !isScan ? '0 1px 3px rgba(0,0,0,0.08)' : 'none';
  }

  if (scanSection) scanSection.style.display = isScan ? 'block' : 'none';
  if (manualSection) manualSection.style.display = 'block'; // Always visible below or active

  if (isScan && step === 1) {
    startScanner();
  } else {
    stopScanner();
  }
}

// ── Load Sections ─────────────────────────────────────────────────

async function loadSections() {
  try {
    sections = await api('GET', '/sections');
    renderSectionGrid();
  } catch {
    document.getElementById('section-select-grid').innerHTML =
      '<div style="grid-column:1/-1;text-align:center;color:var(--n-400);padding:20px 0;">Could not load sections.</div>';
  }
}

function renderSectionGrid() {
  const amount = parseFloat(document.getElementById('inp-amount').value) || 0;
  const grid = document.getElementById('section-select-grid');

  if (!sections || sections.length === 0) {
    grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;color:var(--n-400);padding:20px;">
      No sections found. <a href="/pages/sections.html" class="text-indigo" style="font-weight:600;">Create one</a>
    </div>`;
    return;
  }

  grid.innerHTML = sections.map(sec => {
    const remaining = getRemaining(sec.monthlyBudget, sec.spent);
    const colour    = sectionColour(sec.monthlyBudget, sec.spent);
    const insufficient = amount > 0 && remaining < amount;

    return `
      <div
        class="section-option${insufficient ? ' drained' : ''}"
        data-id="${sec._id}"
        role="button"
        tabindex="${insufficient ? -1 : 0}"
        aria-label="${sec.name}: ${formatINR(remaining)} remaining"
        aria-disabled="${insufficient}"
      >
        <div style="font-size:24px;margin-bottom:4px;">${sec.emoji || '📦'}</div>
        <div class="section-option-name">${sec.name}</div>
        <div class="section-option-remaining ${colour}">${formatINR(remaining)}</div>
        <div style="font-size:10px;color:var(--n-400);margin-top:1px;">remaining</div>
        ${insufficient ? '<div style="font-size:10px;color:var(--red-500);margin-top:3px;font-weight:600;">Insufficient</div>' : ''}
      </div>
    `;
  }).join('');

  grid.querySelectorAll('.section-option:not(.drained)').forEach(card => {
    const handler = () => selectSection(card.dataset.id);
    card.addEventListener('click', handler);
    card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') handler(); });
  });
}

function selectSection(id) {
  selectedSection = sections.find(s => s._id === id);
  if (!selectedSection) return;

  const amount     = parseFloat(document.getElementById('inp-amount').value) || 0;
  const remaining  = getRemaining(selectedSection.monthlyBudget, selectedSection.spent);
  const afterSpend = remaining - amount;

  // Highlight selected
  document.querySelectorAll('.section-option').forEach(card => {
    card.classList.toggle('selected', card.dataset.id === id);
  });

  // Budget warning
  const warn = document.getElementById('budget-warning');
  if (amount > remaining) {
    warn.textContent = `${selectedSection.name} only has ${formatINR(remaining)} — this payment exceeds the budget.`;
    warn.classList.remove('hidden');
    warn.className = 'spend-nudge danger';
  } else if (afterSpend < remaining * 0.2) {
    warn.textContent = `After this payment, only ${formatINR(afterSpend)} will remain in ${selectedSection.name}.`;
    warn.classList.remove('hidden');
    warn.className = 'spend-nudge warn';
  } else {
    warn.classList.add('hidden');
  }

  document.getElementById('btn-p2-confirm').disabled = false;
}

// ── Step Navigation ───────────────────────────────────────────────

// Step 1 → 2
document.getElementById('btn-p1-next').addEventListener('click', () => {
  const merchant = document.getElementById('inp-merchant').value.trim();
  const amount   = parseFloat(document.getElementById('inp-amount').value);

  let valid = true;
  clearErr('merchant'); clearErr('amount');
  if (!merchant) { showErr('merchant', 'Enter a merchant name or scan a QR code.'); valid = false; }
  if (!amount || amount <= 0) { showErr('amount', 'Enter a valid payment amount.'); valid = false; }
  if (!valid) return;

  document.getElementById('conf-amount-display').textContent = formatINR(amount);
  document.getElementById('conf-merchant-display').textContent = merchant;

  stopScanner();
  loadSections();
  renderSectionGrid();
  showStep(2);
});

// Step 2 → 3
document.getElementById('btn-p2-confirm').addEventListener('click', () => {
  if (!selectedSection) return;

  const amount   = parseFloat(document.getElementById('inp-amount').value);
  const merchant = document.getElementById('inp-merchant').value.trim();
  const remaining = getRemaining(selectedSection.monthlyBudget, selectedSection.spent);
  const afterSpend = Math.max(0, remaining - amount);

  document.getElementById('conf-amount').textContent   = formatINR(amount);
  document.getElementById('conf-merchant').textContent = merchant;
  document.getElementById('conf-section-name').textContent = `${selectedSection.emoji || ''} ${selectedSection.name}`.trim();
  document.getElementById('conf-section-after').textContent =
    `${formatINR(afterSpend)} will remain after this payment`;

  // Awareness nudge
  const awareness = document.getElementById('conf-awareness');
  if (amount > remaining) {
    awareness.textContent = `This exceeds the ${selectedSection.name} budget envelope by ${formatINR(amount - remaining)}.`;
    awareness.className = 'spend-nudge danger';
  } else if (afterSpend < remaining * 0.2) {
    awareness.textContent = `You'll have ${formatINR(afterSpend)} left in ${selectedSection.name} after this payment.`;
    awareness.className = 'spend-nudge warn';
  } else {
    awareness.textContent = `${selectedSection.name} has ${formatINR(remaining)} available. You'll have ${formatINR(afterSpend)} left.`;
    awareness.className = 'spend-nudge ok';
  }

  showStep(3);
});

// Step 3 → back or confirm
document.getElementById('btn-p3-back').addEventListener('click', () => showStep(2));

document.getElementById('btn-p3-confirm').addEventListener('click', async () => {
  const amount   = parseFloat(document.getElementById('inp-amount').value);
  const merchant = document.getElementById('inp-merchant').value.trim();
  const btn      = document.getElementById('btn-p3-confirm');

  btn.classList.add('btn-loading');
  try {
    await api('POST', '/transactions', {
      merchant,
      amount,
      section: selectedSection._id,
      direction: 'debit',
    });

    // Update local section spent
    selectedSection.spent = (selectedSection.spent || 0) + amount;
    const remaining = getRemaining(selectedSection.monthlyBudget, selectedSection.spent);

    document.getElementById('succ-amount').textContent = formatINR(amount);
    document.getElementById('succ-section').textContent = `${selectedSection.emoji || ''} ${selectedSection.name}`.trim();
    document.getElementById('succ-remaining').textContent = `${formatINR(remaining)} remaining in this section`;

    showStep(4);
  } catch (err) {
    toast(err.message || 'Payment failed. Try again.', 'error');
  } finally {
    btn.classList.remove('btn-loading');
  }
});

// Log another
document.getElementById('btn-pay-another').addEventListener('click', () => {
  document.getElementById('inp-merchant').value = '';
  document.getElementById('inp-amount').value   = '';
  selectedSection = null;
  showStep(1);
});

// Back button
document.getElementById('back-btn').addEventListener('click', () => {
  if (step > 1 && step < 4) {
    showStep(step - 1);
  } else {
    stopScanner();
    navigate('/pages/dashboard.html');
  }
});

// ── Helpers ───────────────────────────────────────────────────────

function showErr(id, msg) {
  const el = document.getElementById(`err-${id}`);
  if (el) { el.textContent = msg; el.classList.add('show'); }
}

function clearErr(id) {
  const el = document.getElementById(`err-${id}`);
  if (el) { el.textContent = ''; el.classList.remove('show'); }
}

// ── Setup UI Event Listeners ──────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  // Tabs
  document.getElementById('tab-scan-qr')?.addEventListener('click', () => setMode('scan'));
  document.getElementById('tab-manual-entry')?.addEventListener('click', () => setMode('manual'));

  // Camera toolbar
  document.getElementById('btn-switch-camera')?.addEventListener('click', switchCamera);
  document.getElementById('btn-toggle-torch')?.addEventListener('click', toggleTorch);

  const fileInput = document.getElementById('qr-file-input');
  document.getElementById('btn-upload-qr')?.addEventListener('click', () => fileInput?.click());
  fileInput?.addEventListener('change', handleFileUpload);

  // Quick Test Sample UPI QR presets
  document.querySelectorAll('.qr-sample-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const merchant = chip.dataset.merchant || 'Sample Merchant';
      const amount = chip.dataset.amount || '100';
      const simulatedUPI = `upi://pay?pa=${merchant.toLowerCase().replace(/\s+/g,'')}@okhdfcbank&pn=${encodeURIComponent(merchant)}&am=${amount}&cu=INR`;
      handleScanSuccess(simulatedUPI);
    });
  });

  // Start scanner on load if step 1
  setMode('scan');
});

// Stop camera when user navigates away or hides page
window.addEventListener('beforeunload', stopScanner);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) stopScanner();
  else if (step === 1 && currentMode === 'scan') startScanner();
});
