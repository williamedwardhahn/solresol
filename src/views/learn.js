import { NOTES } from '../utils/constants.js';
import { getColor, getFrequency, translate, parseWord, getAllEntries } from '../utils/solresol.js';
import { createWordBlocks } from '../components/color-block.js';
import { SolresolWord } from '../models/word.js';
import { createWordRenderer } from '../components/word-renderer.js';
import { playNote, playWord } from '../audio/synth.js';
import { getSyllableNotations } from '../utils/notation.js';
import { SEMANTIC_CATEGORIES, getSemanticCategory, STRESS_RULES, stressParams } from '../utils/grammar.js';
import { getAntonym } from '../utils/antonyms.js';
import { captureKeyboard, releaseKeyboard } from '../components/global-keyboard.js';
import { inspectWord } from '../state/focus-word.js';
import { managed } from '../utils/lifecycle.js';
import { displaySyllable } from '../utils/format.js';
import { recordQuizResult, recordEncounter, getWeakConcepts, getStats } from '../utils/srs.js';

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
    <div class="learn-modes">
      <button class="btn btn--active" data-mode="study">Study</button>
      <button class="btn" data-mode="quiz">Quiz</button>
    </div>
    <div id="learn-study" class="learn-section"></div>
    <div id="learn-quiz" class="learn-section" style="display:none"></div>
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
          ${displaySyllable(note)}
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
    const modesScope = managed();

    function updateModes() {
      modesDemo.innerHTML = '';
      modesScope.destroyAll();

      const q = modesInput.value.trim();
      if (!q) return;

      const syls = parseWord(q);
      if (syls.length === 0) return;

      const word = new SolresolWord(syls);
      const modesRenderer = modesScope.track(createWordRenderer(word, {
        size: 'lg',
        showSheet: true,
        showDefinition: true,
        showReverse: word.length >= 2,
        reactive: true,
        clickToFocus: true,
        notations: new Set(['colors', 'solfege', 'numbers', 'binary', 'braille', 'ascii', 'sauso']),
      }));
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
    // --- Progression state ---
    const PROGRESS_KEY = 'solresol:quiz-progress';
    const LEVELS = [
      { key: 'level1', label: 'Ear Training', qmode: 'note' },
      { key: 'level2', label: 'Pattern Discovery', qmode: 'category' },
      { key: 'level3', label: 'Symmetry Discovery', qmode: 'antonym' },
      { key: 'level4', label: 'Grammar Discovery', qmode: 'stress' },
      { key: 'level5', label: 'Composition', qmode: 'translate' },
    ];
    const UNLOCK_THRESHOLD = 10;

    function loadProgress() {
      try {
        const raw = localStorage.getItem(PROGRESS_KEY);
        if (raw) return JSON.parse(raw);
      } catch (_) { /* ignore */ }
      return { level1: 0, level2: 0, level3: 0, level4: 0, level5: 0 };
    }

    function saveProgress(progress) {
      try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress)); } catch (_) { /* ignore */ }
    }

    function isUnlocked(levelIdx) {
      if (levelIdx === 0) return true;
      const progress = loadProgress();
      const prevKey = LEVELS[levelIdx - 1].key;
      return (progress[prevKey] || 0) >= UNLOCK_THRESHOLD;
    }

    function recordLevelCorrect(levelIdx) {
      const progress = loadProgress();
      const key = LEVELS[levelIdx].key;
      progress[key] = (progress[key] || 0) + 1;
      saveProgress(progress);
    }

    function srsRecord(concept, correct) {
      try { recordQuizResult(concept, correct); } catch (_) { /* SRS not loaded */ }
    }

    function srsEncounter(wordText, context) {
      try { recordEncounter(wordText, context); } catch (_) { /* SRS not loaded */ }
    }

    function srsGetWeakConcepts(limit) {
      try { return getWeakConcepts(limit); } catch (_) { return []; }
    }

    function srsGetStats() {
      try { return getStats(); } catch (_) { return { totalEncounters: 0, uniqueWords: 0, quizzesTaken: 0, accuracy: 0, streakDays: 0 }; }
    }

    // --- Build UI ---
    el.innerHTML = `
      <div class="quiz-inner">
        <div class="quiz-stats" id="quiz-stats"></div>
        <div class="quiz-progress-bar" id="quiz-progress-bar"></div>
        <div class="quiz-mode-select" id="quiz-mode-select"></div>
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
    const progressBar = el.querySelector('#quiz-progress-bar');
    const modeSelect = el.querySelector('#quiz-mode-select');
    const statsEl = el.querySelector('#quiz-stats');
    let currentLevelIdx = 0;
    let qmode = 'note';
    let score = (() => { try { return parseInt(localStorage.getItem('solresol:quiz-score')) || 0; } catch { return 0; } })();
    let streak = 0;
    scoreEl.textContent = score;
    let roundCleanup = null;
    let roundTimer = null;
    let currentKeyHandler = null;

    function renderStats() {
      const stats = srsGetStats();
      statsEl.innerHTML = `
        <span class="quiz-stat" title="Unique words encountered">Words: <strong>${stats.uniqueWords}</strong></span>
        <span class="quiz-stat" title="Quiz accuracy">Accuracy: <strong>${Math.round(stats.accuracy * 100)}%</strong></span>
        <span class="quiz-stat" title="Consecutive days practiced">Streak: <strong>${stats.streakDays}d</strong></span>
      `;
    }

    function renderProgressBar() {
      const progress = loadProgress();
      progressBar.innerHTML = '';
      LEVELS.forEach((lvl, idx) => {
        const unlocked = isUnlocked(idx);
        const count = progress[lvl.key] || 0;
        const filled = Math.min(count, UNLOCK_THRESHOLD);
        const star = unlocked ? '\u2605' : '\u2606';
        const span = document.createElement('span');
        span.className = `quiz-level-indicator${idx === currentLevelIdx ? ' active' : ''}${!unlocked ? ' locked' : ''}`;
        span.textContent = `Level ${idx + 1} ${star}`;
        if (unlocked && count < UNLOCK_THRESHOLD) {
          span.textContent += ` (${filled}/${UNLOCK_THRESHOLD})`;
        }
        span.title = unlocked ? lvl.label : `Locked — need ${UNLOCK_THRESHOLD - (idx > 0 ? (progress[LEVELS[idx - 1].key] || 0) : 0)} more correct in Level ${idx}`;
        progressBar.appendChild(span);
        if (idx < LEVELS.length - 1) {
          const sep = document.createElement('span');
          sep.className = 'quiz-level-sep';
          sep.textContent = ' | ';
          progressBar.appendChild(sep);
        }
      });
    }

    function renderModeButtons() {
      modeSelect.innerHTML = '';
      LEVELS.forEach((lvl, idx) => {
        const btn = document.createElement('button');
        const unlocked = isUnlocked(idx);
        btn.className = `btn${idx === currentLevelIdx ? ' btn--active' : ''}`;
        btn.dataset.qmode = lvl.qmode;
        btn.dataset.level = idx;
        if (!unlocked) {
          btn.disabled = true;
          btn.innerHTML = `<span class="quiz-lock-icon">\uD83D\uDD12</span> ${lvl.label}`;
          btn.title = `Complete ${UNLOCK_THRESHOLD} correct answers in Level ${idx} to unlock`;
        } else {
          btn.textContent = lvl.label;
        }
        btn.addEventListener('click', () => {
          if (!unlocked) return;
          currentLevelIdx = idx;
          qmode = lvl.qmode;
          renderModeButtons();
          renderProgressBar();
          startRound();
        });
        modeSelect.appendChild(btn);
      });
    }

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

    /** Pick an entry, preferring weak concepts from SRS when available */
    function pickWeightedEntry(entries, conceptType) {
      const weak = srsGetWeakConcepts(10);
      if (weak.length > 0) {
        const weakValues = new Set(weak.filter(w => w.type === conceptType).map(w => w.value));
        if (weakValues.size > 0) {
          const weakEntries = entries.filter(e => {
            const syls = parseWord(e.solresol);
            if (conceptType === 'note') return weakValues.has(syls[0]);
            if (conceptType === 'category') return weakValues.has(syls[0]);
            if (conceptType === 'word') return weakValues.has(e.solresol);
            if (conceptType === 'antonym') return weakValues.has(e.solresol);
            return false;
          });
          if (weakEntries.length > 0) return pickRandom(weakEntries);
        }
      }
      return pickRandom(entries);
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
        else if (qmode === 'category') patternDiscoveryRound();
        else if (qmode === 'antonym') symmetryDiscoveryRound();
        else if (qmode === 'stress') grammarDiscoveryRound();
        else compositionRound();
        area.style.opacity = '1';
      }, 150);
    }

    function nextRound(delay) {
      roundTimer = setTimeout(startRound, delay);
    }

    // Initialize displays
    renderStats();
    renderProgressBar();
    renderModeButtons();

    // =============================
    // LEVEL 1: Ear Training (kept as-is with SRS)
    // =============================
    function noteRound() {
      const weakNotes = srsGetWeakConcepts(7).filter(w => w.type === 'note');
      let target;
      if (weakNotes.length > 0 && Math.random() < 0.5) {
        const weakNote = pickRandom(weakNotes);
        target = NOTES.find(n => n === weakNote.value) || pickRandom(NOTES);
      } else {
        target = pickRandom(NOTES);
      }

      area.innerHTML = `
        <p class="quiz-prompt">Listen and identify the note:</p>
        <p class="quiz-hint">Press keys 1\u20137 or click a button</p>
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
        btn.textContent = displaySyllable(note);
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
        srsRecord({ type: 'note', value: target }, correct);
        if (correct) recordLevelCorrect(0);
        renderProgressBar();
        renderModeButtons();
        renderStats();

        feedback.textContent = correct
          ? 'Correct!'
          : `Wrong \u2014 it was ${displaySyllable(target)}`;
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

    // =============================
    // LEVEL 2: Pattern Discovery
    // =============================
    function patternDiscoveryRound() {
      const entries = getAllEntries().filter(e => e.syllables >= 2 && e.definition);
      if (entries.length < 10) { area.innerHTML = '<p class="no-results">Not enough entries</p>'; return; }

      // Pick a starting note as the "trait"
      const targetNote = pickRandom(NOTES);
      const matchingEntries = entries.filter(e => parseWord(e.solresol)[0] === targetNote);
      if (matchingEntries.length < 3) { area.innerHTML = '<p class="no-results">Not enough entries for this category</p>'; startRound(); return; }

      // Pick 3 words that share this starting note
      const threeWords = shuffle(matchingEntries).slice(0, 3);
      const correctCategory = SEMANTIC_CATEGORIES[targetNote];

      // Pick 2 wrong categories
      const wrongNotes = shuffle(NOTES.filter(n => n !== targetNote)).slice(0, 2);
      const options = shuffle([
        { note: targetNote, label: correctCategory.label, correct: true },
        ...wrongNotes.map(n => ({ note: n, label: SEMANTIC_CATEGORIES[n].label, correct: false })),
      ]);

      area.innerHTML = `
        <p class="quiz-prompt">Listen to these three words. What do they have in common?</p>
        <div id="quiz-word-trio" class="quiz-word-trio"></div>
        <button class="btn btn--sm" id="quiz-replay-trio">&#9654; Replay All</button>
        <div class="quiz-options quiz-options--col" id="quiz-options" style="margin-top:0.75rem"></div>
        <div id="quiz-feedback" class="quiz-feedback" aria-live="polite"></div>
      `;

      const trioEl = area.querySelector('#quiz-word-trio');
      const trioSyllables = [];
      threeWords.forEach(entry => {
        const syls = parseWord(entry.solresol);
        trioSyllables.push(syls);
        const word = new SolresolWord(entry.solresol);
        const wr = createWordRenderer(word, {
          size: 'sm', showSheet: false, showDefinition: true, reactive: false,
          clickToFocus: true,
          notations: new Set(['colors']),
        });
        trioEl.appendChild(wr.el);
        srsEncounter(entry.solresol, 'pattern-quiz');
      });

      // Play all three words sequentially
      function playTrio() {
        let delay = 0;
        trioSyllables.forEach(syls => {
          setTimeout(() => playWord(syls), delay);
          delay += syls.length * 400 + 300;
        });
      }

      area.querySelector('#quiz-replay-trio').addEventListener('click', playTrio);

      const optionsEl = area.querySelector('#quiz-options');
      const feedback = area.querySelector('#quiz-feedback');
      let answered = false;

      options.forEach((opt, idx) => {
        const btn = document.createElement('button');
        btn.className = 'btn quiz-choice';
        btn.style.borderLeft = `4px solid ${SEMANTIC_CATEGORIES[opt.note].color}`;
        btn.style.textAlign = 'left';

        const numSpan = document.createElement('span');
        numSpan.className = 'quiz-choice-num';
        numSpan.textContent = idx + 1;

        const labelSpan = document.createElement('span');
        labelSpan.textContent = opt.label;

        btn.append(numSpan, labelSpan);
        btn.addEventListener('click', () => handleChoice(opt, btn));
        optionsEl.appendChild(btn);
      });

      function handleChoice(opt, btn) {
        if (answered) return;
        answered = true;
        const correct = opt.correct;
        updateScore(correct);
        srsRecord({ type: 'category', value: targetNote }, correct);
        if (correct) recordLevelCorrect(1);
        renderProgressBar();
        renderModeButtons();
        renderStats();

        if (correct) {
          btn.classList.add('btn--correct');
          feedback.textContent = `Correct! All three words start with ${displaySyllable(targetNote)} \u2014 the "${correctCategory.label}" family.`;
          feedback.className = 'quiz-feedback correct';
        } else {
          btn.classList.add('btn--wrong');
          feedback.textContent = `Wrong \u2014 they all start with ${displaySyllable(targetNote)}: "${correctCategory.label}"`;
          feedback.className = 'quiz-feedback wrong';
          optionsEl.querySelectorAll('.quiz-choice').forEach(b => {
            const lbl = b.querySelector('span:nth-child(2)');
            if (lbl && lbl.textContent === correctCategory.label) b.classList.add('btn--correct');
          });
        }

        nextRound(2500);
      }

      setKeyHandler((e) => {
        const n = Number(e.key);
        if (n >= 1 && n <= options.length) {
          e.preventDefault();
          const opt = options[n - 1];
          const btn = optionsEl.querySelectorAll('.quiz-choice')[n - 1];
          handleChoice(opt, btn);
        }
      });

      setTimeout(playTrio, 300);
    }

    // =============================
    // LEVEL 3: Symmetry Discovery
    // =============================
    function symmetryDiscoveryRound() {
      const entries = getAllEntries().filter(e => {
        if (e.syllables < 2 || !e.definition) return false;
        return getAntonym(e.solresol) !== null;
      });
      if (entries.length < 4) { area.innerHTML = '<p class="no-results">Not enough entries with antonyms</p>'; return; }

      const entry = pickWeightedEntry(entries, 'antonym');
      const syls = parseWord(entry.solresol);
      const antonymWord = getAntonym(entry.solresol);
      const antonymDef = translate(antonymWord) || '?';
      srsEncounter(entry.solresol, 'symmetry-quiz');

      // Build wrong choices: 2 random definitions
      const otherEntries = entries.filter(e => e.solresol !== entry.solresol && e.solresol !== antonymWord && e.definition);
      const wrongDefs = shuffle(otherEntries).slice(0, 2).map(e => e.definition);

      const options = shuffle([
        { text: antonymDef, correct: true },
        ...wrongDefs.map(d => ({ text: d, correct: false })),
      ]);

      area.innerHTML = `
        <p class="quiz-prompt">This word means "<strong>${entry.definition}</strong>":</p>
        <div id="quiz-word-display" style="margin:0.75rem 0"></div>
        <p class="quiz-hint">Now listen to the reversed word. What happened to the meaning?</p>
        <button class="btn btn--sm" id="quiz-play-reversed">&#9654; Play Reversed</button>
        <div class="quiz-options quiz-options--col" id="quiz-options" style="margin-top:0.75rem"></div>
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

      const reversedSyls = [...syls].reverse();

      area.querySelector('#quiz-play-reversed').addEventListener('click', () => playWord(reversedSyls));

      const optionsEl = area.querySelector('#quiz-options');
      const feedback = area.querySelector('#quiz-feedback');
      let answered = false;

      options.forEach((opt, idx) => {
        const btn = document.createElement('button');
        btn.className = 'btn quiz-choice';
        btn.style.textAlign = 'left';

        const numSpan = document.createElement('span');
        numSpan.className = 'quiz-choice-num';
        numSpan.textContent = idx + 1;

        const labelSpan = document.createElement('span');
        labelSpan.textContent = `"${opt.text}"`;

        btn.append(numSpan, labelSpan);
        btn.addEventListener('click', () => handleChoice(opt, btn));
        optionsEl.appendChild(btn);
      });

      function handleChoice(opt, btn) {
        if (answered) return;
        answered = true;
        const correct = opt.correct;
        updateScore(correct);
        srsRecord({ type: 'antonym', value: entry.solresol }, correct);
        if (correct) recordLevelCorrect(2);
        renderProgressBar();
        renderModeButtons();
        renderStats();

        const antWord = new SolresolWord(antonymWord);
        const antWr = createWordRenderer(antWord, {
          size: 'md', showSheet: false, showDefinition: true, reactive: false,
          clickToFocus: true,
          notations: new Set(['colors']),
        });

        if (correct) {
          btn.classList.add('btn--correct');
          feedback.textContent = `Correct! ${entry.solresol} ("${entry.definition}") reversed = ${antonymWord} ("${antonymDef}")`;
          feedback.className = 'quiz-feedback correct';
        } else {
          btn.classList.add('btn--wrong');
          feedback.textContent = `Wrong \u2014 the reversed word ${antonymWord} means "${antonymDef}"`;
          feedback.className = 'quiz-feedback wrong';
          optionsEl.querySelectorAll('.quiz-choice').forEach(b => {
            const lbl = b.querySelector('span:nth-child(2)');
            if (lbl && lbl.textContent === `"${antonymDef}"`) b.classList.add('btn--correct');
          });
        }
        feedback.appendChild(antWr.el);
        playWord(reversedSyls);

        nextRound(3000);
      }

      setKeyHandler((e) => {
        const n = Number(e.key);
        if (n >= 1 && n <= options.length) {
          e.preventDefault();
          const opt = options[n - 1];
          const btn = optionsEl.querySelectorAll('.quiz-choice')[n - 1];
          handleChoice(opt, btn);
        }
      });

      // Play original word first, then reversed after a delay
      setTimeout(() => playWord(syls), 300);
      setTimeout(() => playWord(reversedSyls), 300 + syls.length * 400 + 600);
    }

    // =============================
    // LEVEL 4: Grammar Discovery
    // =============================
    function grammarDiscoveryRound() {
      const entries = getAllEntries().filter(e => e.syllables >= 3 && e.definition);
      if (entries.length < 4) { area.innerHTML = '<p class="no-results">Not enough entries</p>'; return; }

      const entry = pickWeightedEntry(entries, 'stress');
      const syls = parseWord(entry.solresol);
      srsEncounter(entry.solresol, 'grammar-quiz');

      // Pick two different stress positions
      const stressOptions = [
        { pos: null, label: 'Noun', rule: STRESS_RULES.noun },
        { pos: 'last', label: 'Adjective', rule: STRESS_RULES.adjective },
        { pos: 'penultimate', label: 'Verb', rule: STRESS_RULES.verb },
      ];
      // Only allow antepenultimate if word has 3+ syllables
      if (syls.length >= 3) {
        stressOptions.push({ pos: 'antepenultimate', label: 'Adverb', rule: STRESS_RULES.adverb });
      }

      const twoStress = shuffle(stressOptions).slice(0, 2);
      const stressA = twoStress[0];
      const stressB = twoStress[1];
      const correctAnswer = `${stressA.label}\u2192${stressB.label}`;

      // Build word objects with stress for playback
      const wordA = new SolresolWord(entry.solresol);
      wordA.stressPosition = stressA.pos;
      const wordB = new SolresolWord(entry.solresol);
      wordB.stressPosition = stressB.pos;

      // Build wrong choices
      const allTransitions = [];
      for (let i = 0; i < stressOptions.length; i++) {
        for (let j = 0; j < stressOptions.length; j++) {
          if (i !== j) {
            const t = `${stressOptions[i].label}\u2192${stressOptions[j].label}`;
            if (t !== correctAnswer) allTransitions.push(t);
          }
        }
      }
      const wrongChoices = shuffle(allTransitions).slice(0, 3);
      const options = shuffle([correctAnswer, ...wrongChoices]);

      area.innerHTML = `
        <p class="quiz-prompt">This word is played with two different stress positions.</p>
        <p class="quiz-hint">What changed from the first to the second?</p>
        <div id="quiz-word-display" style="margin:0.75rem 0"></div>
        <div style="display:flex;gap:0.5rem;justify-content:center;margin-bottom:0.75rem">
          <button class="btn btn--sm" id="quiz-play-a">&#9654; First (${stressA.label})</button>
          <button class="btn btn--sm" id="quiz-play-b">&#9654; Second (?)</button>
          <button class="btn btn--sm" id="quiz-play-both">&#9654; Both</button>
        </div>
        <div class="quiz-options quiz-options--col" id="quiz-options"></div>
        <div id="quiz-feedback" class="quiz-feedback" aria-live="polite"></div>
      `;

      const wordDisplay = area.querySelector('#quiz-word-display');
      const wr = createWordRenderer(wordA, {
        size: 'md', showSheet: false, showDefinition: false, reactive: false,
        clickToFocus: true,
        notations: new Set(['colors']),
      });
      wordDisplay.appendChild(wr.el);

      function playWithStress(word) {
        const params = stressParams(word);
        let delay = 0;
        params.forEach(p => {
          setTimeout(() => playNote(p.syllable, { duration: p.duration, gain: p.gain }), delay * 1000);
          delay += p.duration + 0.05;
        });
      }

      area.querySelector('#quiz-play-a').addEventListener('click', () => playWithStress(wordA));
      area.querySelector('#quiz-play-b').addEventListener('click', () => playWithStress(wordB));
      area.querySelector('#quiz-play-both').addEventListener('click', () => {
        playWithStress(wordA);
        const totalA = stressParams(wordA).reduce((s, p) => s + p.duration + 0.05, 0);
        setTimeout(() => playWithStress(wordB), (totalA + 0.5) * 1000);
      });

      const optionsEl = area.querySelector('#quiz-options');
      const feedback = area.querySelector('#quiz-feedback');
      let answered = false;

      options.forEach((opt, idx) => {
        const btn = document.createElement('button');
        btn.className = 'btn quiz-choice';
        btn.style.textAlign = 'left';

        const numSpan = document.createElement('span');
        numSpan.className = 'quiz-choice-num';
        numSpan.textContent = idx + 1;

        const labelSpan = document.createElement('span');
        labelSpan.textContent = opt;

        btn.append(numSpan, labelSpan);
        btn.addEventListener('click', () => handleChoice(opt, btn));
        optionsEl.appendChild(btn);
      });

      function handleChoice(opt, btn) {
        if (answered) return;
        answered = true;
        const correct = opt === correctAnswer;
        updateScore(correct);
        srsRecord({ type: 'stress', value: correctAnswer }, correct);
        if (correct) recordLevelCorrect(3);
        renderProgressBar();
        renderModeButtons();
        renderStats();

        if (correct) {
          btn.classList.add('btn--correct');
          feedback.innerHTML = `Correct! The stress shifted: <strong>${stressA.label}</strong> (${stressA.rule}) \u2192 <strong>${stressB.label}</strong> (${stressB.rule})`;
          feedback.className = 'quiz-feedback correct';
        } else {
          btn.classList.add('btn--wrong');
          feedback.innerHTML = `Wrong \u2014 the change was <strong>${correctAnswer}</strong>`;
          feedback.className = 'quiz-feedback wrong';
          optionsEl.querySelectorAll('.quiz-choice').forEach(b => {
            const lbl = b.querySelector('span:nth-child(2)');
            if (lbl && lbl.textContent === correctAnswer) b.classList.add('btn--correct');
          });
        }

        nextRound(2500);
      }

      setKeyHandler((e) => {
        const n = Number(e.key);
        if (n >= 1 && n <= options.length) {
          e.preventDefault();
          const opt = options[n - 1];
          const btn = optionsEl.querySelectorAll('.quiz-choice')[n - 1];
          handleChoice(opt, btn);
        }
      });

      // Auto-play both versions
      setTimeout(() => {
        playWithStress(wordA);
        const totalA = stressParams(wordA).reduce((s, p) => s + p.duration + 0.05, 0);
        setTimeout(() => playWithStress(wordB), (totalA + 0.5) * 1000);
      }, 300);
    }

    // =============================
    // LEVEL 5: Composition (enhanced translate)
    // =============================
    function compositionRound() {
      const entries = getAllEntries().filter(e => e.definition && e.syllables >= 2 && e.syllables <= 4);
      if (entries.length < 4) {
        area.innerHTML = '<p class="no-results">Not enough entries for this mode</p>';
        return;
      }

      const correct = pickWeightedEntry(entries, 'word');
      const correctSyls = parseWord(correct.solresol);
      srsEncounter(correct.solresol, 'composition-quiz');

      area.innerHTML = `
        <p class="quiz-prompt">Build the Solresol word for:</p>
        <p class="quiz-target-word">"${correct.definition}"</p>
        <p class="quiz-hint">Press keys 1\u20137 to add notes, Enter to submit, Backspace to clear</p>
        <div class="quiz-built" id="quiz-built"></div>
        <div class="quiz-options" id="quiz-options"></div>
        <div class="quiz-actions">
          <button class="btn btn--sm" id="quiz-clear">Clear</button>
          <button class="btn btn--sm" id="quiz-submit">Submit</button>
          <button class="btn btn--sm" id="quiz-hint-btn" style="margin-left:auto">Hint</button>
        </div>
        <div id="quiz-feedback" class="quiz-feedback" aria-live="polite"></div>
      `;

      const builtEl = area.querySelector('#quiz-built');
      const feedback = area.querySelector('#quiz-feedback');
      let built = [];
      let answered = false;
      let hintUsed = false;

      area.querySelector('#quiz-clear').addEventListener('click', () => { built = []; builtEl.innerHTML = ''; });

      // Hint: reveal first syllable
      area.querySelector('#quiz-hint-btn').addEventListener('click', () => {
        if (hintUsed || answered) return;
        hintUsed = true;
        const hintNote = correctSyls[0];
        const hintEl = document.createElement('p');
        hintEl.className = 'quiz-hint';
        hintEl.style.color = getColor(hintNote);
        hintEl.textContent = `Starts with ${displaySyllable(hintNote)} (${correctSyls.length} syllables total)`;
        area.querySelector('#quiz-hint-btn').disabled = true;
        area.querySelector('.quiz-actions').after(hintEl);
        playNote(hintNote, { duration: 0.5 });
      });

      const optionsEl = area.querySelector('#quiz-options');
      for (const note of NOTES) {
        const btn = document.createElement('button');
        btn.className = 'btn note-btn';
        btn.style.borderBottomColor = getColor(note);
        btn.textContent = displaySyllable(note);
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
        const isCorrect = built.length === correctSyls.length && built.every((s, i) => s === correctSyls[i]);
        updateScore(isCorrect);
        srsRecord({ type: 'word', value: correct.solresol }, isCorrect);
        if (isCorrect) recordLevelCorrect(4);
        renderProgressBar();
        renderModeButtons();
        renderStats();

        const word = new SolresolWord(correct.solresol);
        const wr = createWordRenderer(word, {
          size: 'md', showSheet: false, showDefinition: true, reactive: false,
          clickToFocus: true,
          notations: new Set(['colors']),
        });

        if (isCorrect) {
          feedback.textContent = `Correct! ${correct.solresol} = "${correct.definition}"`;
          feedback.className = 'quiz-feedback correct';
        } else {
          feedback.textContent = `Wrong \u2014 it was ${correct.solresol} (${correct.definition})`;
          feedback.className = 'quiz-feedback wrong';
        }
        feedback.appendChild(wr.el);
        playWord(correctSyls);

        nextRound(2500);
      }

      area.querySelector('#quiz-submit').addEventListener('click', submit);

      setKeyHandler((e) => {
        const n = Number(e.key);
        if (n >= 1 && n <= 7) { e.preventDefault(); addNote(NOTES[n - 1]); }
        else if (e.key === 'Enter') { e.preventDefault(); submit(); }
        else if (e.key === 'Backspace') { e.preventDefault(); built = []; builtEl.innerHTML = ''; }
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
