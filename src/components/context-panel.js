import { SolresolWord } from '../models/word.js';
import { createWordRenderer } from './word-renderer.js';
import { createNotationToggles } from './notation-display.js';
import { getAntonym } from '../utils/antonyms.js';
import { SEMANTIC_CATEGORIES } from '../utils/grammar.js';
import { translate } from '../utils/solresol.js';
import { inspectWord, currentSentence } from '../state/focus-word.js';
import { on, emit } from '../utils/events.js';
import { isStarred, toggleStar } from '../state/vocabulary.js';
import { shareWordCard } from './word-card-export.js';
import { managed } from '../utils/lifecycle.js';

let panelEl = null;
const panelScope = managed();
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

// Persistent panel DOM refs — survive between word switches
let displayWord = null;
let currentRenderer = null;
let catEl = null;
let antEl = null;
let actionsEl = null;
let stressEl = null;
let togglesEl = null;
let histEl = null;
let addBtn = null;
let starBtn = null;
let shareBtn = null;

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

  // If panel already has structure, morph in place instead of rebuilding
  if (displayWord && currentRenderer) {
    morphToWord(word);
  } else {
    buildPanel(content, word);
  }

  openPanel();
}

/**
 * Build the panel DOM from scratch (first time only).
 */
function buildPanel(content, word) {
  content.innerHTML = '';
  panelScope.destroyAll();

  displayWord = new SolresolWord(word.syllables);

  // Word renderer
  currentRenderer = panelScope.track(createWordRenderer(displayWord, {
    size: 'lg',
    showSheet: true,
    showDefinition: true,
    showReverse: displayWord.length >= 2,
    showMirror: true,
    showStress: displayWord.length >= 2,
    reactive: true,
    notations: activeNotations,
    clickToFocus: false,
  }));
  content.appendChild(currentRenderer.el);

  // Category
  catEl = document.createElement('div');
  catEl.className = 'cp-meta';
  catEl.style.cursor = 'pointer';
  catEl.title = 'View in Dictionary by category';
  catEl.addEventListener('click', () => {
    window.location.hash = `dictionary?start=${displayWord.syllables[0]}`;
    closePanel();
  });
  content.appendChild(catEl);
  updateCategory();

  // Antonym
  antEl = document.createElement('div');
  antEl.className = 'cp-meta cp-meta--clickable';
  antEl.title = 'Focus on antonym';
  antEl.addEventListener('click', () => {
    const ant = displayWord.antonym;
    if (ant) inspectWord(ant);
  });
  content.appendChild(antEl);
  updateAntonym();

  // Actions bar
  actionsEl = document.createElement('div');
  actionsEl.className = 'cp-actions';

  const dictBtn = document.createElement('button');
  dictBtn.className = 'btn btn--sm';
  dictBtn.textContent = 'Dictionary';
  dictBtn.title = 'Find in Dictionary';
  dictBtn.addEventListener('click', () => {
    window.location.hash = `dictionary?word=${displayWord.text.toLowerCase()}`;
    closePanel();
  });
  actionsEl.appendChild(dictBtn);

  const sunBtn = document.createElement('button');
  sunBtn.className = 'btn btn--sm';
  sunBtn.textContent = 'Sunburst';
  sunBtn.title = 'Show on Sunburst';
  sunBtn.addEventListener('click', () => {
    window.location.hash = `dictionary?mode=sunburst&zoom=${displayWord.syllables[0]}`;
    closePanel();
  });
  actionsEl.appendChild(sunBtn);

  shareBtn = document.createElement('button');
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
  actionsEl.appendChild(shareBtn);

  addBtn = document.createElement('button');
  addBtn.className = 'btn btn--sm';
  addBtn.textContent = 'Add to Sentence';
  addBtn.title = 'Add this word to the current sentence';
  addBtn.addEventListener('click', () => {
    currentSentence.addWord(displayWord);
    emit('word:commit', { word: displayWord });
    addBtn.textContent = 'Added!';
    addBtn.disabled = true;
    setTimeout(() => {
      addBtn.textContent = 'Add to Sentence';
      addBtn.disabled = false;
    }, 1500);
  });
  actionsEl.appendChild(addBtn);

  starBtn = document.createElement('button');
  starBtn.className = 'btn btn--sm';
  starBtn.title = 'Toggle starred';
  starBtn.addEventListener('click', () => {
    const nowStarred = toggleStar(displayWord.text);
    starBtn.textContent = nowStarred ? '\u2605 Starred' : '\u2606 Star';
  });
  actionsEl.appendChild(starBtn);
  updateStar();

  content.appendChild(actionsEl);

  // Stress toggles
  stressEl = document.createElement('div');
  stressEl.className = 'cp-meta';
  content.appendChild(stressEl);
  buildStressToggles();

  // Notation toggles
  togglesEl = createNotationToggles(activeNotations, (updated) => {
    activeNotations = updated;
    saveNotations(activeNotations);
    if (currentRenderer) currentRenderer.rerender();
  });
  content.appendChild(togglesEl);

  // History
  histEl = document.createElement('div');
  histEl.className = 'cp-history';
  content.appendChild(histEl);
  updateHistory();
}

/**
 * Morph the panel to show a different word — update in place, no DOM rebuild.
 */
function morphToWord(word) {
  // Update the display word
  displayWord.set(word.syllables);

  // Update sections that depend on word identity
  updateCategory();
  updateAntonym();
  updateStar();
  updateHistory();
  buildStressToggles();

  // Reset action button states
  if (addBtn) {
    addBtn.textContent = 'Add to Sentence';
    addBtn.disabled = false;
  }
  if (shareBtn) {
    shareBtn.textContent = 'Share';
    shareBtn.disabled = false;
  }
}

function updateCategory() {
  if (!catEl || !displayWord) return;
  const cat = displayWord.category;
  if (cat) {
    catEl.innerHTML = `<span class="cp-meta-label">Category:</span> <span style="color:${cat.color}">${cat.label}</span>`;
    catEl.style.display = '';
  } else {
    catEl.style.display = 'none';
  }
}

function updateAntonym() {
  if (!antEl || !displayWord) return;
  const antonym = displayWord.antonym;
  if (antonym) {
    const antDef = translate(antonym);
    antEl.innerHTML = `<span class="cp-meta-label">Antonym:</span> <strong>${antonym}</strong>${antDef ? ' \u2014 ' + antDef : ''}`;
    antEl.style.display = '';
  } else {
    antEl.style.display = 'none';
  }
}

function updateStar() {
  if (!starBtn || !displayWord) return;
  starBtn.textContent = isStarred(displayWord.text) ? '\u2605 Starred' : '\u2606 Star';
}

function buildStressToggles() {
  if (!stressEl || !displayWord) return;
  stressEl.innerHTML = '';

  if (displayWord.length < 2) {
    stressEl.style.display = 'none';
    return;
  }
  stressEl.style.display = '';
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
      stressEl.querySelectorAll('.btn').forEach(b => b.classList.remove('btn--active'));
      btn.classList.add('btn--active');
    });
    stressEl.appendChild(btn);
  }
}

function updateHistory() {
  if (!histEl || !displayWord) return;
  addToHistory(displayWord.text);
  const history = getHistory().filter(w => w !== displayWord.text);

  histEl.innerHTML = '';
  if (history.length === 0) {
    histEl.style.display = 'none';
    return;
  }
  histEl.style.display = '';
  histEl.innerHTML = '<span class="cp-meta-label">Recent:</span>';
  const list = document.createElement('div');
  list.className = 'cp-history-list';
  for (const w of history.slice(0, 8)) {
    const chip = document.createElement('button');
    chip.className = 'btn btn--sm cp-history-chip';
    chip.textContent = w;
    chip.addEventListener('click', () => inspectWord(w));
    list.appendChild(chip);
  }
  histEl.appendChild(list);
}

function openPanel() {
  panelEl.classList.add('context-panel--open');
  document.body.classList.add('panel-open');
}

function closePanel() {
  panelEl.classList.remove('context-panel--open');
  document.body.classList.remove('panel-open');
}
