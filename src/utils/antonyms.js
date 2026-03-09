import { parseWord, translate } from './solresol.js';
import { displayWord } from './format.js';

/**
 * Known antonym pairs formed by syllable reversal.
 */
export const ANTONYM_PAIRS = [
  ['Fala', 'Lafa'],       // good ↔ bad
  ['Misol', 'Solmi'],     // kind ↔ mean/sick
  ['Solla', 'Lasol'],     // always ↔ never
  ['Fasi', 'Sifa'],       // much/very ↔ little/scarcely
  ['Misisol', 'Solsimi'], // good fortune ↔ misfortune
  ['Solsifa', 'Fasisol'],  // laugh ↔ cry
  ['Simila', 'Lamisi'],   // easy ↔ difficult
  ['Mila', 'Lami'],       // near/here ↔ far/tomorrow (temporal)
  ['Rela', 'Lare'],       // known ↔ unknown (or yours plural ↔ today)
  ['Dore', 'Redo'],       // you ↔ my/mine
  ['Domi', 'Mido'],       // they ↔ your(sing.)
  ['Dosol', 'Soldo'],     // you(plur.) ↔ our
  ['Dola', 'Lado'],       // they(plur.) ↔ your(plur.)
  ['Dosi', 'Sido'],       // (pron) ↔ their(plur.)
  ['Resol', 'Solre'],     // outside ↔ inside
  ['Resi', 'Sire'],       // none ↔ each/every
  ['Fare', 'Refa'],       // with ↔ (perception)
  ['Domisol', 'Solmido'], // health/god ↔ sickness/devil
  ['Domila', 'Lamido'],   // eternal ↔ temporary
  ['Fasido', 'Dosifa'],   // walk ↔ accomplish
  ['Misolfa', 'Fasolmi'], // benevolence ↔ malice
  ['Mirela', 'Laremi'],   // devote ↔ spell/spelling
  ['Solsire', 'Resisol'], // happiness ↔ sadness
];

/**
 * Get all antonym pairs with definitions.
 */
export function getAntonymPairs() {
  return ANTONYM_PAIRS.map(([a, b]) => ({
    word1: a,
    word2: b,
    def1: translate(a) || '—',
    def2: translate(b) || '—',
    syllables1: parseWord(a),
    syllables2: parseWord(b),
  }));
}

/**
 * Check if a word has a known antonym.
 */
export function getAntonym(word) {
  const lower = word.toLowerCase();
  for (const [a, b] of ANTONYM_PAIRS) {
    if (a.toLowerCase() === lower) return b;
    if (b.toLowerCase() === lower) return a;
  }
  // Try automatic reversal
  const syls = parseWord(word);
  if (syls.length >= 2) {
    const reversed = [...syls].reverse();
    const reversedWord = displayWord(reversed);
    const def = translate(reversedWord);
    if (def) return reversedWord;
  }
  return null;
}
