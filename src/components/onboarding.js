import { NOTES, NOTE_COLORS } from '../utils/constants.js';
import { playNote, playWord } from '../audio/synth.js';
import { getColor, translate } from '../utils/solresol.js';
import { SolresolWord } from '../models/word.js';
import { createWordRenderer } from './word-renderer.js';
import { buildingWord, commitBuildingWord } from '../state/focus-word.js';
import { on } from '../utils/events.js';
import { displaySyllable } from '../utils/format.js';

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
      <button class="btn btn--sm onboard-skip" id="onboard-skip">Skip intro</button>
    </section>
  `;

  const stage = container.querySelector('#onboard-stage');
  const skipBtn = container.querySelector('#onboard-skip');

  skipBtn.addEventListener('click', finish);

  const steps = [
    // Step 0: Welcome — click unlocks AudioContext, then user plays immediately
    () => {
      stage.innerHTML = `
        <h2 class="onboard-title">Welcome to Solresol</h2>
        <p class="onboard-subtitle">A language made entirely of music</p>
        <p class="onboard-hint">Press any three keys: <kbd>1</kbd>\u2013<kbd>7</kbd> on your keyboard, or use the colored keys above</p>
        <button class="btn btn--sm onboard-play-btn" id="onboard-unlock" style="opacity:0.5">or click here to enable audio first</button>
        <div id="onboard-live" style="min-height:100px;display:flex;flex-direction:column;align-items:center;justify-content:center;margin:1rem 0"></div>
        <p class="onboard-hint" id="onboard-hint" style="min-height:1.5em"></p>
      `;

      // Silent click to unlock AudioContext
      stage.querySelector('#onboard-unlock').addEventListener('click', () => {
        playNote('do', { duration: 0.01, gain: 0 });
        stage.querySelector('#onboard-unlock').style.display = 'none';
      });

      const liveEl = stage.querySelector('#onboard-live');
      const hintEl = stage.querySelector('#onboard-hint');
      let renderer = null;
      let noteCount = 0;
      let revealed = false;

      const unsub = buildingWord.onChange(() => {
        if (renderer) renderer.destroy();
        liveEl.innerHTML = '';
        if (buildingWord.isEmpty) return;

        renderer = createWordRenderer(buildingWord, {
          size: 'lg',
          showSheet: false,
          showDefinition: false, // don't show yet — reveal it
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
        if (noteCount === 2) hintEl.textContent = 'One more...';
        if (noteCount >= 3 && !revealed) {
          revealed = true;
          // Reveal: the notes they played ARE a word
          const def = buildingWord.definition;
          const text = buildingWord.text;

          if (def) {
            hintEl.innerHTML = `You just played <strong>${text}</strong> \u2014 it means: <em>"${def}"</em>`;
          } else {
            hintEl.innerHTML = `You played <strong>${text}</strong> \u2014 a valid Solresol word! Not all are in the dictionary yet.`;
          }
          hintEl.style.transition = 'color 0.3s';
          hintEl.style.color = 'var(--accent)';

          setTimeout(() => {
            if (!stage.querySelector('.onboard-next')) {
              const nextBtn = document.createElement('button');
              nextBtn.className = 'btn onboard-next';
              nextBtn.textContent = 'Next \u2192';
              nextBtn.addEventListener('click', nextStep);
              stage.appendChild(nextBtn);
            }
          }, 1200);
        }
      });

      cleanup = () => { unsub(); unsubPlay(); if (renderer) renderer.destroy(); };
    },

    // Step 1: Play more — every combination is a word
    () => {
      // Clear building word so they start fresh
      buildingWord.clear();

      stage.innerHTML = `
        <h2 class="onboard-title">Every combination is a word</h2>
        <p class="onboard-subtitle">Try different notes \u2014 watch the meaning change</p>
        <div id="onboard-live" style="min-height:100px;display:flex;flex-direction:column;align-items:center;justify-content:center;margin:1rem 0"></div>
        <p class="onboard-hint" id="onboard-hint"></p>
      `;

      const liveEl = stage.querySelector('#onboard-live');
      const hintEl = stage.querySelector('#onboard-hint');
      let renderer = null;
      let wordsPlayed = 0;

      const unsub = buildingWord.onChange(() => {
        if (renderer) renderer.destroy();
        liveEl.innerHTML = '';
        if (buildingWord.isEmpty) return;

        renderer = createWordRenderer(buildingWord, {
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

      const unsubCommit = on('word:commit', () => {
        wordsPlayed++;
        if (wordsPlayed === 1) hintEl.textContent = 'Press Enter to commit, then play another!';
        if (wordsPlayed >= 2 && !stage.querySelector('.onboard-next')) {
          hintEl.textContent = '7 notes, 3,152 words \u2014 a whole language from music.';
          setTimeout(() => {
            const nextBtn = document.createElement('button');
            nextBtn.className = 'btn onboard-next';
            nextBtn.textContent = 'Next \u2192';
            nextBtn.addEventListener('click', nextStep);
            stage.appendChild(nextBtn);
          }, 600);
        }
      });

      const unsubPlay = on('syllable:play', () => {
        if (wordsPlayed === 0 && buildingWord.length >= 2) {
          hintEl.textContent = 'Press Enter to commit this word, then try another combination.';
        }
      });

      cleanup = () => { unsub(); unsubCommit(); unsubPlay(); if (renderer) renderer.destroy(); };
    },

    // Step 2: Seven representations + antonym flip
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
