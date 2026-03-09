import { SolresolWord } from '../models/word.js';
import { createWordRenderer } from './word-renderer.js';
import { createNotationToggles } from './notation-display.js';
import { getAntonym } from '../utils/antonyms.js';
import { SEMANTIC_CATEGORIES } from '../utils/grammar.js';
import { translate } from '../utils/solresol.js';
import { setFocusWord } from '../state/focus-word.js';
import { on } from '../utils/events.js';
import { shareWordCard } from './word-card-export.js';

let panelEl = null;
let currentRenderer = null;
const STORAGE_KEY = 'solresol:notations';
const HISTORY_KEY = 'solresol:history';
const MAX_HISTORY = 12;

// Load saved notation prefs
function loadNotations() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return new Set(JSON.parse(saved));
  } catch {}
  return new Set(['colors', 'solfege', 'numbers', 'binary', 'braille', 'ascii', 'sauso']);
}

function saveNotations(notations) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify([...notations])); } catch {}
}

let activeNotations = loadNotations();

// Word history
function getHistory() {
  try {
    const saved = localStorage.getItem(HISTORY_KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  return [];
}

function addToHistory(text) {
  const history = getHistory().filter(w => w !== text);
  history.unshift(text);
  if (history.length > MAX_HISTORY) history.length = MAX_HISTORY;
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(history)); } catch {}
}

/**
 * Initialize the context panel — a slide-in drawer showing everything about the focus word.
 */
export function initContextPanel(container) {
  container.innerHTML = `
    <button class="cp-close" id="cp-close" aria-label="Close panel">&times;</button>
    <div id="cp-content" class="cp-content"></div>
  `;
  panelEl = container;

  container.querySelector('#cp-close').addEventListener('click', closePanel);

  // Listen for word focus events
  on('word:focus', ({ word }) => {
    if (word && !word.isEmpty) {
      showWord(word);
    }
  });

  // Close on Escape (if panel is open)
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && panelEl.classList.contains('context-panel--open')) {
      closePanel();
    }
  });

  // Swipe right to close on touch
  let touchStartX = 0;
  container.addEventListener('touchstart', (e) => {
    touchStartX = e.touches[0].clientX;
  }, { passive: true });
  container.addEventListener('touchend', (e) => {
    const dx = e.changedTouches[0].clientX - touchStartX;
    if (dx > 80) closePanel(); // swipe right to close
  }, { passive: true });
}

function showWord(word) {
  const content = panelEl.querySelector('#cp-content');
  content.innerHTML = '';
  if (currentRenderer) { currentRenderer.destroy(); currentRenderer = null; }

  // Create a copy so we don't mutate the focus word
  const displayWord = new SolresolWord(word.syllables);

  // Word renderer with full notations, mirror, and stress
  currentRenderer = createWordRenderer(displayWord, {
    size: 'lg',
    showSheet: true,
    showDefinition: true,
    showReverse: displayWord.length >= 2,
    showMirror: true,
    showStress: displayWord.length >= 2,
    reactive: true,
    notations: activeNotations,
    clickToFocus: false,
  });
  content.appendChild(currentRenderer.el);

  // Semantic category
  const cat = displayWord.category;
  if (cat) {
    const catEl = document.createElement('div');
    catEl.className = 'cp-meta';
    catEl.innerHTML = `<span class="cp-meta-label">Category:</span> <span style="color:${cat.color}">${cat.label}</span>`;
    catEl.style.cursor = 'pointer';
    catEl.title = 'View in Dictionary by category';
    catEl.addEventListener('click', () => {
      // Navigate to dictionary with category filter
      window.location.hash = `dictionary?start=${displayWord.syllables[0]}`;
      closePanel();
    });
    content.appendChild(catEl);
  }

  // Antonym
  const antonym = displayWord.antonym;
  if (antonym) {
    const antDef = translate(antonym);
    const antEl = document.createElement('div');
    antEl.className = 'cp-meta cp-meta--clickable';
    antEl.innerHTML = `<span class="cp-meta-label">Antonym:</span> <strong>${antonym}</strong>${antDef ? ' — ' + antDef : ''}`;
    antEl.title = 'Focus on antonym';
    antEl.addEventListener('click', () => {
      setFocusWord(antonym);
    });
    content.appendChild(antEl);
  }

  // Actions
  const actions = document.createElement('div');
  actions.className = 'cp-actions';

  const dictBtn = document.createElement('button');
  dictBtn.className = 'btn btn--sm';
  dictBtn.textContent = 'Dictionary';
  dictBtn.title = 'Find in Dictionary';
  dictBtn.addEventListener('click', () => {
    window.location.hash = `dictionary?word=${displayWord.text.toLowerCase()}`;
    closePanel();
  });
  actions.appendChild(dictBtn);

  // Sunburst deep link
  if (displayWord.syllables.length > 0) {
    const sunBtn = document.createElement('button');
    sunBtn.className = 'btn btn--sm';
    sunBtn.textContent = 'Sunburst';
    sunBtn.title = 'Show on Sunburst';
    sunBtn.addEventListener('click', () => {
      window.location.hash = `dictionary?mode=sunburst&zoom=${displayWord.syllables[0]}`;
      closePanel();
    });
    actions.appendChild(sunBtn);
  }

  const shareBtn = document.createElement('button');
  shareBtn.className = 'btn btn--sm';
  shareBtn.textContent = 'Share';
  shareBtn.title = 'Share word card';
  shareBtn.addEventListener('click', async () => {
    shareBtn.disabled = true;
    shareBtn.textContent = '...';
    const result = await shareWordCard(displayWord);
    shareBtn.textContent = result === 'copied' ? 'Copied!' : 'Saved!';
    setTimeout(() => {
      shareBtn.textContent = 'Share';
      shareBtn.disabled = false;
    }, 2000);
  });
  actions.appendChild(shareBtn);

  content.appendChild(actions);

  // Stress / Part of Speech toggles
  if (displayWord.length >= 2) {
    const stressEl = document.createElement('div');
    stressEl.className = 'cp-meta';
    stressEl.innerHTML = '<span class="cp-meta-label">Stress:</span> ';

    const stressOpts = [
      { value: null, label: 'None (noun)' },
      { value: 'last', label: 'Last (adj.)' },
      { value: 'penultimate', label: 'Penult. (verb)' },
    ];
    if (displayWord.length >= 3) {
      stressOpts.push({ value: 'antepenultimate', label: 'Antepenult. (adv.)' });
    }

    for (const opt of stressOpts) {
      const btn = document.createElement('button');
      btn.className = 'btn btn--sm';
      btn.style.marginLeft = '4px';
      btn.textContent = opt.label;
      if (displayWord.stressPosition === opt.value) btn.classList.add('btn--active');
      btn.addEventListener('click', () => {
        displayWord.stressPosition = opt.value;
        // Update active state
        stressEl.querySelectorAll('.btn').forEach(b => b.classList.remove('btn--active'));
        btn.classList.add('btn--active');
      });
      stressEl.appendChild(btn);
    }
    content.appendChild(stressEl);
  }

  // Notation toggles
  const toggles = createNotationToggles(activeNotations, (updated) => {
    activeNotations = updated;
    saveNotations(activeNotations);
    if (currentRenderer) currentRenderer.rerender();
  });
  content.appendChild(toggles);

  // Word history
  addToHistory(displayWord.text);
  const history = getHistory().filter(w => w !== displayWord.text);
  if (history.length > 0) {
    const histEl = document.createElement('div');
    histEl.className = 'cp-history';
    histEl.innerHTML = '<span class="cp-meta-label">Recent:</span>';
    const list = document.createElement('div');
    list.className = 'cp-history-list';
    for (const w of history.slice(0, 8)) {
      const chip = document.createElement('button');
      chip.className = 'btn btn--sm cp-history-chip';
      chip.textContent = w;
      chip.addEventListener('click', () => setFocusWord(w));
      list.appendChild(chip);
    }
    histEl.appendChild(list);
    content.appendChild(histEl);
  }

  openPanel();
}

function openPanel() {
  panelEl.classList.add('context-panel--open');
  document.body.classList.add('panel-open');
}

function closePanel() {
  panelEl.classList.remove('context-panel--open');
  document.body.classList.remove('panel-open');
}
