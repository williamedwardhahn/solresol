import { parseWord, getColor, getFrequency, translate, getEntry } from '../utils/solresol.js';
import { getAllNotations } from '../utils/notation.js';
import { getAntonym } from '../utils/antonyms.js';
import { getSemanticCategory } from '../utils/grammar.js';

/**
 * Observable Solresol word model.
 * A single object that IS simultaneously a sound, color sequence, number,
 * notation, and meaning — and notifies observers when it changes.
 */
export class SolresolWord {
  constructor(input) {
    if (input instanceof SolresolWord) {
      this.syllables = [...input.syllables];
    } else if (Array.isArray(input)) {
      this.syllables = input.map(s => s.toLowerCase());
    } else if (typeof input === 'string' && input.length > 0) {
      this.syllables = parseWord(String(input));
    } else {
      this.syllables = [];
    }
    this._listeners = new Set();
  }

  // --- Computed properties (all representations) ---

  get text() {
    return this.syllables.map(s => s.charAt(0).toUpperCase() + s.slice(1)).join('');
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

  get exists() {
    return this.definition !== null;
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

  // --- Derived words ---

  reversed() {
    return new SolresolWord([...this.syllables].reverse());
  }

  clone() {
    return new SolresolWord([...this.syllables]);
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
