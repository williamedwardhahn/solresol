import { NOTES, NOTE_COLORS } from '../utils/constants.js';
import { playNote } from '../audio/synth.js';
import { SolresolWord } from '../models/word.js';
import { createWordRenderer } from './word-renderer.js';
import { translate } from '../utils/solresol.js';
import { emit } from '../utils/events.js';
import { inspectWord, commitBuildingWord, buildingWord } from '../state/focus-word.js';

const MAX_CELLS = 5;

const STYLES = `
.ci-wrap { display:flex; flex-direction:column; align-items:center; gap:16px; padding:16px; }
.ci-palette { display:flex; gap:10px; justify-content:center; }
.ci-swatch { width:42px; height:42px; border-radius:50%; border:3px solid transparent;
  cursor:pointer; transition:border-color .15s, transform .15s; }
.ci-swatch:hover { transform:scale(1.12); }
.ci-swatch.ci-selected { border-color:#fff; transform:scale(1.15); }
.ci-grid { display:flex; gap:8px; justify-content:center; }
.ci-cell { width:60px; height:60px; border-radius:10px; border:2px dashed rgba(255,255,255,.25);
  display:flex; align-items:center; justify-content:center; cursor:pointer;
  font:bold 13px/1 sans-serif; color:#fff; text-transform:capitalize;
  transition:background .15s, border-color .15s; user-select:none; }
.ci-cell.ci-painted { border-style:solid; border-color:rgba(255,255,255,.35); }
.ci-cell.ci-locked { opacity:.35; cursor:default; }
.ci-preview { min-height:48px; display:flex; flex-direction:column; align-items:center; gap:8px; }
.ci-def { font-size:14px; color:rgba(255,255,255,.7); }
.ci-commit { padding:6px 18px; border:none; border-radius:6px; background:#0088bf;
  color:#fff; font:bold 14px sans-serif; cursor:pointer; }
.ci-commit:hover { background:#009fd6; }
`;

export function createColorInput(container) {
  // Inject styles once
  if (!document.getElementById('ci-styles')) {
    const tag = document.createElement('style');
    tag.id = 'ci-styles';
    tag.textContent = STYLES;
    document.head.appendChild(tag);
  }

  let selectedNote = null;
  const cells = new Array(MAX_CELLS).fill(null); // each null or note string

  const wrap = document.createElement('div');
  wrap.className = 'ci-wrap';
  container.appendChild(wrap);

  // --- Palette ---
  const palette = document.createElement('div');
  palette.className = 'ci-palette';
  const swatches = NOTES.map(note => {
    const s = document.createElement('div');
    s.className = 'ci-swatch';
    s.style.background = NOTE_COLORS[note];
    s.title = note;
    s.addEventListener('click', () => selectNote(note));
    palette.appendChild(s);
    return { el: s, note };
  });
  wrap.appendChild(palette);

  // --- Grid ---
  const grid = document.createElement('div');
  grid.className = 'ci-grid';
  const cellEls = [];
  for (let i = 0; i < MAX_CELLS; i++) {
    const c = document.createElement('div');
    c.className = 'ci-cell';
    c.addEventListener('click', () => onCellClick(i));
    grid.appendChild(c);
    cellEls.push(c);
  }
  wrap.appendChild(grid);

  // --- Preview area ---
  const preview = document.createElement('div');
  preview.className = 'ci-preview';
  wrap.appendChild(preview);

  let wordRenderer = null;
  const previewWord = new SolresolWord([]);

  function selectNote(note) {
    selectedNote = note;
    swatches.forEach(s => s.el.classList.toggle('ci-selected', s.note === note));
  }

  function filledCount() { return cells.filter(Boolean).length; }

  function onCellClick(i) {
    if (cells[i]) {
      // Clear — only allowed if it's the last painted cell
      if (i === filledCount() - 1) { cells[i] = null; render(); }
      return;
    }
    if (!selectedNote) return;
    if (i !== filledCount()) return; // must paint next empty (no gaps)
    cells[i] = selectedNote;
    playNote(selectedNote, { duration: 0.3 });
    render();
  }

  function render() {
    const syls = cells.filter(Boolean);
    // Update cell visuals
    cellEls.forEach((el, i) => {
      const note = cells[i];
      el.classList.toggle('ci-painted', !!note);
      el.classList.toggle('ci-locked', !note && i !== filledCount());
      el.style.background = note ? NOTE_COLORS[note] : '';
      el.textContent = note || '';
    });
    // Update preview
    previewWord.set(syls);
    if (wordRenderer) { wordRenderer.destroy(); wordRenderer = null; }
    preview.innerHTML = '';
    if (syls.length) {
      wordRenderer = createWordRenderer(previewWord, {
        size: 'md', reactive: false, showDefinition: true, clickToFocus: false,
      });
      preview.appendChild(wordRenderer.el);
    }
    if (syls.length >= 2) {
      const def = translate(syls.join(''));
      if (def) {
        const d = document.createElement('div');
        d.className = 'ci-def';
        d.textContent = def;
        preview.appendChild(d);
      }
      const btn = document.createElement('button');
      btn.className = 'ci-commit';
      btn.textContent = 'Commit';
      btn.addEventListener('click', commit);
      preview.appendChild(btn);
    }
  }

  function commit() {
    const syls = cells.filter(Boolean);
    if (syls.length < 2) return;
    buildingWord.set(syls);
    commitBuildingWord();
    inspectWord(syls);
    cells.fill(null);
    render();
  }

  // Initial render
  render();

  return {
    el: container,
    destroy() {
      if (wordRenderer) wordRenderer.destroy();
      wrap.remove();
    },
  };
}
