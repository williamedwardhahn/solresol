import { NOTES, NOTE_COLORS } from '../utils/constants.js';
import { getAllEntries, parseWord, getColor, translate, walkTrie as sharedWalkTrie, collectEntries } from '../utils/solresol.js';
import { SEMANTIC_CATEGORIES } from '../utils/grammar.js';
import { inspectWord } from '../state/focus-word.js';
import { playWord } from '../audio/synth.js';
import { displaySyllable, displayWord } from '../utils/format.js';
import { getAntonym } from '../utils/antonyms.js';
import { setCustomDefinition, getCustomDefinition } from '../state/vocabulary.js';

/**
 * Trie-based word predictor.
 * As syllables are entered, shows the landscape of possible words
 * narrowing with each note played.
 */

/** Walk the trie (delegates to shared trie in solresol.js) */
function walkTrie(syllables) {
  return sharedWalkTrie(syllables);
}

/** Count total entries below a trie node */
function countBelow(node) {
  return node ? node.count : 0;
}

/** Collect a sample of entries below a node (up to limit) */
function sampleEntries(node, limit = 5) {
  const results = [];
  function walk(n) {
    if (results.length >= limit) return;
    for (const e of n.entries) {
      if (results.length >= limit) return;
      results.push(e);
    }
    for (const child of Object.values(n.children)) {
      if (results.length >= limit) return;
      walk(child);
    }
  }
  if (node) walk(node);
  return results;
}

/**
 * Create the word predictor component.
 * Shows the meaning landscape as syllables are typed.
 * @param {SolresolWord} word - the word being built
 * @returns {{ el: HTMLElement, update: function, destroy: function }}
 */
export function createWordPredictor(word) {
  const el = document.createElement('div');
  el.className = 'wp-container';

  /** Build the definition input row for dead-end propose-a-meaning */
  function buildDefInput(wordText, initialValue) {
    const row = document.createElement('div');
    row.className = 'wp-dead-input-row';

    const prompt = document.createElement('label');
    prompt.className = 'wp-dead-prompt';
    prompt.textContent = 'This word doesn\'t exist yet. What should it mean?';
    row.appendChild(prompt);

    const inputWrap = document.createElement('div');
    inputWrap.className = 'wp-dead-input-wrap';

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'wp-dead-input';
    input.placeholder = 'Enter a definition...';
    input.value = initialValue;

    const saveBtn = document.createElement('button');
    saveBtn.className = 'wp-dead-save-btn';
    saveBtn.textContent = 'Save';
    saveBtn.addEventListener('click', () => {
      const val = input.value.trim();
      if (val) {
        setCustomDefinition(wordText, val);
        render(); // re-render to show the saved state
      }
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') saveBtn.click();
    });

    inputWrap.appendChild(input);
    inputWrap.appendChild(saveBtn);
    row.appendChild(inputWrap);
    return row;
  }

  function render() {
    el.innerHTML = '';

    if (word.isEmpty) {
      el.innerHTML = '<span class="wp-hint">Play notes to explore words...</span>';
      return;
    }

    // Status line: category + syllable class
    const status = document.createElement('div');
    status.className = 'wp-status';
    status.setAttribute('aria-live', 'polite');

    const cat = word.category;
    if (cat) {
      const catSpan = document.createElement('span');
      catSpan.className = 'wp-cat';
      catSpan.style.color = cat.color;
      catSpan.textContent = cat.label;
      status.appendChild(catSpan);
    }

    if (word.syllableClass) {
      const classSpan = document.createElement('span');
      classSpan.className = 'wp-class';
      classSpan.textContent = word.syllableClass;
      status.appendChild(classSpan);
    }

    // Current word definition (if defined)
    if (word.isDefined) {
      const defSpan = document.createElement('span');
      defSpan.className = 'wp-def';
      defSpan.textContent = word.definition;
      status.appendChild(defSpan);
    } else if (word.length >= 2) {
      const undSpan = document.createElement('span');
      undSpan.className = 'wp-undef';
      undSpan.textContent = 'not in dictionary';
      status.appendChild(undSpan);
    }

    el.appendChild(status);

    // Prediction fan: what branches are available from here?
    const node = walkTrie(word.syllables);
    if (!node) {
      // No dictionary words continue from here — dead end creativity
      if (word.length < 5) {
        const deadEnd = document.createElement('div');
        deadEnd.className = 'wp-dead-end';

        // 1. Structural analysis — what kind of word this would be
        const firstSyl = word.syllables[0];
        const semCat = SEMANTIC_CATEGORIES[firstSyl];
        const structural = document.createElement('div');
        structural.className = 'wp-dead-analysis';
        const classLabel = word.syllableClass || '';
        const catLabel = semCat ? semCat.label : '';
        if (classLabel || catLabel) {
          structural.textContent = `This ${word.length}-syllable ${displaySyllable(firstSyl)}-family word would be in the ${classLabel || catLabel} class`;
          if (semCat) structural.style.color = semCat.color;
        }
        deadEnd.appendChild(structural);

        deadEnd.appendChild(Object.assign(document.createElement('div'), {
          className: 'wp-dead-notice',
          textContent: 'This word doesn\'t exist in the dictionary yet'
        }));

        // 2. Antonym analysis — check if reversed syllables form a defined word
        const reversed = [...word.syllables].reverse();
        const reversedStr = displayWord(reversed);
        const reverseDef = translate(reversedStr);
        const antonymEl = document.createElement('div');
        antonymEl.className = 'wp-dead-reverse';
        if (reverseDef) {
          antonymEl.textContent = `Its antonym ${reversedStr} means "${reverseDef}"`;
        } else {
          antonymEl.textContent = `Neither this word nor its antonym ${reversedStr} is defined`;
        }
        deadEnd.appendChild(antonymEl);

        // 3. User-proposed definition
        const wordText = word.text;
        const existingDef = getCustomDefinition(wordText);
        const proposeEl = document.createElement('div');
        proposeEl.className = 'wp-dead-propose';

        if (existingDef) {
          // Show existing custom definition with edit option
          const defDisplay = document.createElement('div');
          defDisplay.className = 'wp-dead-custom-def';

          const defLabel = document.createElement('span');
          defLabel.className = 'wp-dead-custom-label';
          defLabel.textContent = `Your definition: "${existingDef}"`;
          defDisplay.appendChild(defLabel);

          const editBtn = document.createElement('button');
          editBtn.className = 'wp-dead-edit-btn';
          editBtn.textContent = 'Edit';
          editBtn.addEventListener('click', () => {
            proposeEl.innerHTML = '';
            proposeEl.appendChild(buildDefInput(wordText, existingDef));
          });
          defDisplay.appendChild(editBtn);

          proposeEl.appendChild(defDisplay);
        } else {
          proposeEl.appendChild(buildDefInput(wordText, ''));
        }

        deadEnd.appendChild(proposeEl);
        el.appendChild(deadEnd);
      }
      return;
    }

    // If we're at a word, show exact matches prominently
    if (node.entries.length > 0 && word.length >= 2) {
      const matches = document.createElement('div');
      matches.className = 'wp-matches';
      for (const entry of node.entries) {
        const m = document.createElement('button');
        m.className = 'wp-match';
        m.textContent = entry.definition || entry.solresol;
        m.addEventListener('click', () => inspectWord(entry.solresol));
        matches.appendChild(m);
      }
      el.appendChild(matches);
    }

    // Show branches (next possible syllables) as visual grid
    const branches = Object.entries(node.children)
      .filter(([, child]) => child.count > 0)
      .sort((a, b) => b[1].count - a[1].count);

    if (branches.length === 0) return;

    const fan = document.createElement('div');
    fan.className = 'wp-fan';

    for (const [syl, child] of branches) {
      const branch = document.createElement('button');
      branch.className = 'wp-branch';

      const color = getColor(syl);

      // Color pip
      const pip = document.createElement('span');
      pip.className = 'wp-pip';
      pip.style.backgroundColor = color;

      // Syllable name
      const name = document.createElement('span');
      name.className = 'wp-branch-name';
      name.textContent = displaySyllable(syl);
      name.style.color = color;

      // Count badge
      const count = document.createElement('span');
      count.className = 'wp-branch-count';
      count.textContent = child.count;

      // Header row: pip + name + count
      const header = document.createElement('div');
      header.className = 'wp-branch-header';
      header.appendChild(pip);
      header.appendChild(name);
      header.appendChild(count);
      branch.appendChild(header);

      // Preview: first few words in this branch
      const samples = sampleEntries(child, 3);
      if (samples.length > 0) {
        const preview = document.createElement('span');
        preview.className = 'wp-branch-preview';
        preview.textContent = samples.map(e => e.definition || e.solresol).join(', ');
        branch.appendChild(preview);
      }

      // Click to add this syllable
      branch.addEventListener('click', () => {
        word.push(syl);
      });

      fan.appendChild(branch);
    }

    el.appendChild(fan);
  }

  render();
  const unsub = word.onChange(() => render());

  return {
    el,
    update: render,
    destroy() { unsub(); },
  };
}
