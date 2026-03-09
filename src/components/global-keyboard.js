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
let keyboardEl = null;
let buildEl = null;
const buildScope = managed();
let collapsed = false;
const keyEls = {};

const KEY_MAP = ['q', 'w', 'e', 'r', 't', 'y', 'u'];

/**
 * Initialize the global keyboard bar.
 * Persists across all navigation — never destroyed.
 */
export function initGlobalKeyboard(container) {
  container.innerHTML = `
    <div class="gk-inner">
      <div class="gk-keys" id="gk-keys"></div>
      <div class="gk-building" id="gk-building" aria-live="assertive">
        <span class="gk-hint">Play notes...</span>
      </div>
      <div class="gk-actions">
        <button class="btn btn--sm" id="gk-commit" title="Commit word (Enter)">Commit</button>
        <button class="btn btn--sm" id="gk-undo" title="Undo last note (Backspace)">⌫</button>
        <select id="gk-waveform" class="select gk-waveform" title="Waveform">
          <option value="sine">♪</option>
          <option value="triangle">△</option>
          <option value="sawtooth">⊿</option>
          <option value="square">□</option>
        </select>
        <span class="gk-midi-status" id="gk-midi-status" title="MIDI status"></span>
        <button class="btn btn--sm gk-help" id="gk-help" title="Keyboard shortcuts">?</button>
        <button class="btn btn--sm gk-toggle" id="gk-toggle" title="Toggle keyboard">▾</button>
      </div>
    </div>
  `;

  keyboardEl = container.querySelector('#gk-keys');
  buildEl = container.querySelector('#gk-building');
  const commitBtn = container.querySelector('#gk-commit');
  const undoBtn = container.querySelector('#gk-undo');
  const waveformSelect = container.querySelector('#gk-waveform');
  const toggleBtn = container.querySelector('#gk-toggle');

  // Build keys
  for (let i = 0; i < NOTES.length; i++) {
    const note = NOTES[i];
    const key = document.createElement('button');
    key.className = 'gk-key';
    key.style.backgroundColor = getColor(note);
    key.textContent = displaySyllable(note);
    key.dataset.shortcut = `${i + 1}`;
    key.setAttribute('aria-label', `Play ${note}`);
    key.addEventListener('pointerdown', () => {
      key.classList.add('gk-key--active');
      onNote(note);
    });
    key.addEventListener('pointerup', () => key.classList.remove('gk-key--active'));
    key.addEventListener('pointerleave', () => key.classList.remove('gk-key--active'));
    keyboardEl.appendChild(key);
    keyEls[note] = key;
  }

  // Controls
  commitBtn.addEventListener('click', () => commitBuildingWord());
  undoBtn.addEventListener('click', () => buildingWord.pop());
  waveformSelect.value = waveform;
  waveformSelect.addEventListener('change', () => {
    waveform = waveformSelect.value;
    try { localStorage.setItem('solresol:waveform', waveform); } catch {}
  });
  toggleBtn.addEventListener('click', () => {
    collapsed = !collapsed;
    container.classList.toggle('global-keyboard--collapsed', collapsed);
    toggleBtn.textContent = collapsed ? '▸' : '▾';
  });

  // Help overlay
  const helpBtn = container.querySelector('#gk-help');
  helpBtn.addEventListener('click', () => {
    const existing = document.querySelector('.gk-help-overlay');
    if (existing) { existing.remove(); return; }
    const overlay = document.createElement('div');
    overlay.className = 'gk-help-overlay';
    overlay.innerHTML = `
      <div class="gk-help-card">
        <h3>Keyboard Shortcuts</h3>
        <table>
          <tr><td><kbd>1</kbd>–<kbd>7</kbd></td><td>Play notes Do–Si</td></tr>
          <tr><td><kbd>Q W E R T Y U</kbd></td><td>Play notes (alternate)</td></tr>
          <tr><td><kbd>Enter</kbd></td><td>Commit word</td></tr>
          <tr><td><kbd>Backspace</kbd></td><td>Undo last note</td></tr>
          <tr><td><kbd>Escape</kbd></td><td>Clear / close panel</td></tr>
        </table>
        <button class="btn btn--sm" id="gk-help-close">Got it</button>
      </div>
    `;
    document.body.appendChild(overlay);
    overlay.querySelector('#gk-help-close').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  });

  // MIDI
  const midiStatusEl = container.querySelector('#gk-midi-status');
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
    midiStatusEl.classList.toggle('gk-midi--connected', connected);
  });

  // Global keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    // Don't capture when typing in inputs
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

  // React to focus word changes
  buildingWord.onChange(() => renderBuilding());

  // Listen for external focus requests (from clicking words elsewhere)
  on('word:focus', () => {
    // Expand keyboard if collapsed when a word is focused
    if (collapsed && !buildingWord.isEmpty) {
      collapsed = false;
      container.classList.remove('global-keyboard--collapsed');
      toggleBtn.textContent = '▾';
    }
  });

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
    el.classList.add('gk-key--active');
    setTimeout(() => el.classList.remove('gk-key--active'), 120);
  }
}

function renderBuilding() {
  buildEl.innerHTML = '';
  buildScope.destroyAll();

  if (buildingWord.isEmpty) {
    // Show predictor in empty state (hint text)
    const wordPredictor = buildScope.track(createWordPredictor(buildingWord));
    buildEl.appendChild(wordPredictor.el);
    return;
  }

  // Color blocks for current word
  const wordRenderer = buildScope.track(createWordRenderer(buildingWord, {
    size: 'sm',
    showSheet: false,
    showDefinition: false,
    showMirror: false,
    reactive: false,
    notations: new Set(['colors']),
    clickToFocus: false,
  }));
  buildEl.appendChild(wordRenderer.el);

  // Meaning landscape predictor
  const wordPredictor = buildScope.track(createWordPredictor(buildingWord));
  buildEl.appendChild(wordPredictor.el);
}

/** Push an input handler onto the priority stack. Higher priority = handles first. */
export function pushInputHandler(id, handler, priority = 0) {
  // Remove existing handler with same id
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
