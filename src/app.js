import { renderTranslator } from './views/translator.js';
import { renderDictionary } from './views/dictionary.js';
import { renderQuiz } from './views/quiz.js';
import { renderMidiLab } from './views/midi-lab.js';
import { renderReference } from './views/reference.js';
import { renderExplorer } from './views/explorer.js';
import { renderAntonyms } from './views/antonyms.js';
import { renderNumbers } from './views/numbers.js';
import { renderPhrasebook } from './views/phrasebook.js';

const routes = {
  translator:  { label: 'Translate',   render: renderTranslator },
  dictionary:  { label: 'Dictionary',  render: renderDictionary },
  explorer:    { label: 'Explorer',    render: renderExplorer },
  numbers:     { label: 'Numbers',     render: renderNumbers },
  phrasebook:  { label: 'Phrases',     render: renderPhrasebook },
  antonyms:    { label: 'Antonyms',    render: renderAntonyms },
  quiz:        { label: 'Quiz',        render: renderQuiz },
  'midi-lab':  { label: 'MIDI Lab',    render: renderMidiLab },
  reference:   { label: 'Reference',   render: renderReference },
};

const DEFAULT_ROUTE = 'translator';
let currentCleanup = null;

function getRoute() {
  const hash = window.location.hash.slice(1);
  const [route] = hash.split('?');
  return route || DEFAULT_ROUTE;
}

/** Get query params from hash, e.g. #dictionary?word=dore → { word: 'dore' } */
export function getHashParams() {
  const hash = window.location.hash.slice(1);
  const qIdx = hash.indexOf('?');
  if (qIdx === -1) return {};
  return Object.fromEntries(new URLSearchParams(hash.slice(qIdx + 1)));
}

function navigate(route) {
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
}

export function initApp() {
  const nav = document.getElementById('app-nav');
  const toggle = document.getElementById('nav-toggle');

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
      // Close mobile nav
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
  navigate(getRoute());
}
