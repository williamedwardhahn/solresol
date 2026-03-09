import { renderPlay } from './views/play.js';
import { renderDictionary } from './views/dictionary.js';
import { renderTranslate } from './views/translate.js';
import { renderLearn } from './views/learn.js';
import { initGlobalKeyboard } from './components/global-keyboard.js';
import { initContextPanel } from './components/context-panel.js';
import { initSentenceBar } from './components/sentence-bar.js';
import { hasOnboarded, renderOnboarding } from './components/onboarding.js';
import { initMicroQuiz } from './components/micro-quiz.js';

const routes = {
  play:       { label: 'Play',       render: renderPlay },
  dictionary: { label: 'Dictionary', render: renderDictionary },
  translate:  { label: 'Translate',  render: renderTranslate },
  learn:      { label: 'Learn',      render: renderLearn },
};

const DEFAULT_ROUTE = 'play';
let currentCleanup = null;

function getRoute() {
  const hash = window.location.hash.slice(1);
  const [route] = hash.split('?');
  if (route && routes[route]) return route;
  // Fall back to last visited route, then default
  try {
    const last = localStorage.getItem('solresol:route');
    if (last && routes[last]) return last;
  } catch {}
  return DEFAULT_ROUTE;
}

/** Get query params from hash, e.g. #dictionary?word=dore → { word: 'dore' } */
export function getHashParams() {
  const hash = window.location.hash.slice(1);
  const qIdx = hash.indexOf('?');
  if (qIdx === -1) return {};
  return Object.fromEntries(new URLSearchParams(hash.slice(qIdx + 1)));
}

function renderRoute(route) {
  if (currentCleanup) {
    currentCleanup();
    currentCleanup = null;
  }

  const content = document.getElementById('app-content');
  const config = routes[route];

  if (!config) {
    content.innerHTML = '<p>Page not found</p>';
    return;
  }

  content.innerHTML = '';
  const result = config.render(content);
  if (typeof result === 'function') {
    currentCleanup = result;
  }

  // Update nav active state
  document.querySelectorAll('.nav-link').forEach(link => {
    link.classList.toggle('nav-link--active', link.dataset.route === route);
  });

  // Remember last route
  try { localStorage.setItem('solresol:route', route); } catch {}
}

function navigate(route) {
  const content = document.getElementById('app-content');

  // Use View Transitions API if available for smooth crossfade
  if (document.startViewTransition) {
    document.startViewTransition(() => renderRoute(route));
  } else {
    // CSS fallback: fade out, swap, fade in
    content.classList.add('view-exit');
    setTimeout(() => {
      renderRoute(route);
      content.classList.remove('view-exit');
      content.classList.add('view-enter');
      requestAnimationFrame(() => {
        setTimeout(() => content.classList.remove('view-enter'), 200);
      });
    }, 120);
  }
}

export function initApp() {
  const nav = document.getElementById('app-nav');
  const toggle = document.getElementById('nav-toggle');

  // Init persistent components
  initGlobalKeyboard(document.getElementById('global-keyboard'));
  initContextPanel(document.getElementById('context-panel'));
  initSentenceBar(document.getElementById('sentence-bar'));
  initMicroQuiz();

  // Build nav links
  for (const [route, config] of Object.entries(routes)) {
    const a = document.createElement('a');
    a.href = `#${route}`;
    a.className = 'nav-link';
    a.dataset.route = route;
    a.textContent = config.label;
    a.addEventListener('click', (e) => {
      e.preventDefault();
      window.location.hash = route;
      nav.classList.remove('nav--open');
    });
    nav.appendChild(a);
  }

  // Mobile nav toggle
  if (toggle) {
    toggle.addEventListener('click', () => {
      nav.classList.toggle('nav--open');
    });
  }

  // Route on hash change
  window.addEventListener('hashchange', () => navigate(getRoute()));

  // Show onboarding on first visit
  const initialRoute = getRoute();
  if (initialRoute === 'play' && !hasOnboarded()) {
    const content = document.getElementById('app-content');
    content.innerHTML = '';
    currentCleanup = renderOnboarding(content, () => {
      currentCleanup = null;
      navigate('play');
    });
    // Still update nav
    document.querySelectorAll('.nav-link').forEach(link => {
      link.classList.toggle('nav-link--active', link.dataset.route === 'play');
    });
  } else {
    navigate(initialRoute);
  }
}
