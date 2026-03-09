import { initHeroKeyboard } from './components/global-keyboard.js';
import { initContextPanel } from './components/context-panel.js';
import { initSentenceDisplay } from './components/sentence-bar.js';
import { initMicroQuiz } from './components/micro-quiz.js';
import { renderDictionary } from './views/dictionary.js';
import { renderTranslate } from './views/translate.js';
import { renderLearn } from './views/learn.js';
import { createSequencer } from './components/sequencer.js';
import { managed } from './utils/lifecycle.js';
import { hasOnboarded, renderOnboarding } from './components/onboarding.js';

const appScope = managed();

/** Get query params from hash (kept for backward compat with dictionary deep links) */
export function getHashParams() {
  const hash = window.location.hash.slice(1);
  const qIdx = hash.indexOf('?');
  if (qIdx === -1) return {};
  return Object.fromEntries(new URLSearchParams(hash.slice(qIdx + 1)));
}

/**
 * Single-page app initializer.
 * All sections live on one page — no routing.
 */
export function initApp() {
  // Init hero keyboard (renders into #hero-keyboard, building into #building-area)
  initHeroKeyboard(
    document.getElementById('hero-keyboard'),
    document.getElementById('building-area')
  );

  // Init context panel (slide-in detail)
  initContextPanel(document.getElementById('context-panel'));

  // Init inline sentence display
  initSentenceDisplay(document.getElementById('sentence-display'));

  // Init micro-quiz toasts
  initMicroQuiz();

  // Collapsible panel toggles
  document.querySelectorAll('.panel-header').forEach(header => {
    const panel = header.closest('.panel') || header.parentElement;
    const body = panel.querySelector('.panel-body');
    const toggle = header.querySelector('.panel-toggle');
    const isCollapsed = body.classList.contains('panel-body--collapsed');

    header.addEventListener('click', () => {
      const collapsed = body.classList.contains('panel-body--collapsed');
      body.classList.toggle('panel-body--collapsed');
      if (toggle) toggle.textContent = collapsed ? '▾' : '▸';

      // Lazy-init panel content on first expand
      if (collapsed && !body.dataset.initialized) {
        initPanelContent(header.dataset.panel, body);
        body.dataset.initialized = 'true';
      }
    });

    // Auto-init visible panels
    if (!isCollapsed && !body.dataset.initialized) {
      initPanelContent(header.dataset.panel, body);
      body.dataset.initialized = 'true';
    }
  });

  // Smooth scroll for nav anchor links
  document.querySelectorAll('.nav-link[href^="#"]').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const target = document.querySelector(link.getAttribute('href'));
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  // Show onboarding on first visit
  if (!hasOnboarded()) {
    const heroEl = document.getElementById('hero-keyboard');
    const originalContent = heroEl.innerHTML;
    heroEl.innerHTML = '';
    renderOnboarding(heroEl, () => {
      // After onboarding, keyboard is already initialized — just scroll to top
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }
}

let sequencerInstance = null;

function initPanelContent(panelName, container) {
  switch (panelName) {
    case 'dict':
      renderDictionary(container);
      break;
    case 'learn':
      renderLearn(container);
      break;
    case 'translate':
      renderTranslate(container);
      break;
    case 'sequencer':
      if (!sequencerInstance) {
        sequencerInstance = createSequencer(container);
      }
      break;
  }
}
