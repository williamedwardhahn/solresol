import { buildSentence, TENSE_MARKERS, MODIFIERS, STRESS_RULES, getSemanticCategory } from '../utils/grammar.js';
import { searchDictionary, parseWord, translate } from '../utils/solresol.js';
import { SolresolWord } from '../models/word.js';
import { createWordRenderer } from '../components/word-renderer.js';
import { createSheetMusic } from '../components/sheet-music.js';
import { playSentence, playWord } from '../audio/synth.js';

/**
 * Sentence Composer — executable grammar.
 * Slot-based interface that lets you construct Solresol sentences using buildSentence().
 */

const SLOTS = [
  { key: 'subject',    label: 'Subject',      hint: 'Who?' },
  { key: 'directObj',  label: 'Direct Object', hint: 'What?' },
  { key: 'adjective',  label: 'Adjective',     hint: 'Describes' },
  { key: 'verb',       label: 'Verb',          hint: 'Action' },
  { key: 'adverb',     label: 'Adverb',        hint: 'How?' },
  { key: 'indirectObj', label: 'Indirect Object', hint: 'To whom?' },
];

export function renderComposer(container) {
  container.innerHTML = `
    <section class="view composer-view">
      <h2>Compose</h2>
      <p class="view-desc">Build Solresol sentences by filling grammatical slots. The grammar engine orders words correctly.</p>

      <div class="composer-slots" id="composer-slots"></div>

      <div class="composer-modifiers">
        <label class="composer-mod-label">Tense:
          <select id="composer-tense" class="select">
            <option value="">None (Present)</option>
            ${Object.entries(TENSE_MARKERS).map(([k, v]) =>
              `<option value="${k}">${v.label} (${v.solresol})</option>`
            ).join('')}
          </select>
        </label>
        <label class="composer-mod-label">Modifier:
          <select id="composer-modifier" class="select">
            <option value="">None</option>
            ${Object.entries(MODIFIERS).map(([k, v]) =>
              `<option value="${k}">${v.label} (${v.solresol})</option>`
            ).join('')}
          </select>
        </label>
        <label class="composer-mod-label">
          <input type="checkbox" id="composer-negate"> Negate (prefix Do)
        </label>
        <label class="composer-mod-label">
          <input type="checkbox" id="composer-question"> Question (append Sol)
        </label>
      </div>

      <div class="composer-output" id="composer-output">
        <div class="composer-output-empty">Fill in slots above to compose a sentence</div>
      </div>

      <div class="composer-actions">
        <button class="btn" id="composer-play" disabled>&#9654; Play Sentence</button>
        <button class="btn btn--sm" id="composer-clear">Clear All</button>
      </div>
    </section>
  `;

  const slotsEl = container.querySelector('#composer-slots');
  const outputEl = container.querySelector('#composer-output');
  const tenseSelect = container.querySelector('#composer-tense');
  const modifierSelect = container.querySelector('#composer-modifier');
  const negateCheck = container.querySelector('#composer-negate');
  const questionCheck = container.querySelector('#composer-question');
  const playBtn = container.querySelector('#composer-play');
  const clearBtn = container.querySelector('#composer-clear');

  // State: selected word for each slot
  const slotValues = {};
  const slotEls = {};
  const renderers = [];

  // Build slot UI
  for (const slot of SLOTS) {
    const slotEl = document.createElement('div');
    slotEl.className = 'composer-slot';

    const labelEl = document.createElement('div');
    labelEl.className = 'composer-slot-label';
    labelEl.textContent = slot.label;

    const hintEl = document.createElement('div');
    hintEl.className = 'composer-slot-hint';
    hintEl.textContent = slot.hint;

    const searchEl = document.createElement('input');
    searchEl.type = 'text';
    searchEl.className = 'input composer-slot-input';
    searchEl.placeholder = `Search for ${slot.label.toLowerCase()}...`;
    searchEl.autocomplete = 'off';

    const resultsEl = document.createElement('div');
    resultsEl.className = 'composer-slot-results';

    const selectedEl = document.createElement('div');
    selectedEl.className = 'composer-slot-selected';

    slotEl.append(labelEl, hintEl, searchEl, resultsEl, selectedEl);
    slotsEl.appendChild(slotEl);

    slotEls[slot.key] = { searchEl, resultsEl, selectedEl, slotEl };

    // Search within slot
    let debounce;
    searchEl.addEventListener('input', () => {
      clearTimeout(debounce);
      debounce = setTimeout(() => {
        searchForSlot(slot.key, searchEl.value.trim());
      }, 200);
    });

    searchEl.addEventListener('focus', () => {
      if (searchEl.value.trim()) {
        searchForSlot(slot.key, searchEl.value.trim());
      }
    });
  }

  function searchForSlot(slotKey, query) {
    const { resultsEl } = slotEls[slotKey];
    resultsEl.innerHTML = '';
    if (!query) return;

    const matches = searchDictionary(query).slice(0, 8);
    for (const entry of matches) {
      const item = document.createElement('button');
      item.className = 'btn btn--sm composer-result-item';
      item.textContent = `${entry.solresol} — ${entry.definition || '?'}`;
      item.addEventListener('click', () => selectWord(slotKey, entry.solresol));
      resultsEl.appendChild(item);
    }
  }

  function selectWord(slotKey, solresolWord) {
    slotValues[slotKey] = solresolWord;
    const { selectedEl, resultsEl, searchEl, slotEl } = slotEls[slotKey];
    resultsEl.innerHTML = '';
    searchEl.value = '';
    slotEl.classList.add('composer-slot--filled');

    selectedEl.innerHTML = '';
    const word = new SolresolWord(solresolWord);
    const wr = createWordRenderer(word, {
      size: 'sm',
      showSheet: false,
      showDefinition: true,
      reactive: false,
      notations: new Set(['colors']),
    });
    renderers.push(wr);

    const removeBtn = document.createElement('button');
    removeBtn.className = 'btn btn--sm';
    removeBtn.textContent = '✕';
    removeBtn.addEventListener('click', () => {
      delete slotValues[slotKey];
      selectedEl.innerHTML = '';
      slotEl.classList.remove('composer-slot--filled');
      updateOutput();
    });

    selectedEl.append(wr.el, removeBtn);
    updateOutput();
  }

  function updateOutput() {
    outputEl.innerHTML = '';

    const parts = {
      ...slotValues,
      tense: tenseSelect.value || undefined,
      modifier: modifierSelect.value || undefined,
      negate: negateCheck.checked,
      question: questionCheck.checked,
    };

    const sentenceWords = buildSentence(parts);
    if (sentenceWords.length === 0) {
      outputEl.innerHTML = '<div class="composer-output-empty">Fill in slots above to compose a sentence</div>';
      playBtn.disabled = true;
      return;
    }

    playBtn.disabled = false;

    // Render each word in the sentence
    const sentenceRow = document.createElement('div');
    sentenceRow.className = 'composer-sentence';

    const allSyllables = [];

    for (const wordStr of sentenceWords) {
      const syls = parseWord(wordStr);
      allSyllables.push(syls);

      const wordCard = document.createElement('div');
      wordCard.className = 'composer-word-card';

      const word = new SolresolWord(wordStr);
      const wr = createWordRenderer(word, {
        size: 'sm',
        showSheet: false,
        showDefinition: true,
        reactive: false,
        notations: new Set(['colors']),
      });
      renderers.push(wr);
      wordCard.appendChild(wr.el);

      // Show grammatical role
      const roleEl = document.createElement('div');
      roleEl.className = 'composer-word-role';
      // Find which slot this came from
      for (const slot of SLOTS) {
        if (slotValues[slot.key] === wordStr) {
          roleEl.textContent = slot.label;
          break;
        }
      }
      // Check if it's a tense marker
      for (const [, marker] of Object.entries(TENSE_MARKERS)) {
        if (marker.solresol === wordStr) {
          roleEl.textContent = marker.label;
          roleEl.classList.add('composer-word-role--marker');
          break;
        }
      }
      if (wordStr === 'Do' && parts.negate) {
        roleEl.textContent = 'Negation';
        roleEl.classList.add('composer-word-role--marker');
      }
      if (wordStr === 'Sol' && parts.question) {
        roleEl.textContent = 'Question';
        roleEl.classList.add('composer-word-role--marker');
      }
      wordCard.appendChild(roleEl);

      sentenceRow.appendChild(wordCard);
    }
    outputEl.appendChild(sentenceRow);

    // Sheet music for the full sentence
    const flatSyls = allSyllables.flat();
    if (flatSyls.length > 0) {
      const sheetWrap = document.createElement('div');
      sheetWrap.className = 'composer-sheet';
      sheetWrap.appendChild(createSheetMusic(flatSyls));
      outputEl.appendChild(sheetWrap);
    }

    // Sentence as text
    const textEl = document.createElement('div');
    textEl.className = 'composer-text';
    const solText = sentenceWords.join(' ');
    const engText = sentenceWords.map(w => translate(w) || w).join(' ');
    textEl.innerHTML = `<strong>${solText}</strong><br><span style="color:var(--text-dim)">${engText}</span>`;
    outputEl.appendChild(textEl);

    // Wire play button
    playBtn.onclick = () => playSentence(allSyllables);
  }

  // Listen for modifier changes
  tenseSelect.addEventListener('change', updateOutput);
  modifierSelect.addEventListener('change', updateOutput);
  negateCheck.addEventListener('change', updateOutput);
  questionCheck.addEventListener('change', updateOutput);

  clearBtn.addEventListener('click', () => {
    for (const key of Object.keys(slotValues)) {
      delete slotValues[key];
      const { selectedEl, slotEl } = slotEls[key];
      selectedEl.innerHTML = '';
      slotEl.classList.remove('composer-slot--filled');
    }
    tenseSelect.value = '';
    modifierSelect.value = '';
    negateCheck.checked = false;
    questionCheck.checked = false;
    updateOutput();
  });
}
