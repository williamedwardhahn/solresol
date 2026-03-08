import { getAllEntries, parseWord } from '../utils/solresol.js';
import { createWordBlocks } from '../components/color-block.js';
import { playWord } from '../audio/synth.js';

const PAGE_SIZE = 50;

export function renderDictionary(container) {
  container.innerHTML = `
    <section class="view dictionary-view">
      <h2>Dictionary</h2>
      <div class="dictionary-controls">
        <input type="text" id="dict-search" class="input"
               placeholder="Search Solresol or English..." autocomplete="off"
               aria-label="Search dictionary">
        <div class="dictionary-filters">
          <label>Syllables:
            <select id="dict-syllables" class="select" aria-label="Filter by syllable count">
              <option value="0">All</option>
              <option value="1">1</option>
              <option value="2">2</option>
              <option value="3">3</option>
              <option value="4">4</option>
              <option value="5">5</option>
            </select>
          </label>
          <label>Starting note:
            <select id="dict-start" class="select" aria-label="Filter by starting note">
              <option value="">All</option>
              <option value="do">Do</option>
              <option value="re">Re</option>
              <option value="mi">Mi</option>
              <option value="fa">Fa</option>
              <option value="sol">Sol</option>
              <option value="la">La</option>
              <option value="si">Si</option>
            </select>
          </label>
        </div>
      </div>
      <div id="dict-count" class="dict-count" aria-live="polite"></div>
      <div id="dict-list" class="dict-list"></div>
      <div id="dict-pager" class="dict-pager"></div>
    </section>
  `;

  const allEntries = getAllEntries();
  const searchInput = container.querySelector('#dict-search');
  const syllableSelect = container.querySelector('#dict-syllables');
  const startSelect = container.querySelector('#dict-start');
  const listEl = container.querySelector('#dict-list');
  const countEl = container.querySelector('#dict-count');
  const pagerEl = container.querySelector('#dict-pager');
  let page = 0;
  let filtered = allEntries;

  function applyFilters() {
    const q = searchInput.value.trim().toLowerCase();
    const sylCount = Number(syllableSelect.value);
    const startNote = startSelect.value;

    filtered = allEntries.filter(e => {
      if (sylCount && e.syllables !== sylCount) return false;
      if (startNote && !e.solresol.toLowerCase().startsWith(startNote)) return false;
      if (q) {
        const inSol = e.solresol.toLowerCase().includes(q);
        const inDef = e.definition && e.definition.toLowerCase().includes(q);
        if (!inSol && !inDef) return false;
      }
      return true;
    });

    page = 0;
    render();
  }

  function render() {
    const start = page * PAGE_SIZE;
    const pageEntries = filtered.slice(start, start + PAGE_SIZE);
    const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

    countEl.textContent = `${filtered.length} entries`;
    listEl.innerHTML = '';

    for (const entry of pageEntries) {
      const row = document.createElement('div');
      row.className = 'dict-row';

      const syllables = parseWord(entry.solresol);

      const wordCol = document.createElement('div');
      wordCol.className = 'dict-word';
      wordCol.textContent = entry.solresol;

      const blocksCol = document.createElement('div');
      blocksCol.className = 'dict-blocks';
      blocksCol.appendChild(createWordBlocks(syllables, { size: 'sm', showLabel: false }));

      const defCol = document.createElement('div');
      defCol.className = 'dict-def';
      defCol.textContent = entry.definition || '—';

      const playBtn = document.createElement('button');
      playBtn.className = 'btn btn--sm btn--icon';
      playBtn.innerHTML = '&#9654;';
      playBtn.setAttribute('aria-label', `Play ${entry.solresol}`);
      playBtn.addEventListener('click', () => playWord(syllables));

      row.append(wordCol, blocksCol, defCol, playBtn);
      listEl.appendChild(row);
    }

    // Pager
    pagerEl.innerHTML = '';
    if (totalPages > 1) {
      const prevBtn = document.createElement('button');
      prevBtn.className = 'btn btn--sm';
      prevBtn.textContent = '← Prev';
      prevBtn.disabled = page === 0;
      prevBtn.addEventListener('click', () => { page--; render(); });

      const info = document.createElement('span');
      info.className = 'pager-info';
      info.textContent = `Page ${page + 1} of ${totalPages}`;

      const nextBtn = document.createElement('button');
      nextBtn.className = 'btn btn--sm';
      nextBtn.textContent = 'Next →';
      nextBtn.disabled = page >= totalPages - 1;
      nextBtn.addEventListener('click', () => { page++; render(); });

      pagerEl.append(prevBtn, info, nextBtn);
    }
  }

  let debounce;
  searchInput.addEventListener('input', () => {
    clearTimeout(debounce);
    debounce = setTimeout(applyFilters, 200);
  });
  syllableSelect.addEventListener('change', applyFilters);
  startSelect.addEventListener('change', applyFilters);

  applyFilters();
}
