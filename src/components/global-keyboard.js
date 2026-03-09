import { NOTES } from '../utils/constants.js';
import { getColor } from '../utils/solresol.js';
import { SolresolWord } from '../models/word.js';
import { createWordRenderer } from './word-renderer.js';
import { createWordPredictor } from './word-predictor.js';
import { playNote, playWord } from '../audio/synth.js';
import { buildingWord, commitBuildingWord } from '../state/focus-word.js';
import { MidiInput } from '../audio/midi.js';
import { on, emit } from '../utils/events.js';
import { managed } from '../utils/lifecycle.js';
import { displaySyllable } from '../utils/format.js';

let waveform = (() => { try { return localStorage.getItem('solresol:waveform') || 'sine'; } catch { return 'sine'; } })();
/** Priority-based input handler stack. Highest priority handles input first. */
const inputHandlers = []; // [{ id, handler, priority }]
let keyboardContainer = null;
let buildContainer = null;
const buildScope = managed();
const keyEls = {};

const KEY_MAP = ['q', 'w', 'e', 'r', 't', 'y', 'u'];

/**
 * Initialize the hero keyboard section + building area.
 * @param {HTMLElement} heroEl — container for the keyboard keys (#hero-keyboard)
 * @param {HTMLElement} buildEl — container for building word + predictor (#building-area)
 */
export function initHeroKeyboard(heroEl, buildEl) {
  keyboardContainer = heroEl;
  buildContainer = buildEl;

  // Build hero keys
  const keysRow = document.createElement('div');
  keysRow.className = 'hero-keys';

  for (let i = 0; i < NOTES.length; i++) {
    const note = NOTES[i];
    const key = document.createElement('button');
    key.className = 'hero-key';
    key.style.backgroundColor = getColor(note);
    key.setAttribute('aria-label', `Play ${note}`);
    key.innerHTML = `
      <span class="hero-key-name">${displaySyllable(note)}</span>
      <span class="hero-key-num">${i + 1}</span>
      <span class="hero-key-shortcut">${KEY_MAP[i].toUpperCase()}</span>
    `;
    key.addEventListener('pointerdown', () => {
      key.classList.add('hero-key--active');
      onNote(note);
    });
    key.addEventListener('pointerup', () => key.classList.remove('hero-key--active'));
    key.addEventListener('pointerleave', () => key.classList.remove('hero-key--active'));
    keysRow.appendChild(key);
    keyEls[note] = key;
  }

  heroEl.appendChild(keysRow);

  // Hero actions row (commit, undo, waveform)
  const actionsRow = document.createElement('div');
  actionsRow.className = 'hero-actions';

  const commitBtn = document.createElement('button');
  commitBtn.className = 'btn';
  commitBtn.textContent = 'Commit (Enter)';
  commitBtn.addEventListener('click', () => commitBuildingWord());

  const undoBtn = document.createElement('button');
  undoBtn.className = 'btn btn--sm';
  undoBtn.textContent = '⌫ Undo';
  undoBtn.addEventListener('click', () => buildingWord.pop());

  const waveformSelect = document.createElement('select');
  waveformSelect.className = 'select';
  waveformSelect.title = 'Waveform';
  waveformSelect.innerHTML = `
    <option value="sine">♪ Sine</option>
    <option value="triangle">△ Triangle</option>
    <option value="sawtooth">⊿ Sawtooth</option>
    <option value="square">□ Square</option>
  `;
  waveformSelect.value = waveform;
  waveformSelect.addEventListener('change', () => {
    waveform = waveformSelect.value;
    try { localStorage.setItem('solresol:waveform', waveform); } catch {}
  });

  const midiStatusEl = document.createElement('span');
  midiStatusEl.className = 'hero-midi-status';
  midiStatusEl.id = 'hero-midi-status';

  actionsRow.append(commitBtn, undoBtn, waveformSelect, midiStatusEl);
  heroEl.appendChild(actionsRow);

  // MIDI
  const midi = new MidiInput();
  midi.init();
  document.addEventListener('midi:note', (e) => onNote(e.detail.syllable));
  document.addEventListener('midi:silence', () => {
    if (!buildingWord.isEmpty) commitBuildingWord();
  });
  document.addEventListener('midi:status', (e) => {
    const { connected, message } = e.detail;
    midiStatusEl.textContent = connected ? '🎹' : '';
    midiStatusEl.title = message;
  });

  // Global keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;

    // Dispatch to highest-priority input handler if any
    if (inputHandlers.length > 0) {
      inputHandlers[0].handler(e);
      return;
    }

    const n = Number(e.key);
    if (n >= 1 && n <= 7) {
      e.preventDefault();
      onNote(NOTES[n - 1]);
      flashKey(NOTES[n - 1]);
    }
    const qIdx = KEY_MAP.indexOf(e.key.toLowerCase());
    if (qIdx !== -1) {
      e.preventDefault();
      onNote(NOTES[qIdx]);
      flashKey(NOTES[qIdx]);
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      commitBuildingWord();
    }
    if (e.key === 'Backspace') {
      e.preventDefault();
      buildingWord.pop();
    }
    if (e.key === 'Escape') {
      buildingWord.clear();
    }
  });

  // React to building word changes
  buildingWord.onChange(() => renderBuilding());

  renderBuilding();
}

function onNote(syllable) {
  playNote(syllable, { waveform });
  buildingWord.push(syllable);
  emit('syllable:play', { syllable });

  if (buildingWord.length >= 5) {
    commitBuildingWord();
  }
}

function flashKey(note) {
  const el = keyEls[note];
  if (el) {
    el.classList.add('hero-key--active');
    setTimeout(() => el.classList.remove('hero-key--active'), 120);
  }
}

function renderBuilding() {
  if (!buildContainer) return;
  buildContainer.innerHTML = '';
  buildScope.destroyAll();

  if (buildingWord.isEmpty) {
    // Show empty state with predictor hint
    const buildingWord_ = document.createElement('div');
    buildingWord_.className = 'building-word';
    const empty = document.createElement('div');
    empty.className = 'building-empty';
    empty.textContent = 'Play notes to build words...';
    buildingWord_.appendChild(empty);

    const predictor = buildScope.track(createWordPredictor(buildingWord));
    buildingWord_.appendChild(predictor.el);
    buildContainer.appendChild(buildingWord_);
    return;
  }

  const wrapper = document.createElement('div');
  wrapper.className = 'building-word';

  // Color blocks for current word
  const wordRenderer = buildScope.track(createWordRenderer(buildingWord, {
    size: 'md',
    showSheet: false,
    showDefinition: true,
    showMirror: true,
    reactive: false,
    notations: new Set(['colors', 'solfege']),
    clickToFocus: false,
  }));
  wrapper.appendChild(wordRenderer.el);

  // Meaning landscape predictor
  const predictor = buildScope.track(createWordPredictor(buildingWord));
  const predictorWrap = document.createElement('div');
  predictorWrap.className = 'building-predictor';
  predictorWrap.appendChild(predictor.el);
  wrapper.appendChild(predictorWrap);

  buildContainer.appendChild(wrapper);
}

/** Push an input handler onto the priority stack. Higher priority = handles first. */
export function pushInputHandler(id, handler, priority = 0) {
  popInputHandler(id);
  inputHandlers.push({ id, handler, priority });
  inputHandlers.sort((a, b) => b.priority - a.priority);
}

/** Remove an input handler by id. */
export function popInputHandler(id) {
  const idx = inputHandlers.findIndex(h => h.id === id);
  if (idx !== -1) inputHandlers.splice(idx, 1);
}

/** @deprecated Use pushInputHandler/popInputHandler instead */
export function captureKeyboard(handler) {
  pushInputHandler('legacy-capture', handler, 10);
}

/** @deprecated Use pushInputHandler/popInputHandler instead */
export function releaseKeyboard() {
  popInputHandler('legacy-capture');
}

// Keep old export name for backward compat
export const initGlobalKeyboard = initHeroKeyboard;
