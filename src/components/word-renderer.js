import { SolresolWord } from '../models/word.js';
import { getColor } from '../utils/solresol.js';
import { getSyllableNotations, NOTATION_SYSTEMS } from '../utils/notation.js';
import { playNote, playWord } from '../audio/synth.js';
import { emit } from '../utils/events.js';
import { setFocusWord } from '../state/focus-word.js';

/**
 * Unified word display component.
 * Renders a SolresolWord as aligned columns of all active representations,
 * with cross-highlighting and click-to-play on every syllable.
 */

const DEFAULT_NOTATIONS = new Set(['colors', 'solfege', 'numbers']);

/**
 * Create a unified, reactive word renderer.
 * @param {SolresolWord} word
 * @param {object} opts
 * @param {Set<string>} opts.notations - which notation systems to show
 * @param {string} opts.size - 'sm' | 'md' | 'lg' (color block size)
 * @param {boolean} opts.playable - enable click-to-play (default true)
 * @param {boolean} opts.showSheet - show sheet music row (default true)
 * @param {boolean} opts.showDefinition - show definition (default false)
 * @param {boolean} opts.showReverse - show reverse button (default false)
 * @param {boolean} opts.reactive - subscribe to word changes (default true)
 * @param {function} opts.onReverse - callback when reverse button clicked
 * @returns {{ el: HTMLElement, destroy: function }}
 */
export function createWordRenderer(word, opts = {}) {
  const {
    notations = DEFAULT_NOTATIONS,
    size = 'md',
    playable = true,
    showSheet = true,
    showDefinition = false,
    showReverse = false,
    reactive = true,
    clickToFocus = true,
    onReverse,
  } = opts;

  const el = document.createElement('div');
  el.className = 'word-renderer';

  // Click anywhere on the renderer to focus this word in the context panel
  if (clickToFocus) {
    el.classList.add('word-renderer--focusable');
    el.addEventListener('click', (e) => {
      // Don't trigger if clicking a button (play, reverse, etc.)
      if (e.target.closest('button')) return;
      if (!word.isEmpty) {
        setFocusWord(word.syllables);
      }
    });
  }

  let unsub = null;

  function render() {
    el.innerHTML = '';

    if (word.isEmpty) {
      el.classList.add('word-renderer--empty');
      return;
    }
    el.classList.remove('word-renderer--empty');

    // Definition
    if (showDefinition) {
      const defRow = document.createElement('div');
      defRow.className = 'wr-definition';
      if (word.exists) {
        defRow.textContent = word.definition;
      } else {
        defRow.textContent = word.text;
        defRow.classList.add('wr-definition--unknown');
      }
      el.appendChild(defRow);
    }

    // Syllable columns container
    const grid = document.createElement('div');
    grid.className = `wr-grid wr-grid--${size}`;
    grid.setAttribute('role', 'img');
    grid.setAttribute('aria-label', `Solresol word: ${word.text}`);

    // Build column-aligned rows
    const rows = [];

    // Color blocks row (always shown)
    const colorRow = document.createElement('div');
    colorRow.className = 'wr-row wr-row--colors';
    rows.push(colorRow);

    // Check if we have notation rows (need label spacer for alignment)
    const hasNotationRows = [...notations].some(k => k !== 'colors');

    // Notation rows
    for (const sys of NOTATION_SYSTEMS) {
      if (sys.key === 'colors') continue; // handled by color blocks
      if (!notations.has(sys.key)) continue;
      const row = document.createElement('div');
      row.className = `wr-row wr-row--${sys.key}`;
      const label = document.createElement('span');
      label.className = 'wr-label';
      label.textContent = sys.label;
      row.appendChild(label);
      rows.push({ row, key: sys.key });
    }

    // Sheet music row
    let sheetRow = null;
    if (showSheet) {
      sheetRow = createMiniStaff(word.syllables);
    }

    // Add spacer to color row for alignment with label columns
    if (hasNotationRows) {
      const colorSpacer = document.createElement('span');
      colorSpacer.className = 'wr-label';
      colorRow.appendChild(colorSpacer);
    }

    // Populate syllable columns
    word.syllables.forEach((syl, i) => {
      const notData = getSyllableNotations(syl);
      const color = getColor(syl);

      // Color block
      const block = document.createElement('button');
      block.className = `wr-block wr-block--${size}`;
      block.style.backgroundColor = color;
      block.textContent = syl.charAt(0).toUpperCase() + syl.slice(1);
      block.dataset.sylIndex = i;
      block.setAttribute('aria-label', `Play ${syl}`);

      if (playable) {
        block.addEventListener('click', (e) => {
          e.stopPropagation();
          playNote(syl);
          emit('syllable:play', { syllable: syl, index: i, word });
        });
      }

      // Cross-highlight on hover
      block.addEventListener('mouseenter', () => highlightColumn(el, i, true));
      block.addEventListener('mouseleave', () => highlightColumn(el, i, false));

      colorRow.appendChild(block);

      // Notation values
      for (const item of rows) {
        if (!item.key) continue; // skip colorRow
        const cell = document.createElement('span');
        cell.className = 'wr-cell';
        cell.dataset.sylIndex = i;
        cell.style.color = color;

        if (item.key === 'solfege') cell.textContent = notData.solfege;
        else if (item.key === 'numbers') cell.textContent = notData.number;
        else if (item.key === 'binary') { cell.textContent = notData.binary; cell.classList.add('mono'); }
        else if (item.key === 'braille') { cell.textContent = notData.braille; cell.classList.add('wr-cell--large'); }
        else if (item.key === 'ascii') { cell.textContent = notData.ascii; cell.classList.add('mono'); }
        else if (item.key === 'sauso') { cell.textContent = notData.sauso; cell.classList.add('wr-cell--large'); }

        cell.addEventListener('mouseenter', () => highlightColumn(el, i, true));
        cell.addEventListener('mouseleave', () => highlightColumn(el, i, false));
        if (playable) {
          cell.style.cursor = 'pointer';
          cell.addEventListener('click', () => {
            playNote(syl);
            emit('syllable:play', { syllable: syl, index: i, word });
          });
        }

        item.row.appendChild(cell);
      }
    });

    grid.appendChild(colorRow);
    for (const item of rows) {
      if (item.row) grid.appendChild(item.row);
    }
    el.appendChild(grid);

    if (sheetRow) el.appendChild(sheetRow);

    // Action bar
    const actions = document.createElement('div');
    actions.className = 'wr-actions';

    if (playable && word.length > 0) {
      const playBtn = document.createElement('button');
      playBtn.className = 'btn btn--sm btn--icon wr-play';
      playBtn.innerHTML = '&#9654;';
      playBtn.setAttribute('aria-label', `Play ${word.text}`);
      playBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        playWord(word.syllables);
        emit('word:play', { word });
      });
      actions.appendChild(playBtn);
    }

    if (showReverse && word.length >= 2) {
      const revBtn = document.createElement('button');
      revBtn.className = 'btn btn--sm wr-reverse';
      revBtn.textContent = '⇄ Reverse';
      revBtn.setAttribute('aria-label', 'Reverse syllables');
      revBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (onReverse) {
          onReverse(word);
        } else {
          word.set([...word.syllables].reverse());
        }
        emit('word:reverse', { word });
      });
      actions.appendChild(revBtn);
    }

    if (actions.children.length > 0) {
      el.appendChild(actions);
    }
  }

  render();

  if (reactive) {
    unsub = word.onChange(() => render());
  }

  return {
    el,
    destroy() {
      if (unsub) unsub();
    },
    rerender: render,
  };
}

/** Highlight/unhighlight all elements in a syllable column */
function highlightColumn(container, index, on) {
  const els = container.querySelectorAll(`[data-syl-index="${index}"]`);
  for (const e of els) {
    e.classList.toggle('wr-highlight', on);
  }
}

/** Compact inline SVG mini-staff */
function createMiniStaff(syllables) {
  const NOTE_POS = { do: 6, re: 5, mi: 4, fa: 3, sol: 2, la: 1, si: 0 };
  const staffY = 20;
  const lineGap = 6;
  const noteSpacing = 28;
  const rx = 5, ry = 3.5;

  const width = Math.max(120, syllables.length * noteSpacing + 50);
  const height = 58;

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('class', 'wr-staff');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', `Sheet music: ${syllables.join(' ')}`);

  // Staff lines
  for (let i = 0; i < 5; i++) {
    const y = staffY + i * lineGap;
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', '10');
    line.setAttribute('x2', String(width - 10));
    line.setAttribute('y1', String(y));
    line.setAttribute('y2', String(y));
    line.setAttribute('stroke', '#555');
    line.setAttribute('stroke-width', '0.75');
    svg.appendChild(line);
  }

  // Treble clef
  const clef = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  clef.setAttribute('x', '12');
  clef.setAttribute('y', String(staffY + 20));
  clef.setAttribute('font-size', '26');
  clef.setAttribute('fill', '#555');
  clef.textContent = '\u{1D11E}';
  svg.appendChild(clef);

  // Notes
  syllables.forEach((syl, i) => {
    const s = syl.toLowerCase();
    const x = 42 + i * noteSpacing;
    const pos = NOTE_POS[s] ?? 3;
    const y = staffY + pos * (lineGap / 2);
    const color = getColor(s);

    // Ledger line for Do
    if (s === 'do') {
      const ledger = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      ledger.setAttribute('x1', String(x - 8));
      ledger.setAttribute('x2', String(x + 8));
      const ly = staffY + 5 * lineGap;
      ledger.setAttribute('y1', String(ly));
      ledger.setAttribute('y2', String(ly));
      ledger.setAttribute('stroke', '#333');
      ledger.setAttribute('stroke-width', '0.75');
      svg.appendChild(ledger);
    }

    // Note head
    const note = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
    note.setAttribute('cx', String(x));
    note.setAttribute('cy', String(y));
    note.setAttribute('rx', String(rx));
    note.setAttribute('ry', String(ry));
    note.setAttribute('fill', color);
    note.setAttribute('data-syl-index', String(i));
    svg.appendChild(note);

    // Stem
    const stem = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    stem.setAttribute('x1', String(x + rx));
    stem.setAttribute('x2', String(x + rx));
    stem.setAttribute('y1', String(y));
    stem.setAttribute('y2', String(y - 18));
    stem.setAttribute('stroke', '#777');
    stem.setAttribute('stroke-width', '1');
    svg.appendChild(stem);
  });

  return svg;
}
