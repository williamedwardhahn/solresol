import { NOTES } from '../utils/constants.js';
import { getColor, translate, parseWord } from '../utils/solresol.js';
import { createWordBlocks } from '../components/color-block.js';
import { createSheetMusic } from '../components/sheet-music.js';
import { playNote } from '../audio/synth.js';
import { MidiInput } from '../audio/midi.js';

export function renderMidiLab(container) {
  container.innerHTML = `
    <section class="view midi-view">
      <h2>MIDI Lab</h2>
      <div id="midi-status" class="midi-status" aria-live="polite">Initializing MIDI...</div>
      <div class="midi-display">
        <div id="midi-current" class="midi-current"></div>
        <div id="midi-words" class="midi-words"></div>
        <div id="midi-sheet" class="midi-sheet"></div>
        <div id="midi-translation" class="midi-translation" aria-live="polite"></div>
      </div>
      <div class="midi-keyboard" id="midi-keyboard" role="group" aria-label="On-screen keyboard"></div>
      <div class="midi-controls">
        <label class="midi-control-label">Waveform:
          <select id="midi-waveform" class="select">
            <option value="sine">Sine</option>
            <option value="triangle">Triangle</option>
            <option value="sawtooth">Sawtooth</option>
            <option value="square">Square</option>
          </select>
        </label>
        <button class="btn btn--sm" id="midi-commit">Commit Word</button>
        <button class="btn btn--sm" id="midi-clear">Clear All</button>
      </div>
    </section>
  `;

  const statusEl = container.querySelector('#midi-status');
  const currentEl = container.querySelector('#midi-current');
  const wordsEl = container.querySelector('#midi-words');
  const sheetEl = container.querySelector('#midi-sheet');
  const translationEl = container.querySelector('#midi-translation');
  const keyboardEl = container.querySelector('#midi-keyboard');
  const clearBtn = container.querySelector('#midi-clear');
  const commitBtn = container.querySelector('#midi-commit');
  const waveformSelect = container.querySelector('#midi-waveform');

  let currentSyllables = [];
  let completedWords = [];

  // On-screen keyboard fallback
  for (const note of NOTES) {
    const key = document.createElement('button');
    key.className = 'midi-key';
    key.style.backgroundColor = getColor(note);
    key.textContent = note.charAt(0).toUpperCase() + note.slice(1);
    key.setAttribute('aria-label', `Play ${note}`);
    key.addEventListener('click', () => onNote(note));
    keyboardEl.appendChild(key);
  }

  // MIDI input
  const midi = new MidiInput();
  midi.init();

  // Named handlers for proper cleanup
  const onMidiStatus = (e) => {
    const { connected, message } = e.detail;
    statusEl.textContent = message;
    statusEl.className = `midi-status ${connected ? 'connected' : 'disconnected'}`;
  };
  const onMidiNote = (e) => onNote(e.detail.syllable);
  const onMidiSilence = () => {
    if (currentSyllables.length > 0) commitWord();
  };

  document.addEventListener('midi:status', onMidiStatus);
  document.addEventListener('midi:note', onMidiNote);
  document.addEventListener('midi:silence', onMidiSilence);

  clearBtn.addEventListener('click', () => {
    currentSyllables = [];
    completedWords = [];
    currentEl.innerHTML = '';
    wordsEl.innerHTML = '';
    sheetEl.innerHTML = '';
    translationEl.textContent = '';
  });

  commitBtn.addEventListener('click', () => commitWord());

  function onNote(syllable) {
    playNote(syllable, { waveform: waveformSelect.value });
    currentSyllables.push(syllable);
    renderCurrent();

    // Auto-commit at 5 syllables (max Solresol word length)
    if (currentSyllables.length >= 5) {
      commitWord();
    }
  }

  function commitWord() {
    if (currentSyllables.length === 0) return;

    const word = currentSyllables.map(s => s.charAt(0).toUpperCase() + s.slice(1)).join('');
    const def = translate(word);
    completedWords.push({ syllables: [...currentSyllables], word, definition: def });
    currentSyllables = [];

    renderWords();
    renderCurrent();
  }

  function renderCurrent() {
    currentEl.innerHTML = '';
    if (currentSyllables.length > 0) {
      const label = document.createElement('span');
      label.className = 'midi-label';
      label.textContent = 'Building: ';
      currentEl.appendChild(label);
      currentEl.appendChild(createWordBlocks(currentSyllables));
    }
  }

  function renderWords() {
    wordsEl.innerHTML = '';
    sheetEl.innerHTML = '';
    const allSyllables = [];

    for (const w of completedWords) {
      const row = document.createElement('div');
      row.className = 'midi-word-row';

      const blocks = createWordBlocks(w.syllables, { size: 'sm' });
      const text = document.createElement('span');
      text.className = 'midi-word-text';
      text.textContent = `${w.word}${w.definition ? ' — ' + w.definition : ''}`;

      row.append(blocks, text);
      wordsEl.appendChild(row);
      allSyllables.push(...w.syllables);
    }

    if (allSyllables.length > 0) {
      sheetEl.appendChild(createSheetMusic(allSyllables));
    }

    // Full translation
    const sentence = completedWords
      .map(w => w.definition || w.word)
      .join(' ');
    translationEl.textContent = sentence ? `Translation: ${sentence}` : '';
  }

  // Keyboard shortcut: keys 1-7 to play notes
  const onKeyDown = (e) => {
    const n = Number(e.key);
    if (n >= 1 && n <= 7) {
      e.preventDefault();
      onNote(NOTES[n - 1]);
    }
  };
  document.addEventListener('keydown', onKeyDown);

  // Cleanup on view change
  return () => {
    midi.destroy();
    document.removeEventListener('midi:status', onMidiStatus);
    document.removeEventListener('midi:note', onMidiNote);
    document.removeEventListener('midi:silence', onMidiSilence);
    document.removeEventListener('keydown', onKeyDown);
  };
}
