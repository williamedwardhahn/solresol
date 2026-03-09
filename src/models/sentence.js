import { SolresolWord } from './word.js';
import { emit } from '../utils/events.js';

const SENTENCE_KEY = 'solresol:sentence';
const SENTENCES_KEY = 'solresol:sentences';

/**
 * Observable Solresol sentence model.
 * A structured collection of words with grammar awareness.
 */
export class SolresolSentence {
  constructor() {
    this.words = [];      // SolresolWord[]
    this._listeners = new Set();
  }

  // --- Computed properties ---

  get length() { return this.words.length; }
  get isEmpty() { return this.words.length === 0; }

  /** All syllables across all words, flattened */
  get allSyllables() {
    return this.words.flatMap(w => w.syllables);
  }

  /** English translation gloss */
  get translation() {
    return this.words.map(w => {
      const d = w.definition;
      return d ? d.split(',')[0].split(';')[0].trim() : w.text;
    }).join(' ');
  }

  /** Detect if sentence ends with Sol (question marker) */
  get isQuestion() {
    if (this.words.length === 0) return false;
    const last = this.words[this.words.length - 1];
    return last.syllables.length === 1 && last.syllables[0] === 'sol';
  }

  /** Detect if sentence has Do particle before a verb (negation) */
  get isNegated() {
    for (let i = 0; i < this.words.length - 1; i++) {
      const w = this.words[i];
      if (w.syllables.length === 1 && w.syllables[0] === 'do') {
        // Check if next word could be a verb
        const next = this.words[i + 1];
        if (next.syllables.length >= 2) return true;
      }
    }
    return false;
  }

  /** Detect tense from tense marker presence */
  get tense() {
    const TENSE_MAP = {
      'dodo': 'past', 'rere': 'pluperfect', 'mimi': 'future',
      'fafa': 'conditional', 'solsol': 'imperative',
      'lala': 'participle', 'sisi': 'passive',
    };
    for (const w of this.words) {
      const key = w.syllables.join('');
      if (TENSE_MAP[key]) return TENSE_MAP[key];
    }
    return 'present';
  }

  // --- Mutations (notify observers) ---

  addWord(word) {
    const w = word instanceof SolresolWord ? word.clone() : new SolresolWord(word);
    this.words.push(w);
    this._notify();
    this._save();
  }

  removeWord(index) {
    if (index >= 0 && index < this.words.length) {
      this.words.splice(index, 1);
      this._notify();
      this._save();
    }
  }

  moveWord(from, to) {
    if (from < 0 || from >= this.words.length || to < 0 || to >= this.words.length) return;
    const [word] = this.words.splice(from, 1);
    this.words.splice(to, 0, word);
    this._notify();
    this._save();
  }

  undoLast() {
    if (this.words.length === 0) return null;
    const removed = this.words.pop();
    this._notify();
    this._save();
    return removed;
  }

  clear() {
    if (this.words.length === 0) return;
    this.words.length = 0;
    this._notify();
    this._save();
  }

  // --- Observable ---

  onChange(fn) {
    this._listeners.add(fn);
    return () => this._listeners.delete(fn);
  }

  _notify() {
    for (const fn of this._listeners) {
      fn(this);
    }
  }

  // --- Persistence ---

  _save() {
    try {
      localStorage.setItem(SENTENCE_KEY, JSON.stringify(this.words.map(w => w.syllables)));
    } catch {}
  }

  static restore() {
    const sentence = new SolresolSentence();
    try {
      const saved = localStorage.getItem(SENTENCE_KEY);
      if (saved) {
        for (const syls of JSON.parse(saved)) {
          sentence.words.push(new SolresolWord(syls));
        }
      }
    } catch {}
    return sentence;
  }

  toJSON() {
    return this.words.map(w => w.syllables);
  }

  static fromJSON(data) {
    const sentence = new SolresolSentence();
    for (const syls of data) {
      sentence.words.push(new SolresolWord(syls));
    }
    return sentence;
  }

  // --- Multiple sentence management ---

  /** Save current sentence to the saved list with a name */
  static saveSentence(sentence, name = '') {
    try {
      const saved = JSON.parse(localStorage.getItem(SENTENCES_KEY) || '[]');
      saved.push({
        name: name || sentence.translation.slice(0, 30) || 'Untitled',
        words: sentence.toJSON(),
        timestamp: Date.now(),
      });
      localStorage.setItem(SENTENCES_KEY, JSON.stringify(saved));
    } catch {}
  }

  /** Get all saved sentences */
  static getSavedSentences() {
    try {
      return JSON.parse(localStorage.getItem(SENTENCES_KEY) || '[]');
    } catch { return []; }
  }

  /** Delete a saved sentence by index */
  static deleteSentence(index) {
    try {
      const saved = JSON.parse(localStorage.getItem(SENTENCES_KEY) || '[]');
      saved.splice(index, 1);
      localStorage.setItem(SENTENCES_KEY, JSON.stringify(saved));
    } catch {}
  }

  /** Export sentence as JSON string */
  static exportJSON(sentence) {
    return JSON.stringify({
      words: sentence.toJSON(),
      translation: sentence.translation,
      tense: sentence.tense,
    }, null, 2);
  }
}
