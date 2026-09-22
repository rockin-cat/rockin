// Chord colours by degree, as in the ROCKIN songbook (the Hooktheory system).
//
// Every chord gets the colour of its root in the major scale of the key (a
// minor key uses the colours of its relative major, so its i is purple):
//   I red · ii orange · iii yellow · IV green · V blue · vi purple · vii° pink
// A chord whose root is not in the scale (a borrowed chord, such as bVII) is
// light pink. The label is the degree in the key of the song: I, IV, vi… in a
// major key; i, III, iv, VII… in a minor key.

import { splitChord, mod } from './theory.js';

const LETTER_PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const pcOf = (name) => mod(LETTER_PC[name[0]] + (name[1] === '#' ? 1 : name[1] === 'b' ? -1 : 0), 12);

const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const MINOR = [0, 2, 3, 5, 7, 8, 10];
const NUMERALS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];

export const DEGREE_COLOURS = ['#ec1c24', '#f7a21b', '#f5e616', '#3fd11a', '#4b52f5', '#9d3fe3', '#f2459a'];
export const BORROWED_COLOUR = '#f3b3ef';

/** Tonal function of each degree of the major scale (by colour index). */
export const FUNCTIONS = [
  { name: 'Tònica', text: 'casa: repòs', degrees: [0, 5, 2] },
  { name: 'Predominant', text: 's\'allunya de casa', degrees: [3, 1] },
  { name: 'Dominant', text: 'tensió: vol tornar a casa', degrees: [4, 6] },
];

/** 'C', 'Am', 'F#m', 'Bbm' → { tonic, minor }. */
export function parseKey(key) {
  const { root, suffix } = splitChord(key);
  return { tonic: pcOf(root), minor: suffix === 'm' };
}

/** A guess for songs without a key: the first chord is home. */
export function guessKey(chords) {
  return chords[0] ?? 'C';
}

const quality = (suffix) => (suffix.startsWith('dim') || suffix === 'm7b5' ? 'dim' : suffix.startsWith('m') && !suffix.startsWith('maj') ? 'minor' : 'major');

/** Readable text colour on a background colour. */
function inkFor(hex) {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? '#1d1d1f' : '#ffffff';
}

/** { label, colour, ink, diatonic, index } for `symbol` in `key`. */
export function degreeOf(symbol, key = 'C') {
  const { tonic, minor } = parseKey(key);
  const { root, suffix } = splitChord(symbol);
  const pc = pcOf(root);
  const q = quality(suffix);
  const scale = minor ? MINOR : MAJOR;
  const semis = mod(pc - tonic, 12);
  let step = scale.indexOf(semis);
  let prefix = '';
  if (step < 0) {
    // Not in the scale: name it from the degree above (bVII) or, in minor, the one below (#).
    const above = scale.findIndex((s) => s === mod(semis + 1, 12));
    if (above >= 0) {
      step = above;
      prefix = '♭';
    } else {
      step = scale.findIndex((s) => s === mod(semis - 1, 12));
      prefix = '♯';
    }
  }
  const numeral = NUMERALS[step];
  const label = `${prefix}${q === 'major' ? numeral : numeral.toLowerCase()}${q === 'dim' ? '°' : ''}`;
  const relative = minor ? mod(tonic + 3, 12) : tonic;
  const index = MAJOR.indexOf(mod(pc - relative, 12));
  const colour = index >= 0 ? DEGREE_COLOURS[index] : BORROWED_COLOUR;
  const expected = index >= 0 ? (index === 6 ? 'dim' : [1, 2, 5].includes(index) ? 'minor' : 'major') : null;
  return { label, colour, ink: inkFor(colour), diatonic: index >= 0 && expected === q, index };
}

/** The seven chords of the key, in the order of the book's side strip (from the tonic). */
export function keyChords(key) {
  const { tonic, minor } = parseKey(key);
  const scale = minor ? MINOR : MAJOR;
  const relative = minor ? mod(tonic + 3, 12) : tonic;
  const NAMES = [5, 10, 3, 8, 1, 6].includes(relative)
    ? ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']
    : ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const qualities = minor ? ['m', 'dim', '', 'm', 'm', '', ''] : ['', 'm', 'm', '', '', 'm', 'dim'];
  return scale.map((s, k) => `${NAMES[mod(tonic + s, 12)]}${qualities[k]}`);
}
