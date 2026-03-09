import { PHRASE_CATEGORIES } from '../utils/phrases.js';
import { parseWord } from '../utils/solresol.js';
import { createWordBlocks } from '../components/color-block.js';
import { playWord } from '../audio/synth.js';

export function renderPhrasebook(container) {
  container.innerHTML = `
    <section class="view phrasebook-view">
      <h2>Phrase Book</h2>
      <p class="view-desc">Common Solresol phrases for everyday communication.</p>
      <div id="phrase-cats"></div>
    </section>
  `;

  const catsEl = container.querySelector('#phrase-cats');

  for (const cat of PHRASE_CATEGORIES) {
    const section = document.createElement('div');
    section.className = 'phrase-section';

    const title = document.createElement('h3');
    title.textContent = cat.label;
    section.appendChild(title);

    for (const phrase of cat.phrases) {
      const row = document.createElement('div');
      row.className = 'phrase-row';

      const englishEl = document.createElement('div');
      englishEl.className = 'phrase-english';
      englishEl.textContent = phrase.english;

      const solEl = document.createElement('div');
      solEl.className = 'phrase-solresol';

      const words = phrase.solresol.split(' ');
      const allSyls = words.flatMap(w => parseWord(w));

      const wordText = document.createElement('span');
      wordText.className = 'phrase-word';
      wordText.textContent = phrase.solresol;

      const blocks = createWordBlocks(allSyls, { size: 'sm', showLabel: false });

      const playBtn = document.createElement('button');
      playBtn.className = 'btn btn--sm btn--icon';
      playBtn.innerHTML = '&#9654;';
      playBtn.addEventListener('click', () => playWord(allSyls));

      solEl.append(wordText, blocks, playBtn);

      // Condensed form
      if (phrase.condensed) {
        const condensedEl = document.createElement('div');
        condensedEl.className = 'phrase-condensed';
        condensedEl.textContent = `Roudo Ses: ${phrase.condensed}`;
        row.append(englishEl, solEl, condensedEl);
      } else {
        row.append(englishEl, solEl);
      }

      section.appendChild(row);
    }

    catsEl.appendChild(section);
  }
}
