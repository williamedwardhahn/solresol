import { numberToSolresol, getNumberTable } from '../utils/numbers.js';
import { parseWord } from '../utils/solresol.js';
import { createWordBlocks } from '../components/color-block.js';
import { playWord } from '../audio/synth.js';

export function renderNumbers(container) {
  container.innerHTML = `
    <section class="view numbers-view">
      <h2>Number System</h2>
      <p class="view-desc">Solresol numbers use French-style composition. Enter any number to see its Solresol form.</p>

      <div class="numbers-converter">
        <div class="numbers-input-row">
          <input type="number" id="num-input" class="input" placeholder="Enter a number..." min="0" max="999999999" aria-label="Number input">
          <button id="num-play" class="btn btn--icon" aria-label="Play" disabled>&#9654;</button>
        </div>
        <div id="num-result" class="num-result" aria-live="polite"></div>
      </div>

      <h3>Base Numbers</h3>
      <div id="num-table" class="num-table"></div>
    </section>
  `;

  const input = container.querySelector('#num-input');
  const result = container.querySelector('#num-result');
  const playBtn = container.querySelector('#num-play');
  const tableEl = container.querySelector('#num-table');
  let lastSyllables = [];

  input.addEventListener('input', () => {
    const val = parseInt(input.value, 10);
    result.innerHTML = '';
    lastSyllables = [];
    playBtn.disabled = true;

    if (isNaN(val) || val < 0) return;

    const solresol = numberToSolresol(val);
    const words = solresol.split(' ');
    const allSyls = words.flatMap(w => parseWord(w));

    lastSyllables = allSyls;
    playBtn.disabled = false;

    const card = document.createElement('div');
    card.className = 'num-result-card';

    const numEl = document.createElement('div');
    numEl.className = 'num-result-num';
    numEl.textContent = val.toLocaleString();

    const solEl = document.createElement('div');
    solEl.className = 'num-result-sol';
    solEl.textContent = solresol;

    const blocks = createWordBlocks(allSyls);

    card.append(numEl, solEl, blocks);
    result.appendChild(card);
  });

  playBtn.addEventListener('click', () => {
    if (lastSyllables.length) playWord(lastSyllables);
  });

  // Render base number table
  const numbers = getNumberTable();
  for (const { number, solresol } of numbers) {
    const row = document.createElement('div');
    row.className = 'num-row';

    const numCol = document.createElement('span');
    numCol.className = 'num-col-num';
    numCol.textContent = number.toLocaleString();

    const syls = parseWord(solresol);
    const blocks = createWordBlocks(syls, { size: 'sm', showLabel: false });

    const wordCol = document.createElement('span');
    wordCol.className = 'num-col-word';
    wordCol.textContent = solresol;

    const playRowBtn = document.createElement('button');
    playRowBtn.className = 'btn btn--sm btn--icon';
    playRowBtn.innerHTML = '&#9654;';
    playRowBtn.addEventListener('click', () => playWord(syls));

    row.append(numCol, blocks, wordCol, playRowBtn);
    tableEl.appendChild(row);
  }
}
