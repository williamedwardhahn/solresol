import { NOTES } from '../utils/constants.js';
import { getAllEntries, parseWord, getColor } from '../utils/solresol.js';
import { SEMANTIC_CATEGORIES } from '../utils/grammar.js';
import { createWordBlocks } from '../components/color-block.js';
import { createNotationDisplay } from '../components/notation-display.js';
import { playWord } from '../audio/synth.js';

export function renderExplorer(container) {
  container.innerHTML = `
    <section class="view explorer-view">
      <h2>Semantic Explorer</h2>
      <p class="view-desc">Solresol words are organized by their first syllable into semantic families. Click a category to explore.</p>
      <div id="explorer-cats" class="explorer-cats"></div>
      <div id="explorer-families" class="explorer-families"></div>
    </section>
  `;

  const catsEl = container.querySelector('#explorer-cats');
  const familiesEl = container.querySelector('#explorer-families');
  const allEntries = getAllEntries();
  let activeNote = null;

  // Category buttons
  for (const note of NOTES) {
    const cat = SEMANTIC_CATEGORIES[note];
    const btn = document.createElement('button');
    btn.className = 'btn explorer-cat-btn';
    btn.style.borderLeftColor = cat.color;
    btn.style.borderLeftWidth = '4px';
    btn.style.borderLeftStyle = 'solid';
    btn.innerHTML = `<span class="explorer-cat-note" style="color:${cat.color}">${note.charAt(0).toUpperCase() + note.slice(1)}</span>
      <span class="explorer-cat-desc">${cat.label.split('—')[1]?.trim() || ''}</span>`;
    btn.addEventListener('click', () => {
      activeNote = note;
      catsEl.querySelectorAll('.explorer-cat-btn').forEach(b => b.classList.remove('btn--active'));
      btn.classList.add('btn--active');
      renderFamilies(note);
    });
    catsEl.appendChild(btn);
  }

  function renderFamilies(note) {
    familiesEl.innerHTML = '';

    // Get entries starting with this note, grouped by syllable count
    const entries = allEntries.filter(e => {
      const syls = parseWord(e.solresol);
      return syls.length > 0 && syls[0] === note;
    });

    // Group 3-syllable words into families by first 2 syllables
    const families = new Map();

    for (const entry of entries) {
      const syls = parseWord(entry.solresol);
      let familyKey;
      if (syls.length <= 2) {
        familyKey = '_basic';
      } else {
        familyKey = syls.slice(0, 2).join('');
      }

      if (!families.has(familyKey)) families.set(familyKey, []);
      families.get(familyKey).push(entry);
    }

    // Render basic words first
    const basic = families.get('_basic');
    if (basic) {
      const section = createFamilySection('Basic Words', basic);
      familiesEl.appendChild(section);
      families.delete('_basic');
    }

    // Then semantic families
    for (const [key, members] of families) {
      const familyName = key.charAt(0).toUpperCase() + key.slice(1) + '- family';
      const section = createFamilySection(familyName, members);
      familiesEl.appendChild(section);
    }
  }

  function createFamilySection(title, entries) {
    const section = document.createElement('div');
    section.className = 'explorer-family';

    const header = document.createElement('h3');
    header.className = 'explorer-family-title';
    header.textContent = `${title} (${entries.length})`;
    header.style.cursor = 'pointer';

    const list = document.createElement('div');
    list.className = 'explorer-family-list';

    let expanded = entries.length <= 14;
    list.style.display = expanded ? 'flex' : 'none';
    header.addEventListener('click', () => {
      expanded = !expanded;
      list.style.display = expanded ? 'flex' : 'none';
      header.classList.toggle('collapsed', !expanded);
    });
    if (!expanded) header.classList.add('collapsed');

    for (const entry of entries) {
      const syls = parseWord(entry.solresol);
      const row = document.createElement('div');
      row.className = 'explorer-entry';

      const wordEl = document.createElement('span');
      wordEl.className = 'explorer-word';
      wordEl.textContent = entry.solresol;

      const blocks = createWordBlocks(syls, { size: 'sm', showLabel: false });

      const defEl = document.createElement('span');
      defEl.className = 'explorer-def';
      defEl.textContent = entry.definition || '—';

      const playBtn = document.createElement('button');
      playBtn.className = 'btn btn--sm btn--icon';
      playBtn.innerHTML = '&#9654;';
      playBtn.addEventListener('click', (e) => { e.stopPropagation(); playWord(syls); });

      row.append(wordEl, blocks, defEl, playBtn);
      list.appendChild(row);
    }

    section.append(header, list);
    return section;
  }

  // Auto-select first category
  catsEl.querySelector('.explorer-cat-btn')?.click();
}
