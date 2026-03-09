import { parseWord, getColor, getFrequency, translate, getEntry } from '../utils/solresol.js';
import { getAllNotations } from '../utils/notation.js';
import { getAntonym } from '../utils/antonyms.js';
import { getSemanticCategory, STRESS_RULES } from '../utils/grammar.js';
import { displayWord } from '../utils/format.js';

const SYLLABLE_COUNT_CLASS = {
  1: 'Particles',
  2: 'Pronouns & articles',
  3: 'Common words',
  4: 'Core vocabulary',
  5: 'Extended vocabulary',
};

/**
 * Observable Solresol word model.
 * A single object that IS simultaneously a sound, color sequence, number,
 * notation, and meaning — and notifies observers when it changes.
 */
export class SolresolWord {
  constructor(input) {
    if (input instanceof SolresolWord) {
      this.syllables = [...input.syllables];
      this._stress = input._stress || null;
    } else if (Array.isArray(input)) {
      this.syllables = input.map(s => s.toLowerCase());
      this._stress = null;
    } else if (typeof input === 'string' && input.length > 0) {
      this.syllables = parseWord(String(input));
      this._stress = null;
    } else {
      this.syllables = [];
      this._stress = null;
    }
    this._listeners = new Set();
  }

  // --- Computed properties (all representations) ---

  get text() {
    return displayWord(this.syllables);
  }

  get colors() {
    return this.syllables.map(getColor);
  }

  get frequencies() {
    return this.syllables.map(getFrequency);
  }

  get definition() {
    return translate(this.text);
  }

  get entry() {
    return getEntry(this.text);
  }

  get notations() {
    return this.syllables.length > 0 ? getAllNotations(this.text) : null;
  }

  get antonym() {
    return this.syllables.length >= 2 ? getAntonym(this.text) : null;
  }

  get category() {
    return this.syllables.length > 0 ? getSemanticCategory(this.text) : null;
  }

  get length() {
    return this.syllables.length;
  }

  get isEmpty() {
    return this.syllables.length === 0;
  }

  /** Whether this word has a dictionary entry */
  get isDefined() {
    return this.definition !== null;
  }

  /** Every 1-5 syllable combination is a valid Solresol word */
  get exists() {
    return this.syllables.length > 0 && this.syllables.length <= 5;
  }

  /** Syllable count class description */
  get syllableClass() {
    return SYLLABLE_COUNT_CLASS[this.syllables.length] || null;
  }

  // --- Stress & Part of Speech ---

  /** Stress position: null, 'last', 'penultimate', 'antepenultimate' */
  get stressPosition() {
    return this._stress;
  }

  set stressPosition(pos) {
    this._stress = pos;
    this._notify();
  }

  /** Part of speech derived from stress position */
  get partOfSpeech() {
    if (this.syllables.length < 2) return 'particle';
    if (!this._stress) return 'noun';
    if (this._stress === 'last') return 'adjective';
    if (this._stress === 'penultimate') return 'verb';
    if (this._stress === 'antepenultimate') return 'adverb';
    return 'noun';
  }

  /** The stressed syllable index, or -1 if none */
  get stressIndex() {
    if (!this._stress || this.syllables.length < 2) return -1;
    if (this._stress === 'last') return this.syllables.length - 1;
    if (this._stress === 'penultimate') return this.syllables.length - 2;
    if (this._stress === 'antepenultimate') return Math.max(0, this.syllables.length - 3);
    return -1;
  }

  // --- Structural analysis ---

  /** Full structural analysis for any word, defined or not */
  get analysis() {
    if (this.isEmpty) return null;
    return {
      category: this.category,
      syllableClass: this.syllableClass,
      partOfSpeech: this.partOfSpeech,
      isDefined: this.isDefined,
      definition: this.definition,
      hasAntonym: this.antonym !== null,
      antonym: this.antonym,
    };
  }

  // --- Mutations (notify observers) ---

  push(syllable) {
    this.syllables.push(syllable.toLowerCase());
    this._notify();
  }

  pop() {
    if (this.syllables.length > 0) {
      this.syllables.pop();
      this._notify();
    }
  }

  clear() {
    if (this.syllables.length > 0) {
      this.syllables = [];
      this._stress = null;
      this._notify();
    }
  }

  set(input) {
    if (Array.isArray(input)) {
      this.syllables = input.map(s => s.toLowerCase());
    } else {
      this.syllables = parseWord(String(input));
    }
    this._notify();
  }

  /** Swap syllables at positions i and j */
  swap(i, j) {
    if (i >= 0 && j >= 0 && i < this.syllables.length && j < this.syllables.length && i !== j) {
      [this.syllables[i], this.syllables[j]] = [this.syllables[j], this.syllables[i]];
      this._notify();
    }
  }

  /** Insert syllable at position i */
  insertAt(i, syllable) {
    if (i >= 0 && i <= this.syllables.length) {
      this.syllables.splice(i, 0, syllable.toLowerCase());
      this._notify();
    }
  }

  /** Remove syllable at position i */
  removeAt(i) {
    if (i >= 0 && i < this.syllables.length) {
      this.syllables.splice(i, 1);
      this._notify();
    }
  }

  /** Reverse syllables in place */
  reverse() {
    if (this.syllables.length >= 2) {
      this.syllables.reverse();
      this._notify();
    }
  }

  // --- Derived words ---

  reversed() {
    return new SolresolWord([...this.syllables].reverse());
  }

  clone() {
    const w = new SolresolWord([...this.syllables]);
    w._stress = this._stress;
    return w;
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
}
