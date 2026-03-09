import { getColor } from '../utils/solresol.js';
import { playNote, playWord } from '../audio/synth.js';

/**
 * Render a single syllable as a colored block.
 * @param {string} syllable
 * @param {object} opts
 * @param {boolean} opts.showLabel - show syllable text (default true)
 * @param {boolean} opts.showNumber - show number (default false)
 * @param {string} opts.size - 'sm' | 'md' | 'lg' (default 'md')
 * @param {boolean} opts.playable - click to play sound (default true)
 * @returns {HTMLElement}
 */
export function createBlock(syllable, opts = {}) {
  const { showLabel = true, showNumber = false, size = 'md', playable = true } = opts;
  const el = document.createElement(playable ? 'button' : 'div');
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

  if (playable) {
    el.style.cursor = 'pointer';
    el.setAttribute('tabindex', '0');
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      playNote(syl);
    });
  }

  return el;
}

/**
 * Render an array of syllables as a row of colored blocks.
 * @param {string[]} syllables
 * @param {object} opts - passed to createBlock, plus:
 * @param {boolean} opts.playable - make blocks clickable (default true)
 * @returns {HTMLElement}
 */
export function createWordBlocks(syllables, opts = {}) {
  const { playable = true, ...blockOpts } = opts;
  const row = document.createElement('div');
  row.className = 'note-blocks';
  row.setAttribute('role', 'img');
  row.setAttribute('aria-label', `Solresol word: ${syllables.join('')}`);
  for (const syl of syllables) {
    row.appendChild(createBlock(syl, { ...blockOpts, playable }));
  }

  // Double-click to play entire word
  if (playable) {
    row.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      playWord(syllables);
    });
  }

  return row;
}
