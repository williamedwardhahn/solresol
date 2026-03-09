import { getAllNotations, NOTATION_SYSTEMS } from '../utils/notation.js';
import { createWordBlocks } from './color-block.js';
import { parseWord } from '../utils/solresol.js';

/**
 * Render a Solresol word in all 7 notation systems.
 * @param {string} word
 * @param {Set<string>} activeNotations - which systems to show
 * @returns {HTMLElement}
 */
export function createNotationDisplay(word, activeNotations = null) {
  const notations = getAllNotations(word);
  if (!notations) return document.createElement('span');

  const active = activeNotations || new Set(['solfege', 'colors', 'numbers']);
  const syllables = parseWord(word);

  const container = document.createElement('div');
  container.className = 'notation-display';

  if (active.has('solfege')) {
    const row = makeRow('Solfege', notations.solfege);
    container.appendChild(row);
  }

  if (active.has('colors')) {
    const row = document.createElement('div');
    row.className = 'notation-row';
    const label = document.createElement('span');
    label.className = 'notation-label';
    label.textContent = 'Colors';
    row.appendChild(label);
    row.appendChild(createWordBlocks(syllables, { size: 'sm' }));
    container.appendChild(row);
  }

  if (active.has('numbers')) {
    const row = makeRow('Numbers', notations.numbers);
    container.appendChild(row);
  }

  if (active.has('binary')) {
    const row = makeRow('Binary', notations.binary);
    row.querySelector('.notation-value').classList.add('mono');
    container.appendChild(row);
  }

  if (active.has('braille')) {
    const row = makeRow('Braille', notations.braille);
    row.querySelector('.notation-value').style.fontSize = '1.3em';
    container.appendChild(row);
  }

  if (active.has('ascii')) {
    const row = makeRow('ASCII', notations.ascii);
    row.querySelector('.notation-value').classList.add('mono');
    container.appendChild(row);
  }

  if (active.has('sauso')) {
    const row = makeRow('Sauso', notations.sauso);
    row.querySelector('.notation-value').style.fontSize = '1.3em';
    container.appendChild(row);
  }

  return container;
}

function makeRow(label, value) {
  const row = document.createElement('div');
  row.className = 'notation-row';
  const labelEl = document.createElement('span');
  labelEl.className = 'notation-label';
  labelEl.textContent = label;
  const valueEl = document.createElement('span');
  valueEl.className = 'notation-value';
  valueEl.textContent = value;
  row.append(labelEl, valueEl);
  return row;
}

/**
 * Create toggles for notation systems.
 * @param {Set<string>} active
 * @param {function} onChange - called with updated Set
 * @returns {HTMLElement}
 */
export function createNotationToggles(active, onChange) {
  const container = document.createElement('div');
  container.className = 'notation-toggles';

  for (const sys of NOTATION_SYSTEMS) {
    const btn = document.createElement('button');
    btn.className = `btn btn--sm ${active.has(sys.key) ? 'btn--active' : ''}`;
    btn.textContent = sys.label;
    btn.addEventListener('click', () => {
      if (active.has(sys.key)) active.delete(sys.key);
      else active.add(sys.key);
      btn.classList.toggle('btn--active');
      onChange(active);
    });
    container.appendChild(btn);
  }

  return container;
}
