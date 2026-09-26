// ── emoji-picker.js — Reusable Emoji Dropdown Menu ───────────────────

export const EMOJI_CATEGORIES = [
  {
    id: 'popular',
    name: '🔥 Popular',
    emojis: ['🍔','🛍️','🚗','🎬','💊','🏠','💡','☕','🍕','🛒','✈️','🎮','📚','🎁']
  },
  {
    id: 'food',
    name: '🍔 Food',
    emojis: ['🍔','🍕','☕','🍜','🥗','🥐','🍩','🍱','🍲','🍺','🍷','🛒','🍎','🥪','🍣','🍦','🥤','🥟','🌮','🧁']
  },
  {
    id: 'shopping',
    name: '🛍️ Shopping',
    emojis: ['🛍️','🛒','👗','👟','👕','🕶️','💄','🧴','🎁','💎','💍','🎒','🧢','⌚','👠','🧥']
  },
  {
    id: 'transport',
    name: '🚗 Transport',
    emojis: ['🚗','🚕','🚌','🚆','✈️','⛽','🚲','🛵','🏨','🧳','🎫','🛳️','🚦','🚂','🚁']
  },
  {
    id: 'entertainment',
    name: '🎬 Fun',
    emojis: ['🎬','🍿','🎮','🎵','🎟️','🎨','🎳','⚽','📺','🏖️','🎪','🎤','🎧','🎲','🎉']
  },
  {
    id: 'home',
    name: '🏠 Home & Bills',
    emojis: ['🏠','💡','📶','💧','🛋️','🧹','🔧','📦','📱','🔌','🖥️','🔑','🛡️','🛏️','🪴']
  },
  {
    id: 'health',
    name: '💊 Health',
    emojis: ['💊','🏋️','🩺','🧘','🏃','🦷','🩹','🍎','🏊','🚴','🧴','🌿','🥑','🫀']
  },
  {
    id: 'work',
    name: '📚 Work',
    emojis: ['📚','💻','🎓','💼','✏️','📝','📎','📁','📊','🗂️','📖','📐','✒️']
  },
  {
    id: 'finance',
    name: '💰 Money',
    emojis: ['💰','🏦','💳','🪙','📈','🫙','🔒','🏷️','🧾','💵','💎','🪙']
  }
];

export const ALL_EMOJIS = [
  ...new Set(EMOJI_CATEGORIES.flatMap(c => c.emojis))
];

/**
 * Initialize an Emoji Dropdown Menu on a target wrapper.
 * @param {Object} options
 * @param {HTMLElement|string} options.container - Container element or selector
 * @param {HTMLInputElement|string} options.input - Target hidden or text input to sync
 * @param {string} [options.defaultEmoji='🍔'] - Initial emoji
 * @param {Function} [options.onSelect] - Callback when emoji is selected
 * @returns {Object} { setEmoji: (emoji) => void, getEmoji: () => string }
 */
export function setupEmojiDropdown({ container, input, defaultEmoji = '🍔', onSelect = null }) {
  const containerEl = typeof container === 'string' ? document.querySelector(container) : container;
  const inputEl = typeof input === 'string' ? document.querySelector(input) : input;

  if (!containerEl || !inputEl) {
    console.warn('setupEmojiDropdown: container or input not found');
    return null;
  }

  let selectedEmoji = inputEl.value || defaultEmoji || '🍔';
  inputEl.value = selectedEmoji;

  // Render dropdown structure
  containerEl.classList.add('emoji-dropdown-container');
  containerEl.innerHTML = `
    <button type="button" class="emoji-trigger-btn" aria-haspopup="true" aria-expanded="false" title="Click to choose an emoji">
      <div class="emoji-trigger-display">
        <span class="emoji-trigger-icon">${selectedEmoji}</span>
        <span class="emoji-trigger-label">Choose section icon</span>
      </div>
      <span class="emoji-trigger-arrow">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </span>
    </button>

    <div class="emoji-dropdown-panel" role="menu">
      <div class="emoji-dropdown-search-wrap">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
        <input type="text" class="emoji-dropdown-search" placeholder="Search emojis..." autocomplete="off">
      </div>

      <div class="emoji-category-bar">
        ${EMOJI_CATEGORIES.map((c, i) => `
          <button type="button" class="emoji-category-tab ${i === 0 ? 'active' : ''}" data-cat="${c.id}">
            ${c.name}
          </button>
        `).join('')}
      </div>

      <div class="emoji-items-grid">
        <!-- populated dynamically -->
      </div>
    </div>
  `;

  const triggerBtn = containerEl.querySelector('.emoji-trigger-btn');
  const panel = containerEl.querySelector('.emoji-dropdown-panel');
  const iconDisplay = containerEl.querySelector('.emoji-trigger-icon');
  const searchInput = containerEl.querySelector('.emoji-dropdown-search');
  const catTabs = containerEl.querySelectorAll('.emoji-category-tab');
  const grid = containerEl.querySelector('.emoji-items-grid');

  let currentCategory = 'popular';

  function renderGrid(emojisToRender) {
    grid.innerHTML = emojisToRender.map(e => `
      <button type="button" class="emoji-item-btn ${e === selectedEmoji ? 'selected' : ''}" data-emoji="${e}" title="${e}">
        ${e}
      </button>
    `).join('');

    grid.querySelectorAll('.emoji-item-btn').forEach(btn => {
      btn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        selectEmoji(btn.dataset.emoji);
      });
    });
  }

  function selectEmoji(emoji) {
    selectedEmoji = emoji;
    inputEl.value = emoji;
    iconDisplay.textContent = emoji;
    closeDropdown();
    if (typeof onSelect === 'function') {
      onSelect(emoji);
    }
  }

  function showCategory(catId) {
    currentCategory = catId;
    catTabs.forEach(t => t.classList.toggle('active', t.dataset.cat === catId));
    searchInput.value = '';
    const cat = EMOJI_CATEGORIES.find(c => c.id === catId);
    renderGrid(cat ? cat.emojis : ALL_EMOJIS);
  }

  function filterEmojis(query) {
    if (!query) {
      showCategory(currentCategory);
      return;
    }
    const q = query.toLowerCase().trim();
    // Filter matching category name or emojis
    const matching = ALL_EMOJIS.filter(e => {
      for (const cat of EMOJI_CATEGORIES) {
        if (cat.emojis.includes(e) && (cat.name.toLowerCase().includes(q) || cat.id.includes(q))) {
          return true;
        }
      }
      return false;
    });

    renderGrid(matching.length > 0 ? matching : ALL_EMOJIS);
  }

  function openDropdown() {
    panel.classList.add('open');
    triggerBtn.classList.add('active');
    triggerBtn.setAttribute('aria-expanded', 'true');
    showCategory(currentCategory);
    setTimeout(() => searchInput.focus(), 100);
  }

  function closeDropdown() {
    panel.classList.remove('open');
    triggerBtn.classList.remove('active');
    triggerBtn.setAttribute('aria-expanded', 'false');
  }

  function toggleDropdown() {
    if (panel.classList.contains('open')) {
      closeDropdown();
    } else {
      openDropdown();
    }
  }

  // Trigger click
  triggerBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    toggleDropdown();
  });

  // Category tabs
  catTabs.forEach(tab => {
    tab.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      showCategory(tab.dataset.cat);
    });
  });

  // Search input
  searchInput.addEventListener('input', (e) => {
    filterEmojis(e.target.value);
  });

  searchInput.addEventListener('click', (e) => e.stopPropagation());

  // Close on outside click
  document.addEventListener('click', (e) => {
    if (!containerEl.contains(e.target)) {
      closeDropdown();
    }
  });

  // Close on Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && panel.classList.contains('open')) {
      closeDropdown();
    }
  });

  // Initial render
  showCategory('popular');

  return {
    setEmoji(emoji) {
      if (!emoji) return;
      selectedEmoji = emoji;
      inputEl.value = emoji;
      iconDisplay.textContent = emoji;
    },
    getEmoji() {
      return selectedEmoji;
    }
  };
}
