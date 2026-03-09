import { NOTES, NOTE_COLORS } from '../utils/constants.js';
import { playNote, playWord } from '../audio/synth.js';
import { getColor, translate } from '../utils/solresol.js';
import { SolresolWord } from '../models/word.js';
import { createWordRenderer } from './word-renderer.js';
import { focusWord, commitFocusWord } from '../state/focus-word.js';
import { on } from '../utils/events.js';

const ONBOARD_KEY = 'solresol:onboarded';

export function hasOnboarded() {
  try { return localStorage.getItem(ONBOARD_KEY) === 'true'; } catch { return false; }
}

/**
 * Guided first experience — hear melody, realize it's a word, play your own.
 * Returns a cleanup function.
 */
export function renderOnboarding(container, onComplete) {
  let step = 0;
  let cleanup = null;

  container.innerHTML = `
    <section class="onboard">
      <div class="onboard-stage" id="onboard-stage"></div>
      <div class="onboard-nav">
        <button class="btn btn--sm onboard-skip" id="onboard-skip">Skip intro</button>
      </div>
    </section>
  `;

  const stage = container.querySelector('#onboard-stage');
  const skipBtn = container.querySelector('#onboard-skip');

  skipBtn.addEventListener('click', finish);

  const steps = [
    // Step 0: Hear this melody
    () => {
      stage.innerHTML = `
        <h2 class="onboard-title">Listen to this melody</h2>
        <div class="onboard-blocks" id="onboard-blocks"></div>
        <p class="onboard-subtitle" id="onboard-sub" style="opacity:0">That was a <em>word</em>.</p>
      `;
      const blocksEl = stage.querySelector('#onboard-blocks');
      const subEl = stage.querySelector('#onboard-sub');
      const word = ['do', 're', 'mi'];

      // Play notes one by one with visual blocks appearing
      let i = 0;
      const interval = setInterval(() => {
        if (i >= word.length) {
          clearInterval(interval);
          // Reveal it's a word
          setTimeout(() => {
            subEl.style.opacity = '1';
            subEl.style.transition = 'opacity 0.6s';
            const def = translate('Doremi');
            if (def) {
              const defEl = document.createElement('p');
              defEl.className = 'onboard-def';
              defEl.textContent = `"DoReMi" means: ${def}`;
              stage.appendChild(defEl);
            }
            setTimeout(() => {
              const nextBtn = document.createElement('button');
              nextBtn.className = 'btn onboard-next';
              nextBtn.textContent = 'Next \u2192';
              nextBtn.addEventListener('click', nextStep);
              stage.appendChild(nextBtn);
            }, 800);
          }, 600);
          return;
        }

        const syl = word[i];
        playNote(syl, { duration: 0.5 });

        const block = document.createElement('div');
        block.className = 'onboard-block';
        block.style.backgroundColor = getColor(syl);
        block.textContent = syl.charAt(0).toUpperCase() + syl.slice(1);
        block.style.animation = 'onboard-pop 0.3s ease-out';
        blocksEl.appendChild(block);

        i++;
      }, 500);

      cleanup = () => clearInterval(interval);
    },

    // Step 1: Now you play
    () => {
      stage.innerHTML = `
        <h2 class="onboard-title">Now you play</h2>
        <p class="onboard-subtitle">Press keys <kbd>1</kbd>\u2013<kbd>7</kbd> on your keyboard, or use the colored keys above</p>
        <div id="onboard-live" style="min-height:80px;display:flex;align-items:center;justify-content:center;margin:1rem 0"></div>
        <p class="onboard-hint" id="onboard-hint">Try pressing a few notes...</p>
      `;

      const liveEl = stage.querySelector('#onboard-live');
      const hintEl = stage.querySelector('#onboard-hint');
      let renderer = null;
      let noteCount = 0;

      const unsub = focusWord.onChange(() => {
        if (renderer) renderer.destroy();
        liveEl.innerHTML = '';
        if (focusWord.isEmpty) return;

        renderer = createWordRenderer(focusWord, {
          size: 'lg',
          showSheet: false,
          showDefinition: true,
          showMirror: false,
          reactive: false,
          notations: new Set(['colors']),
          clickToFocus: false,
        });
        liveEl.appendChild(renderer.el);
      });

      const unsubPlay = on('syllable:play', () => {
        noteCount++;
        if (noteCount === 1) hintEl.textContent = 'Keep going...';
        if (noteCount >= 3) {
          hintEl.textContent = 'Every combination of notes is a word!';
          if (!stage.querySelector('.onboard-next')) {
            setTimeout(() => {
              const nextBtn = document.createElement('button');
              nextBtn.className = 'btn onboard-next';
              nextBtn.textContent = 'Next \u2192';
              nextBtn.addEventListener('click', nextStep);
              stage.appendChild(nextBtn);
            }, 600);
          }
        }
      });

      cleanup = () => { unsub(); unsubPlay(); if (renderer) renderer.destroy(); };
    },

    // Step 2: Seven representations
    () => {
      stage.innerHTML = `
        <h2 class="onboard-title">Colors are sounds are numbers</h2>
        <p class="onboard-subtitle">Every word exists simultaneously as color, music, number, binary, braille, and more</p>
        <div id="onboard-all" style="margin:1rem 0"></div>
      `;

      const allEl = stage.querySelector('#onboard-all');
      const word = new SolresolWord(['fa', 'la']);
      const wr = createWordRenderer(word, {
        size: 'lg',
        showSheet: true,
        showDefinition: true,
        showReverse: true,
        showMirror: true,
        reactive: true,
        clickToFocus: false,
        notations: new Set(['colors', 'solfege', 'numbers', 'binary', 'braille', 'ascii', 'sauso']),
      });
      allEl.appendChild(wr.el);

      const hint = document.createElement('p');
      hint.className = 'onboard-hint';
      hint.textContent = 'Try clicking \u21C4 Reverse \u2014 the meaning flips!';
      stage.appendChild(hint);

      setTimeout(() => {
        const nextBtn = document.createElement('button');
        nextBtn.className = 'btn onboard-next';
        nextBtn.textContent = 'Start exploring \u2192';
        nextBtn.addEventListener('click', finish);
        stage.appendChild(nextBtn);
      }, 1000);

      cleanup = () => wr.destroy();
    },
  ];

  function nextStep() {
    if (cleanup) { cleanup(); cleanup = null; }
    step++;
    if (step < steps.length) {
      steps[step]();
    } else {
      finish();
    }
  }

  function finish() {
    if (cleanup) { cleanup(); cleanup = null; }
    try { localStorage.setItem(ONBOARD_KEY, 'true'); } catch {}
    onComplete();
  }

  // Start
  steps[0]();

  return () => {
    if (cleanup) { cleanup(); cleanup = null; }
  };
}
