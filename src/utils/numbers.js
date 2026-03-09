/**
 * Solresol number system.
 * Based on the Symmetric Solresol specification.
 */

const DIGITS = {
  0: 'Dodore',
  1: 'Redodo',
  2: 'Remimi',
  3: 'Refafa',
  4: 'Resolsol',
  5: 'Relala',
  6: 'Resisi',
  7: 'Mimido',
  8: 'Mimire',
  9: 'Mimifa',
  10: 'Mimisol',
  11: 'Mimila',
  12: 'Mimisi',
  13: 'Midodo',
  14: 'Mirere',
  15: 'Mifafa',
  16: 'Misolsol',
  17: 'Milala',
  18: 'Misisi',
  19: 'Fafado',
  20: 'Fafare',
  30: 'Fafami',
  40: 'Fafasol',
  50: 'Fafala',
  60: 'Fafasi',
  80: 'Fadodo',
  100: 'Farere',
  1000: 'Famimi',
  1000000: 'Fasolsol',
  1000000000: 'Falala',
  1000000000000: 'Fasisi',
};

// Reverse lookup
const WORDS_TO_NUM = {};
for (const [num, word] of Object.entries(DIGITS)) {
  WORDS_TO_NUM[word.toLowerCase()] = Number(num);
}

/**
 * Convert a number (0–999999+) to Solresol words.
 * Uses French-style composition for 70, 90.
 */
export function numberToSolresol(n) {
  if (n < 0) return 'Do ' + numberToSolresol(-n); // negation
  if (DIGITS[n]) return DIGITS[n];

  // 70-79: sixty + ten+digit
  if (n >= 70 && n < 80) {
    const remainder = n - 60;
    return DIGITS[60] + ' ' + numberToSolresol(remainder);
  }

  // 90-99: eighty + ten+digit
  if (n >= 90 && n < 100) {
    const remainder = n - 80;
    return DIGITS[80] + ' ' + numberToSolresol(remainder);
  }

  // 21-69 (not 30,40,50,60): tens + units
  if (n > 20 && n < 70) {
    const tens = Math.floor(n / 10) * 10;
    const units = n % 10;
    if (units === 0) return DIGITS[tens];
    return DIGITS[tens] + ' ' + numberToSolresol(units);
  }

  // 81-89
  if (n > 80 && n < 90) {
    const units = n - 80;
    return DIGITS[80] + ' ' + numberToSolresol(units);
  }

  // 100-999
  if (n >= 100 && n < 1000) {
    const hundreds = Math.floor(n / 100);
    const remainder = n % 100;
    const prefix = hundreds === 1 ? DIGITS[100] : numberToSolresol(hundreds) + ' ' + DIGITS[100];
    return remainder === 0 ? prefix : prefix + ' ' + numberToSolresol(remainder);
  }

  // 1000+
  if (n >= 1000 && n < 1000000) {
    const thousands = Math.floor(n / 1000);
    const remainder = n % 1000;
    const prefix = thousands === 1 ? DIGITS[1000] : numberToSolresol(thousands) + ' ' + DIGITS[1000];
    return remainder === 0 ? prefix : prefix + ' ' + numberToSolresol(remainder);
  }

  // million+
  if (n >= 1000000 && n < 1000000000) {
    const millions = Math.floor(n / 1000000);
    const remainder = n % 1000000;
    const prefix = numberToSolresol(millions) + ' ' + DIGITS[1000000];
    return remainder === 0 ? prefix : prefix + ' ' + numberToSolresol(remainder);
  }

  // billion+
  if (n >= 1000000000 && n < 1000000000000) {
    const billions = Math.floor(n / 1000000000);
    const remainder = n % 1000000000;
    const prefix = numberToSolresol(billions) + ' ' + DIGITS[1000000000];
    return remainder === 0 ? prefix : prefix + ' ' + numberToSolresol(remainder);
  }

  return String(n); // fallback
}

/**
 * Convert a Solresol number word back to a number.
 * Simple lookup for known values.
 */
export function solresolToNumber(word) {
  return WORDS_TO_NUM[word.toLowerCase()] ?? null;
}

/** Get all base number mappings for display */
export function getNumberTable() {
  return Object.entries(DIGITS)
    .map(([num, word]) => ({ number: Number(num), solresol: word }))
    .sort((a, b) => a.number - b.number);
}
