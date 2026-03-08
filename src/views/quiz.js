import { NOTES } from '../utils/constants.js';
import { getColor, translate, parseWord, getAllEntries } from '../utils/solresol.js';
import { createWordBlocks } from '../components/color-block.js';
import { playNote, playWord } from '../audio/synth.js';

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
  let cleanup = null;

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
    if (cleanup) cleanup();
    cleanup = null;

    if (mode === 'note') noteRound();
    else if (mode === 'word') wordRound();
    else translateRound();
  }

  // --- Note Recognition ---
  function noteRound() {
    const target = pickRandom(NOTES);
    area.innerHTML = `
      <p class="quiz-prompt">Listen and identify the note:</p>
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

      // Highlight correct answer
      optionsEl.querySelectorAll('.note-btn').forEach(b => {
        if (b.textContent.toLowerCase() === target) b.classList.add('btn--correct');
        b.disabled = true;
      });

      setTimeout(startRound, 1500);
    }

    // Auto-play on start
    setTimeout(() => playNote(target, { duration: 0.8 }), 300);
  }

  // --- Word Building ---
  function wordRound() {
    const entries = getAllEntries().filter(e => e.syllables >= 2 && e.syllables <= 4 && e.definition);
    const entry = pickRandom(entries);
    const syllables = parseWord(entry.solresol);

    area.innerHTML = `
      <p class="quiz-prompt">Listen and build the word:</p>
      <button class="btn btn--lg" id="quiz-play-word">&#9654; Play</button>
      <div class="quiz-built" id="quiz-built"></div>
      <div class="quiz-options" id="quiz-options"></div>
      <button class="btn btn--sm" id="quiz-clear">Clear</button>
      <button class="btn btn--sm" id="quiz-submit">Submit</button>
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
      btn.addEventListener('click', () => {
        if (answered) return;
        built.push(note);
        builtEl.innerHTML = '';
        builtEl.appendChild(createWordBlocks(built, { size: 'sm' }));
      });
      optionsEl.appendChild(btn);
    }

    area.querySelector('#quiz-submit').addEventListener('click', () => {
      if (answered || built.length === 0) return;
      answered = true;
      const correct = built.length === syllables.length && built.every((s, i) => s === syllables[i]);
      updateScore(correct);
      feedback.textContent = correct
        ? `Correct! "${entry.definition}"`
        : `Wrong — it was ${entry.solresol} (${entry.definition})`;
      feedback.className = `quiz-feedback ${correct ? 'correct' : 'wrong'}`;
      setTimeout(startRound, 2000);
    });

    setTimeout(() => playWord(syllables), 300);
  }

  // --- Translation Quiz ---
  function translateRound() {
    const entries = getAllEntries().filter(e => e.definition && e.syllables >= 2);
    const correct = pickRandom(entries);
    const wrongs = [];
    while (wrongs.length < 3) {
      const w = pickRandom(entries);
      if (w !== correct && !wrongs.includes(w)) wrongs.push(w);
    }

    const options = [correct, ...wrongs].sort(() => Math.random() - 0.5);

    area.innerHTML = `
      <p class="quiz-prompt">Which Solresol word means:</p>
      <p class="quiz-target-word">"${correct.definition}"</p>
      <div class="quiz-options" id="quiz-options"></div>
      <div id="quiz-feedback" class="quiz-feedback" aria-live="polite"></div>
    `;

    const optionsEl = area.querySelector('#quiz-options');
    const feedback = area.querySelector('#quiz-feedback');
    let answered = false;

    for (const opt of options) {
      const btn = document.createElement('button');
      btn.className = 'btn quiz-choice';
      const syls = parseWord(opt.solresol);

      const label = document.createElement('span');
      label.textContent = opt.solresol;

      btn.appendChild(label);
      btn.appendChild(createWordBlocks(syls, { size: 'sm', showLabel: false }));

      btn.addEventListener('click', () => {
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
            if (b.querySelector('span').textContent === correct.solresol) {
              b.classList.add('btn--correct');
            }
          });
        }

        setTimeout(startRound, 2000);
      });

      optionsEl.appendChild(btn);
    }
  }

  startRound();
}
