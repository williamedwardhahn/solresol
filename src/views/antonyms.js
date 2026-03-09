import { getAntonymPairs } from '../utils/antonyms.js';
import { createWordBlocks } from '../components/color-block.js';
import { playWord } from '../audio/synth.js';

export function renderAntonyms(container) {
  container.innerHTML = `
    <section class="view antonyms-view">
      <h2>Antonym Pairs</h2>
      <p class="view-desc">A unique Solresol principle: <strong>reversing</strong> a word's syllables produces its opposite meaning.</p>
      <div id="antonym-list" class="antonym-list"></div>
    </section>
  `;

  const listEl = container.querySelector('#antonym-list');
  const pairs = getAntonymPairs();

  for (const pair of pairs) {
    const row = document.createElement('div');
    row.className = 'antonym-row';

    // Left word
    const left = document.createElement('div');
    left.className = 'antonym-side';
    const leftWord = document.createElement('div');
    leftWord.className = 'antonym-word';
    leftWord.textContent = pair.word1;
    const leftBlocks = createWordBlocks(pair.syllables1, { size: 'sm' });
    const leftDef = document.createElement('div');
    leftDef.className = 'antonym-def';
    leftDef.textContent = pair.def1;
    const leftPlay = document.createElement('button');
    leftPlay.className = 'btn btn--sm btn--icon';
    leftPlay.innerHTML = '&#9654;';
    leftPlay.addEventListener('click', () => playWord(pair.syllables1));
    left.append(leftWord, leftBlocks, leftDef, leftPlay);

    // Arrow
    const arrow = document.createElement('div');
    arrow.className = 'antonym-arrow';
    arrow.textContent = '↔';

    // Right word
    const right = document.createElement('div');
    right.className = 'antonym-side';
    const rightWord = document.createElement('div');
    rightWord.className = 'antonym-word';
    rightWord.textContent = pair.word2;
    const rightBlocks = createWordBlocks(pair.syllables2, { size: 'sm' });
    const rightDef = document.createElement('div');
    rightDef.className = 'antonym-def';
    rightDef.textContent = pair.def2;
    const rightPlay = document.createElement('button');
    rightPlay.className = 'btn btn--sm btn--icon';
    rightPlay.innerHTML = '&#9654;';
    rightPlay.addEventListener('click', () => playWord(pair.syllables2));
    right.append(rightWord, rightBlocks, rightDef, rightPlay);

    row.append(left, arrow, right);
    listEl.appendChild(row);
  }
}
