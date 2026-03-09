import { committedWords, clearSentence, undoLastWord } from '../state/focus-word.js';
import { createWordBlocks } from './color-block.js';
import { createSheetMusic } from './sheet-music.js';
import { playSentence } from '../audio/synth.js';
import { setFocusWord } from '../state/focus-word.js';
import { on } from '../utils/events.js';

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

    // Word chips
    for (const w of committedWords) {
      const chip = document.createElement('button');
      chip.className = 'sb-chip';
      chip.title = w.definition || w.text;

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

      chip.addEventListener('click', () => setFocusWord(w.syllables));
      wordsEl.appendChild(chip);
    }

    // Translation line
    const trans = document.createElement('span');
    trans.className = 'sb-translation';
    trans.textContent = committedWords.map(w => {
      const d = w.definition;
      return d ? d.split(',')[0].split(';')[0].trim() : w.text;
    }).join(' ');
    wordsEl.appendChild(trans);

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

    actionsEl.append(playBtn, undoBtn, clearBtn);
  }

  // Listen for changes
  on('word:commit', render);
  on('word:undo', render);
  on('sentence:clear', render);

  render();
}
