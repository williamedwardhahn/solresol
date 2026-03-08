import { getColor } from '../utils/solresol.js';

/**
 * Render a single syllable as a colored block.
 * @param {string} syllable
 * @param {object} opts
 * @param {boolean} opts.showLabel - show syllable text (default true)
 * @param {boolean} opts.showNumber - show number (default false)
 * @param {string} opts.size - 'sm' | 'md' | 'lg' (default 'md')
 * @returns {HTMLElement}
 */
export function createBlock(syllable, opts = {}) {
  const { showLabel = true, showNumber = false, size = 'md' } = opts;
  const el = document.createElement('div');
  el.className = `note-block note-block--${size}`;
  el.style.backgroundColor = getColor(syllable);

  const syl = syllable.toLowerCase();
  const labels = [];
  if (showLabel) labels.push(syl.charAt(0).toUpperCase() + syl.slice(1));
  if (showNumber) {
    const n = ['do','re','mi','fa','sol','la','si'].indexOf(syl) + 1;
    labels.push(n);
  }
  el.textContent = labels.join(' ');
  el.setAttribute('aria-label', `Note ${syllable}`);
  return el;
}

/**
 * Render an array of syllables as a row of colored blocks.
 * @param {string[]} syllables
 * @param {object} opts - passed to createBlock
 * @returns {HTMLElement}
 */
export function createWordBlocks(syllables, opts = {}) {
  const row = document.createElement('div');
  row.className = 'note-blocks';
  row.setAttribute('role', 'img');
  row.setAttribute('aria-label', `Solresol word: ${syllables.join('')}`);
  for (const syl of syllables) {
    row.appendChild(createBlock(syl, opts));
  }
  return row;
}
