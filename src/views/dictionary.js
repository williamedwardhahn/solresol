import { getAllEntries, parseWord, translate } from '../utils/solresol.js';
import { NOTES } from '../utils/constants.js';
import { SolresolWord } from '../models/word.js';
import { createWordBlocks } from '../components/color-block.js';
import { createWordRenderer } from '../components/word-renderer.js';
import { SEMANTIC_CATEGORIES } from '../utils/grammar.js';
import { getAntonymPairs, getAntonym } from '../utils/antonyms.js';
import { numberToSolresol, getNumberTable } from '../utils/numbers.js';
import { playWord } from '../audio/synth.js';
import { inspectWord } from '../state/focus-word.js';
import { getHashParams } from '../app.js';
import { createSunburst } from '../components/sunburst.js';
import { managed } from '../utils/lifecycle.js';
import { displaySyllable, displayWord } from '../utils/format.js';

const PAGE_SIZE = 50;

/**
 * Dictionary view — combines dictionary + explorer + antonyms + numbers.
 * Internal mode tabs switch between them.
 */
export function renderDictionary(container) {
  container.innerHTML = `
    <section class="view dictionary-view">
      <h2>Dictionary</h2>
      <div class="dict-modes">
        <button class="btn btn--active" data-mode="all">All Words</button>
        <button class="btn" data-mode="sunburst">Sunburst</button>
        <button class="btn" data-mode="category">By Category</button>
        <button class="btn" data-mode="antonyms">Antonyms</button>
        <button class="btn" data-mode="numbers">Numbers</button>
      </div>
      <div id="dict-content"></div>
    </section>
  `;

  const contentEl = container.querySelector('#dict-content');
  const modeBtns = container.querySelectorAll('[data-mode]');
  let mode = 'all';

  // Check hash params for initial mode
  const params = getHashParams();
  if (params.start) mode = 'category';
  if (params.mode === 'sunburst') mode = 'sunburst';

  modeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      mode = btn.dataset.mode;
      modeBtns.forEach(b => b.classList.remove('btn--active'));
      btn.classList.add('btn--active');
      renderMode();
    });
  });

  // Set initial active button
  modeBtns.forEach(b => {
    if (b.dataset.mode === mode) {
      modeBtns.forEach(x => x.classList.remove('btn--active'));
      b.classList.add('btn--active');
    }
  });

  const dictScope = managed();

  function renderMode() {
    dictScope.destroyAll();
    contentEl.innerHTML = '';
    if (mode === 'all') renderAllWords(contentEl);
    else if (mode === 'sunburst') renderSunburstMode(contentEl);
    else if (mode === 'category') renderByCategory(contentEl);
    else if (mode === 'antonyms') renderAntonyms(contentEl);
    else if (mode === 'numbers') renderNumbers(contentEl);
  }

  renderMode();

  // === ALL WORDS MODE ===
  function renderAllWords(el) {
    el.innerHTML = `
      <div class="dictionary-controls">
        <input type="text" id="dict-search" class="input" placeholder="Search Solresol or English..." autocomplete="off">
        <div class="dictionary-filters">
          <label>Syllables: <select id="dict-syllables" class="select">
            <option value="0">All</option><option value="1">1</option><option value="2">2</option>
            <option value="3">3</option><option value="4">4</option><option value="5">5</option>
          </select></label>
          <label>Starting note: <select id="dict-start" class="select">
            <option value="">All</option>
            ${NOTES.map(n => `<option value="${n}">${displaySyllable(n)}</option>`).join('')}
          </select></label>
        </div>
      </div>
      <div id="dict-count" class="dict-count"></div>
      <div id="dict-list" class="dict-list"></div>
      <div id="dict-pager" class="dict-pager"></div>
    `;

    const allEntries = getAllEntries();
    const searchInput = el.querySelector('#dict-search');
    const syllableSelect = el.querySelector('#dict-syllables');
    const startSelect = el.querySelector('#dict-start');
    const listEl = el.querySelector('#dict-list');
    const countEl = el.querySelector('#dict-count');
    const pagerEl = el.querySelector('#dict-pager');
    let page = 0, filtered = allEntries;

    function applyFilters() {
      const q = searchInput.value.trim().toLowerCase();
      const sylCount = Number(syllableSelect.value);
      const startNote = startSelect.value;
      filtered = allEntries.filter(e => {
        if (sylCount && e.syllables !== sylCount) return false;
        if (startNote && !e.solresol.toLowerCase().startsWith(startNote)) return false;
        if (q) {
          if (!e.solresol.toLowerCase().includes(q) && !(e.definition && e.definition.toLowerCase().includes(q))) return false;
        }
        return true;
      });
      page = 0;
      renderList();
    }

    function renderList() {
      const start = page * PAGE_SIZE;
      const pageEntries = filtered.slice(start, start + PAGE_SIZE);
      const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
      countEl.textContent = `${filtered.length} entries`;
      listEl.innerHTML = '';

      if (filtered.length === 0) {
        listEl.innerHTML = '<p class="no-results">No matching entries</p>';
        pagerEl.innerHTML = '';
        return;
      }

      for (const entry of pageEntries) {
        const syllables = parseWord(entry.solresol);
        const row = document.createElement('div');
        row.className = 'dict-row';
        row.innerHTML = `
          <div class="dict-word">${entry.solresol}</div>
          <div class="dict-blocks"></div>
          <div class="dict-def">${entry.definition || '—'}</div>
        `;
        row.querySelector('.dict-blocks').appendChild(createWordBlocks(syllables, { size: 'sm', showLabel: false }));
        const playBtn = document.createElement('button');
        playBtn.className = 'btn btn--sm btn--icon';
        playBtn.innerHTML = '&#9654;';
        playBtn.addEventListener('click', (e) => { e.stopPropagation(); playWord(syllables); });
        row.appendChild(playBtn);
        row.addEventListener('click', (e) => {
          if (e.target.closest('.btn')) return;
          inspectWord(entry.solresol);
        });
        listEl.appendChild(row);
      }

      pagerEl.innerHTML = '';
      if (totalPages > 1) {
        const prevBtn = document.createElement('button');
        prevBtn.className = 'btn btn--sm';
        prevBtn.textContent = '← Prev';
        prevBtn.disabled = page === 0;
        prevBtn.addEventListener('click', () => { page--; renderList(); });
        const info = document.createElement('span');
        info.className = 'pager-info';
        info.textContent = `Page ${page + 1} of ${totalPages}`;
        const nextBtn = document.createElement('button');
        nextBtn.className = 'btn btn--sm';
        nextBtn.textContent = 'Next →';
        nextBtn.disabled = page >= totalPages - 1;
        nextBtn.addEventListener('click', () => { page++; renderList(); });
        pagerEl.append(prevBtn, info, nextBtn);
      }
    }

    let debounce;
    searchInput.addEventListener('input', () => { clearTimeout(debounce); debounce = setTimeout(applyFilters, 200); });
    syllableSelect.addEventListener('change', applyFilters);
    startSelect.addEventListener('change', applyFilters);

    if (params.word) searchInput.value = params.word;
    if (params.start) startSelect.value = params.start;
    applyFilters();
  }

  // === BY CATEGORY MODE (explorer) ===
  function renderByCategory(el) {
    el.innerHTML = `
      <p class="view-desc">Words organized by first syllable into semantic families.</p>
      <div id="explorer-cats" class="explorer-cats"></div>
      <div id="explorer-families" class="explorer-families"></div>
    `;
    const catsEl = el.querySelector('#explorer-cats');
    const familiesEl = el.querySelector('#explorer-families');
    const allEntries = getAllEntries();
    let initialNote = params.start || null;

    for (const note of NOTES) {
      const cat = SEMANTIC_CATEGORIES[note];
      const btn = document.createElement('button');
      btn.className = 'btn explorer-cat-btn';
      btn.style.borderLeftColor = cat.color;
      btn.style.borderLeftWidth = '4px';
      btn.style.borderLeftStyle = 'solid';
      btn.innerHTML = `<span class="explorer-cat-note" style="color:${cat.color}">${displaySyllable(note)}</span>
        <span class="explorer-cat-desc">${cat.label.split('—')[1]?.trim() || ''}</span>`;
      btn.addEventListener('click', () => {
        catsEl.querySelectorAll('.explorer-cat-btn').forEach(b => b.classList.remove('btn--active'));
        btn.classList.add('btn--active');
        showFamilies(note);
      });
      catsEl.appendChild(btn);
    }

    function showFamilies(note) {
      familiesEl.innerHTML = '';
      const entries = allEntries.filter(e => { const s = parseWord(e.solresol); return s.length > 0 && s[0] === note; });
      const families = new Map();
      for (const entry of entries) {
        const syls = parseWord(entry.solresol);
        const key = syls.length <= 2 ? '_basic' : syls.slice(0, 2).join('');
        if (!families.has(key)) families.set(key, []);
        families.get(key).push(entry);
      }
      const basic = families.get('_basic');
      if (basic) { familiesEl.appendChild(createFamily('Basic Words', basic, [note])); families.delete('_basic'); }
      for (const [key, members] of families) {
        familiesEl.appendChild(createFamily(displayWord(parseWord(key)) + '- family', members, parseWord(key)));
      }
    }

    function createFamily(title, entries, prefixSyls) {
      const section = document.createElement('div');
      section.className = 'explorer-family';
      const header = document.createElement('h3');
      header.className = 'explorer-family-title';
      header.style.cursor = 'pointer';
      if (prefixSyls && prefixSyls.length > 0) {
        const blocks = createWordBlocks(prefixSyls, { size: 'sm', showLabel: true, playable: true });
        blocks.style.display = 'inline-flex';
        blocks.style.marginRight = '0.5rem';
        blocks.style.verticalAlign = 'middle';
        header.appendChild(blocks);
      }
      header.appendChild(document.createTextNode(`${title} (${entries.length})`));
      const list = document.createElement('div');
      list.className = 'explorer-family-list';
      let expanded = entries.length <= 14;
      list.style.display = expanded ? 'flex' : 'none';
      header.addEventListener('click', () => { expanded = !expanded; list.style.display = expanded ? 'flex' : 'none'; header.classList.toggle('collapsed', !expanded); });
      if (!expanded) header.classList.add('collapsed');
      for (const entry of entries) {
        const syls = parseWord(entry.solresol);
        const row = document.createElement('div');
        row.className = 'explorer-entry';
        row.innerHTML = `<span class="explorer-word">${entry.solresol}</span>`;
        row.appendChild(createWordBlocks(syls, { size: 'sm', showLabel: false }));
        const defEl = document.createElement('span');
        defEl.className = 'explorer-def';
        defEl.textContent = entry.definition || '—';
        row.appendChild(defEl);
        const playBtn = document.createElement('button');
        playBtn.className = 'btn btn--sm btn--icon';
        playBtn.innerHTML = '&#9654;';
        playBtn.addEventListener('click', (e) => { e.stopPropagation(); playWord(syls); });
        row.appendChild(playBtn);
        row.addEventListener('click', (e) => { if (!e.target.closest('.btn')) inspectWord(entry.solresol); });
        list.appendChild(row);
      }
      section.append(header, list);
      return section;
    }

    // Auto-select
    const autoNote = initialNote || 'do';
    const autoBtn = catsEl.querySelectorAll('.explorer-cat-btn')[NOTES.indexOf(autoNote)];
    if (autoBtn) autoBtn.click();
  }

  // === ANTONYMS MODE ===
  function renderAntonyms(el) {
    el.innerHTML = `
      <p class="view-desc">Reversing syllables creates the opposite meaning. Try any word:</p>
      <div class="antonym-explorer">
        <input type="text" id="antonym-input" class="input" placeholder="Type a Solresol word (e.g. fala)..." autocomplete="off">
        <div id="antonym-live" class="antonym-live" style="margin-top:0.75rem"></div>
      </div>
      <h3 style="margin-top:1rem">Known Pairs</h3>
      <div id="antonym-list" class="antonym-list"></div>
    `;

    const inputEl = el.querySelector('#antonym-input');
    const liveEl = el.querySelector('#antonym-live');
    const listEl = el.querySelector('#antonym-list');

    let debounce;
    inputEl.addEventListener('input', () => {
      clearTimeout(debounce);
      debounce = setTimeout(() => {
        liveEl.innerHTML = '';
        const syls = parseWord(inputEl.value.trim());
        if (syls.length < 2) return;
        const orig = new SolresolWord(syls);
        const rev = orig.reversed();
        const pair = document.createElement('div');
        pair.className = 'antonym-live-pair';
        const origWr = createWordRenderer(orig, { size: 'md', showSheet: false, showDefinition: true, reactive: false, notations: new Set(['colors']) });
        const arrow = document.createElement('div');
        arrow.className = 'antonym-arrow antonym-arrow--interactive';
        arrow.textContent = '⇄';
        arrow.addEventListener('click', () => { playWord(orig.syllables); setTimeout(() => playWord(rev.syllables), orig.length * 400 + 300); });
        const revWr = createWordRenderer(rev, { size: 'md', showSheet: false, showDefinition: true, reactive: false, notations: new Set(['colors']) });
        pair.append(origWr.el, arrow, revWr.el);
        liveEl.appendChild(pair);
      }, 150);
    });

    const pairs = getAntonymPairs();
    for (const p of pairs) {
      const row = document.createElement('div');
      row.className = 'antonym-row';
      const w1 = new SolresolWord(p.syllables1);
      const w2 = new SolresolWord(p.syllables2);
      const left = document.createElement('div');
      left.className = 'antonym-side';
      left.appendChild(createWordRenderer(w1, { size: 'sm', showSheet: false, showDefinition: true, reactive: false, notations: new Set(['colors']) }).el);
      const arrow = document.createElement('button');
      arrow.className = 'antonym-arrow antonym-arrow--interactive';
      arrow.textContent = '⇄';
      arrow.addEventListener('click', () => { playWord(p.syllables1); setTimeout(() => playWord(p.syllables2), p.syllables1.length * 400 + 300); });
      const right = document.createElement('div');
      right.className = 'antonym-side';
      right.appendChild(createWordRenderer(w2, { size: 'sm', showSheet: false, showDefinition: true, reactive: false, notations: new Set(['colors']) }).el);
      row.append(left, arrow, right);
      listEl.appendChild(row);
    }
  }

  // === NUMBERS MODE ===
  function renderNumbers(el) {
    el.innerHTML = `
      <p class="view-desc">Enter a number to see its Solresol form.</p>
      <div class="numbers-converter">
        <div class="numbers-input-row">
          <input type="number" id="num-input" class="input" placeholder="Enter a number..." min="0" max="999999999">
          <button id="num-play" class="btn btn--icon" disabled>&#9654;</button>
        </div>
        <div id="num-result" class="num-result"></div>
      </div>
      <h3>Base Numbers</h3>
      <div id="num-table" class="num-table"></div>
    `;

    const numInput = el.querySelector('#num-input');
    const numResult = el.querySelector('#num-result');
    const numPlayBtn = el.querySelector('#num-play');
    const tableEl = el.querySelector('#num-table');
    let lastSyls = [];

    numInput.addEventListener('input', () => {
      const val = parseInt(numInput.value, 10);
      numResult.innerHTML = '';
      lastSyls = [];
      numPlayBtn.disabled = true;
      if (isNaN(val) || val < 0) return;
      const sol = numberToSolresol(val);
      const allSyls = sol.split(' ').flatMap(w => parseWord(w));
      lastSyls = allSyls;
      numPlayBtn.disabled = false;
      const card = document.createElement('div');
      card.className = 'num-result-card';
      card.innerHTML = `<div class="num-result-num">${val.toLocaleString()}</div><div class="num-result-sol">${sol}</div>`;
      card.appendChild(createWordBlocks(allSyls));
      numResult.appendChild(card);
    });

    numPlayBtn.addEventListener('click', () => { if (lastSyls.length) playWord(lastSyls); });

    for (const { number, solresol } of getNumberTable()) {
      const row = document.createElement('div');
      row.className = 'num-row';
      const numCol = document.createElement('span');
      numCol.className = 'num-col-num';
      numCol.textContent = number.toLocaleString();
      const syls = parseWord(solresol);
      const wordCol = document.createElement('span');
      wordCol.className = 'num-col-word';
      wordCol.textContent = solresol;
      const playBtn = document.createElement('button');
      playBtn.className = 'btn btn--sm btn--icon';
      playBtn.innerHTML = '&#9654;';
      playBtn.addEventListener('click', () => playWord(syls));
      row.append(numCol, createWordBlocks(syls, { size: 'sm', showLabel: false }), wordCol, playBtn);
      tableEl.appendChild(row);
    }
  }

  // === SUNBURST MODE ===
  function renderSunburstMode(el) {
    el.innerHTML = `
      <p class="view-desc">Visual map of all 3,152 Solresol words. Click a sector to zoom in, click the center to zoom out.</p>
      <div id="sunburst-container" class="sunburst-container"></div>
    `;
    const sunburstEl = el.querySelector('#sunburst-container');
    const sunburstInstance = dictScope.track(createSunburst(sunburstEl));
    // Auto-zoom if deep-linked
    if (params.zoom && sunburstInstance.zoomTo) {
      sunburstInstance.zoomTo(params.zoom);
    }
  }

  // Cleanup on navigation
  return () => {
    dictScope.destroyAll();
  };
}
