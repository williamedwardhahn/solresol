import { SolresolWord } from '../models/word.js';
import { getColor, translate } from '../utils/solresol.js';
import { getSyllableNotations, NOTATION_SYSTEMS } from '../utils/notation.js';
import { getAntonym } from '../utils/antonyms.js';
import { playNote, playWord } from '../audio/synth.js';
import { emit } from '../utils/events.js';
import { inspectWord } from '../state/focus-word.js';
import { displaySyllable } from '../utils/format.js';

/**
 * Unified word display component.
 * Renders a SolresolWord as aligned columns of all active representations,
 * with cross-highlighting, click-to-play, antonym mirror, and stress visualization.
 *
 * Uses incremental DOM updates: appending/removing syllable columns individually
 * rather than full innerHTML rebuilds, preserving visual continuity.
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
 * @param {boolean} opts.showMirror - show antonym mirror ghost (default: true for 2+ syl)
 * @param {boolean} opts.showStress - show stress/POS controls (default false)
 * @param {boolean} opts.reactive - subscribe to word changes (default true)
 * @param {boolean} opts.clickToFocus - click to open context panel (default true)
 * @param {function} opts.onReverse - callback when reverse button clicked
 * @returns {{ el: HTMLElement, destroy: function, rerender: function }}
 */
export function createWordRenderer(word, opts = {}) {
  const {
    notations = DEFAULT_NOTATIONS,
    size = 'md',
    playable = true,
    showSheet = true,
    showDefinition = false,
    showReverse = false,
    showMirror = true,
    showStress = false,
    reactive = true,
    clickToFocus = true,
    onReverse,
  } = opts;

  const el = document.createElement('div');
  el.className = 'word-renderer';
  el.setAttribute('role', 'group');
  el.setAttribute('aria-label', `Solresol word: ${word.text}`);

  // Click anywhere on the renderer to focus this word in the context panel
  if (clickToFocus) {
    el.classList.add('word-renderer--focusable');
    el.addEventListener('click', (e) => {
      if (e.target.closest('button')) return;
      if (!word.isEmpty) {
        inspectWord(word.syllables);
      }
    });
  }

  let unsub = null;

  // Persistent references for incremental updates
  let prevSyllables = [];
  let defRow = null;
  let grid = null;
  let colorRow = null;
  let notationRowEntries = []; // { row, key }[]
  let sheetSvg = null;
  let posRow = null;
  let actionsRow = null;
  let mirrorEl = null;

  const hasNotationRows = [...notations].some(k => k !== 'colors');

  // ---- Helpers for building individual column elements ----

  function createBlock(syl, i, stressIdx) {
    const color = getColor(syl);
    const block = document.createElement('button');
    block.className = `wr-block wr-block--${size}`;
    if (stressIdx === i) block.classList.add('wr-block--stressed');
    block.style.backgroundColor = color;
    block.textContent = displaySyllable(syl);
    block.dataset.sylIndex = i;
    block.setAttribute('aria-label', `Play ${syl}`);

    if (playable) {
      block.addEventListener('click', (e) => {
        e.stopPropagation();
        playNote(syl);
        emit('syllable:play', { syllable: syl, index: i, word });
      });
    }

    block.addEventListener('mouseenter', () => highlightColumn(el, i, true));
    block.addEventListener('mouseleave', () => highlightColumn(el, i, false));

    return block;
  }

  function createNotationCell(syl, i, sysKey) {
    const notData = getSyllableNotations(syl);
    const color = getColor(syl);
    const cell = document.createElement('span');
    cell.className = 'wr-cell';
    cell.dataset.sylIndex = i;
    cell.style.color = color;

    if (sysKey === 'solfege') cell.textContent = notData.solfege;
    else if (sysKey === 'numbers') cell.textContent = notData.number;
    else if (sysKey === 'binary') { cell.textContent = notData.binary; cell.classList.add('mono'); }
    else if (sysKey === 'braille') { cell.textContent = notData.braille; cell.classList.add('wr-cell--large'); }
    else if (sysKey === 'ascii') { cell.textContent = notData.ascii; cell.classList.add('mono'); }
    else if (sysKey === 'sauso') { cell.textContent = notData.sauso; cell.classList.add('wr-cell--large'); }

    cell.addEventListener('mouseenter', () => highlightColumn(el, i, true));
    cell.addEventListener('mouseleave', () => highlightColumn(el, i, false));
    if (playable) {
      cell.style.cursor = 'pointer';
      cell.addEventListener('click', () => {
        playNote(syl);
        emit('syllable:play', { syllable: syl, index: i, word });
      });
    }

    return cell;
  }

  // ---- Section update helpers ----

  function updateDefinition() {
    if (!showDefinition) return;
    if (!defRow) {
      defRow = document.createElement('div');
      defRow.className = 'wr-definition wr-def-fade';
      el.insertBefore(defRow, el.firstChild);
    }
    defRow.classList.remove('wr-definition--unknown');
    if (word.isDefined) {
      defRow.textContent = word.definition;
    } else if (word.exists) {
      const cat = word.category;
      defRow.textContent = word.text + (cat ? ` (${cat.label.split('\u2014')[0].trim()} family)` : '');
      defRow.classList.add('wr-definition--unknown');
    } else {
      defRow.textContent = word.text;
      defRow.classList.add('wr-definition--unknown');
    }
  }

  function updateSheet() {
    if (!showSheet) return;
    const newSvg = createMiniStaff(word.syllables, word.stressIndex);
    if (sheetSvg && sheetSvg.parentNode) {
      sheetSvg.parentNode.replaceChild(newSvg, sheetSvg);
    } else {
      // Insert after grid
      const insertRef = grid ? grid.nextSibling : null;
      if (insertRef) {
        el.insertBefore(newSvg, insertRef);
      } else {
        el.appendChild(newSvg);
      }
    }
    sheetSvg = newSvg;
  }

  function updateStress() {
    const stressIdx = word.stressIndex;
    // Update color blocks
    if (colorRow) {
      const blocks = colorRow.querySelectorAll('.wr-block');
      blocks.forEach((block, i) => {
        block.classList.toggle('wr-block--stressed', stressIdx === i);
      });
    }
    // Update sheet music (stress ring changes note sizes)
    updateSheet();
    // Update POS badge
    updatePosBadge();
  }

  function updatePosBadge() {
    if (!showStress) return;
    if (word.length >= 2) {
      if (!posRow) {
        posRow = document.createElement('div');
        posRow.className = 'wr-pos-badge';
      }
      posRow.textContent = word.partOfSpeech;
      // Insert after sheet or grid
      const afterEl = sheetSvg || grid;
      if (posRow.parentNode !== el) {
        if (afterEl && afterEl.nextSibling) {
          el.insertBefore(posRow, afterEl.nextSibling);
        } else {
          el.appendChild(posRow);
        }
      }
    } else if (posRow && posRow.parentNode) {
      posRow.remove();
    }
  }

  function updateActions() {
    // Remove old actions
    if (actionsRow && actionsRow.parentNode) {
      actionsRow.remove();
    }
    actionsRow = document.createElement('div');
    actionsRow.className = 'wr-actions';

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
      actionsRow.appendChild(playBtn);
    }

    if (showReverse && word.length >= 2) {
      const revBtn = document.createElement('button');
      revBtn.className = 'btn btn--sm wr-reverse';
      revBtn.textContent = '\u21C4 Reverse';
      revBtn.setAttribute('aria-label', 'Reverse syllables');
      revBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        animateFlip(el, word, onReverse);
      });
      actionsRow.appendChild(revBtn);
    }

    if (actionsRow.children.length > 0) {
      // Insert before mirror if it exists
      if (mirrorEl && mirrorEl.parentNode) {
        el.insertBefore(actionsRow, mirrorEl);
      } else {
        el.appendChild(actionsRow);
      }
    }
  }

  function updateMirror() {
    // Remove old mirror
    if (mirrorEl && mirrorEl.parentNode) {
      mirrorEl.remove();
      mirrorEl = null;
    }
    if (showMirror && word.length >= 2) {
      const antonymText = getAntonym(word.text);
      if (antonymText) {
        mirrorEl = createMirror(word, antonymText);
        el.appendChild(mirrorEl);
      }
    }
  }

  /** Add a syllable column at position idx */
  function addColumn(idx) {
    const syl = word.syllables[idx];
    const stressIdx = word.stressIndex;

    // Add color block
    const block = createBlock(syl, idx, stressIdx);
    colorRow.appendChild(block);

    // Animate entrance
    block.classList.add('wr-col--entering');
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        block.classList.remove('wr-col--entering');
      });
    });

    // Add notation cells
    for (const entry of notationRowEntries) {
      const cell = createNotationCell(syl, idx, entry.key);
      entry.row.appendChild(cell);
      cell.classList.add('wr-col--entering');
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          cell.classList.remove('wr-col--entering');
        });
      });
    }

    // Update grid aria-label
    if (grid) {
      grid.setAttribute('aria-label', `Solresol word: ${word.text}`);
    }
  }

  /** Remove the last syllable column */
  function removeLastColumn() {
    // Remove last color block (skip the spacer if present)
    if (colorRow) {
      const blocks = colorRow.querySelectorAll('.wr-block');
      const lastBlock = blocks[blocks.length - 1];
      if (lastBlock) lastBlock.remove();
    }

    // Remove last notation cell from each row
    for (const entry of notationRowEntries) {
      const cells = entry.row.querySelectorAll('.wr-cell');
      const lastCell = cells[cells.length - 1];
      if (lastCell) lastCell.remove();
    }

    // Update grid aria-label
    if (grid) {
      grid.setAttribute('aria-label', `Solresol word: ${word.text}`);
    }
  }

  /** Full rebuild — used on first render and when syllables change non-incrementally */
  function fullRebuild() {
    el.innerHTML = '';
    defRow = null;
    grid = null;
    colorRow = null;
    notationRowEntries = [];
    sheetSvg = null;
    posRow = null;
    actionsRow = null;
    mirrorEl = null;

    el.classList.remove('word-renderer--empty');

    // Definition
    updateDefinition();

    // Syllable columns container
    grid = document.createElement('div');
    grid.className = `wr-grid wr-grid--${size}`;
    grid.setAttribute('role', 'img');
    grid.setAttribute('aria-label', `Solresol word: ${word.text}`);

    // Color blocks row (always shown)
    colorRow = document.createElement('div');
    colorRow.className = 'wr-row wr-row--colors';

    // Add spacer to color row for alignment with label columns
    if (hasNotationRows) {
      const colorSpacer = document.createElement('span');
      colorSpacer.className = 'wr-label';
      colorRow.appendChild(colorSpacer);
    }

    // Notation rows
    notationRowEntries = [];
    for (const sys of NOTATION_SYSTEMS) {
      if (sys.key === 'colors') continue;
      if (!notations.has(sys.key)) continue;
      const row = document.createElement('div');
      row.className = `wr-row wr-row--${sys.key}`;
      const label = document.createElement('span');
      label.className = 'wr-label';
      label.textContent = sys.label;
      row.appendChild(label);
      notationRowEntries.push({ row, key: sys.key });
    }

    // Populate syllable columns
    const stressIdx = word.stressIndex;
    word.syllables.forEach((syl, i) => {
      const block = createBlock(syl, i, stressIdx);
      colorRow.appendChild(block);

      for (const entry of notationRowEntries) {
        const cell = createNotationCell(syl, i, entry.key);
        entry.row.appendChild(cell);
      }
    });

    grid.appendChild(colorRow);
    for (const entry of notationRowEntries) {
      grid.appendChild(entry.row);
    }
    el.appendChild(grid);

    // Sheet music
    if (showSheet) {
      sheetSvg = createMiniStaff(word.syllables, word.stressIndex);
      el.appendChild(sheetSvg);
    }

    // POS badge
    updatePosBadge();

    // Actions
    updateActions();

    // Antonym mirror
    updateMirror();
  }

  function render() {
    const currSyllables = [...word.syllables];

    if (currSyllables.length === 0) {
      el.innerHTML = '';
      el.classList.add('word-renderer--empty');
      defRow = null;
      grid = null;
      colorRow = null;
      notationRowEntries = [];
      sheetSvg = null;
      posRow = null;
      actionsRow = null;
      mirrorEl = null;
      prevSyllables = [];
      return;
    }

    el.classList.remove('word-renderer--empty');

    // Determine the type of change
    const isAppend = grid !== null
      && currSyllables.length === prevSyllables.length + 1
      && currSyllables.slice(0, -1).every((s, i) => s === prevSyllables[i]);

    const isPop = grid !== null
      && currSyllables.length === prevSyllables.length - 1
      && currSyllables.every((s, i) => s === prevSyllables[i]);

    const isStressOnly = grid !== null
      && currSyllables.length === prevSyllables.length
      && currSyllables.every((s, i) => s === prevSyllables[i]);

    if (isAppend) {
      addColumn(currSyllables.length - 1);
      updateStress();
      updateDefinition();
      updateActions();
      updateMirror();
    } else if (isPop) {
      removeLastColumn();
      updateStress();
      updateDefinition();
      updateActions();
      updateMirror();
    } else if (isStressOnly) {
      updateStress();
    } else {
      // Full rebuild for swap, reverse, set, or first render
      fullRebuild();
    }

    prevSyllables = currSyllables;
    el.setAttribute('aria-label', `Solresol word: ${word.text}`);
  }

  render();

  // Swipe gestures
  if (playable) {
    let swipeStartX = 0;
    el.addEventListener('touchstart', (e) => {
      swipeStartX = e.touches[0].clientX;
    }, { passive: true });
    el.addEventListener('touchend', (e) => {
      const dx = e.changedTouches[0].clientX - swipeStartX;
      if (Math.abs(dx) < 60) return;
      if (dx < 0 && showReverse) {
        // Swipe left → reverse
        word.reverse();
      } else if (dx > 0) {
        // Swipe right → play
        playWord(word.syllables);
      }
    }, { passive: true });
  }

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

/** Create the ghost antonym mirror */
function createMirror(word, antonymText) {
  const mirror = document.createElement('div');
  mirror.className = 'wr-mirror';
  mirror.title = `Antonym: ${antonymText}`;

  const arrow = document.createElement('span');
  arrow.className = 'wr-mirror-arrow';
  arrow.textContent = '\u21C4';
  mirror.appendChild(arrow);

  // Reversed color pips
  const revSyls = [...word.syllables].reverse();
  for (const syl of revSyls) {
    const pip = document.createElement('span');
    pip.className = 'wr-mirror-pip';
    pip.style.backgroundColor = getColor(syl);
    mirror.appendChild(pip);
  }

  // Antonym definition
  const antDef = translate(antonymText);
  if (antDef) {
    const def = document.createElement('span');
    def.className = 'wr-mirror-def';
    def.textContent = antDef;
    mirror.appendChild(def);
  }

  // Click mirror to flip
  mirror.addEventListener('click', (e) => {
    e.stopPropagation();
    inspectWord(antonymText);
  });

  return mirror;
}

/** Animate the flip/reverse of syllable blocks */
function animateFlip(container, word, onReverse) {
  const colorRow = container.querySelector('.wr-row--colors');
  if (!colorRow) {
    doReverse(word, onReverse);
    return;
  }

  const blocks = [...colorRow.querySelectorAll('.wr-block')];
  if (blocks.length < 2) {
    doReverse(word, onReverse);
    return;
  }

  // Calculate positions for the swap animation
  const positions = blocks.map(b => b.getBoundingClientRect());

  colorRow.classList.add('wr-flipping');

  blocks.forEach((block, i) => {
    const targetIdx = blocks.length - 1 - i;
    const dx = positions[targetIdx].left - positions[i].left;
    block.style.transform = `translateX(${dx}px)`;
  });

  // Play reversed audio
  playWord([...word.syllables].reverse());

  // After animation, do the actual reverse
  setTimeout(() => {
    doReverse(word, onReverse);
    emit('word:reverse', { word });
  }, 420);
}

function doReverse(word, onReverse) {
  if (onReverse) {
    onReverse(word);
  } else {
    word.reverse();
  }
}

/** Highlight/unhighlight all elements in a syllable column */
function highlightColumn(container, index, on) {
  const els = container.querySelectorAll(`[data-syl-index="${index}"]`);
  for (const e of els) {
    e.classList.toggle('wr-highlight', on);
  }
}

/** Compact inline SVG mini-staff */
function createMiniStaff(syllables, stressIndex) {
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
    const isStressed = stressIndex === i;

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

    // Stress ring (drawn behind note)
    if (isStressed) {
      const ring = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
      ring.setAttribute('cx', String(x));
      ring.setAttribute('cy', String(y));
      ring.setAttribute('rx', String(rx + 3));
      ring.setAttribute('ry', String(ry + 2));
      ring.setAttribute('fill', 'none');
      ring.setAttribute('stroke', '#fff');
      ring.setAttribute('stroke-width', '1.5');
      ring.setAttribute('opacity', '0.6');
      svg.appendChild(ring);
    }

    // Note head
    const note = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
    note.setAttribute('cx', String(x));
    note.setAttribute('cy', String(y));
    note.setAttribute('rx', String(isStressed ? rx + 1 : rx));
    note.setAttribute('ry', String(isStressed ? ry + 0.5 : ry));
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
