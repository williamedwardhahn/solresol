import { parseWord, translate, reverseTranslate } from '../utils/solresol.js';
import { createWordBlocks } from '../components/color-block.js';
import { createSheetMusic } from '../components/sheet-music.js';
import { playWord } from '../audio/synth.js';

export function renderTranslator(container) {
  container.innerHTML = `
    <section class="view translator-view">
      <h2>Translator</h2>
      <div class="translator-controls">
        <div class="translator-direction">
          <button class="btn btn--active" data-dir="en-sol">English → Solresol</button>
          <button class="btn" data-dir="sol-en">Solresol → English</button>
        </div>
        <div class="translator-input-row">
          <input type="text" id="translator-input" class="input"
                 placeholder="Type an English word..." autocomplete="off"
                 aria-label="Translation input">
          <button id="translator-play" class="btn btn--icon" aria-label="Play audio" disabled>
            &#9654;
          </button>
        </div>
      </div>
      <div id="translator-results" class="translator-results" aria-live="polite"></div>
    </section>
  `;

  const input = container.querySelector('#translator-input');
  const results = container.querySelector('#translator-results');
  const playBtn = container.querySelector('#translator-play');
  const dirBtns = container.querySelectorAll('[data-dir]');
  let direction = 'en-sol';
  let lastSyllables = [];

  dirBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      direction = btn.dataset.dir;
      dirBtns.forEach(b => b.classList.remove('btn--active'));
      btn.classList.add('btn--active');
      input.placeholder = direction === 'en-sol'
        ? 'Type an English word...'
        : 'Type a Solresol word (e.g. doredo)...';
      input.value = '';
      results.innerHTML = '';
      playBtn.disabled = true;
    });
  });

  let debounce;
  input.addEventListener('input', () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => doTranslate(), 200);
  });

  playBtn.addEventListener('click', () => {
    if (lastSyllables.length) playWord(lastSyllables);
  });

  function doTranslate() {
    const q = input.value.trim();
    results.innerHTML = '';
    lastSyllables = [];
    playBtn.disabled = true;

    if (!q) return;

    if (direction === 'en-sol') {
      const matches = reverseTranslate(q);
      if (matches.length === 0) {
        results.innerHTML = '<p class="no-results">No matches found</p>';
        return;
      }

      const list = document.createElement('div');
      list.className = 'result-list';

      matches.slice(0, 30).forEach(entry => {
        const item = document.createElement('div');
        item.className = 'result-item';

        const syllables = parseWord(entry.solresol);
        const header = document.createElement('div');
        header.className = 'result-header';

        const wordEl = document.createElement('span');
        wordEl.className = 'result-word';
        wordEl.textContent = entry.solresol;

        const defEl = document.createElement('span');
        defEl.className = 'result-def';
        defEl.textContent = entry.definition;

        const playItemBtn = document.createElement('button');
        playItemBtn.className = 'btn btn--sm btn--icon';
        playItemBtn.innerHTML = '&#9654;';
        playItemBtn.setAttribute('aria-label', `Play ${entry.solresol}`);
        playItemBtn.addEventListener('click', () => playWord(syllables));

        header.append(wordEl, playItemBtn);
        item.append(header, createWordBlocks(syllables, { size: 'sm' }), defEl);
        list.appendChild(item);
      });

      if (matches.length > 30) {
        const more = document.createElement('p');
        more.className = 'more-results';
        more.textContent = `...and ${matches.length - 30} more results`;
        list.appendChild(more);
      }

      results.appendChild(list);
    } else {
      const syllables = parseWord(q);
      if (syllables.length === 0) {
        results.innerHTML = '<p class="no-results">Enter a valid Solresol word</p>';
        return;
      }

      const def = translate(q);
      lastSyllables = syllables;
      playBtn.disabled = false;

      const card = document.createElement('div');
      card.className = 'result-card';

      const title = document.createElement('h3');
      title.textContent = syllables.map(s => s.charAt(0).toUpperCase() + s.slice(1)).join('');

      const defEl = document.createElement('p');
      defEl.className = 'result-def';
      defEl.textContent = def || 'Not found in dictionary';

      card.append(title, createWordBlocks(syllables), defEl, createSheetMusic(syllables));
      results.appendChild(card);
    }
  }
}
