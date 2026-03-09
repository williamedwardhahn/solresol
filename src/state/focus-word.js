import { SolresolWord } from '../models/word.js';
import { emit } from '../utils/events.js';

const SENTENCE_KEY = 'solresol:sentence';

/** The single focus word — the word the user is currently looking at/building */
export const focusWord = new SolresolWord([]);

/** History of committed words (the sentence being built) */
export const committedWords = [];

// Restore sentence from localStorage on load
try {
  const saved = localStorage.getItem(SENTENCE_KEY);
  if (saved) {
    const words = JSON.parse(saved);
    for (const syls of words) {
      committedWords.push(new SolresolWord(syls));
    }
  }
} catch {}

function saveSentence() {
  try {
    localStorage.setItem(SENTENCE_KEY, JSON.stringify(committedWords.map(w => w.syllables)));
  } catch {}
}

export function commitFocusWord() {
  if (focusWord.isEmpty) return;
  const committed = focusWord.clone();
  committedWords.push(committed);
  focusWord.clear();
  saveSentence();
  emit('word:commit', { word: committed });
  return committed;
}

export function setFocusWord(input) {
  if (input instanceof SolresolWord) {
    focusWord.set(input.syllables);
  } else if (Array.isArray(input)) {
    focusWord.set(input);
  } else {
    focusWord.set(String(input));
  }
  emit('word:focus', { word: focusWord });
}

export function undoLastWord() {
  if (committedWords.length === 0) return null;
  const removed = committedWords.pop();
  saveSentence();
  emit('word:undo', { word: removed });
  return removed;
}

export function clearSentence() {
  committedWords.length = 0;
  saveSentence();
  emit('sentence:clear', {});
}
