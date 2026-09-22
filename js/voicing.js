// Where the hand plays each chord in "Juga", and how it moves between chords.
//
// Root position first: every chord is built from its root, which sits between
// F3 and E4 (MIDI 53-64), so the hand stays around middle C. In the inversions
// world each chord takes the position closest to the previous one, so shared
// notes stay under the fingers.

import { noteAtOrAbove, parseChord, pitchClass } from './theory.js';

export const LOW = 53;
const HIGH = 79;

const asChord = (chord) => (typeof chord === 'string' ? parseChord(chord) : chord);

function stack(pcs, low) {
  const notes = [noteAtOrAbove(pcs[0], low)];
  for (const pc of pcs.slice(1)) notes.push(noteAtOrAbove(pc, notes.at(-1) + 1));
  return notes;
}

/** Root position, root between F3 and E4. */
export function rootVoicing(chord) {
  return stack(asChord(chord).triad, LOW);
}

/** Two hands: the right hand plays the chord from middle C up (root between C4 and B4). */
export function rightHandVoicing(chord) {
  return stack(asChord(chord).triad, 60);
}

/**
 * Two hands: the left hand, as close to the right one as possible (so both fit
 * on the screen) but below middle C. The bass alone: C3–B3. The whole chord: from
 * C3 up, or an octave lower if it would reach middle C (lowest F2).
 */
export function leftHandVoicing(chord, mode = 'chord') {
  const notes = stack(asChord(chord).triad, 48);
  if (mode === 'bass') return [notes[0]];
  return notes.at(-1) >= 60 ? notes.map((n) => n - 12) : notes;
}

/** Keys to show on screen when playing with two hands (F2–C6). */
export const TWO_HANDS_RANGE = [41, 84];

/** Left-hand fingers, bottom to top: 5-3-1 for a triad, 5 for a single bass note. */
export function leftFingers(notes) {
  if (notes.length === 1) return [5];
  const sorted = [...notes].sort((a, b) => a - b);
  return sorted[1] - sorted[0] >= 5 ? [5, 2, 1] : [5, 3, 1];
}

/** 0 = root position, 1 = first inversion (third at the bottom), 2 = second. */
export function inversionVoicing(chord, inversion, low = LOW) {
  const { triad } = asChord(chord);
  return stack([...triad.slice(inversion), ...triad.slice(0, inversion)], low);
}

/** Which inversion `notes` are (by the lowest note), or -1. */
export function inversionOf(chord, notes) {
  const { triad } = asChord(chord);
  return triad.indexOf(pitchClass(Math.min(...notes)));
}

/** The position of `chord` that moves the fingers least from `previous`. */
export function closestVoicing(previous, chord) {
  let best = null;
  let bestScore = Infinity;
  for (let inversion = 0; inversion < 3; inversion++) {
    for (let low = LOW - 1; low <= 70; low++) {
      const notes = inversionVoicing(chord, inversion, low);
      if (notes[0] !== low || notes.at(-1) > HIGH) continue;
      const moved = notes.reduce((sum, n, i) => sum + Math.abs(n - previous[i]), 0);
      const kept = notes.filter((n) => previous.includes(n)).length;
      const score = moved - kept * 2;
      if (score < bestScore) {
        bestScore = score;
        best = notes;
      }
    }
  }
  return best;
}

/** One voicing per chord symbol, in order. */
export function voiceChain(symbols, inversions = false) {
  let previous = null;
  return symbols.map((symbol) => {
    const notes = inversions && previous ? closestVoicing(previous, symbol) : rootVoicing(symbol);
    previous = notes;
    return notes;
  });
}

/** Right-hand fingers for a close triad: 1-3-5, or 1-2-5 when the top gap is a fourth. */
export function fingers(notes) {
  const sorted = [...notes].sort((a, b) => a - b);
  return sorted[2] - sorted[1] >= 5 ? [1, 2, 5] : [1, 3, 5];
}

export const FINGER_NAME = { 1: 'polze (1)', 2: 'índex (2)', 3: 'dit del mig (3)', 4: 'anular (4)', 5: 'dit petit (5)' };

/**
 * How the hand goes from one chord to the next: for each finger, where it goes;
 * which keys are played in both chords and whether the same finger keeps them.
 * `nameOf(midi, which)` names a key (which = 'from' | 'to').
 */
export function describeChange(from, to, nameOf) {
  const a = [...from].sort((x, y) => x - y);
  const b = [...to].sort((x, y) => x - y);
  const fa = fingers(a);
  const fb = fingers(b);
  const moves = b.map((note, i) => ({ finger: fb[i], from: a[i], to: note, diff: note - a[i] }));
  const shared = b.filter((n) => a.includes(n)).map((n) => ({
    note: n,
    fingerFrom: fa[a.indexOf(n)],
    fingerTo: fb[b.indexOf(n)],
  }));
  const same = moves.every((m) => m.diff === moves[0].diff);
  const side = (d) => (d > 0 ? 'cap a la dreta' : 'cap a l\'esquerra');
  const far = (d) => (Math.abs(d) <= 2 ? 'una mica' : 'un bon salt');
  const lines = [];
  if (same && moves[0].diff !== 0) {
    lines.push(`Tota la mà fa <b>${far(moves[0].diff)} ${side(moves[0].diff)}</b> i la forma dels dits no canvia.`);
  } else {
    for (const m of moves) {
      const where = m.diff === 0 ? '<b>es queda quiet</b>' : `va <b>${side(m.diff)}</b>`;
      lines.push(`Dit ${m.finger}: ${nameOf(m.from, 'from')} → ${nameOf(m.to, 'to')}, ${where}.`);
    }
  }
  for (const s of shared) {
    lines.push(s.fingerFrom === s.fingerTo
      ? `El <b>${nameOf(s.note, 'to')}</b> és als dos acords: <b>no aixequis</b> el dit ${s.fingerTo}.`
      : `El <b>${nameOf(s.note, 'to')}</b> és als dos acords: primer amb el dit ${s.fingerFrom} i després amb el dit ${s.fingerTo}.`);
  }
  return { moves, shared, lines, fingersFrom: fa, fingersTo: fb };
}
