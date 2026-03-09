import { NOTES } from '../utils/constants.js';
import { getColor, translate, parseWord, reverseTranslate } from '../utils/solresol.js';
import { SolresolWord } from '../models/word.js';
import { createWordRenderer } from '../components/word-renderer.js';
import { createWordBlocks } from '../components/color-block.js';
import { createSheetMusic } from '../components/sheet-music.js';
import { playNote, playWord, playSentence } from '../audio/synth.js';
import { MidiInput } from '../audio/midi.js';
import { emit } from '../utils/events.js';

/**
 * Instrument view — the play-first home page.
 * Seven colored keys. Play notes. Words form. Meaning appears.
 */
export function renderInstrument(container) {
  container.innerHTML = `
    <section class="view instrument-view">
      <div class="instrument-hero">
        <h2>Play Solresol</h2>
        <p>Press the keys to build words. Each note is a syllable, each color a sound.</p>
      </div>
      <div class="instrument-keyboard" id="inst-keyboard" role="group" aria-label="Solresol keyboard"></div>
      <div class="instrument-building" id="inst-building">
        <span class="instrument-building-hint">Play notes to build a word...</span>
      </div>
      <div class="instrument-controls">
        <button class="btn btn--sm" id="inst-commit">Commit Word</button>
        <button class="btn btn--sm" id="inst-backspace">⌫ Undo</button>
        <button class="btn btn--sm" id="inst-clear">Clear All</button>
        <label class="midi-control-label">
          <select id="inst-waveform" class="select">
            <option value="sine">Sine</option>
            <option value="triangle">Triangle</option>
            <option value="sawtooth">Sawtooth</option>
            <option value="square">Square</option>
          </select>
        </label>
      </div>
      <div id="inst-midi-status" class="instrument-midi-status"></div>
      <div class="instrument-completed" id="inst-completed"></div>
      <details class="instrument-translator">
        <summary>Text translator</summary>
        <div class="translator-input-row" style="margin-top:0.5rem">
          <input type="text" id="inst-text-input" class="input"
                 placeholder="Type English or Solresol..." autocomplete="off"
                 aria-label="Text translation input">
        </div>
        <div id="inst-text-results" style="margin-top:0.75rem"></div>
      </details>
    </section>
  `;

  const keyboardEl = container.querySelector('#inst-keyboard');
  const buildingEl = container.querySelector('#inst-building');
  const completedEl = container.querySelector('#inst-completed');
  const commitBtn = container.querySelector('#inst-commit');
  const backspaceBtn = container.querySelector('#inst-backspace');
  const clearBtn = container.querySelector('#inst-clear');
  const waveformSelect = container.querySelector('#inst-waveform');
  const midiStatusEl = container.querySelector('#inst-midi-status');
  const textInput = container.querySelector('#inst-text-input');
  const textResults = container.querySelector('#inst-text-results');

  // State
  const currentWord = new SolresolWord([]);
  let completedWords = []; // array of SolresolWord
  let wordRenderer = null;
  let borderFlashTimer = null;
  const keyEls = {};

  // Build the 7-key instrument
  const KEY_MAP = ['q', 'w', 'e', 'r', 't', 'y', 'u'];

  for (let i = 0; i < NOTES.length; i++) {
    const note = NOTES[i];
    const key = document.createElement('button');
    key.className = 'instrument-key';
    key.style.backgroundColor = getColor(note);
    key.textContent = note.charAt(0).toUpperCase() + note.slice(1);
    key.dataset.shortcut = `${i + 1}`;
    key.setAttribute('aria-label', `Play ${note}`);
    key.addEventListener('click', () => onNote(note));
    // Visual press feedback via pointerdown
    key.addEventListener('pointerdown', () => key.classList.add('key-active'));
    key.addEventListener('pointerup', () => key.classList.remove('key-active'));
    key.addEventListener('pointerleave', () => key.classList.remove('key-active'));
    keyboardEl.appendChild(key);
    keyEls[note] = key;
  }

  // MIDI input
  const midi = new MidiInput();
  midi.init();

  const onMidiStatus = (e) => {
    const { connected, message } = e.detail;
    midiStatusEl.textContent = message;
    midiStatusEl.className = `instrument-midi-status ${connected ? 'connected' : ''}`;
  };
  const onMidiNote = (e) => onNote(e.detail.syllable);
  const onMidiSilence = () => {
    if (currentWord.length > 0) commitWord();
  };

  document.addEventListener('midi:status', onMidiStatus);
  document.addEventListener('midi:note', onMidiNote);
  document.addEventListener('midi:silence', onMidiSilence);

  // Word building
  function onNote(syllable) {
    playNote(syllable, { waveform: waveformSelect.value });
    currentWord.push(syllable);
    emit('syllable:play', { syllable });

    // Flash building border with note color
    buildingEl.style.borderColor = getColor(syllable);
    clearTimeout(borderFlashTimer);
    borderFlashTimer = setTimeout(() => {
      buildingEl.style.borderColor = currentWord.isEmpty ? '' : 'var(--accent)';
    }, 300);

    if (currentWord.length >= 5) {
      commitWord();
    }
  }

  function commitWord() {
    if (currentWord.isEmpty) return;
    const committed = currentWord.clone();
    completedWords.push(committed);
    currentWord.clear();
    renderCompleted();
  }

  // Reactive rendering of building area
  currentWord.onChange(() => renderBuilding());
  renderBuilding();

  function renderBuilding() {
    buildingEl.innerHTML = '';

    if (currentWord.isEmpty) {
      const hint = document.createElement('span');
      hint.className = 'instrument-building-hint';
      hint.textContent = 'Play notes to build a word...';
      buildingEl.appendChild(hint);
      buildingEl.classList.remove('has-word');
      return;
    }

    buildingEl.classList.add('has-word');

    // WordRenderer for the current word being built
    if (wordRenderer) wordRenderer.destroy();
    wordRenderer = createWordRenderer(currentWord, {
      size: 'lg',
      showSheet: true,
      showDefinition: false,
      reactive: false, // we re-render manually on change
      notations: new Set(['colors', 'solfege', 'numbers']),
    });
    buildingEl.appendChild(wordRenderer.el);

    // Show match status
    const matchEl = document.createElement('div');
    if (currentWord.exists) {
      matchEl.className = 'instrument-match';
      matchEl.textContent = currentWord.definition;
    } else if (currentWord.length >= 2) {
      matchEl.className = 'instrument-nomatch';
      matchEl.textContent = '(not in dictionary — keep building or commit)';
    }
    buildingEl.appendChild(matchEl);
  }

  function renderCompleted() {
    completedEl.innerHTML = '';
    if (completedWords.length === 0) return;

    const title = document.createElement('h3');
    title.textContent = 'Composed Words';
    completedEl.appendChild(title);

    const sentence = document.createElement('div');
    sentence.className = 'instrument-sentence';

    for (const w of completedWords) {
      const card = document.createElement('div');
      card.className = 'instrument-word-card';

      const wr = createWordRenderer(w, {
        size: 'sm',
        showSheet: false,
        showDefinition: false,
        reactive: false,
        notations: new Set(['colors']),
      });
      card.appendChild(wr.el);

      const def = document.createElement('div');
      def.className = 'instrument-word-def';
      def.textContent = w.exists ? w.definition : w.text;
      card.appendChild(def);
      sentence.appendChild(card);
    }
    completedEl.appendChild(sentence);

    // Full sentence sheet music
    const allSyllables = completedWords.flatMap(w => w.syllables);
    if (allSyllables.length > 0) {
      const sheetWrap = document.createElement('div');
      sheetWrap.style.cssText = 'background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);padding:0.75rem;margin-top:0.5rem';
      sheetWrap.appendChild(createSheetMusic(allSyllables));
      completedEl.appendChild(sheetWrap);
    }

    // Play sentence button
    const playSentenceBtn = document.createElement('button');
    playSentenceBtn.className = 'btn btn--sm';
    playSentenceBtn.innerHTML = '&#9654; Play All';
    playSentenceBtn.style.marginTop = '0.5rem';
    playSentenceBtn.addEventListener('click', () => {
      playSentence(completedWords.map(w => w.syllables));
    });
    completedEl.appendChild(playSentenceBtn);
  }

  // Controls
  commitBtn.addEventListener('click', () => commitWord());
  backspaceBtn.addEventListener('click', () => currentWord.pop());
  clearBtn.addEventListener('click', () => {
    currentWord.clear();
    completedWords = [];
    completedEl.innerHTML = '';
  });

  // Keyboard shortcuts
  const onKeyDown = (e) => {
    // Don't capture when typing in text input
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    const n = Number(e.key);
    if (n >= 1 && n <= 7) {
      e.preventDefault();
      const note = NOTES[n - 1];
      onNote(note);
      // Flash key
      flashKey(note);
    }
    // QWERTYU mapping
    const qIdx = KEY_MAP.indexOf(e.key.toLowerCase());
    if (qIdx !== -1) {
      e.preventDefault();
      const note = NOTES[qIdx];
      onNote(note);
      flashKey(note);
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      commitWord();
    }
    if (e.key === 'Backspace') {
      e.preventDefault();
      currentWord.pop();
    }
  };

  function flashKey(note) {
    const el = keyEls[note];
    if (el) {
      el.classList.add('key-active');
      setTimeout(() => el.classList.remove('key-active'), 120);
    }
  }

  document.addEventListener('keydown', onKeyDown);

  // Text translator (collapsible)
  let textDebounce;
  textInput.addEventListener('input', () => {
    clearTimeout(textDebounce);
    textDebounce = setTimeout(() => doTextTranslate(), 200);
  });

  function doTextTranslate() {
    const q = textInput.value.trim();
    textResults.innerHTML = '';
    if (!q) return;

    // Try as Solresol first
    const syls = parseWord(q);
    if (syls.length > 0) {
      const def = translate(q);
      if (def) {
        const w = new SolresolWord(syls);
        const wr = createWordRenderer(w, {
          size: 'md',
          showDefinition: true,
          showSheet: true,
          notations: new Set(['colors', 'solfege', 'numbers']),
        });
        textResults.appendChild(wr.el);
        return;
      }
    }

    // Try as English
    const matches = reverseTranslate(q);
    if (matches.length === 0) {
      textResults.innerHTML = '<p class="no-results">No matches found</p>';
      return;
    }

    for (const entry of matches.slice(0, 10)) {
      const w = new SolresolWord(entry.solresol);
      const item = document.createElement('div');
      item.style.cssText = 'margin-bottom:0.75rem';
      const wr = createWordRenderer(w, {
        size: 'sm',
        showDefinition: true,
        showSheet: false,
        reactive: false,
        notations: new Set(['colors']),
      });
      item.appendChild(wr.el);
      textResults.appendChild(item);
    }
  }

  // Cleanup
  return () => {
    midi.destroy();
    if (wordRenderer) wordRenderer.destroy();
    document.removeEventListener('midi:status', onMidiStatus);
    document.removeEventListener('midi:note', onMidiNote);
    document.removeEventListener('midi:silence', onMidiSilence);
    document.removeEventListener('keydown', onKeyDown);
  };
}
