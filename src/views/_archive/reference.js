import { NOTES } from '../utils/constants.js';
import { getColor, getFrequency, parseWord } from '../utils/solresol.js';
import { SolresolWord } from '../models/word.js';
import { createWordRenderer } from '../components/word-renderer.js';
import { createWordBlocks } from '../components/color-block.js';
import { playNote, playWord } from '../audio/synth.js';
import { getSyllableNotations } from '../utils/notation.js';

export function renderReference(container) {
  container.innerHTML = `
    <section class="view reference-view">
      <h2>Solresol Reference</h2>

      <article class="ref-section">
        <h3>What is Solresol?</h3>
        <p>Solresol is a constructed language devised by French musician
        <strong>Jean-Fran&ccedil;ois Sudre</strong> beginning in 1827. It is the
        first artificial language to gain any significant popularity. The language is
        built entirely from the seven musical notes of the solfege scale:
        <strong>Do, Re, Mi, Fa, Sol, La, Si</strong>.</p>
        <p>Because it is based on music, Solresol can be communicated by speaking,
        singing, playing an instrument, writing in colors, using hand signs, or
        even with numbers (1&ndash;7).</p>
      </article>

      <article class="ref-section">
        <h3>The Seven Notes</h3>
        <p style="font-size:0.85rem;color:var(--text-dim);margin-bottom:0.5rem">Click any note to hear it:</p>
        <div id="ref-notes" class="ref-notes-grid"></div>
      </article>

      <article class="ref-section">
        <h3>Communication Modes — Live Demo</h3>
        <p style="font-size:0.85rem;color:var(--text-dim);margin-bottom:0.5rem">Type a Solresol word to see it in all modes simultaneously:</p>
        <input type="text" id="ref-modes-input" class="input" style="max-width:300px;margin-bottom:0.75rem"
               placeholder="e.g. fala, misol, doredo..." autocomplete="off">
        <div id="ref-modes-demo"></div>
      </article>

      <article class="ref-section">
        <h3>Grammar Rules</h3>
        <h4>Word Length &amp; Parts of Speech</h4>
        <ul>
          <li><strong>1 syllable</strong> &mdash; Particles (do = no, re = and/or, mi = or, etc.)</li>
          <li><strong>2 syllables</strong> &mdash; Pronouns, articles, common particles</li>
          <li><strong>3 syllables</strong> &mdash; Common everyday words</li>
          <li><strong>4 syllables</strong> &mdash; Most of the vocabulary</li>
          <li><strong>5 syllables</strong> &mdash; Specialized/extended vocabulary</li>
        </ul>

        <h4>Stress &amp; Parts of Speech</h4>
        <p>The <strong>stress position</strong> on a word changes its grammatical role:</p>
        <ul>
          <li>No stress (default) &rarr; <strong>Noun</strong></li>
          <li>Stress on <strong>last syllable</strong> &rarr; Adjective</li>
          <li>Stress on <strong>penultimate syllable</strong> &rarr; Verb</li>
          <li>Stress on <strong>antepenultimate syllable</strong> &rarr; Adverb</li>
        </ul>

        <h4>Antonyms by Reversal — Try It</h4>
        <p>Reversing a word produces its opposite meaning. Click ⇄ to flip:</p>
        <div id="ref-antonym-demo" style="display:flex;justify-content:center;margin:0.75rem 0"></div>

        <h4>Gender</h4>
        <p>Feminine forms are indicated by adding an accent or lengthening the final syllable.</p>

        <h4>Tense</h4>
        <ul>
          <li>Past tense &mdash; prefix with <strong>Dodo</strong></li>
          <li>Future tense &mdash; prefix with <strong>Mimi</strong></li>
          <li>Conditional &mdash; prefix with <strong>Fafa</strong></li>
          <li>Imperative &mdash; prefix with <strong>Solsol</strong></li>
        </ul>
      </article>

      <article class="ref-section">
        <h3>History</h3>
        <p>Sudre developed Solresol over several decades, presenting it to the
        Institut de France and eventually receiving recognition at the 1855 World
        Exposition in Paris. The language was further documented by Boleslav Gajewski
        in his 1902 grammar.</p>
        <p>Solresol predates Esperanto (1887) by over 50 years, making it one of the
        earliest constructed languages in modern history.</p>
      </article>
    </section>
  `;

  // --- Interactive notes grid ---
  const notesGrid = container.querySelector('#ref-notes');
  for (const note of NOTES) {
    const card = document.createElement('div');
    card.className = 'ref-note-card';
    card.style.borderLeftColor = getColor(note);

    const num = NOTES.indexOf(note) + 1;
    const freq = getFrequency(note).toFixed(1);
    const notData = getSyllableNotations(note);

    card.innerHTML = `
      <div class="ref-note-name" style="color: ${getColor(note)}">
        ${note.charAt(0).toUpperCase() + note.slice(1)}
      </div>
      <div class="ref-note-detail">Number: ${num}</div>
      <div class="ref-note-detail">${freq} Hz</div>
      <div class="ref-note-detail" style="font-family:monospace">${notData.binary} | ${notData.braille} | ${notData.ascii}</div>
    `;

    card.style.cursor = 'pointer';
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    card.setAttribute('aria-label', `Play ${note}`);
    card.addEventListener('click', () => playNote(note, { duration: 0.6 }));
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        playNote(note, { duration: 0.6 });
      }
    });
    notesGrid.appendChild(card);
  }

  // --- Live communication modes demo ---
  const modesInput = container.querySelector('#ref-modes-input');
  const modesDemo = container.querySelector('#ref-modes-demo');
  let modesRenderer = null;

  function updateModes() {
    modesDemo.innerHTML = '';
    if (modesRenderer) { modesRenderer.destroy(); modesRenderer = null; }

    const q = modesInput.value.trim();
    if (!q) return;

    const syls = parseWord(q);
    if (syls.length === 0) return;

    const word = new SolresolWord(syls);
    modesRenderer = createWordRenderer(word, {
      size: 'lg',
      showSheet: true,
      showDefinition: true,
      showReverse: word.length >= 2,
      reactive: true,
      notations: new Set(['colors', 'solfege', 'numbers', 'binary', 'braille', 'ascii', 'sauso']),
    });
    modesDemo.appendChild(modesRenderer.el);
  }

  let modesDebounce;
  modesInput.addEventListener('input', () => {
    clearTimeout(modesDebounce);
    modesDebounce = setTimeout(updateModes, 150);
  });

  // Pre-fill with "fala"
  modesInput.value = 'fala';
  updateModes();

  // --- Antonym reversal demo ---
  const antonymDemo = container.querySelector('#ref-antonym-demo');
  const antWord = new SolresolWord(['fa', 'la']);
  const antRenderer = createWordRenderer(antWord, {
    size: 'lg',
    showSheet: true,
    showDefinition: true,
    showReverse: true,
    reactive: true,
    notations: new Set(['colors', 'solfege', 'numbers']),
  });
  antonymDemo.appendChild(antRenderer.el);
}
