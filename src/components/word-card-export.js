import { getColor } from '../utils/solresol.js';
import { getSyllableNotations } from '../utils/notation.js';
import { displaySyllable } from '../utils/format.js';

const CARD_W = 600;
const CARD_H = 320;
const PAD = 24;
const NOTE_COLORS = {
  do: '#c40233', re: '#e16b1a', mi: '#eac100',
  fa: '#00a368', sol: '#00b2b0', la: '#0088bf', si: '#624579',
};

/**
 * Render a SolresolWord as a PNG image via canvas.
 * Returns a Promise<Blob>.
 */
export function renderWordCard(word) {
  const canvas = document.createElement('canvas');
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext('2d');

  // Background
  ctx.fillStyle = '#0e0e12';
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  // Border
  ctx.strokeStyle = '#2a2a3a';
  ctx.lineWidth = 2;
  ctx.roundRect(1, 1, CARD_W - 2, CARD_H - 2, 12);
  ctx.stroke();

  const syls = word.syllables;
  const blockSize = Math.min(64, (CARD_W - PAD * 2 - (syls.length - 1) * 8) / syls.length);
  const totalBlockW = syls.length * blockSize + (syls.length - 1) * 8;
  const startX = (CARD_W - totalBlockW) / 2;

  // Color blocks
  const blockY = 40;
  for (let i = 0; i < syls.length; i++) {
    const x = startX + i * (blockSize + 8);
    ctx.fillStyle = getColor(syls[i]);
    ctx.beginPath();
    ctx.roundRect(x, blockY, blockSize, blockSize, 8);
    ctx.fill();

    // Solfege label on block
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${Math.round(blockSize * 0.28)}px Inter, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const label = displaySyllable(syls[i]);
    ctx.fillText(label, x + blockSize / 2, blockY + blockSize / 2);
  }

  // Word text
  const textY = blockY + blockSize + 32;
  ctx.fillStyle = '#e8e8f0';
  ctx.font = 'bold 28px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(word.text, CARD_W / 2, textY);

  // Definition
  if (word.definition) {
    ctx.fillStyle = '#888898';
    ctx.font = '18px Inter, sans-serif';
    ctx.fillText(word.definition, CARD_W / 2, textY + 34);
  }

  // Notation rows
  const notY = textY + 70;
  const notations = syls.map(s => getSyllableNotations(s));
  const rows = [
    { label: 'Numbers', key: 'number' },
    { label: 'Binary', key: 'binary' },
  ];

  for (let r = 0; r < rows.length; r++) {
    const y = notY + r * 24;
    ctx.fillStyle = '#888898';
    ctx.font = '12px Inter, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(rows[r].label, startX - 12, y);

    ctx.fillStyle = '#e8e8f0';
    ctx.font = '14px monospace';
    ctx.textAlign = 'center';
    for (let i = 0; i < syls.length; i++) {
      ctx.fillText(notations[i][rows[r].key], startX + i * (blockSize + 8) + blockSize / 2, y);
    }
  }

  // Branding
  ctx.fillStyle = '#555';
  ctx.font = '11px Inter, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('Solresol', CARD_W - PAD, CARD_H - 12);

  return new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
}

/**
 * Copy word card image to clipboard or trigger download.
 */
export async function shareWordCard(word) {
  const blob = await renderWordCard(word);

  // Try clipboard first
  if (navigator.clipboard && window.ClipboardItem) {
    try {
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob })
      ]);
      return 'copied';
    } catch {}
  }

  // Fallback: download
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `solresol-${word.text}.png`;
  a.click();
  URL.revokeObjectURL(url);
  return 'downloaded';
}
