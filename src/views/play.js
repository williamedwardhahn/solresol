import { SolresolWord } from '../models/word.js';
import { createWordRenderer } from '../components/word-renderer.js';
import { createWordBlocks } from '../components/color-block.js';
import { createSheetMusic } from '../components/sheet-music.js';
import { playSentence } from '../audio/synth.js';
import { focusWord, committedWords, commitFocusWord, clearSentence, undoLastWord } from '../state/focus-word.js';
import { buildSentence, TENSE_MARKERS } from '../utils/grammar.js';
import { searchDictionary, parseWord, translate } from '../utils/solresol.js';
import { on } from '../utils/events.js';
import { createSequencer } from '../components/sequencer.js';

/**
 * Play view — the home page.
 * Shows committed words as a sentence. Keyboard input comes from the global bar.
 * Includes a Compose mode for structured sentence building.
 */
export function renderPlay(container) {
  container.innerHTML = `
    <section class="view play-view">
      <div class="play-hero">
        <h2>Play Solresol</h2>
        <p class="view-desc">Use the keyboard above to play notes and build words. Press Enter to commit a word.</p>
      </div>

      <div class="play-modes">
        <button class="btn btn--active" data-mode="free">Free Play</button>
        <button class="btn" data-mode="compose">Compose Sentence</button>
        <button class="btn" data-mode="sequencer">Sequencer</button>
      </div>

      <div id="play-free" class="play-section">
        <div id="play-sentence" class="play-sentence"></div>
        <div id="play-actions" class="play-actions"></div>
      </div>

      <div id="play-sequencer" class="play-section" style="display:none"></div>

      <div id="play-compose" class="play-section" style="display:none">
        <div class="composer-slots" id="composer-slots"></div>
        <div class="composer-modifiers">
          <label class="composer-mod-label">Tense:
            <select id="composer-tense" class="select">
              <option value="">Present</option>
              ${Object.entries(TENSE_MARKERS).map(([k, v]) =>
                `<option value="${k}">${v.label}</option>`
              ).join('')}
            </select>
          </label>
          <label class="composer-mod-label">
            <input type="checkbox" id="composer-negate"> Negate
          </label>
          <label class="composer-mod-label">
            <input type="checkbox" id="composer-question"> Question
          </label>
        </div>
        <div class="composer-output" id="composer-output">
          <div class="composer-output-empty">Fill in slots to compose</div>
        </div>
        <div class="composer-actions">
          <button class="btn" id="composer-play" disabled>&#9654; Play</button>
          <button class="btn btn--sm" id="composer-clear">Clear</button>
        </div>
      </div>
    </section>
  `;

  const sentenceEl = container.querySelector('#play-sentence');
  const actionsEl = container.querySelector('#play-actions');
  const freeSection = container.querySelector('#play-free');
  const composeSection = container.querySelector('#play-compose');
  const seqSection = container.querySelector('#play-sequencer');
  const modeBtns = container.querySelectorAll('[data-mode]');
  let mode = 'free';
  let sequencer = null;

  // Mode toggle
  modeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      mode = btn.dataset.mode;
      modeBtns.forEach(b => b.classList.remove('btn--active'));
      btn.classList.add('btn--active');
      freeSection.style.display = mode === 'free' ? '' : 'none';
      composeSection.style.display = mode === 'compose' ? '' : 'none';
      seqSection.style.display = mode === 'sequencer' ? '' : 'none';
      if (mode === 'sequencer' && !sequencer) {
        sequencer = createSequencer(seqSection);
      }
    });
  });

  // === FREE PLAY MODE ===
  function renderSentence() {
    sentenceEl.innerHTML = '';
    actionsEl.innerHTML = '';

    if (committedWords.length === 0) {
      sentenceEl.innerHTML = `<div class="play-empty">
        <p>Use the keyboard above to play notes and build words.</p>
        <p class="play-empty-keys"><kbd>1</kbd>–<kbd>7</kbd> play notes &nbsp; <kbd>Enter</kbd> commits &nbsp; <kbd>Backspace</kbd> undoes</p>
        <p style="margin-top:0.5rem;font-size:0.8rem">Try pressing <kbd>1</kbd> <kbd>3</kbd> <kbd>5</kbd> then <kbd>Enter</kbd></p>
      </div>`;
      return;
    }

    const wordCards = document.createElement('div');
    wordCards.className = 'play-word-cards';

    for (const w of committedWords) {
      const card = document.createElement('div');
      card.className = 'play-word-card';
      const wr = createWordRenderer(w, {
        size: 'sm', showSheet: false, showDefinition: true, reactive: false,
        notations: new Set(['colors']),
      });
      card.appendChild(wr.el);
      wordCards.appendChild(card);
    }
    sentenceEl.appendChild(wordCards);

    // Sheet music
    const allSyls = committedWords.flatMap(w => w.syllables);
    if (allSyls.length > 0) {
      const sheet = document.createElement('div');
      sheet.className = 'play-sheet';
      sheet.appendChild(createSheetMusic(allSyls));
      sentenceEl.appendChild(sheet);
    }

    // Translation line
    const transEl = document.createElement('div');
    transEl.className = 'play-translation';
    transEl.textContent = committedWords.map(w => w.definition || w.text).join(' ');
    sentenceEl.appendChild(transEl);

    // Actions
    const playAllBtn = document.createElement('button');
    playAllBtn.className = 'btn';
    playAllBtn.innerHTML = '&#9654; Play All';
    playAllBtn.addEventListener('click', () => {
      playSentence(committedWords.map(w => w.syllables));
    });

    const undoBtn = document.createElement('button');
    undoBtn.className = 'btn btn--sm';
    undoBtn.textContent = 'Undo Last';
    undoBtn.addEventListener('click', () => {
      undoLastWord();
      renderSentence();
    });

    const clearBtn = document.createElement('button');
    clearBtn.className = 'btn btn--sm';
    clearBtn.textContent = 'Clear All';
    clearBtn.addEventListener('click', () => {
      clearSentence();
      renderSentence();
    });

    actionsEl.append(playAllBtn, undoBtn, clearBtn);
  }

  // Listen for committed words from global keyboard
  const unsubCommit = on('word:commit', ({ word }) => {
    renderSentence();
    // Flash animation on commit
    sentenceEl.classList.add('play-sentence--flash');
    setTimeout(() => sentenceEl.classList.remove('play-sentence--flash'), 400);
    // Auto-add to sequencer if recording
    if (sequencer && sequencer.isRecording() && word) {
      sequencer.addWord(word.syllables);
    }
  });
  const unsubClear = on('sentence:clear', () => renderSentence());
  const unsubUndo = on('word:undo', () => renderSentence());
  renderSentence();

  // === COMPOSE MODE ===
  const SLOTS = [
    { key: 'subject', label: 'Subject' },
    { key: 'directObj', label: 'Object' },
    { key: 'adjective', label: 'Adjective' },
    { key: 'verb', label: 'Verb' },
    { key: 'adverb', label: 'Adverb' },
    { key: 'indirectObj', label: 'Indirect Obj.' },
  ];

  const slotsEl = container.querySelector('#composer-slots');
  const outputEl = container.querySelector('#composer-output');
  const tenseSelect = container.querySelector('#composer-tense');
  const negateCheck = container.querySelector('#composer-negate');
  const questionCheck = container.querySelector('#composer-question');
  const compPlayBtn = container.querySelector('#composer-play');
  const compClearBtn = container.querySelector('#composer-clear');
  const slotValues = {};
  const slotEls = {};

  for (const slot of SLOTS) {
    const el = document.createElement('div');
    el.className = 'composer-slot';
    el.innerHTML = `
      <div class="composer-slot-label">${slot.label}</div>
      <input type="text" class="input composer-slot-input" placeholder="Search..." autocomplete="off">
      <div class="composer-slot-results"></div>
      <div class="composer-slot-selected"></div>
    `;
    slotsEl.appendChild(el);

    const searchEl = el.querySelector('.composer-slot-input');
    const resultsEl = el.querySelector('.composer-slot-results');
    const selectedEl = el.querySelector('.composer-slot-selected');
    slotEls[slot.key] = { searchEl, resultsEl, selectedEl, el };

    let debounce;
    searchEl.addEventListener('input', () => {
      clearTimeout(debounce);
      debounce = setTimeout(() => {
        resultsEl.innerHTML = '';
        const q = searchEl.value.trim();
        if (!q) return;
        for (const entry of searchDictionary(q).slice(0, 6)) {
          const item = document.createElement('button');
          item.className = 'btn btn--sm composer-result-item';
          item.textContent = `${entry.solresol} — ${entry.definition || '?'}`;
          item.addEventListener('click', () => {
            slotValues[slot.key] = entry.solresol;
            resultsEl.innerHTML = '';
            searchEl.value = '';
            selectedEl.innerHTML = '';
            el.classList.add('composer-slot--filled');
            const w = new SolresolWord(entry.solresol);
            const wr = createWordRenderer(w, {
              size: 'sm', showSheet: false, showDefinition: true, reactive: false,
              notations: new Set(['colors']),
            });
            const removeBtn = document.createElement('button');
            removeBtn.className = 'btn btn--sm';
            removeBtn.textContent = '✕';
            removeBtn.addEventListener('click', () => {
              delete slotValues[slot.key];
              selectedEl.innerHTML = '';
              el.classList.remove('composer-slot--filled');
              updateComposerOutput();
            });
            selectedEl.append(wr.el, removeBtn);
            updateComposerOutput();
          });
          resultsEl.appendChild(item);
        }
      }, 200);
    });
  }

  function updateComposerOutput() {
    outputEl.innerHTML = '';
    const parts = {
      ...slotValues,
      tense: tenseSelect.value || undefined,
      negate: negateCheck.checked,
      question: questionCheck.checked,
    };
    const words = buildSentence(parts);
    if (words.length === 0) {
      outputEl.innerHTML = '<div class="composer-output-empty">Fill in slots to compose</div>';
      compPlayBtn.disabled = true;
      return;
    }
    compPlayBtn.disabled = false;

    const row = document.createElement('div');
    row.className = 'composer-sentence';
    const allSyls = [];
    for (const ws of words) {
      const syls = parseWord(ws);
      allSyls.push(syls);
      const card = document.createElement('div');
      card.className = 'composer-word-card';
      const w = new SolresolWord(ws);
      const wr = createWordRenderer(w, {
        size: 'sm', showSheet: false, showDefinition: true, reactive: false,
        notations: new Set(['colors']),
      });
      card.appendChild(wr.el);

      // Role label
      const roleEl = document.createElement('div');
      roleEl.className = 'composer-word-role';
      for (const slot of SLOTS) {
        if (slotValues[slot.key] === ws) { roleEl.textContent = slot.label; break; }
      }
      for (const [, marker] of Object.entries(TENSE_MARKERS)) {
        if (marker.solresol === ws) {
          roleEl.textContent = marker.label;
          roleEl.classList.add('composer-word-role--marker');
          break;
        }
      }
      if (ws === 'Do' && parts.negate) {
        roleEl.textContent = 'Negation';
        roleEl.classList.add('composer-word-role--marker');
      }
      if (ws === 'Sol' && parts.question) {
        roleEl.textContent = 'Question';
        roleEl.classList.add('composer-word-role--marker');
      }
      card.appendChild(roleEl);

      row.appendChild(card);
    }
    outputEl.appendChild(row);

    // Translation text
    const textEl = document.createElement('div');
    textEl.className = 'composer-text';
    const solText = words.join(' ');
    const engText = words.map(w => translate(w) || w).join(' ');
    textEl.innerHTML = `<strong>${solText}</strong><br><span style="color:var(--text-dim)">${engText}</span>`;
    outputEl.appendChild(textEl);

    const flat = allSyls.flat();
    if (flat.length > 0) {
      const sheet = document.createElement('div');
      sheet.className = 'composer-sheet';
      sheet.appendChild(createSheetMusic(flat));
      outputEl.appendChild(sheet);
    }

    compPlayBtn.onclick = () => playSentence(allSyls);
  }

  tenseSelect.addEventListener('change', updateComposerOutput);
  negateCheck.addEventListener('change', updateComposerOutput);
  questionCheck.addEventListener('change', updateComposerOutput);
  compClearBtn.addEventListener('click', () => {
    for (const key of Object.keys(slotValues)) {
      delete slotValues[key];
      slotEls[key].selectedEl.innerHTML = '';
      slotEls[key].el.classList.remove('composer-slot--filled');
    }
    tenseSelect.value = '';
    negateCheck.checked = false;
    questionCheck.checked = false;
    updateComposerOutput();
  });

  return () => {
    unsubCommit();
    unsubClear();
    unsubUndo();
    if (sequencer) sequencer.destroy();
  };
}
