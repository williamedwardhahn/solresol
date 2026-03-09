import { on, emit } from '../utils/events.js';
import { shouldQuiz, getNextQuizItem, recordQuizResult, recordEncounter } from '../utils/srs.js';
import { translate, getColor, getAllEntries, parseWord } from '../utils/solresol.js';
import { getAntonym } from '../utils/antonyms.js';
import { SEMANTIC_CATEGORIES } from '../utils/grammar.js';
import { NOTES } from '../utils/constants.js';
import { displaySyllable } from '../utils/format.js';

const STRESS_LABELS = {
  noun:      'Noun (no stress)',
  adjective: 'Adjective (last syllable)',
  verb:      'Verb (penultimate)',
  adverb:    'Adverb (antepenultimate)',
};

let container = null;
let dismissTimer = null;
let styleInjected = false;

function injectStyles() {
  if (styleInjected) return;
  styleInjected = true;
  const style = document.createElement('style');
  style.textContent = `
    .mq-toast {
      position: fixed; bottom: 80px; right: 20px; max-width: 320px; z-index: 1000;
      background: var(--surface, #1e1e2e); color: var(--text, #cdd6f4);
      border: 1px solid var(--accent, #89b4fa); border-radius: 10px;
      padding: 14px 16px; font-size: 14px; box-shadow: 0 4px 20px rgba(0,0,0,.4);
      transform: translateX(120%); transition: transform .3s ease, border-color .3s ease;
    }
    .mq-toast--visible { transform: translateX(0); }
    .mq-toast--correct { border-color: #a6e3a1; }
    .mq-toast--wrong   { border-color: #f38ba8; }
    .mq-toast__header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
    .mq-toast__title  { font-weight: 600; font-size: 13px; opacity: .7; text-transform: uppercase; letter-spacing: .5px; }
    .mq-toast__close  { background: none; border: none; color: var(--text, #cdd6f4); cursor: pointer; font-size: 18px; padding: 0 2px; line-height: 1; }
    .mq-toast__prompt { margin-bottom: 10px; line-height: 1.4; }
    .mq-toast__prompt strong { color: var(--accent, #89b4fa); }
    .mq-toast__choices { display: flex; flex-direction: column; gap: 5px; }
    .mq-toast__btn {
      background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.1);
      color: var(--text, #cdd6f4); padding: 7px 10px; border-radius: 6px;
      cursor: pointer; text-align: left; font-size: 13px; transition: background .15s;
    }
    .mq-toast__btn:hover { background: rgba(255,255,255,.12); }
    .mq-toast__btn--correct { background: rgba(166,227,161,.2); border-color: #a6e3a1; }
    .mq-toast__btn--wrong   { background: rgba(243,139,168,.15); border-color: #f38ba8; }
    .mq-toast__result { margin-top: 8px; font-size: 13px; font-weight: 500; }
  `;
  document.head.appendChild(style);
}

function getContainer() {
  if (!container) {
    container = document.createElement('div');
    container.id = 'micro-quiz-container';
    document.body.appendChild(container);
  }
  return container;
}

function dismiss() {
  clearTimeout(dismissTimer);
  const toast = getContainer().querySelector('.mq-toast');
  if (!toast) return;
  toast.classList.remove('mq-toast--visible');
  setTimeout(() => toast.remove(), 320);
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function pickDistractors(correct, pool, count = 2) {
  const others = pool.filter(v => v !== correct);
  shuffle(others);
  return others.slice(0, count);
}

/** Build quiz data for a given type. Returns { title, prompt, choices[], answer } or null. */
function buildQuiz() {
  const entries = getAllEntries().filter(e => e.definition && parseWord(e.solresol).length >= 2);
  if (entries.length < 4) return null;

  const srsItem = getNextQuizItem();
  const types = ['antonym', 'family', 'tense', 'reverse'];
  const type = srsItem?.type || pick(types);
  const target = srsItem?.entry || pick(entries);
  const word = target.solresol;
  const def = target.definition;
  const syls = parseWord(word);

  if (type === 'antonym') {
    const ant = getAntonym(word);
    if (!ant) return buildFallback(entries);
    const antDef = translate(ant) || '(unknown)';
    const distractors = pickDistractors(antDef, entries.map(e => e.definition));
    const choices = shuffle([antDef, ...distractors]);
    return { concept: word, title: 'Antonym', prompt: `What does <strong>${ant}</strong> mean?`, choices, answer: antDef };
  }

  if (type === 'family') {
    const first = syls[0];
    const cat = SEMANTIC_CATEGORIES[first];
    if (!cat) return buildFallback(entries);
    const correctLabel = cat.label;
    const distractors = pickDistractors(correctLabel, Object.values(SEMANTIC_CATEGORIES).map(c => c.label));
    const choices = shuffle([correctLabel, ...distractors]);
    const display = syls.map(displaySyllable).join('');
    return { concept: word, title: 'Which family?', prompt: `<strong>${display}</strong> belongs to which category?`, choices, answer: correctLabel };
  }

  if (type === 'tense') {
    if (syls.length < 3) return buildFallback(entries);
    const posKeys = Object.keys(STRESS_LABELS);
    const correctPos = pick(posKeys);
    const correctLabel = STRESS_LABELS[correctPos];
    const distractors = pickDistractors(correctLabel, Object.values(STRESS_LABELS));
    const choices = shuffle([correctLabel, ...distractors]);
    const display = syls.map(displaySyllable).join('');
    return { concept: word, title: 'What part of speech?', prompt: `If <strong>${display}</strong> is stressed as a <em>${correctPos}</em>, what is it?`, choices, answer: correctLabel };
  }

  // reverse: English → Solresol
  const display = syls.map(displaySyllable).join('');
  const distractors = pickDistractors(display, entries.map(e => parseWord(e.solresol).map(displaySyllable).join('')));
  const choices = shuffle([display, ...distractors]);
  return { concept: word, title: 'Quick translate', prompt: `What is "<strong>${def}</strong>" in Solresol?`, choices, answer: display };
}

function buildFallback(entries) {
  const target = pick(entries);
  const syls = parseWord(target.solresol);
  const display = syls.map(displaySyllable).join('');
  const distractors = pickDistractors(target.definition, entries.map(e => e.definition));
  const choices = shuffle([target.definition, ...distractors]);
  return { concept: target.solresol, title: 'Quick quiz', prompt: `What does <strong>${display}</strong> mean?`, choices, answer: target.definition };
}

function showToast(quiz) {
  dismiss();
  const el = document.createElement('div');
  el.className = 'mq-toast';
  el.innerHTML = `
    <div class="mq-toast__header">
      <span class="mq-toast__title">${quiz.title}</span>
      <button class="mq-toast__close" aria-label="Dismiss">&times;</button>
    </div>
    <div class="mq-toast__prompt">${quiz.prompt}</div>
    <div class="mq-toast__choices">
      ${quiz.choices.map(c => `<button class="mq-toast__btn">${c}</button>`).join('')}
    </div>`;
  el.querySelector('.mq-toast__close').addEventListener('click', dismiss);

  let answered = false;
  el.querySelectorAll('.mq-toast__btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (answered) return;
      answered = true;
      const correct = btn.textContent === quiz.answer;
      recordQuizResult(quiz.concept, correct);
      btn.classList.add(correct ? 'mq-toast__btn--correct' : 'mq-toast__btn--wrong');
      el.classList.add(correct ? 'mq-toast--correct' : 'mq-toast--wrong');
      if (!correct) {
        el.querySelectorAll('.mq-toast__btn').forEach(b => {
          if (b.textContent === quiz.answer) b.classList.add('mq-toast__btn--correct');
        });
      }
      clearTimeout(dismissTimer);
      dismissTimer = setTimeout(dismiss, 1500);
    });
  });

  getContainer().appendChild(el);
  requestAnimationFrame(() => el.classList.add('mq-toast--visible'));
  dismissTimer = setTimeout(dismiss, 8000);
}

function onEscape(e) {
  if (e.key === 'Escape') dismiss();
}

/**
 * Initialize the micro-quiz system. Call once at app startup.
 */
export function initMicroQuiz() {
  injectStyles();
  getContainer();
  document.addEventListener('keydown', onEscape);

  on('word:commit', (detail) => {
    const wordText = detail?.text || detail?.word?.text || '';
    if (wordText) recordEncounter(wordText, 'commit');
    if (!shouldQuiz()) return;
    const quiz = buildQuiz();
    if (quiz) showToast(quiz);
  });
}
