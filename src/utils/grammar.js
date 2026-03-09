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

/**
 * Analyze a sequence of SolresolWords for grammatical structure.
 * Assigns roles based on word order and markers.
 */
export function analyzeGrammar(words) {
  const roles = assignRoles(words);
  return {
    roles,
    tense: detectTense(words),
    isValid: roles.length > 0,
    suggestions: suggestNext(roles),
  };
}

/** Assign grammatical roles to words based on Solresol word order */
function assignRoles(words) {
  // Word order: subject → directObj → adjective → tense → verb → adverb → indirectObj → question
  const roles = [];
  const tenseMarkerKeys = new Set(Object.values(TENSE_MARKERS).map(m => m.solresol.toLowerCase()));

  let phase = 0; // tracks position in word order
  for (const w of words) {
    const text = w.text.toLowerCase();
    const syls = w.syllables;

    // Single-syllable particles
    if (syls.length === 1) {
      if (syls[0] === 'do') {
        roles.push({ word: w, role: 'negation' });
      } else if (syls[0] === 'sol') {
        roles.push({ word: w, role: 'question' });
      } else {
        roles.push({ word: w, role: 'particle' });
      }
      continue;
    }

    // Tense markers (doubled syllables: dodo, rere, etc.)
    if (tenseMarkerKeys.has(text)) {
      roles.push({ word: w, role: 'tense-marker' });
      phase = 4; // after tense comes verb
      continue;
    }

    // Assign based on position and stress
    const pos = w.partOfSpeech;
    if (pos === 'verb' || (phase >= 4 && phase < 5)) {
      roles.push({ word: w, role: 'verb' });
      phase = 5;
    } else if (pos === 'adjective') {
      roles.push({ word: w, role: 'adjective' });
    } else if (pos === 'adverb') {
      roles.push({ word: w, role: 'adverb' });
    } else if (phase < 1) {
      roles.push({ word: w, role: 'subject' });
      phase = 1;
    } else if (phase < 2) {
      roles.push({ word: w, role: 'object' });
      phase = 2;
    } else if (phase >= 5) {
      roles.push({ word: w, role: 'indirect-object' });
    } else {
      roles.push({ word: w, role: 'noun' });
      phase = Math.max(phase, 2);
    }
  }

  return roles;
}

function detectTense(words) {
  const tenseMap = {};
  for (const [key, marker] of Object.entries(TENSE_MARKERS)) {
    tenseMap[marker.solresol.toLowerCase()] = key;
  }
  for (const w of words) {
    const t = tenseMap[w.text.toLowerCase()];
    if (t) return t;
  }
  return 'present';
}

/** Suggest what grammatical roles are missing from the sentence */
export function suggestNext(roles) {
  const filled = new Set(roles.map(r => r.role));
  const suggestions = [];
  if (!filled.has('subject')) suggestions.push('subject');
  if (!filled.has('verb')) suggestions.push('verb');
  if (!filled.has('object') && filled.has('verb')) suggestions.push('object');
  if (!filled.has('adjective')) suggestions.push('adjective');
  if (!filled.has('adverb') && filled.has('verb')) suggestions.push('adverb');
  return suggestions;
}

/**
 * Get stress-aware audio parameters for playing a word.
 * Stressed syllable is louder and longer.
 */
export function stressParams(word) {
  const idx = word.stressIndex;
  return word.syllables.map((syl, i) => ({
    syllable: syl,
    gain: i === idx ? 0.5 : 0.3,
    duration: i === idx ? 0.55 : 0.4,
  }));
}
