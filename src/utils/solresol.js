import { NOTES, NOTE_COLORS, NOTE_FREQUENCIES, NUMBER_TO_NOTE, NOTE_TO_NUMBER } from './constants.js';
import dictionary from '../data/dictionary.json';

// --- Parsing ---

const SYLLABLE_RE = /do|re|mi|fa|sol|la|si/gi;

/** Parse a Solresol word string into an array of lowercase syllables */
export function parseWord(str) {
  const matches = str.toLowerCase().match(SYLLABLE_RE);
  return matches || [];
}

/** Convert a syllable to its number (1-7) */
export function syllableToNumber(syl) {
  return NOTE_TO_NUMBER[syl.toLowerCase()] ?? null;
}

/** Convert a number (1-7) to a syllable */
export function numberToSyllable(n) {
  return NUMBER_TO_NOTE[n] ?? null;
}

/** Convert a number string like "1234" to a Solresol word */
export function numbersToWord(numStr) {
  return [...numStr].map(d => numberToSyllable(Number(d))).filter(Boolean).join('');
}

// --- Lookup ---

/** Get color hex for a syllable */
export function getColor(syllable) {
  return NOTE_COLORS[syllable.toLowerCase()] ?? '#999';
}

/** Get frequency in Hz for a syllable */
export function getFrequency(syllable) {
  return NOTE_FREQUENCIES[syllable.toLowerCase()] ?? 0;
}

// --- Dictionary ---

// Build lookup maps once at import time
const solresolToEntry = new Map();
const englishIndex = [];

for (const entry of dictionary) {
  solresolToEntry.set(entry.solresol.toLowerCase(), entry);
  if (entry.definition) {
    englishIndex.push(entry);
  }
}

/** Translate a Solresol word to its English definition */
export function translate(solresolWord) {
  const entry = solresolToEntry.get(solresolWord.toLowerCase());
  return entry?.definition ?? null;
}

/** Search dictionary by English keyword, returns matching entries */
export function reverseTranslate(englishTerm) {
  const term = englishTerm.toLowerCase();
  return englishIndex.filter(e =>
    e.definition.toLowerCase().includes(term)
  );
}

/** Get all dictionary entries */
export function getAllEntries() {
  return dictionary;
}

/** Get a dictionary entry by Solresol word */
export function getEntry(solresolWord) {
  return solresolToEntry.get(solresolWord.toLowerCase()) ?? null;
}

/** Search dictionary entries by query string (matches both Solresol and definition) */
export function searchDictionary(query) {
  const q = query.toLowerCase();
  return dictionary.filter(e =>
    e.solresol.toLowerCase().includes(q) ||
    (e.definition && e.definition.toLowerCase().includes(q))
  );
}
