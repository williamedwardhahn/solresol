import { committedWords, clearSentence, undoLastWord, currentSentence } from '../state/focus-word.js';
import { createWordBlocks } from './color-block.js';
import { createSheetMusic } from './sheet-music.js';
import { playSentence } from '../audio/synth.js';
import { inspectWord } from '../state/focus-word.js';
import { on } from '../utils/events.js';
import { analyzeGrammar } from '../utils/grammar.js';
import { SolresolSentence } from '../models/sentence.js';

/**
 * Show a popover with saved sentences above the sentence bar.
 */
function showLoadPopover(barContainer, rerenderBar) {
  // Remove any existing popover
  const existing = barContainer.querySelector('.sb-load-popover');
  if (existing) { existing.remove(); return; }

  const saved = SolresolSentence.getSavedSentences();
  const popover = document.createElement('div');
  popover.className = 'sb-load-popover';

  if (saved.length === 0) {
    popover.innerHTML = '<div class="sb-popover-empty">No saved sentences</div>';
  } else {
    for (let i = 0; i < saved.length; i++) {
      const entry = saved[i];
      const row = document.createElement('div');
      row.className = 'sb-popover-row';

      const info = document.createElement('button');
      info.className = 'sb-popover-load';
      const date = new Date(entry.timestamp);
      const timeStr = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ' ' + date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
      info.innerHTML = '<span class="sb-popover-name">' + escapeHtml(entry.name) + '</span><span class="sb-popover-time">' + timeStr + '</span>';
      info.addEventListener('click', () => {
        clearSentence();
        for (const syls of entry.words) {
          currentSentence.addWord(syls);
        }
        popover.remove();
        rerenderBar();
      });

      const delBtn = document.createElement('button');
      delBtn.className = 'sb-popover-del';
      delBtn.textContent = '\u00D7';
      delBtn.title = 'Delete';
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        SolresolSentence.deleteSentence(i);
        popover.remove();
        showLoadPopover(barContainer, rerenderBar);
      });

      row.append(info, delBtn);
      popover.appendChild(row);
    }
  }

  barContainer.appendChild(popover);

  // Close when clicking outside
  function closeOnClick(e) {
    if (!popover.contains(e.target) && !e.target.classList.contains('sb-load')) {
      popover.remove();
      document.removeEventListener('click', closeOnClick);
    }
  }
  setTimeout(() => document.addEventListener('click', closeOnClick), 0);
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/**
 * Persistent sentence bar — always visible at the bottom of the viewport.
 * Shows committed words across all views, survives navigation.
 */
export function initSentenceBar(container) {
  container.innerHTML = `
    <div class="sb-inner">
      <div class="sb-words" id="sb-words"></div>
      <div class="sb-actions" id="sb-actions"></div>
    </div>
  `;

  const wordsEl = container.querySelector('#sb-words');
  const actionsEl = container.querySelector('#sb-actions');

  function render() {
    wordsEl.innerHTML = '';
    actionsEl.innerHTML = '';

    if (committedWords.length === 0) {
      container.classList.add('sentence-bar--empty');
      return;
    }

    container.classList.remove('sentence-bar--empty');

    // Analyze grammar for role assignment
    const grammar = analyzeGrammar(currentSentence.words);
    const roleMap = new Map();
    for (const entry of grammar.roles) {
      roleMap.set(entry.word, entry.role);
    }

    // Role → CSS class mapping
    const roleClassMap = {
      'subject': 'sb-chip--subject',
      'verb': 'sb-chip--verb',
      'object': 'sb-chip--object',
      'indirect-object': 'sb-chip--object',
      'adjective': 'sb-chip--adjective',
      'adverb': 'sb-chip--adverb',
      'tense-marker': 'sb-chip--marker',
      'negation': 'sb-chip--marker',
      'question': 'sb-chip--marker',
      'particle': 'sb-chip--marker',
      'noun': 'sb-chip--subject',
    };

    // Word chips
    for (const w of committedWords) {
      const chip = document.createElement('button');
      const role = roleMap.get(w) || '';
      const roleClass = roleClassMap[role] || '';
      chip.className = 'sb-chip' + (roleClass ? ' ' + roleClass : '');
      chip.title = (w.definition || w.text) + (role ? ' (' + role + ')' : '');

      // Mini color blocks
      for (const syl of w.syllables) {
        const pip = document.createElement('span');
        pip.className = 'sb-pip';
        pip.style.backgroundColor = w.colors[w.syllables.indexOf(syl)];
        chip.appendChild(pip);
      }

      const label = document.createElement('span');
      label.className = 'sb-chip-label';
      label.textContent = w.definition ? w.definition.split(',')[0].split(';')[0].trim() : w.text;
      chip.appendChild(label);

      chip.addEventListener('click', () => inspectWord(w.syllables));
      wordsEl.appendChild(chip);
    }

    // Translation line with badges
    const transRow = document.createElement('div');
    transRow.className = 'sb-trans-row';

    const trans = document.createElement('span');
    trans.className = 'sb-translation';
    trans.setAttribute('aria-live', 'polite');
    trans.textContent = committedWords.map(w => {
      const d = w.definition;
      return d ? d.split(',')[0].split(';')[0].trim() : w.text;
    }).join(' ');
    transRow.appendChild(trans);

    // Tense badge
    const tense = currentSentence.tense;
    if (tense !== 'present') {
      const tenseBadge = document.createElement('span');
      tenseBadge.className = 'sb-badge';
      tenseBadge.textContent = tense.toUpperCase();
      transRow.appendChild(tenseBadge);
    }

    // Question badge
    if (currentSentence.isQuestion) {
      const qBadge = document.createElement('span');
      qBadge.className = 'sb-badge';
      qBadge.textContent = '?';
      transRow.appendChild(qBadge);
    }

    // Negation badge
    if (currentSentence.isNegated) {
      const negBadge = document.createElement('span');
      negBadge.className = 'sb-badge';
      negBadge.textContent = 'NOT';
      transRow.appendChild(negBadge);
    }

    wordsEl.appendChild(transRow);

    // Grammar suggestion hint
    if (grammar.suggestions && grammar.suggestions.length > 0) {
      const hint = document.createElement('div');
      hint.className = 'sb-suggestion';
      const first = grammar.suggestions[0];
      hint.textContent = 'Add ' + (first === 'subject' ? 'a subject' : first === 'verb' ? 'a verb' : first === 'object' ? 'an object' : first === 'adjective' ? 'an adjective' : 'an adverb');
      wordsEl.appendChild(hint);
    }

    // Actions
    const playBtn = document.createElement('button');
    playBtn.className = 'btn btn--sm btn--icon sb-play';
    playBtn.innerHTML = '&#9654;';
    playBtn.title = 'Play sentence';
    playBtn.addEventListener('click', () => {
      playSentence(committedWords.map(w => w.syllables));
    });

    const undoBtn = document.createElement('button');
    undoBtn.className = 'btn btn--sm sb-undo';
    undoBtn.textContent = '\u232B';
    undoBtn.title = 'Undo last word';
    undoBtn.addEventListener('click', () => {
      undoLastWord();
    });

    const clearBtn = document.createElement('button');
    clearBtn.className = 'btn btn--sm sb-clear';
    clearBtn.textContent = '\u00D7';
    clearBtn.title = 'New sentence';
    clearBtn.addEventListener('click', () => {
      clearSentence();
    });

    // Save button
    const saveBtn = document.createElement('button');
    saveBtn.className = 'btn btn--sm btn--icon sb-save';
    saveBtn.innerHTML = '&#128190;';  // floppy disk
    saveBtn.title = 'Save sentence';
    saveBtn.addEventListener('click', () => {
      SolresolSentence.saveSentence(currentSentence);
      saveBtn.textContent = '\u2713';
      setTimeout(() => { saveBtn.innerHTML = '&#128190;'; }, 800);
    });

    // Load button
    const loadBtn = document.createElement('button');
    loadBtn.className = 'btn btn--sm btn--icon sb-load';
    loadBtn.innerHTML = '&#128194;';  // folder
    loadBtn.title = 'Load saved sentence';
    loadBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      showLoadPopover(container, render);
    });

    actionsEl.append(playBtn, undoBtn, clearBtn, saveBtn, loadBtn);
  }

  // Listen for changes
  on('word:commit', render);
  on('word:undo', render);
  on('sentence:clear', render);

  render();
}
