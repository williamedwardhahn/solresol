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

// --- Shared Trie for prefix search ---

let _trie = null;

function getTrie() {
  if (_trie) return _trie;
  _trie = { children: {}, entries: [], count: 0 };
  for (const entry of dictionary) {
    const syls = parseWord(entry.solresol);
    if (syls.length === 0) continue;
    let node = _trie;
    for (const syl of syls) {
      if (!node.children[syl]) {
        node.children[syl] = { children: {}, entries: [], count: 0 };
      }
      node = node.children[syl];
      node.count++;
    }
    node.entries.push(entry);
  }
  return _trie;
}

/** Walk the shared trie to a syllable prefix. Returns the trie node or null. */
export function walkTrie(syllables) {
  let node = getTrie();
  for (const syl of syllables) {
    if (!node.children[syl]) return null;
    node = node.children[syl];
  }
  return node;
}

/** Collect all entries below a trie node (up to limit). */
export function collectEntries(node, limit = 50) {
  const results = [];
  (function walk(n) {
    if (results.length >= limit) return;
    for (const e of n.entries) {
      if (results.length >= limit) return;
      results.push(e);
    }
    for (const child of Object.values(n.children)) {
      walk(child);
    }
  })(node);
  return results;
}

/** Search dictionary entries by query string.
 *  Uses trie for Solresol prefix matching, O(n) filter for English substring. */
export function searchDictionary(query) {
  const q = query.toLowerCase();
  const syls = parseWord(q);

  // If query looks like Solresol syllables, use trie for fast prefix match
  if (syls.length > 0 && syls.join('').length >= q.replace(/\s/g, '').length * 0.8) {
    const node = walkTrie(syls);
    if (node) return collectEntries(node, 200);
    return [];
  }

  // English substring search (fallback)
  return dictionary.filter(e =>
    e.solresol.toLowerCase().includes(q) ||
    (e.definition && e.definition.toLowerCase().includes(q))
  );
}
