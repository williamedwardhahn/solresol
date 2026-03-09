import { getAntonymPairs, getAntonym } from '../utils/antonyms.js';
import { SolresolWord } from '../models/word.js';
import { createWordRenderer } from '../components/word-renderer.js';
import { createWordBlocks } from '../components/color-block.js';
import { playWord } from '../audio/synth.js';
import { parseWord, translate } from '../utils/solresol.js';

/**
 * Antonym pairs view — interactive reversal visualizer.
 * Drag, click, or type any word to see its reversal and meaning flip.
 */
export function renderAntonyms(container) {
  container.innerHTML = `
    <section class="view antonyms-view">
      <h2>Antonym Pairs</h2>
      <p class="view-desc">Reversing a word's syllables creates its opposite meaning. Try it yourself:</p>

      <div class="antonym-explorer">
        <div class="antonym-explorer-input">
          <input type="text" id="antonym-input" class="input"
                 placeholder="Type any Solresol word (e.g. fala, misol)..." autocomplete="off"
                 aria-label="Enter a Solresol word to reverse">
        </div>
        <div id="antonym-live" class="antonym-live"></div>
      </div>

      <h3 style="margin-top:1.5rem">Known Antonym Pairs</h3>
      <div id="antonym-list" class="antonym-list"></div>
    </section>
  `;

  const inputEl = container.querySelector('#antonym-input');
  const liveEl = container.querySelector('#antonym-live');
  const listEl = container.querySelector('#antonym-list');
  const renderers = [];

  // Live any-word reversal tool
  let debounce;
  inputEl.addEventListener('input', () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => renderLiveReversal(), 150);
  });

  function renderLiveReversal() {
    liveEl.innerHTML = '';
    const q = inputEl.value.trim();
    if (!q) return;

    const syls = parseWord(q);
    if (syls.length < 2) {
      liveEl.innerHTML = '<p class="antonym-live-hint">Enter at least 2 syllables to see reversal</p>';
      return;
    }

    const original = new SolresolWord(syls);
    const reversed = original.reversed();

    const pairEl = document.createElement('div');
    pairEl.className = 'antonym-live-pair';

    // Original
    const origSide = createReversibleSide(original, reversed);
    // Arrow
    const arrow = document.createElement('div');
    arrow.className = 'antonym-arrow antonym-arrow--interactive';
    arrow.textContent = '⇄';
    arrow.title = 'Click to hear both';
    arrow.addEventListener('click', () => {
      playWord(original.syllables);
      setTimeout(() => playWord(reversed.syllables), original.length * 400 + 300);
    });
    // Reversed
    const revSide = createReversibleSide(reversed, original);

    pairEl.append(origSide, arrow, revSide);
    liveEl.appendChild(pairEl);
  }

  function createReversibleSide(word, other) {
    const side = document.createElement('div');
    side.className = 'antonym-side';

    const wr = createWordRenderer(word, {
      size: 'md',
      showSheet: false,
      showDefinition: true,
      showReverse: false,
      reactive: false,
      notations: new Set(['colors']),
    });
    renderers.push(wr);
    side.appendChild(wr.el);

    if (!word.exists) {
      const hint = document.createElement('div');
      hint.className = 'antonym-def';
      hint.textContent = '(not in dictionary)';
      side.appendChild(hint);
    }

    return side;
  }

  // Known pairs with interactive reversal animation
  const pairs = getAntonymPairs();

  for (const pair of pairs) {
    const row = document.createElement('div');
    row.className = 'antonym-row';

    const w1 = new SolresolWord(pair.syllables1);
    const w2 = new SolresolWord(pair.syllables2);

    // Left side
    const left = document.createElement('div');
    left.className = 'antonym-side';
    const leftWr = createWordRenderer(w1, {
      size: 'sm',
      showSheet: false,
      showDefinition: true,
      reactive: false,
      notations: new Set(['colors']),
    });
    renderers.push(leftWr);
    left.appendChild(leftWr.el);

    // Reverse button as the arrow
    const arrow = document.createElement('button');
    arrow.className = 'antonym-arrow antonym-arrow--interactive';
    arrow.textContent = '⇄';
    arrow.title = 'Play both words';
    arrow.setAttribute('aria-label', `Play ${pair.word1} and ${pair.word2}`);
    arrow.addEventListener('click', () => {
      playWord(pair.syllables1);
      setTimeout(() => playWord(pair.syllables2), pair.syllables1.length * 400 + 300);
    });

    // Right side
    const right = document.createElement('div');
    right.className = 'antonym-side';
    const rightWr = createWordRenderer(w2, {
      size: 'sm',
      showSheet: false,
      showDefinition: true,
      reactive: false,
      notations: new Set(['colors']),
    });
    renderers.push(rightWr);
    right.appendChild(rightWr.el);

    row.append(left, arrow, right);
    listEl.appendChild(row);
  }
}
