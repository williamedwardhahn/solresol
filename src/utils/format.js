/** Canonical display form of a syllable: 'do' → 'Do' */
export function displaySyllable(syl) {
  return syl.charAt(0).toUpperCase() + syl.slice(1);
}

/** Canonical display form of a word: ['do','re'] → 'DoRe' */
export function displayWord(syllables) {
  return syllables.map(displaySyllable).join('');
}
