import { parseWord } from './solresol.js';

/**
 * Solresol grammar engine.
 * Word order: subject direct-obj adjective tense verb adverb indirect-obj
 */

export const TENSE_MARKERS = {
  past:        { solresol: 'Dodo',   label: 'Past' },
  pluperfect:  { solresol: 'Rere',   label: 'Pluperfect' },
  future:      { solresol: 'Mimi',   label: 'Future' },
  conditional: { solresol: 'Fafa',   label: 'Conditional' },
  imperative:  { solresol: 'Solsol', label: 'Imperative' },
  participle:  { solresol: 'Lala',   label: 'Present Participle' },
  passive:     { solresol: 'Sisi',   label: 'Passive Participle' },
};

export const MODIFIERS = {
  augmentative:  { solresol: 'Fasi', label: 'Augmentative (very)', position: 'before' },
  superlative:   { solresol: 'Fasi', label: 'Superlative (most)', position: 'after' },
  diminutive:    { solresol: 'Sifa', label: 'Diminutive (slightly)', position: 'before' },
  diminutive2:   { solresol: 'Sifa', label: 'Further Diminutive (barely)', position: 'after' },
};

/**
 * Build a grammatically correct Solresol sentence.
 * @param {object} parts
 * @param {string} parts.subject - Solresol word
 * @param {string} parts.directObj - Solresol word
 * @param {string} parts.adjective - Solresol word
 * @param {string} parts.tense - key from TENSE_MARKERS
 * @param {string} parts.verb - Solresol word
 * @param {string} parts.adverb - Solresol word
 * @param {string} parts.indirectObj - Solresol word
 * @param {boolean} parts.negate - prepend Do to verb
 * @param {boolean} parts.question - append Sol to sentence
 * @param {string} parts.modifier - key from MODIFIERS (applied to adjective)
 * @returns {string[]} array of Solresol words in correct order
 */
export function buildSentence(parts = {}) {
  const words = [];

  if (parts.subject) words.push(parts.subject);
  if (parts.directObj) words.push(parts.directObj);

  // Adjective with optional modifier
  if (parts.adjective) {
    const mod = parts.modifier && MODIFIERS[parts.modifier];
    if (mod && mod.position === 'before') {
      words.push(mod.solresol);
      words.push(parts.adjective);
    } else if (mod && mod.position === 'after') {
      words.push(parts.adjective);
      words.push(mod.solresol);
    } else {
      words.push(parts.adjective);
    }
  }

  // Tense marker before verb
  if (parts.tense && TENSE_MARKERS[parts.tense]) {
    words.push(TENSE_MARKERS[parts.tense].solresol);
  }

  // Verb with optional negation
  if (parts.verb) {
    if (parts.negate) words.push('Do');
    words.push(parts.verb);
  }

  if (parts.adverb) words.push(parts.adverb);
  if (parts.indirectObj) words.push(parts.indirectObj);

  // Question marker
  if (parts.question) words.push('Sol');

  return words;
}

/**
 * Describe the stress pattern for a word's part of speech.
 */
export const STRESS_RULES = {
  noun:      'No stress (default)',
  adjective: 'Stress on last syllable',
  verb:      'Stress on penultimate syllable',
  adverb:    'Stress on antepenultimate syllable',
};

/**
 * Get the semantic category for a Solresol word based on its first syllable.
 */
export const SEMANTIC_CATEGORIES = {
  do:  { label: 'Do — Time, Universe, Sustenance', color: '#c40233' },
  re:  { label: 'Re — Numbers, Cognition, Perception', color: '#e16b1a' },
  mi:  { label: 'Mi — Emotions, Sensations, Love', color: '#eac100' },
  fa:  { label: 'Fa — Communication, Action, Movement', color: '#00a368' },
  sol: { label: 'Sol — Days, Language, Grammar', color: '#00b2b0' },
  la:  { label: 'La — Education, Writing, Weather', color: '#0088bf' },
  si:  { label: 'Si — Atmosphere, Study, Analysis', color: '#624579' },
};

export function getSemanticCategory(solresolWord) {
  const syllables = parseWord(solresolWord);
  if (syllables.length === 0) return null;
  return SEMANTIC_CATEGORIES[syllables[0]] || null;
}
