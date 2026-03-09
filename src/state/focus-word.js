import { SolresolWord } from '../models/word.js';
import { SolresolSentence } from '../models/sentence.js';
import { emit } from '../utils/events.js';

/** The word being built note-by-note via the keyboard */
export const buildingWord = new SolresolWord([]);

/** The word being inspected in the context panel */
export const inspectedWord = new SolresolWord([]);

/** The current sentence — a first-class model with grammar awareness */
export const currentSentence = SolresolSentence.restore();

/** Committed words — direct reference to sentence.words for backward compat */
export const committedWords = currentSentence.words;

/** Commit the building word to the sentence */
export function commitBuildingWord() {
  if (buildingWord.isEmpty) return;
  const committed = buildingWord.clone();
  currentSentence.addWord(committed);
  buildingWord.clear();
  emit('word:commit', { word: committed });
  return committed;
}

/** Inspect a word in the context panel */
export function inspectWord(input) {
  if (input instanceof SolresolWord) {
    inspectedWord.set(input.syllables);
  } else if (Array.isArray(input)) {
    inspectedWord.set(input);
  } else {
    inspectedWord.set(String(input));
  }
  emit('word:focus', { word: inspectedWord });
}

export function undoLastWord() {
  const removed = currentSentence.undoLast();
  if (removed) {
    emit('word:undo', { word: removed });
  }
  return removed;
}

export function clearSentence() {
  currentSentence.clear();
  emit('sentence:clear', {});
}
