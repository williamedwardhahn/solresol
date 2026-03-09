import { parseWord, translate, reverseTranslate } from '../utils/solresol.js';
import { SolresolWord } from '../models/word.js';
import { createWordRenderer } from '../components/word-renderer.js';
import { createWordBlocks } from '../components/color-block.js';
import { createSheetMusic } from '../components/sheet-music.js';
import { playWord, playSentence } from '../audio/synth.js';

export function renderTranslator(container) {
  container.innerHTML = `
    <section class="view translator-view">
      <h2>Translator</h2>
      <div class="translator-controls">
        <div class="translator-direction">
          <button class="btn btn--active" data-dir="en-sol">English → Solresol</button>
          <button class="btn" data-dir="sol-en">Solresol → English</button>
          <button class="btn" data-dir="sentence">Sentence</button>
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
  let lastSentenceWords = [];
  const renderers = [];

  dirBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      direction = btn.dataset.dir;
      dirBtns.forEach(b => b.classList.remove('btn--active'));
      btn.classList.add('btn--active');
      input.placeholder = direction === 'en-sol'
        ? 'Type an English word...'
        : direction === 'sol-en'
        ? 'Type a Solresol word (e.g. doredo)...'
        : 'Type an English sentence...';
      input.value = '';
      results.innerHTML = '';
      playBtn.disabled = true;
      lastSyllables = [];
      lastSentenceWords = [];
    });
  });

  let debounce;
  input.addEventListener('input', () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => doTranslate(), 200);
  });

  playBtn.addEventListener('click', () => {
    if (lastSentenceWords.length > 0) {
      playSentence(lastSentenceWords);
    } else if (lastSyllables.length) {
      playWord(lastSyllables);
    }
  });

  function doTranslate() {
    const q = input.value.trim();
    results.innerHTML = '';
    lastSyllables = [];
    lastSentenceWords = [];
    playBtn.disabled = true;
    for (const r of renderers) r.destroy();
    renderers.length = 0;

    if (!q) return;

    if (direction === 'sentence') {
      doSentence(q);
    } else if (direction === 'en-sol') {
      doEnglishToSolresol(q);
    } else {
      doSolresolToEnglish(q);
    }
  }

  function doEnglishToSolresol(q) {
    const matches = reverseTranslate(q);
    if (matches.length === 0) {
      results.innerHTML = '<p class="no-results">No matches found</p>';
      return;
    }

    const list = document.createElement('div');
    list.className = 'result-list';

    matches.slice(0, 30).forEach(entry => {
      const word = new SolresolWord(entry.solresol);
      const item = document.createElement('div');
      item.className = 'result-item';

      const wr = createWordRenderer(word, {
        size: 'sm',
        showSheet: false,
        showDefinition: true,
        showReverse: word.length >= 2,
        reactive: true,
        notations: new Set(['colors', 'solfege']),
      });
      renderers.push(wr);
      item.appendChild(wr.el);
      list.appendChild(item);
    });

    if (matches.length > 30) {
      const more = document.createElement('p');
      more.className = 'more-results';
      more.textContent = `...and ${matches.length - 30} more results`;
      list.appendChild(more);
    }

    results.appendChild(list);
  }

  function doSolresolToEnglish(q) {
    const syllables = parseWord(q);
    if (syllables.length === 0) {
      results.innerHTML = '<p class="no-results">Enter a valid Solresol word</p>';
      return;
    }

    lastSyllables = syllables;
    playBtn.disabled = false;

    const word = new SolresolWord(syllables);
    const card = document.createElement('div');
    card.className = 'result-card';

    const wr = createWordRenderer(word, {
      size: 'lg',
      showSheet: true,
      showDefinition: true,
      showReverse: word.length >= 2,
      reactive: true,
      notations: new Set(['colors', 'solfege', 'numbers', 'binary']),
    });
    renderers.push(wr);
    card.appendChild(wr.el);
    results.appendChild(card);
  }

  function doSentence(q) {
    const words = q.split(/\s+/).filter(Boolean);
    const sentenceEl = document.createElement('div');
    sentenceEl.className = 'sentence-results';
    const allSyllables = [];

    for (const word of words) {
      const matches = reverseTranslate(word);
      const row = document.createElement('div');
      row.className = 'sentence-word-row';

      const engLabel = document.createElement('span');
      engLabel.className = 'sentence-eng';
      engLabel.textContent = word;

      const arrow = document.createElement('span');
      arrow.className = 'sentence-arrow';
      arrow.textContent = '→';

      row.append(engLabel, arrow);

      if (matches.length > 0) {
        const best = matches[0];
        const syls = parseWord(best.solresol);
        allSyllables.push(syls);

        row.appendChild(createWordBlocks(syls, { size: 'sm' }));
        const solLabel = document.createElement('span');
        solLabel.className = 'sentence-sol';
        solLabel.textContent = best.solresol;
        row.appendChild(solLabel);
      } else {
        const missing = document.createElement('span');
        missing.className = 'sentence-missing';
        missing.textContent = '(not found)';
        row.appendChild(missing);
      }

      sentenceEl.appendChild(row);
    }

    const flatSyllables = allSyllables.flat();
    if (flatSyllables.length > 0) {
      lastSentenceWords = allSyllables;
      playBtn.disabled = false;

      const sheet = document.createElement('div');
      sheet.className = 'sentence-sheet';
      sheet.appendChild(createSheetMusic(flatSyllables));
      sentenceEl.appendChild(sheet);
    }

    results.appendChild(sentenceEl);
  }
}
