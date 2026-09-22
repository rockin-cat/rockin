// Music theory helpers: note names, chord symbols, progressions, time signatures.

const LETTER_PITCH_CLASS = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const PITCH_CLASS_NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

export const mod = (n, m) => ((n % m) + m) % m;
export const pitchClass = (midiNote) => mod(midiNote, 12);
export const pitchClassName = (pc) => PITCH_CLASS_NAMES[pc];
export const noteName = (midiNote) => `${PITCH_CLASS_NAMES[pitchClass(midiNote)]}${Math.floor(midiNote / 12) - 1}`;

// `triad` is root, "third" and fifth (what Level 2 asks for; sus chords use
// their 2nd/4th in the third's place). `extra` are further chord tones that
// Level 3 also accepts.
const quality = (triad, ...extra) => ({ triad, extra });
const MAJOR = [0, 4, 7];
const MINOR = [0, 3, 7];
const DIMINISHED = [0, 3, 6];
const AUGMENTED = [0, 4, 8];
const SUS2 = [0, 2, 7];
const SUS4 = [0, 5, 7];

const QUALITIES = {
  '': quality(MAJOR),
  M: quality(MAJOR),
  maj: quality(MAJOR),
  m: quality(MINOR),
  min: quality(MINOR),
  '-': quality(MINOR),
  dim: quality(DIMINISHED),
  '°': quality(DIMINISHED),
  o: quality(DIMINISHED),
  aug: quality(AUGMENTED),
  '+': quality(AUGMENTED),
  sus: quality(SUS4),
  sus4: quality(SUS4),
  sus2: quality(SUS2),
  6: quality(MAJOR, 9),
  m6: quality(MINOR, 9),
  7: quality(MAJOR, 10),
  maj7: quality(MAJOR, 11),
  M7: quality(MAJOR, 11),
  'Δ': quality(MAJOR, 11),
  'Δ7': quality(MAJOR, 11),
  m7: quality(MINOR, 10),
  min7: quality(MINOR, 10),
  '-7': quality(MINOR, 10),
  m7b5: quality(DIMINISHED, 10),
  'ø': quality(DIMINISHED, 10),
  'ø7': quality(DIMINISHED, 10),
  dim7: quality(DIMINISHED, 9),
  '°7': quality(DIMINISHED, 9),
  o7: quality(DIMINISHED, 9),
  '7sus4': quality(SUS4, 10),
  add9: quality(MAJOR, 2),
  9: quality(MAJOR, 10, 2),
  m9: quality(MINOR, 10, 2),
};

const CHORD_RE = /^([A-G])([#b]?)(.*?)(?:\/([A-G])([#b]?))?$/;

const letterToPitchClass = (letter, accidental) =>
  mod(LETTER_PITCH_CLASS[letter] + (accidental === '#' ? 1 : accidental === 'b' ? -1 : 0), 12);

export function parseChord(symbol) {
  const text = symbol.trim().replace(/♯/g, '#').replace(/♭/g, 'b');
  const match = CHORD_RE.exec(text);
  if (!match) throw new Error(`No reconec l'acord "${symbol}"`);
  const [, letter, accidental, suffix, bassLetter, bassAccidental] = match;
  const q = QUALITIES[suffix];
  if (!q) throw new Error(`Tipus d'acord no suportat "${suffix}" a "${symbol}"`);

  const root = letterToPitchClass(letter, accidental);
  const transpose = (intervals) => intervals.map((i) => mod(root + i, 12));
  return {
    symbol: text,
    root,
    triad: transpose(q.triad),
    tones: transpose([...q.triad, ...q.extra]),
    bass: bassLetter ? letterToPitchClass(bassLetter, bassAccidental) : root,
  };
}

/** "C | Am | F | G" -> one chord per bar. "%" repeats the previous bar. */
export function parseProgression(text) {
  const bars = text.split('|').map((s) => s.trim()).filter(Boolean);
  if (!bars.length) throw new Error('La progressió d\'acords és buida');
  const chords = [];
  bars.forEach((bar, i) => {
    if (bar === '%') {
      if (!chords.length) throw new Error('"%" no pot ser el primer compàs');
      chords.push(chords.at(-1));
      return;
    }
    const tokens = bar.split(/\s+/);
    if (tokens.length > 1) {
      throw new Error(`El compàs ${i + 1} ("${bar}") té més d'un acord; només se'n permet un per compàs`);
    }
    chords.push(parseChord(tokens[0]));
  });
  return chords;
}

export function parseTimeSignature(text) {
  const match = /^\s*(\d+)\s*\/\s*(\d+)\s*$/.exec(text);
  if (!match) throw new Error(`El compàs ha de ser com "4/4", no "${text}"`);
  const beats = Number(match[1]);
  const beatUnit = Number(match[2]);
  if (beats < 1 || beats > 16 || ![2, 4, 8, 16].includes(beatUnit)) {
    throw new Error(`Compàs no suportat "${text}"`);
  }
  // 6/8, 9/8, 12/8: the felt pulse is a dotted note that divides in three.
  const compound = beatUnit >= 8 && beats > 3 && beats % 3 === 0;
  return {
    label: `${beats}/${beatUnit}`,
    beats,
    beatUnit,
    compound,
    pulses: compound ? beats / 3 : beats,
    unitsPerPulse: compound ? 3 : 1,
  };
}

/** Splits a chord symbol into { root, suffix, bass } names without validating the quality. */
export function splitChord(symbol) {
  const match = CHORD_RE.exec(symbol.trim().replace(/♯/g, '#').replace(/♭/g, 'b'));
  if (!match) throw new Error(`No reconec l'acord "${symbol}"`);
  const [, letter, accidental, suffix, bassLetter, bassAccidental] = match;
  return { root: letter + accidental, suffix, bass: bassLetter ? bassLetter + bassAccidental : null };
}

export const CHORD_SUFFIXES = Object.keys(QUALITIES);

// ---- Suggested keys for the on-screen keyboard ----------------------------

/** Lowest MIDI note >= `low` with pitch class `pc`. */
export const noteAtOrAbove = (pc, low) => low + mod(pc - low, 12);

/** The chord's triad stacked upwards in root position, root at or above `low`. */
export function triadNotes(chord, low = 60) {
  const notes = [noteAtOrAbove(chord.root, low)];
  for (const pc of chord.triad.slice(1)) notes.push(noteAtOrAbove(pc, notes.at(-1) + 1));
  return notes;
}

/**
 * One way to play a melodic contour: rank 0 is the root (at or above `low`) and
 * each higher rank is the next triad note up.
 */
export function contourNotes(chord, contour, low = 60) {
  const ladder = [noteAtOrAbove(chord.root, low)];
  const order = [...chord.triad];
  const top = Math.max(0, ...contour);
  for (let i = 1; i <= top; i++) ladder.push(noteAtOrAbove(order[i % order.length], ladder.at(-1) + 1));
  return contour.map((rank) => ladder[rank]);
}
