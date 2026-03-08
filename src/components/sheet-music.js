import { getColor } from '../utils/solresol.js';

const NOTE_POSITIONS = {
  do:  6,  // C4 - ledger line below
  re:  5,  // D4
  mi:  4,  // E4
  fa:  3,  // F4
  sol: 2,  // G4
  la:  1,  // A4
  si:  0,  // B4
};

const STAFF_Y = 40;
const LINE_GAP = 10;
const NOTE_SPACING = 40;
const NOTE_RADIUS_X = 7;
const NOTE_RADIUS_Y = 5;

/**
 * Render syllables as SVG sheet music notation.
 * @param {string[]} syllables
 * @param {object} opts
 * @param {boolean} opts.showLabels - solfege labels below (default true)
 * @returns {SVGElement}
 */
export function createSheetMusic(syllables, opts = {}) {
  const { showLabels = true } = opts;
  const width = Math.max(200, syllables.length * NOTE_SPACING + 80);
  const height = showLabels ? 120 : 100;

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('width', '100%');
  svg.setAttribute('height', height);
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', `Sheet music: ${syllables.join(' ')}`);

  // Draw 5 staff lines
  for (let i = 0; i < 5; i++) {
    const y = STAFF_Y + i * LINE_GAP;
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', '20');
    line.setAttribute('x2', String(width - 20));
    line.setAttribute('y1', String(y));
    line.setAttribute('y2', String(y));
    line.setAttribute('stroke', '#333');
    line.setAttribute('stroke-width', '1');
    svg.appendChild(line);
  }

  // Draw treble clef placeholder
  const clef = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  clef.setAttribute('x', '25');
  clef.setAttribute('y', String(STAFF_Y + 32));
  clef.setAttribute('font-size', '42');
  clef.setAttribute('fill', '#333');
  clef.textContent = '\u{1D11E}'; // 𝄞
  svg.appendChild(clef);

  // Draw notes
  syllables.forEach((syl, i) => {
    const x = 70 + i * NOTE_SPACING;
    const pos = NOTE_POSITIONS[syl.toLowerCase()] ?? 3;
    const y = STAFF_Y + pos * (LINE_GAP / 2);

    // Ledger line for Do (below staff)
    if (syl.toLowerCase() === 'do') {
      const ledger = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      ledger.setAttribute('x1', String(x - 12));
      ledger.setAttribute('x2', String(x + 12));
      ledger.setAttribute('y1', String(STAFF_Y + 5 * LINE_GAP));
      ledger.setAttribute('y2', String(STAFF_Y + 5 * LINE_GAP));
      ledger.setAttribute('stroke', '#333');
      ledger.setAttribute('stroke-width', '1');
      svg.appendChild(ledger);
    }

    // Note head (colored ellipse)
    const note = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
    note.setAttribute('cx', String(x));
    note.setAttribute('cy', String(y));
    note.setAttribute('rx', String(NOTE_RADIUS_X));
    note.setAttribute('ry', String(NOTE_RADIUS_Y));
    note.setAttribute('fill', getColor(syl));
    note.setAttribute('stroke', '#333');
    note.setAttribute('stroke-width', '0.5');
    svg.appendChild(note);

    // Stem
    const stem = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    stem.setAttribute('x1', String(x + NOTE_RADIUS_X));
    stem.setAttribute('x2', String(x + NOTE_RADIUS_X));
    stem.setAttribute('y1', String(y));
    stem.setAttribute('y2', String(y - 30));
    stem.setAttribute('stroke', '#333');
    stem.setAttribute('stroke-width', '1.5');
    svg.appendChild(stem);

    // Solfege label
    if (showLabels) {
      const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      label.setAttribute('x', String(x));
      label.setAttribute('y', String(STAFF_Y + 5 * LINE_GAP + 18));
      label.setAttribute('text-anchor', 'middle');
      label.setAttribute('font-size', '10');
      label.setAttribute('fill', getColor(syl));
      label.setAttribute('font-weight', 'bold');
      label.textContent = syl.charAt(0).toUpperCase() + syl.slice(1);
      svg.appendChild(label);
    }
  });

  return svg;
}
