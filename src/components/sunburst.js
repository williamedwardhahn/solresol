import { NOTES, NOTE_COLORS } from '../utils/constants.js';
import { getAllEntries, parseWord } from '../utils/solresol.js';
import { SEMANTIC_CATEGORIES } from '../utils/grammar.js';
import { setFocusWord } from '../state/focus-word.js';

const TAU = Math.PI * 2;
const SIZE = 520;
const CX = SIZE / 2;
const CY = SIZE / 2;

/**
 * Create an interactive SVG sunburst of all Solresol words.
 * Ring 0 (innermost): 7 sectors by first syllable
 * Ring 1: 49 sectors by second syllable
 * Ring 2: word count arcs for 3+ syllable words
 * Click a sector to zoom in, click center to zoom out.
 */
export function createSunburst(container, { onWordSelect } = {}) {
  // Build hierarchy: note -> note -> [entries]
  const entries = getAllEntries();
  const tree = {};
  for (const note of NOTES) {
    tree[note] = { count: 0, children: {} };
    for (const n2 of NOTES) {
      tree[note].children[n2] = { count: 0, entries: [] };
    }
  }

  for (const entry of entries) {
    const syls = parseWord(entry.solresol);
    if (syls.length === 0) continue;
    const s1 = syls[0];
    if (!tree[s1]) continue;
    tree[s1].count++;
    if (syls.length >= 2) {
      const s2 = syls[1];
      if (tree[s1].children[s2]) {
        tree[s1].children[s2].count++;
        tree[s1].children[s2].entries.push(entry);
      }
    }
  }

  let zoomedNote = null;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', `0 0 ${SIZE} ${SIZE}`);
  svg.setAttribute('class', 'sunburst-svg');
  svg.style.width = '100%';
  svg.style.maxWidth = SIZE + 'px';

  const tooltip = document.createElement('div');
  tooltip.className = 'sunburst-tooltip';
  tooltip.style.display = 'none';

  const wrapper = document.createElement('div');
  wrapper.className = 'sunburst-wrapper';
  wrapper.appendChild(svg);
  wrapper.appendChild(tooltip);
  container.appendChild(wrapper);

  function render() {
    svg.innerHTML = '';

    if (zoomedNote) {
      renderZoomed(zoomedNote);
    } else {
      renderOverview();
    }

    // Center circle (zoom out button)
    const center = createCircle(CX, CY, 40, '#1a1a24', '#2a2a3a');
    center.style.cursor = 'pointer';
    const centerText = createText(CX, CY, zoomedNote ? '←' : '☉', zoomedNote ? 16 : 20, '#888898');
    center.addEventListener('click', () => {
      if (zoomedNote) {
        zoomedNote = null;
        render();
      }
    });
    svg.appendChild(center);
    svg.appendChild(centerText);
  }

  function renderOverview() {
    const total = entries.length;
    const R0 = 50, R1 = 120, R2 = 200;

    let angle = -Math.PI / 2; // start from top

    for (let i = 0; i < NOTES.length; i++) {
      const note = NOTES[i];
      const fraction = tree[note].count / total;
      const sweep = fraction * TAU;
      const startAngle = angle;
      const endAngle = angle + sweep;
      const color = NOTE_COLORS[note];

      // Ring 0: main sector
      const arc0 = createArc(CX, CY, R0, R1, startAngle, endAngle, color, 0.85);
      arc0.style.cursor = 'pointer';
      arc0.addEventListener('click', () => {
        zoomedNote = note;
        render();
      });
      arc0.addEventListener('mouseenter', (e) => showTooltip(e, `${capitalize(note)} — ${tree[note].count} words`));
      arc0.addEventListener('mouseleave', hideTooltip);
      svg.appendChild(arc0);

      // Label on ring 0
      const midAngle = startAngle + sweep / 2;
      const labelR = (R0 + R1) / 2;
      const lx = CX + Math.cos(midAngle) * labelR;
      const ly = CY + Math.sin(midAngle) * labelR;
      const label = createText(lx, ly, capitalize(note), 13, '#fff');
      label.style.pointerEvents = 'none';
      svg.appendChild(label);

      // Ring 1: sub-sectors by second syllable
      let subAngle = startAngle;
      const childTotal = Object.values(tree[note].children).reduce((s, c) => s + c.count, 0) || 1;

      for (const n2 of NOTES) {
        const child = tree[note].children[n2];
        if (child.count === 0) continue;
        const subFraction = child.count / childTotal;
        const subSweep = subFraction * sweep;
        const subEnd = subAngle + subSweep;
        const subColor = NOTE_COLORS[n2];

        const arc1 = createArc(CX, CY, R1 + 2, R2, subAngle, subEnd, subColor, 0.5);
        arc1.style.cursor = 'pointer';
        arc1.addEventListener('click', () => {
          zoomedNote = note;
          render();
        });
        arc1.addEventListener('mouseenter', (e) =>
          showTooltip(e, `${capitalize(note)}${capitalize(n2)}— ${child.count} words`)
        );
        arc1.addEventListener('mouseleave', hideTooltip);
        svg.appendChild(arc1);

        // Label if big enough
        if (subSweep > 0.15) {
          const sMid = subAngle + subSweep / 2;
          const sR = (R1 + R2) / 2;
          const sx = CX + Math.cos(sMid) * sR;
          const sy = CY + Math.sin(sMid) * sR;
          const sLabel = createText(sx, sy, capitalize(n2), 9, '#ddd');
          sLabel.style.pointerEvents = 'none';
          svg.appendChild(sLabel);
        }

        subAngle = subEnd;
      }

      angle = endAngle;
    }
  }

  function renderZoomed(note) {
    const color = NOTE_COLORS[note];
    const children = tree[note].children;
    const childEntries = Object.entries(children).filter(([, c]) => c.count > 0);
    const totalInNote = childEntries.reduce((s, [, c]) => s + c.count, 0) || 1;

    const R0 = 50, R1 = 130, R2 = 230;
    let angle = -Math.PI / 2;

    // Category label
    const cat = SEMANTIC_CATEGORIES[note];
    const catLabel = createText(CX, 22, cat ? cat.label : capitalize(note), 13, color);
    svg.appendChild(catLabel);

    for (const [n2, child] of childEntries) {
      const fraction = child.count / totalInNote;
      const sweep = fraction * TAU;
      const startAngle = angle;
      const endAngle = angle + sweep;
      const subColor = NOTE_COLORS[n2];

      // Family sector
      const arc = createArc(CX, CY, R0, R1, startAngle, endAngle, subColor, 0.7);
      arc.style.cursor = 'pointer';
      arc.addEventListener('mouseenter', (e) => {
        const prefix = capitalize(note) + capitalize(n2);
        const sample = child.entries.slice(0, 3).map(e => `${e.solresol}: ${e.definition || '?'}`).join('\n');
        showTooltip(e, `${prefix}— (${child.count})\n${sample}`);
      });
      arc.addEventListener('mouseleave', hideTooltip);
      svg.appendChild(arc);

      // Label
      const midAngle = startAngle + sweep / 2;
      const labelR = (R0 + R1) / 2;
      const lx = CX + Math.cos(midAngle) * labelR;
      const ly = CY + Math.sin(midAngle) * labelR;
      if (sweep > 0.2) {
        const label = createText(lx, ly, capitalize(n2), 12, '#fff');
        label.style.pointerEvents = 'none';
        svg.appendChild(label);
      }

      // Outer ring: individual word arcs
      if (child.entries.length > 0 && sweep > 0.05) {
        const wordSweep = sweep / child.entries.length;
        for (let w = 0; w < child.entries.length; w++) {
          const wStart = startAngle + w * wordSweep;
          const wEnd = wStart + wordSweep * 0.85;
          const entry = child.entries[w];
          const syls = parseWord(entry.solresol);
          const wColor = syls.length >= 3 ? NOTE_COLORS[syls[2]] || subColor : subColor;

          const wArc = createArc(CX, CY, R1 + 3, R2, wStart, wEnd, wColor, 0.4);
          wArc.style.cursor = 'pointer';
          wArc.addEventListener('click', () => {
            setFocusWord(entry.solresol);
            if (onWordSelect) onWordSelect(entry);
          });
          wArc.addEventListener('mouseenter', (e) =>
            showTooltip(e, `${entry.solresol}\n${entry.definition || '(no definition)'}`)
          );
          wArc.addEventListener('mouseleave', hideTooltip);
          svg.appendChild(wArc);
        }
      }

      angle = endAngle;
    }
  }

  function showTooltip(e, text) {
    tooltip.textContent = text;
    tooltip.style.display = 'block';
    const rect = wrapper.getBoundingClientRect();
    tooltip.style.left = (e.clientX - rect.left + 12) + 'px';
    tooltip.style.top = (e.clientY - rect.top - 8) + 'px';
  }

  function hideTooltip() {
    tooltip.style.display = 'none';
  }

  // SVG helpers
  function createArc(cx, cy, r1, r2, startAngle, endAngle, fill, opacity) {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    const largeArc = (endAngle - startAngle) > Math.PI ? 1 : 0;

    const x1o = cx + Math.cos(startAngle) * r2;
    const y1o = cy + Math.sin(startAngle) * r2;
    const x2o = cx + Math.cos(endAngle) * r2;
    const y2o = cy + Math.sin(endAngle) * r2;
    const x1i = cx + Math.cos(endAngle) * r1;
    const y1i = cy + Math.sin(endAngle) * r1;
    const x2i = cx + Math.cos(startAngle) * r1;
    const y2i = cy + Math.sin(startAngle) * r1;

    const d = [
      `M ${x1o} ${y1o}`,
      `A ${r2} ${r2} 0 ${largeArc} 1 ${x2o} ${y2o}`,
      `L ${x1i} ${y1i}`,
      `A ${r1} ${r1} 0 ${largeArc} 0 ${x2i} ${y2i}`,
      'Z',
    ].join(' ');

    path.setAttribute('d', d);
    path.setAttribute('fill', fill);
    path.setAttribute('opacity', opacity);
    path.setAttribute('stroke', '#0e0e12');
    path.setAttribute('stroke-width', '1');
    path.classList.add('sunburst-arc');
    return path;
  }

  function createCircle(cx, cy, r, fill, stroke) {
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', cx);
    circle.setAttribute('cy', cy);
    circle.setAttribute('r', r);
    circle.setAttribute('fill', fill);
    circle.setAttribute('stroke', stroke);
    circle.setAttribute('stroke-width', '1');
    return circle;
  }

  function createText(x, y, text, size, fill) {
    const el = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    el.setAttribute('x', x);
    el.setAttribute('y', y);
    el.setAttribute('text-anchor', 'middle');
    el.setAttribute('dominant-baseline', 'central');
    el.setAttribute('fill', fill);
    el.setAttribute('font-size', size);
    el.setAttribute('font-family', 'Inter, sans-serif');
    el.setAttribute('font-weight', '600');
    el.textContent = text;
    return el;
  }

  function capitalize(s) {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  render();

  return {
    el: wrapper,
    destroy() { wrapper.remove(); },
    zoomTo(note) { zoomedNote = note; render(); },
    zoomOut() { zoomedNote = null; render(); },
  };
}
