import { NOTES } from '../utils/constants.js';
import { getColor, getFrequency } from '../utils/solresol.js';
import { createWordBlocks } from '../components/color-block.js';
import { playNote } from '../audio/synth.js';

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
        <div id="ref-notes" class="ref-notes-grid"></div>
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
          <li>Stress on <strong>no syllable</strong> (default) &rarr; Noun</li>
          <li>Stress on <strong>last syllable</strong> &rarr; Adjective</li>
          <li>Stress on <strong>penultimate syllable</strong> &rarr; Verb</li>
          <li>Stress on <strong>antepenultimate syllable</strong> &rarr; Adverb</li>
        </ul>

        <h4>Antonyms by Reversal</h4>
        <p>A key Solresol principle: <strong>reversing</strong> a word produces its
        opposite meaning. For example:</p>
        <div id="ref-antonym-example"></div>

        <h4>Gender</h4>
        <p>Feminine forms are indicated by adding an accent or lengthening the final syllable.</p>

        <h4>Tense</h4>
        <ul>
          <li>Past tense &mdash; prefix with <strong>Re</strong></li>
          <li>Future tense &mdash; prefix with <strong>Fa</strong></li>
          <li>Conditional &mdash; prefix with <strong>La</strong></li>
        </ul>
      </article>

      <article class="ref-section">
        <h3>Communication Modes</h3>
        <table class="ref-table">
          <thead>
            <tr><th>Mode</th><th>How</th></tr>
          </thead>
          <tbody>
            <tr><td>Speech</td><td>Pronounce the solfege syllables</td></tr>
            <tr><td>Music</td><td>Play the corresponding notes on any instrument</td></tr>
            <tr><td>Color</td><td>Use the 7-color code shown above</td></tr>
            <tr><td>Numbers</td><td>1=Do, 2=Re, 3=Mi, 4=Fa, 5=Sol, 6=La, 7=Si</td></tr>
            <tr><td>Hand Signs</td><td>Point to fingers 1&ndash;7</td></tr>
            <tr><td>Flags</td><td>7 colored flags in sequence</td></tr>
          </tbody>
        </table>
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

  // Render interactive notes grid
  const notesGrid = container.querySelector('#ref-notes');
  for (const note of NOTES) {
    const card = document.createElement('div');
    card.className = 'ref-note-card';
    card.style.borderLeftColor = getColor(note);

    const num = NOTES.indexOf(note) + 1;
    const freq = getFrequency(note).toFixed(1);

    card.innerHTML = `
      <div class="ref-note-name" style="color: ${getColor(note)}">
        ${note.charAt(0).toUpperCase() + note.slice(1)}
      </div>
      <div class="ref-note-detail">Number: ${num}</div>
      <div class="ref-note-detail">Frequency: ${freq} Hz</div>
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

  // Antonym example: fala (good) ↔ lafa (bad)
  const antonymEl = container.querySelector('#ref-antonym-example');
  const row = document.createElement('div');
  row.className = 'ref-antonym-row';

  const left = document.createElement('div');
  left.className = 'ref-antonym-item';
  left.innerHTML = '<strong>Fala</strong> = good';
  left.appendChild(createWordBlocks(['fa', 'la'], { size: 'sm' }));

  const arrow = document.createElement('span');
  arrow.className = 'ref-antonym-arrow';
  arrow.textContent = '↔';

  const right = document.createElement('div');
  right.className = 'ref-antonym-item';
  right.innerHTML = '<strong>Lafa</strong> = bad';
  right.appendChild(createWordBlocks(['la', 'fa'], { size: 'sm' }));

  row.append(left, arrow, right);
  antonymEl.appendChild(row);
}
