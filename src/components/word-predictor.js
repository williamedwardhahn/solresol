import { NOTES, NOTE_COLORS } from '../utils/constants.js';
import { getAllEntries, parseWord, getColor } from '../utils/solresol.js';
import { SEMANTIC_CATEGORIES } from '../utils/grammar.js';
import { setFocusWord } from '../state/focus-word.js';
import { playWord } from '../audio/synth.js';

/**
 * Trie-based word predictor.
 * As syllables are entered, shows the landscape of possible words
 * narrowing with each note played.
 */

let trie = null;

/** Build a trie from the dictionary (once, lazily) */
function buildTrie() {
  if (trie) return trie;
  trie = { children: {}, entries: [], count: 0 };

  for (const entry of getAllEntries()) {
    const syls = parseWord(entry.solresol);
    if (syls.length === 0) continue;

    let node = trie;
    for (const syl of syls) {
      if (!node.children[syl]) {
        node.children[syl] = { children: {}, entries: [], count: 0 };
      }
      node = node.children[syl];
      node.count++;
    }
    node.entries.push(entry);
  }
  return trie;
}

/** Walk the trie to the node matching the given syllable prefix */
function walkTrie(syllables) {
  const root = buildTrie();
  let node = root;
  for (const syl of syllables) {
    if (!node.children[syl]) return null;
    node = node.children[syl];
  }
  return node;
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

  function render() {
    el.innerHTML = '';

    if (word.isEmpty) {
      el.innerHTML = '<span class="wp-hint">Play notes to explore words...</span>';
      return;
    }

    // Status line: category + syllable class
    const status = document.createElement('div');
    status.className = 'wp-status';

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
      // No dictionary words continue from here
      if (word.length < 5) {
        const deadEnd = document.createElement('div');
        deadEnd.className = 'wp-dead-end';
        deadEnd.textContent = 'No dictionary words continue from here';
        el.appendChild(deadEnd);
      }
      return;
    }

    // If we're at a word, show exact matches
    if (node.entries.length > 0 && word.length >= 2) {
      const matches = document.createElement('div');
      matches.className = 'wp-matches';
      for (const entry of node.entries) {
        const m = document.createElement('button');
        m.className = 'wp-match';
        m.textContent = entry.definition || entry.solresol;
        m.addEventListener('click', () => setFocusWord(entry.solresol));
        matches.appendChild(m);
      }
      el.appendChild(matches);
    }

    // Show branches (next possible syllables)
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
      branch.appendChild(pip);

      // Syllable name
      const name = document.createElement('span');
      name.className = 'wp-branch-name';
      name.textContent = syl.charAt(0).toUpperCase() + syl.slice(1);
      name.style.color = color;
      branch.appendChild(name);

      // Count
      const count = document.createElement('span');
      count.className = 'wp-branch-count';
      count.textContent = child.count;
      branch.appendChild(count);

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
