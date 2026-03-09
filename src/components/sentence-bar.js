import { committedWords, clearSentence, undoLastWord, currentSentence } from '../state/focus-word.js';
import { createWordBlocks } from './color-block.js';
import { playSentence } from '../audio/synth.js';
import { inspectWord } from '../state/focus-word.js';
import { on } from '../utils/events.js';
import { analyzeGrammar } from '../utils/grammar.js';
import { SolresolSentence } from '../models/sentence.js';

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/**
 * Show a popover with saved sentences.
 */
function showLoadPopover(container, rerenderFn) {
  const existing = container.querySelector('.sb-load-popover');
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
        rerenderFn();
      });

      const delBtn = document.createElement('button');
      delBtn.className = 'sb-popover-del';
      delBtn.textContent = '\u00D7';
      delBtn.title = 'Delete';
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        SolresolSentence.deleteSentence(i);
        popover.remove();
        showLoadPopover(container, rerenderFn);
      });

      row.append(info, delBtn);
      popover.appendChild(row);
    }
  }

  container.appendChild(popover);

  function closeOnClick(e) {
    if (!popover.contains(e.target)) {
      popover.remove();
      document.removeEventListener('click', closeOnClick);
    }
  }
  setTimeout(() => document.addEventListener('click', closeOnClick), 0);
}

/**
 * Inline sentence display — renders into #sentence-display.
 * Shows committed words as chips with grammar roles.
 */
export function initSentenceDisplay(container) {
  function render() {
    container.innerHTML = '';

    if (committedWords.length === 0) {
      container.innerHTML = `<div class="sentence-empty">
        Play notes to build words, press <kbd>Enter</kbd> to add to sentence
      </div>`;
      return;
    }

    // Analyze grammar for role assignment
    const grammar = analyzeGrammar(currentSentence.words);
    const roleMap = new Map();
    for (const entry of grammar.roles) {
      roleMap.set(entry.word, entry.role);
    }

    const roleClassMap = {
      'subject': 'sentence-chip--subject',
      'verb': 'sentence-chip--verb',
      'object': 'sentence-chip--object',
      'indirect-object': 'sentence-chip--object',
      'adjective': 'sentence-chip--adjective',
      'adverb': 'sentence-chip--adverb',
      'tense-marker': 'sentence-chip--marker',
      'negation': 'sentence-chip--marker',
      'question': 'sentence-chip--marker',
      'particle': 'sentence-chip--marker',
      'noun': 'sentence-chip--subject',
    };

    // Label
    const label = document.createElement('div');
    label.className = 'sentence-label';
    label.textContent = 'Your Sentence';
    container.appendChild(label);

    // Word chips
    const chipsRow = document.createElement('div');
    chipsRow.className = 'sentence-chips';

    for (const w of committedWords) {
      const chip = document.createElement('button');
      const role = roleMap.get(w) || '';
      const roleClass = roleClassMap[role] || '';
      chip.className = 'sentence-chip' + (roleClass ? ' ' + roleClass : '');
      chip.title = (w.definition || w.text) + (role ? ' (' + role + ')' : '');

      for (const syl of w.syllables) {
        const pip = document.createElement('span');
        pip.className = 'sentence-pip';
        pip.style.backgroundColor = w.colors[w.syllables.indexOf(syl)];
        chip.appendChild(pip);
      }

      const labelEl = document.createElement('span');
      labelEl.className = 'sentence-chip-label';
      labelEl.textContent = w.definition ? w.definition.split(',')[0].split(';')[0].trim() : w.text;
      chip.appendChild(labelEl);

      chip.addEventListener('click', () => inspectWord(w.syllables));
      chipsRow.appendChild(chip);
    }
    container.appendChild(chipsRow);

    // Translation line
    const trans = document.createElement('div');
    trans.className = 'sentence-translation';
    trans.setAttribute('aria-live', 'polite');
    trans.textContent = committedWords.map(w => {
      const d = w.definition;
      return d ? d.split(',')[0].split(';')[0].trim() : w.text;
    }).join(' ');
    container.appendChild(trans);

    // Actions
    const actions = document.createElement('div');
    actions.className = 'sentence-actions';

    const playBtn = document.createElement('button');
    playBtn.className = 'btn btn--sm';
    playBtn.innerHTML = '&#9654; Play';
    playBtn.addEventListener('click', () => {
      playSentence(committedWords.map(w => w.syllables));
    });

    const undoBtn = document.createElement('button');
    undoBtn.className = 'btn btn--sm';
    undoBtn.textContent = '⌫ Undo';
    undoBtn.addEventListener('click', () => undoLastWord());

    const clearBtn = document.createElement('button');
    clearBtn.className = 'btn btn--sm';
    clearBtn.textContent = '✕ Clear';
    clearBtn.addEventListener('click', () => clearSentence());

    const saveBtn = document.createElement('button');
    saveBtn.className = 'btn btn--sm';
    saveBtn.innerHTML = '💾 Save';
    saveBtn.addEventListener('click', () => {
      SolresolSentence.saveSentence(currentSentence);
      saveBtn.textContent = '✓ Saved';
      setTimeout(() => { saveBtn.innerHTML = '💾 Save'; }, 800);
    });

    const loadBtn = document.createElement('button');
    loadBtn.className = 'btn btn--sm';
    loadBtn.innerHTML = '📂 Load';
    loadBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      showLoadPopover(container, render);
    });

    actions.append(playBtn, undoBtn, clearBtn, saveBtn, loadBtn);
    container.appendChild(actions);
  }

  on('word:commit', render);
  on('word:undo', render);
  on('sentence:clear', render);

  render();
}

// Keep old export name for backward compat
export const initSentenceBar = initSentenceDisplay;
