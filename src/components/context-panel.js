import { SolresolWord } from '../models/word.js';
import { createWordRenderer } from './word-renderer.js';
import { createNotationToggles } from './notation-display.js';
import { getAntonym } from '../utils/antonyms.js';
import { getSemanticCategory, SEMANTIC_CATEGORIES } from '../utils/grammar.js';
import { translate } from '../utils/solresol.js';
import { setFocusWord } from '../state/focus-word.js';
import { on } from '../utils/events.js';

let panelEl = null;
let currentRenderer = null;
let activeNotations = new Set(['colors', 'solfege', 'numbers', 'binary', 'braille', 'ascii', 'sauso']);

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
}

function showWord(word) {
  const content = panelEl.querySelector('#cp-content');
  content.innerHTML = '';
  if (currentRenderer) { currentRenderer.destroy(); currentRenderer = null; }

  // Create a copy so we don't mutate the focus word
  const displayWord = new SolresolWord(word.syllables);

  // Word renderer with full notations
  currentRenderer = createWordRenderer(displayWord, {
    size: 'lg',
    showSheet: true,
    showDefinition: true,
    showReverse: displayWord.length >= 2,
    reactive: true,
    notations: activeNotations,
    clickToFocus: false,
    onReverse: (w) => {
      w.set([...w.syllables].reverse());
    },
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
  dictBtn.textContent = 'Find in Dictionary';
  dictBtn.addEventListener('click', () => {
    window.location.hash = `dictionary?word=${displayWord.text.toLowerCase()}`;
    closePanel();
  });
  actions.appendChild(dictBtn);

  content.appendChild(actions);

  // Notation toggles
  const toggles = createNotationToggles(activeNotations, (updated) => {
    activeNotations = updated;
    if (currentRenderer) currentRenderer.rerender();
  });
  content.appendChild(toggles);

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
