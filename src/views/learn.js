import { NOTES } from '../utils/constants.js';
import { getColor, getFrequency, translate, parseWord, getAllEntries } from '../utils/solresol.js';
import { createWordBlocks } from '../components/color-block.js';
import { SolresolWord } from '../models/word.js';
import { createWordRenderer } from '../components/word-renderer.js';
import { playNote, playWord } from '../audio/synth.js';
import { getSyllableNotations } from '../utils/notation.js';
import { SEMANTIC_CATEGORIES, getSemanticCategory } from '../utils/grammar.js';
import { getAntonym } from '../utils/antonyms.js';
import { captureKeyboard, releaseKeyboard } from '../components/global-keyboard.js';
import { setFocusWord } from '../state/focus-word.js';

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Learn view — merges Reference (study) + Quiz into one view.
 */
export function renderLearn(container) {
  container.innerHTML = `
    <section class="view learn-view">
      <h2>Learn</h2>
      <div class="learn-modes">
        <button class="btn btn--active" data-mode="study">Study</button>
        <button class="btn" data-mode="quiz">Quiz</button>
      </div>

      <div id="learn-study" class="learn-section"></div>
      <div id="learn-quiz" class="learn-section" style="display:none"></div>
    </section>
  `;

  const studySection = container.querySelector('#learn-study');
  const quizSection = container.querySelector('#learn-quiz');
  const modeBtns = container.querySelectorAll('[data-mode]');
  let mode = 'study';

  modeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      mode = btn.dataset.mode;
      modeBtns.forEach(b => b.classList.remove('btn--active'));
      btn.classList.add('btn--active');
      studySection.style.display = mode === 'study' ? '' : 'none';
      quizSection.style.display = mode === 'quiz' ? '' : 'none';
      if (mode === 'quiz' && !quizInitialized) initQuiz();
      if (mode === 'quiz') captureKeyboard(quizKeyHandler);
      else releaseKeyboard();
    });
  });

  // =====================
  // STUDY MODE (reference)
  // =====================
  renderStudy(studySection);

  // =====================
  // QUIZ MODE
  // =====================
  let quizInitialized = false;
  let quizKeyHandler = null;
  let quizCleanup = null;

  function initQuiz() {
    quizInitialized = true;
    renderQuiz(quizSection, (handler) => {
      quizKeyHandler = handler;
      captureKeyboard(handler);
    });
  }

  // Cleanup — release keyboard and stop quiz timers
  function cleanup() {
    releaseKeyboard();
    if (quizCleanup) quizCleanup();
  }

  // Return cleanup function for router
  // (called when navigating away from Learn view)
  const _cleanup = () => cleanup();
  // We need to return this at the end, store for now

  function renderStudy(el) {
    el.innerHTML = `
      <article class="ref-section">
        <h3>What is Solresol?</h3>
        <p>Solresol is a constructed language devised by French musician
        <strong>Jean-Fran&ccedil;ois Sudre</strong> beginning in 1827. It is the
        first artificial language to gain any significant popularity. The language is
        built entirely from the seven musical notes of the solfege scale:
        <strong>Do, Re, Mi, Fa, Sol, La, Si</strong>.</p>
        <p>Because it is based on music, Solresol can be communicated by speaking,
        singing, playing an instrument, writing in colors, using hand signs, or
        even with numbers (1&ndash;7).</p>
      </article>

      <article class="ref-section">
        <h3>The Seven Notes</h3>
        <p style="font-size:0.85rem;color:var(--text-dim);margin-bottom:0.5rem">Click any note to hear it:</p>
        <div id="ref-notes" class="ref-notes-grid"></div>
      </article>

      <article class="ref-section">
        <h3>Communication Modes — Live Demo</h3>
        <p style="font-size:0.85rem;color:var(--text-dim);margin-bottom:0.5rem">Type a Solresol word to see it in all modes simultaneously:</p>
        <input type="text" id="ref-modes-input" class="input" style="max-width:300px;margin-bottom:0.75rem"
               placeholder="e.g. fala, misol, doredo..." autocomplete="off">
        <div id="ref-modes-demo"></div>
      </article>

      <article class="ref-section">
        <h3>Grammar Rules</h3>
        <h4>Word Length &amp; Parts of Speech</h4>
        <ul>
          <li><strong>1 syllable</strong> &mdash; Particles (do = no, re = and/or, mi = or, etc.)</li>
          <li><strong>2 syllables</strong> &mdash; Pronouns, articles, common particles</li>
          <li><strong>3 syllables</strong> &mdash; Common everyday words</li>
          <li><strong>4 syllables</strong> &mdash; Most of the vocabulary</li>
          <li><strong>5 syllables</strong> &mdash; Specialized/extended vocabulary</li>
        </ul>

        <h4>Stress &amp; Parts of Speech</h4>
        <p>The <strong>stress position</strong> on a word changes its grammatical role:</p>
        <ul>
          <li>No stress (default) &rarr; <strong>Noun</strong></li>
          <li>Stress on <strong>last syllable</strong> &rarr; Adjective</li>
          <li>Stress on <strong>penultimate syllable</strong> &rarr; Verb</li>
          <li>Stress on <strong>antepenultimate syllable</strong> &rarr; Adverb</li>
        </ul>

        <h4>Antonyms by Reversal — Try It</h4>
        <p>Reversing a word produces its opposite meaning. Click ⇄ to flip:</p>
        <div id="ref-antonym-demo" style="display:flex;justify-content:center;margin:0.75rem 0"></div>

        <h4>Gender</h4>
        <p>Feminine forms are indicated by adding an accent or lengthening the final syllable.</p>

        <h4>Tense</h4>
        <ul>
          <li>Past tense &mdash; prefix with <strong>Dodo</strong></li>
          <li>Future tense &mdash; prefix with <strong>Mimi</strong></li>
          <li>Conditional &mdash; prefix with <strong>Fafa</strong></li>
          <li>Imperative &mdash; prefix with <strong>Solsol</strong></li>
        </ul>
      </article>

      <article class="ref-section">
        <h3>History</h3>
        <p>Sudre developed Solresol over several decades, presenting it to the
        Institut de France and eventually receiving recognition at the 1855 World
        Exposition in Paris. The language was further documented by Boleslav Gajewski
        in his 1902 grammar.</p>
        <p>Solresol predates Esperanto (1887) by over 50 years, making it one of the
        earliest constructed languages in modern history.</p>
      </article>
    `;

    // --- Interactive notes grid ---
    const notesGrid = el.querySelector('#ref-notes');
    for (const note of NOTES) {
      const card = document.createElement('div');
      card.className = 'ref-note-card';
      card.style.borderLeftColor = getColor(note);

      const num = NOTES.indexOf(note) + 1;
      const freq = getFrequency(note).toFixed(1);
      const notData = getSyllableNotations(note);

      card.innerHTML = `
        <div class="ref-note-name" style="color: ${getColor(note)}">
          ${note.charAt(0).toUpperCase() + note.slice(1)}
        </div>
        <div class="ref-note-detail">Number: ${num}</div>
        <div class="ref-note-detail">${freq} Hz</div>
        <div class="ref-note-detail" style="font-family:monospace">${notData.binary} | ${notData.braille} | ${notData.ascii}</div>
      `;

      card.style.cursor = 'pointer';
      card.setAttribute('role', 'button');
      card.setAttribute('tabindex', '0');
      card.setAttribute('aria-label', `Play ${note}`);
      card.addEventListener('click', () => playNote(note, { duration: 0.6 }));
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          playNote(note, { duration: 0.6 });
        }
      });
      notesGrid.appendChild(card);
    }

    // --- Live communication modes demo ---
    const modesInput = el.querySelector('#ref-modes-input');
    const modesDemo = el.querySelector('#ref-modes-demo');
    let modesRenderer = null;

    function updateModes() {
      modesDemo.innerHTML = '';
      if (modesRenderer) { modesRenderer.destroy(); modesRenderer = null; }

      const q = modesInput.value.trim();
      if (!q) return;

      const syls = parseWord(q);
      if (syls.length === 0) return;

      const word = new SolresolWord(syls);
      modesRenderer = createWordRenderer(word, {
        size: 'lg',
        showSheet: true,
        showDefinition: true,
        showReverse: word.length >= 2,
        reactive: true,
        clickToFocus: true,
        notations: new Set(['colors', 'solfege', 'numbers', 'binary', 'braille', 'ascii', 'sauso']),
      });
      modesDemo.appendChild(modesRenderer.el);
    }

    let modesDebounce;
    modesInput.addEventListener('input', () => {
      clearTimeout(modesDebounce);
      modesDebounce = setTimeout(updateModes, 150);
    });

    modesInput.value = 'fala';
    updateModes();

    // --- Antonym reversal demo ---
    const antonymDemo = el.querySelector('#ref-antonym-demo');
    const antWord = new SolresolWord(['fa', 'la']);
    const antRenderer = createWordRenderer(antWord, {
      size: 'lg',
      showSheet: true,
      showDefinition: true,
      showReverse: true,
      reactive: true,
      clickToFocus: true,
      notations: new Set(['colors', 'solfege', 'numbers']),
    });
    antonymDemo.appendChild(antRenderer.el);
  }

  function renderQuiz(el, onCapture) {
    el.innerHTML = `
      <div class="quiz-inner">
        <div class="quiz-mode-select">
          <button class="btn btn--active" data-qmode="note">Ear Training</button>
          <button class="btn" data-qmode="word">Word Building</button>
          <button class="btn" data-qmode="category">Categories</button>
          <button class="btn" data-qmode="antonym">Antonyms</button>
          <button class="btn" data-qmode="translate">Translation</button>
        </div>
        <div id="quiz-area" class="quiz-area"></div>
        <div class="quiz-score">
          Score: <span id="quiz-score">0</span> |
          Streak: <span id="quiz-streak">0</span>
        </div>
      </div>
    `;

    const area = el.querySelector('#quiz-area');
    const scoreEl = el.querySelector('#quiz-score');
    const streakEl = el.querySelector('#quiz-streak');
    const qmodeBtns = el.querySelectorAll('[data-qmode]');
    let qmode = 'note';
    let score = (() => { try { return parseInt(localStorage.getItem('solresol:quiz-score')) || 0; } catch { return 0; } })();
    let streak = 0;
    scoreEl.textContent = score;
    let roundCleanup = null;
    let roundTimer = null;
    let currentKeyHandler = null;

    qmodeBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        qmode = btn.dataset.qmode;
        qmodeBtns.forEach(b => b.classList.remove('btn--active'));
        btn.classList.add('btn--active');
        startRound();
      });
    });

    function updateScore(correct) {
      if (correct) { score++; streak++; }
      else { streak = 0; }
      scoreEl.textContent = score;
      streakEl.textContent = streak;
      try { localStorage.setItem('solresol:quiz-score', score); } catch {}
    }

    function pickRandom(arr) {
      return arr[Math.floor(Math.random() * arr.length)];
    }

    function setKeyHandler(handler) {
      currentKeyHandler = handler;
      onCapture((e) => {
        if (currentKeyHandler) currentKeyHandler(e);
      });
    }

    function startRound() {
      if (roundCleanup) { roundCleanup(); roundCleanup = null; }
      clearTimeout(roundTimer);

      area.style.opacity = '0';
      setTimeout(() => {
        if (qmode === 'note') noteRound();
        else if (qmode === 'word') wordRound();
        else if (qmode === 'category') categoryRound();
        else if (qmode === 'antonym') antonymRound();
        else translateRound();
        area.style.opacity = '1';
      }, 150);
    }

    function nextRound(delay) {
      roundTimer = setTimeout(startRound, delay);
    }

    // --- Note Recognition ---
    function noteRound() {
      const target = pickRandom(NOTES);
      area.innerHTML = `
        <p class="quiz-prompt">Listen and identify the note:</p>
        <p class="quiz-hint">Press keys 1–7 or click a button</p>
        <button class="btn btn--lg" id="quiz-play-note">&#9654; Play</button>
        <div class="quiz-options" id="quiz-options"></div>
        <div id="quiz-feedback" class="quiz-feedback" aria-live="polite"></div>
      `;

      area.querySelector('#quiz-play-note').addEventListener('click', () => {
        playNote(target, { duration: 0.8 });
      });

      const optionsEl = area.querySelector('#quiz-options');
      for (const note of NOTES) {
        const btn = document.createElement('button');
        btn.className = 'btn note-btn';
        btn.style.borderBottomColor = getColor(note);
        btn.textContent = note.charAt(0).toUpperCase() + note.slice(1);
        btn.addEventListener('click', () => handleAnswer(note));
        optionsEl.appendChild(btn);
      }

      const feedback = area.querySelector('#quiz-feedback');
      let answered = false;

      function handleAnswer(chosen) {
        if (answered) return;
        answered = true;
        const correct = chosen === target;
        updateScore(correct);
        feedback.textContent = correct
          ? 'Correct!'
          : `Wrong — it was ${target.charAt(0).toUpperCase() + target.slice(1)}`;
        feedback.className = `quiz-feedback ${correct ? 'correct' : 'wrong'}`;

        optionsEl.querySelectorAll('.note-btn').forEach(b => {
          if (b.textContent.toLowerCase() === target) b.classList.add('btn--correct');
          b.disabled = true;
        });

        nextRound(1500);
      }

      setKeyHandler((e) => {
        const n = Number(e.key);
        if (n >= 1 && n <= 7) { e.preventDefault(); handleAnswer(NOTES[n - 1]); }
      });

      setTimeout(() => playNote(target, { duration: 0.8 }), 300);
    }

    // --- Word Building ---
    function wordRound() {
      const entries = getAllEntries().filter(e => e.syllables >= 2 && e.syllables <= 4 && e.definition);
      if (entries.length === 0) {
        area.innerHTML = '<p class="no-results">No entries available</p>';
        return;
      }
      const entry = pickRandom(entries);
      const syllables = parseWord(entry.solresol);

      area.innerHTML = `
        <p class="quiz-prompt">Listen and build the word:</p>
        <p class="quiz-hint">Press keys 1–7 to add notes, Enter to submit, Backspace to clear</p>
        <button class="btn btn--lg" id="quiz-play-word">&#9654; Play</button>
        <div class="quiz-built" id="quiz-built"></div>
        <div class="quiz-options" id="quiz-options"></div>
        <div class="quiz-actions">
          <button class="btn btn--sm" id="quiz-clear">Clear</button>
          <button class="btn btn--sm" id="quiz-submit">Submit</button>
        </div>
        <div id="quiz-feedback" class="quiz-feedback" aria-live="polite"></div>
      `;

      const builtEl = area.querySelector('#quiz-built');
      const feedback = area.querySelector('#quiz-feedback');
      let built = [];
      let answered = false;

      area.querySelector('#quiz-play-word').addEventListener('click', () => playWord(syllables));
      area.querySelector('#quiz-clear').addEventListener('click', () => { built = []; builtEl.innerHTML = ''; });

      const optionsEl = area.querySelector('#quiz-options');
      for (const note of NOTES) {
        const btn = document.createElement('button');
        btn.className = 'btn note-btn';
        btn.style.borderBottomColor = getColor(note);
        btn.textContent = note.charAt(0).toUpperCase() + note.slice(1);
        btn.addEventListener('click', () => addNote(note));
        optionsEl.appendChild(btn);
      }

      function addNote(note) {
        if (answered) return;
        playNote(note, { duration: 0.3 });
        built.push(note);
        builtEl.innerHTML = '';
        builtEl.appendChild(createWordBlocks(built, { size: 'sm' }));
      }

      function submit() {
        if (answered || built.length === 0) return;
        answered = true;
        const correct = built.length === syllables.length && built.every((s, i) => s === syllables[i]);
        updateScore(correct);

        const word = new SolresolWord(entry.solresol);
        const wr = createWordRenderer(word, {
          size: 'md', showSheet: false, showDefinition: true, reactive: false,
          clickToFocus: true,
          notations: new Set(['colors']),
        });

        feedback.textContent = correct
          ? `Correct! "${entry.definition}"`
          : `Wrong — it was ${entry.solresol} (${entry.definition})`;
        feedback.className = `quiz-feedback ${correct ? 'correct' : 'wrong'}`;
        feedback.appendChild(wr.el);

        nextRound(2500);
      }

      area.querySelector('#quiz-submit').addEventListener('click', submit);

      setKeyHandler((e) => {
        const n = Number(e.key);
        if (n >= 1 && n <= 7) { e.preventDefault(); addNote(NOTES[n - 1]); }
        else if (e.key === 'Enter') { e.preventDefault(); submit(); }
        else if (e.key === 'Backspace') { e.preventDefault(); built = []; builtEl.innerHTML = ''; }
      });

      setTimeout(() => playWord(syllables), 300);
    }

    // --- Category Quiz ---
    function categoryRound() {
      const entries = getAllEntries().filter(e => e.syllables >= 2 && e.definition);
      if (entries.length < 4) { area.innerHTML = '<p class="no-results">Not enough entries</p>'; return; }

      const entry = pickRandom(entries);
      const syls = parseWord(entry.solresol);
      const correctNote = syls[0];
      const correctCategory = SEMANTIC_CATEGORIES[correctNote];

      area.innerHTML = `
        <p class="quiz-prompt">Which semantic family does this word belong to?</p>
        <div id="quiz-word-display" style="margin:0.75rem 0"></div>
        <p class="quiz-hint">The first syllable determines the category</p>
        <div class="quiz-options quiz-options--col" id="quiz-options"></div>
        <div id="quiz-feedback" class="quiz-feedback" aria-live="polite"></div>
      `;

      const wordDisplay = area.querySelector('#quiz-word-display');
      const word = new SolresolWord(entry.solresol);
      const wr = createWordRenderer(word, {
        size: 'md', showSheet: false, showDefinition: false, reactive: false,
        clickToFocus: true,
        notations: new Set(['colors']),
      });
      wordDisplay.appendChild(wr.el);

      const optionsEl = area.querySelector('#quiz-options');
      const feedback = area.querySelector('#quiz-feedback');
      let answered = false;

      const noteOrder = shuffle([...NOTES]);
      noteOrder.forEach((note, idx) => {
        const cat = SEMANTIC_CATEGORIES[note];
        const btn = document.createElement('button');
        btn.className = 'btn quiz-choice';
        btn.style.borderLeft = `4px solid ${cat.color}`;
        btn.style.textAlign = 'left';

        const numSpan = document.createElement('span');
        numSpan.className = 'quiz-choice-num';
        numSpan.textContent = idx + 1;

        const labelSpan = document.createElement('span');
        labelSpan.textContent = cat.label;

        btn.append(numSpan, labelSpan);
        btn.addEventListener('click', () => handleChoice(note, btn));
        optionsEl.appendChild(btn);
      });

      function handleChoice(note, btn) {
        if (answered) return;
        answered = true;
        const correct = note === correctNote;
        updateScore(correct);

        if (correct) {
          btn.classList.add('btn--correct');
          feedback.textContent = `Correct! Words starting with ${correctNote.charAt(0).toUpperCase() + correctNote.slice(1)} are in the "${correctCategory.label}" family.`;
          feedback.className = 'quiz-feedback correct';
        } else {
          btn.classList.add('btn--wrong');
          feedback.textContent = `Wrong — ${entry.solresol} starts with ${correctNote.charAt(0).toUpperCase() + correctNote.slice(1)}: "${correctCategory.label}"`;
          feedback.className = 'quiz-feedback wrong';
          optionsEl.querySelectorAll('.quiz-choice').forEach(b => {
            if (b.querySelector('.quiz-choice-num')?.nextElementSibling?.textContent === correctCategory.label) {
              b.classList.add('btn--correct');
            }
          });
        }

        playWord(syls);
        nextRound(2500);
      }

      setKeyHandler((e) => {
        const n = Number(e.key);
        if (n >= 1 && n <= noteOrder.length) {
          e.preventDefault();
          const note = noteOrder[n - 1];
          const btn = optionsEl.querySelectorAll('.quiz-choice')[n - 1];
          handleChoice(note, btn);
        }
      });
    }

    // --- Antonym Quiz ---
    function antonymRound() {
      const entries = getAllEntries().filter(e => {
        if (e.syllables < 2 || !e.definition) return false;
        return getAntonym(e.solresol) !== null;
      });
      if (entries.length < 4) { area.innerHTML = '<p class="no-results">Not enough entries with antonyms</p>'; return; }

      const entry = pickRandom(entries);
      const syls = parseWord(entry.solresol);
      const antonymWord = getAntonym(entry.solresol);
      const antonymDef = translate(antonymWord) || '?';

      area.innerHTML = `
        <p class="quiz-prompt">What is the antonym of this word?</p>
        <p class="quiz-hint">Reverse the syllables to find the opposite!</p>
        <div id="quiz-word-display" style="margin:0.75rem 0"></div>
        <p style="color:var(--text-dim);font-size:0.9rem;margin-bottom:0.5rem">"${entry.definition}"</p>
        <p class="quiz-hint">Play the syllables in reverse order using keys 1–7, then press Enter</p>
        <div class="quiz-built" id="quiz-built"></div>
        <div class="quiz-options" id="quiz-options"></div>
        <div class="quiz-actions">
          <button class="btn btn--sm" id="quiz-clear">Clear</button>
          <button class="btn btn--sm" id="quiz-submit">Submit</button>
        </div>
        <div id="quiz-feedback" class="quiz-feedback" aria-live="polite"></div>
      `;

      const wordDisplay = area.querySelector('#quiz-word-display');
      const word = new SolresolWord(entry.solresol);
      const wr = createWordRenderer(word, {
        size: 'md', showSheet: false, showDefinition: false, reactive: false,
        clickToFocus: true,
        notations: new Set(['colors']),
      });
      wordDisplay.appendChild(wr.el);

      const builtEl = area.querySelector('#quiz-built');
      const feedback = area.querySelector('#quiz-feedback');
      let built = [];
      let answered = false;

      const optionsEl = area.querySelector('#quiz-options');
      for (const note of NOTES) {
        const btn = document.createElement('button');
        btn.className = 'btn note-btn';
        btn.style.borderBottomColor = getColor(note);
        btn.textContent = note.charAt(0).toUpperCase() + note.slice(1);
        btn.addEventListener('click', () => addNote(note));
        optionsEl.appendChild(btn);
      }

      function addNote(note) {
        if (answered) return;
        playNote(note, { duration: 0.3 });
        built.push(note);
        builtEl.innerHTML = '';
        builtEl.appendChild(createWordBlocks(built, { size: 'sm' }));
      }

      function submit() {
        if (answered || built.length === 0) return;
        answered = true;

        const reversedSyls = [...syls].reverse();
        const correct = built.length === reversedSyls.length && built.every((s, i) => s === reversedSyls[i]);
        updateScore(correct);

        const antWord = new SolresolWord(antonymWord);
        const antWr = createWordRenderer(antWord, {
          size: 'md', showSheet: false, showDefinition: true, reactive: false,
          clickToFocus: true,
          notations: new Set(['colors']),
        });

        if (correct) {
          feedback.textContent = `Correct! ${entry.solresol} (${entry.definition}) ↔ ${antonymWord} (${antonymDef})`;
          feedback.className = 'quiz-feedback correct';
        } else {
          feedback.textContent = `The reverse is ${antonymWord} (${antonymDef})`;
          feedback.className = 'quiz-feedback wrong';
        }
        feedback.appendChild(antWr.el);
        playWord(reversedSyls);

        nextRound(3000);
      }

      area.querySelector('#quiz-clear').addEventListener('click', () => { built = []; builtEl.innerHTML = ''; });
      area.querySelector('#quiz-submit').addEventListener('click', submit);

      setKeyHandler((e) => {
        const n = Number(e.key);
        if (n >= 1 && n <= 7) { e.preventDefault(); addNote(NOTES[n - 1]); }
        else if (e.key === 'Enter') { e.preventDefault(); submit(); }
        else if (e.key === 'Backspace') { e.preventDefault(); built = []; builtEl.innerHTML = ''; }
      });
    }

    // --- Translation Quiz ---
    function translateRound() {
      const entries = getAllEntries().filter(e => e.definition && e.syllables >= 2);
      if (entries.length < 4) {
        area.innerHTML = '<p class="no-results">Not enough entries for this mode</p>';
        return;
      }

      const correct = pickRandom(entries);
      const wrongs = [];
      let safety = 0;
      while (wrongs.length < 3 && safety < 100) {
        const w = pickRandom(entries);
        if (w !== correct && !wrongs.includes(w)) wrongs.push(w);
        safety++;
      }

      const options = shuffle([correct, ...wrongs]);

      area.innerHTML = `
        <p class="quiz-prompt">Which Solresol word means:</p>
        <p class="quiz-target-word">"${correct.definition}"</p>
        <div class="quiz-options" id="quiz-options"></div>
        <div id="quiz-feedback" class="quiz-feedback" aria-live="polite"></div>
      `;

      const optionsEl = area.querySelector('#quiz-options');
      const feedback = area.querySelector('#quiz-feedback');
      let answered = false;

      options.forEach((opt, idx) => {
        const btn = document.createElement('button');
        btn.className = 'btn quiz-choice';
        const syls = parseWord(opt.solresol);

        const numLabel = document.createElement('span');
        numLabel.className = 'quiz-choice-num';
        numLabel.textContent = idx + 1;

        const label = document.createElement('span');
        label.textContent = opt.solresol;

        btn.appendChild(numLabel);
        btn.appendChild(label);
        btn.appendChild(createWordBlocks(syls, { size: 'sm', showLabel: false }));

        btn.addEventListener('click', () => handleChoice(opt, btn, syls));
        optionsEl.appendChild(btn);
      });

      function handleChoice(opt, btn, syls) {
        if (answered) return;
        answered = true;
        const isCorrect = opt === correct;
        updateScore(isCorrect);

        if (isCorrect) {
          btn.classList.add('btn--correct');
          feedback.textContent = 'Correct!';
          feedback.className = 'quiz-feedback correct';
          playWord(syls);
        } else {
          btn.classList.add('btn--wrong');
          feedback.textContent = `Wrong — it was ${correct.solresol}`;
          feedback.className = 'quiz-feedback wrong';
          optionsEl.querySelectorAll('.quiz-choice').forEach(b => {
            if (b.querySelector('span:nth-child(2)')?.textContent === correct.solresol) {
              b.classList.add('btn--correct');
            }
          });
        }

        nextRound(2000);
      }

      setKeyHandler((e) => {
        const n = Number(e.key);
        if (n >= 1 && n <= options.length) {
          e.preventDefault();
          const opt = options[n - 1];
          const btn = optionsEl.querySelectorAll('.quiz-choice')[n - 1];
          const syls = parseWord(opt.solresol);
          handleChoice(opt, btn, syls);
        }
      });
    }

    startRound();

    quizCleanup = () => {
      if (roundCleanup) roundCleanup();
      clearTimeout(roundTimer);
    };
  }

  return _cleanup;
}
