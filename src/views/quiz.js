import { NOTES } from '../utils/constants.js';
import { getColor, translate, parseWord, getAllEntries } from '../utils/solresol.js';
import { createWordBlocks } from '../components/color-block.js';
import { playNote, playWord } from '../audio/synth.js';

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
        <button class="btn btn--active" data-mode="note">Note Recognition</button>
        <button class="btn" data-mode="word">Word Building</button>
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
    if (correct) {
      score++;
      streak++;
    } else {
      streak = 0;
    }
    scoreEl.textContent = score;
    streakEl.textContent = streak;
  }

  function pickRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function startRound() {
    if (roundCleanup) { roundCleanup(); roundCleanup = null; }
    clearTimeout(roundTimer);

    if (mode === 'note') noteRound();
    else if (mode === 'word') wordRound();
    else translateRound();
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

    // Keyboard input: 1-7
    const onKeyDown = (e) => {
      const n = Number(e.key);
      if (n >= 1 && n <= 7) {
        e.preventDefault();
        handleAnswer(NOTES[n - 1]);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    roundCleanup = () => document.removeEventListener('keydown', onKeyDown);

    setTimeout(() => playNote(target, { duration: 0.8 }), 300);
  }

  // --- Word Building ---
  function wordRound() {
    const entries = getAllEntries().filter(e => e.syllables >= 2 && e.syllables <= 4 && e.definition);
    if (entries.length === 0) {
      area.innerHTML = '<p class="no-results">No entries available for this mode</p>';
      return;
    }
    const entry = pickRandom(entries);
    const syllables = parseWord(entry.solresol);

    area.innerHTML = `
      <p class="quiz-prompt">Listen and build the word:</p>
      <p class="quiz-hint">Press keys 1–7 to add notes, Enter to submit</p>
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
    area.querySelector('#quiz-clear').addEventListener('click', () => {
      built = [];
      builtEl.innerHTML = '';
    });

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
      built.push(note);
      builtEl.innerHTML = '';
      builtEl.appendChild(createWordBlocks(built, { size: 'sm' }));
    }

    function submit() {
      if (answered || built.length === 0) return;
      answered = true;
      const correct = built.length === syllables.length && built.every((s, i) => s === syllables[i]);
      updateScore(correct);
      feedback.textContent = correct
        ? `Correct! "${entry.definition}"`
        : `Wrong — it was ${entry.solresol} (${entry.definition})`;
      feedback.className = `quiz-feedback ${correct ? 'correct' : 'wrong'}`;
      nextRound(2000);
    }

    area.querySelector('#quiz-submit').addEventListener('click', submit);

    // Keyboard: 1-7 to add, Enter to submit, Backspace to clear
    const onKeyDown = (e) => {
      const n = Number(e.key);
      if (n >= 1 && n <= 7) {
        e.preventDefault();
        addNote(NOTES[n - 1]);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        submit();
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        built = [];
        builtEl.innerHTML = '';
      }
    };
    document.addEventListener('keydown', onKeyDown);
    roundCleanup = () => document.removeEventListener('keydown', onKeyDown);

    setTimeout(() => playWord(syllables), 300);
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

      const label = document.createElement('span');
      label.textContent = opt.solresol;

      const numLabel = document.createElement('span');
      numLabel.className = 'quiz-choice-num';
      numLabel.textContent = idx + 1;

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
          if (b.querySelector('span:nth-child(2)').textContent === correct.solresol) {
            b.classList.add('btn--correct');
          }
        });
      }

      nextRound(2000);
    }

    // Keyboard: 1-4 to select option
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

  // View-level cleanup
  return () => {
    if (roundCleanup) roundCleanup();
    clearTimeout(roundTimer);
  };
}
