import { NOTES } from '../utils/constants.js';
import { getColor, translate, parseWord, getAllEntries } from '../utils/solresol.js';
import { createWordBlocks } from '../components/color-block.js';
import { SolresolWord } from '../models/word.js';
import { createWordRenderer } from '../components/word-renderer.js';
import { playNote, playWord } from '../audio/synth.js';
import { SEMANTIC_CATEGORIES, getSemanticCategory } from '../utils/grammar.js';
import { getAntonym } from '../utils/antonyms.js';

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function renderQuiz(container) {
  container.innerHTML = `
    <section class="view quiz-view">
      <h2>Quiz</h2>
      <div class="quiz-mode-select">
        <button class="btn btn--active" data-mode="note">Ear Training</button>
        <button class="btn" data-mode="word">Word Building</button>
        <button class="btn" data-mode="category">Categories</button>
        <button class="btn" data-mode="antonym">Antonyms</button>
        <button class="btn" data-mode="translate">Translation</button>
      </div>
      <div id="quiz-area" class="quiz-area"></div>
      <div class="quiz-score">
        Score: <span id="quiz-score">0</span> |
        Streak: <span id="quiz-streak">0</span>
      </div>
    </section>
  `;

  const area = container.querySelector('#quiz-area');
  const scoreEl = container.querySelector('#quiz-score');
  const streakEl = container.querySelector('#quiz-streak');
  const modeBtns = container.querySelectorAll('[data-mode]');
  let mode = 'note';
  let score = 0;
  let streak = 0;
  let roundCleanup = null;
  let roundTimer = null;

  modeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      mode = btn.dataset.mode;
      modeBtns.forEach(b => b.classList.remove('btn--active'));
      btn.classList.add('btn--active');
      startRound();
    });
  });

  function updateScore(correct) {
    if (correct) { score++; streak++; }
    else { streak = 0; }
    scoreEl.textContent = score;
    streakEl.textContent = streak;
  }

  function pickRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function startRound() {
    if (roundCleanup) { roundCleanup(); roundCleanup = null; }
    clearTimeout(roundTimer);

    area.style.opacity = '0';
    setTimeout(() => {
      if (mode === 'note') noteRound();
      else if (mode === 'word') wordRound();
      else if (mode === 'category') categoryRound();
      else if (mode === 'antonym') antonymRound();
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

    const onKeyDown = (e) => {
      const n = Number(e.key);
      if (n >= 1 && n <= 7) { e.preventDefault(); handleAnswer(NOTES[n - 1]); }
    };
    document.addEventListener('keydown', onKeyDown);
    roundCleanup = () => document.removeEventListener('keydown', onKeyDown);

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

      // Show correct answer with WordRenderer
      const word = new SolresolWord(entry.solresol);
      const wr = createWordRenderer(word, {
        size: 'md', showSheet: false, showDefinition: true, reactive: false,
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

    const onKeyDown = (e) => {
      const n = Number(e.key);
      if (n >= 1 && n <= 7) { e.preventDefault(); addNote(NOTES[n - 1]); }
      else if (e.key === 'Enter') { e.preventDefault(); submit(); }
      else if (e.key === 'Backspace') { e.preventDefault(); built = []; builtEl.innerHTML = ''; }
    };
    document.addEventListener('keydown', onKeyDown);
    roundCleanup = () => document.removeEventListener('keydown', onKeyDown);

    setTimeout(() => playWord(syllables), 300);
  }

  // --- Category Quiz (structural: first syllable determines semantic domain) ---
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
      <div class="quiz-options" id="quiz-options" style="flex-direction:column;max-width:400px;margin:0.75rem auto"></div>
      <div id="quiz-feedback" class="quiz-feedback" aria-live="polite"></div>
    `;

    // Show the word
    const wordDisplay = area.querySelector('#quiz-word-display');
    const word = new SolresolWord(entry.solresol);
    const wr = createWordRenderer(word, {
      size: 'md', showSheet: false, showDefinition: false, reactive: false,
      notations: new Set(['colors']),
    });
    wordDisplay.appendChild(wr.el);

    const optionsEl = area.querySelector('#quiz-options');
    const feedback = area.querySelector('#quiz-feedback');
    let answered = false;

    // Show all 7 categories as choices
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
        // Highlight correct
        optionsEl.querySelectorAll('.quiz-choice').forEach(b => {
          if (b.querySelector('.quiz-choice-num')?.nextElementSibling?.textContent === correctCategory.label) {
            b.classList.add('btn--correct');
          }
        });
      }

      playWord(syls);
      nextRound(2500);
    }

    const onKeyDown = (e) => {
      const n = Number(e.key);
      if (n >= 1 && n <= noteOrder.length) {
        e.preventDefault();
        const note = noteOrder[n - 1];
        const btn = optionsEl.querySelectorAll('.quiz-choice')[n - 1];
        handleChoice(note, btn);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    roundCleanup = () => document.removeEventListener('keydown', onKeyDown);
  }

  // --- Antonym Quiz (structural: reverse syllables to find opposite) ---
  function antonymRound() {
    // Find words that have known antonyms
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

    // Show the word
    const wordDisplay = area.querySelector('#quiz-word-display');
    const word = new SolresolWord(entry.solresol);
    const wr = createWordRenderer(word, {
      size: 'md', showSheet: false, showDefinition: false, reactive: false,
      notations: new Set(['colors']),
    });
    wordDisplay.appendChild(wr.el);

    const builtEl = area.querySelector('#quiz-built');
    const feedback = area.querySelector('#quiz-feedback');
    let built = [];
    let answered = false;

    // Note buttons
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

      // Show both words
      const antWord = new SolresolWord(antonymWord);
      const antWr = createWordRenderer(antWord, {
        size: 'md', showSheet: false, showDefinition: true, reactive: false,
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

    const onKeyDown = (e) => {
      const n = Number(e.key);
      if (n >= 1 && n <= 7) { e.preventDefault(); addNote(NOTES[n - 1]); }
      else if (e.key === 'Enter') { e.preventDefault(); submit(); }
      else if (e.key === 'Backspace') { e.preventDefault(); built = []; builtEl.innerHTML = ''; }
    };
    document.addEventListener('keydown', onKeyDown);
    roundCleanup = () => document.removeEventListener('keydown', onKeyDown);
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

    const onKeyDown = (e) => {
      const n = Number(e.key);
      if (n >= 1 && n <= options.length) {
        e.preventDefault();
        const opt = options[n - 1];
        const btn = optionsEl.querySelectorAll('.quiz-choice')[n - 1];
        const syls = parseWord(opt.solresol);
        handleChoice(opt, btn, syls);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    roundCleanup = () => document.removeEventListener('keydown', onKeyDown);
  }

  startRound();

  return () => {
    if (roundCleanup) roundCleanup();
    clearTimeout(roundTimer);
  };
}
