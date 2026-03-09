import { SolresolWord } from '../models/word.js';
import { emit } from '../utils/events.js';

/** The single focus word — the word the user is currently looking at/building */
export const focusWord = new SolresolWord([]);

/** History of committed words (the sentence being built) */
export const committedWords = [];

export function commitFocusWord() {
  if (focusWord.isEmpty) return;
  const committed = focusWord.clone();
  committedWords.push(committed);
  focusWord.clear();
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
  emit('word:undo', { word: removed });
  return removed;
}

export function clearSentence() {
  committedWords.length = 0;
  emit('sentence:clear', {});
}
