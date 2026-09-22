// Improvisation ("Improvisa"): the band plays and you invent. Nothing is right
// or wrong here, so this module only decides what to offer on the keyboard,
// what to suggest trying, and how to tell afterwards what happened.

import { parseChord, pitchClass, mod } from './theory.js';
import { parseKey } from './degrees.js';

const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const MINOR = [0, 2, 3, 5, 7, 8, 10];
const PENTA_MAJOR = [0, 2, 4, 7, 9];
const PENTA_MINOR = [0, 3, 5, 7, 10];

export const GUIDES = [
  { id: 'acord', label: 'Notes de l\'acord', note: 'Les tres notes del que sona ara: sempre encaixen.' },
  { id: 'penta', label: 'Pentatònica', note: 'Cinc notes per a tota la roda: és difícil equivocar-se.' },
  { id: 'escala', label: 'Escala sencera', note: 'Les set notes de la tonalitat; les de l\'acord, plenes.' },
  { id: 'res', label: 'Res marcat', note: 'El teclat no diu res: toca d\'oïda.' },
];

export const MODES = [
  { id: 'lliure', label: 'Roda oberta', note: 'La banda no s\'atura i tu improvises per sobre.' },
  { id: 'dialeg', label: 'Pregunta i resposta', note: 'Mitja roda pregunta el piano i l\'altra mitja contestes tu.' },
  { id: 'reptes', label: 'Reptes curts', note: 'Una consigna cada vegada, amb la banda.' },
];

/**
 * What the keyboard offers for a chord in a key.
 * Returns { full: [pitch classes], strong: [pitch classes of the chord] }.
 */
export function guideNotes(symbol, key, guide) {
  const chord = parseChord(symbol);
  const strong = chord.triad;
  if (guide === 'res') return { full: [], strong: [] };
  if (guide === 'acord') return { full: strong, strong };
  const { tonic, minor } = parseKey(key);
  const steps = guide === 'penta' ? (minor ? PENTA_MINOR : PENTA_MAJOR) : minor ? MINOR : MAJOR;
  return { full: steps.map((s) => mod(tonic + s, 12)), strong };
}

/**
 * The "question" of call and response: a short pentatonic phrase with a shape
 * and an ending that asks for an answer (it stops on the second or the fifth,
 * never at home), so it sounds like a question and not like random notes.
 * Returns [{ at, note }] with `at` in pulses from the start of the block.
 */
// Rhythm cells for one bar (in pulses) and for the last bar of the question,
// which stops early and leaves the last note ringing: that is what asks.
const BAR_CELLS = [[0, 1, 2], [0, 1, 1.5, 2], [0, 0.5, 1, 2], [0, 2, 2.5], [0, 1, 2, 3], [0.5, 1, 2], [0, 1.5, 2], [0, 1, 2, 2.5]];
const END_CELLS = [[0], [0, 1], [0, 0.5, 1], [0, 1.5]];
const pick = (list) => list[Math.floor(Math.random() * list.length)];

export function callPhrase(symbol, key, { pulses = 4, bars = 2 } = {}) {
  const { tonic, minor } = parseKey(key);
  const steps = minor ? PENTA_MINOR : PENTA_MAJOR;
  const scale = steps.map((s) => mod(tonic + s, 12));
  const chord = parseChord(symbol);
  // The pentatonic laid out as a ladder of keys around the middle of the piano.
  const ladder = [];
  for (let n = 60; n <= 84; n++) if (scale.includes(pitchClass(n))) ladder.push(n);
  if (!ladder.length) return [];
  // Notes that ask a question: the second and the fifth of the key (never home).
  const question = [mod(tonic + steps[1], 12), mod(tonic + steps[3], 12)];
  const near = (pc, around) => {
    let best = ladder[0];
    for (const n of ladder) if (pitchClass(n) === pc && Math.abs(n - around) < Math.abs(best - around)) best = n;
    return best;
  };
  // The question fills the whole block (half the wheel): a cell per bar, and a
  // shorter one to finish, so it breathes before the answer.
  const times = [];
  for (let b = 0; b < bars; b++) {
    const cell = b === bars - 1 ? pick(END_CELLS) : pick(BAR_CELLS);
    for (const at of cell) if (at < pulses) times.push(b * pulses + at);
  }
  // Start on a note of the chord, around the middle, and draw an arch: up for
  // most of the phrase, then down towards the note that asks.
  const starts = ladder.filter((n) => chord.triad.includes(pitchClass(n)) && n >= 62 && n <= 72);
  let i = ladder.indexOf(starts.length ? pick(starts) : near(scale[0], 67));
  const peak = Math.max(1, Math.floor(times.length * 0.6));
  const out = [];
  times.forEach((at, k) => {
    if (k > 0) {
      const dir = k <= peak ? 1 : -1;
      const size = Math.random() < 0.2 ? 2 : 1;
      const turn = Math.random() < 0.12 ? -1 : 1; // a small turn now and then
      i = Math.max(0, Math.min(ladder.length - 1, i + dir * size * turn));
    }
    out.push({ at, note: ladder[i] });
  });
  // The last note asks: move it to the nearest second or fifth of the key.
  const last = out.at(-1);
  const asks = question.map((pc) => near(pc, last.note));
  last.note = asks.reduce((a, b) => (Math.abs(a - last.note) <= Math.abs(b - last.note) ? a : b));
  return out;
}

export const CHALLENGES = [
  { id: 'tres', text: 'Només <b>tres notes diferents</b> en tota la volta.', check: (s) => s.distinct <= 3, ok: 'Tres notes i prou: això és fer música amb poc.' },
  { id: 'puja', text: 'Fes una frase que <b>pugi</b> i acabi amunt.', check: (s) => s.last !== null && s.first !== null && s.last > s.first, ok: 'Ha pujat: es nota cap on anava.' },
  { id: 'baixa', text: 'Fes una frase que <b>baixi</b> i acabi avall.', check: (s) => s.last !== null && s.first !== null && s.last < s.first, ok: 'Ha baixat fins al final.' },
  { id: 'silenci', text: '<b>Deixa respirar</b>: un compàs sencer sense tocar.', check: (s) => s.emptyBars >= 1, ok: 'El silenci també és música.' },
  { id: 'temps', text: 'Una nota <b>a cada temps</b>, ni més ni menys.', check: (s) => s.onBeat >= s.notes * 0.8 && s.notes >= s.bars * 2, ok: 'Ben plantada al pols.' },
  { id: 'contratemps', text: 'Comença <b>a contratemps</b> (entre dos temps).', check: (s) => s.offBeat >= 1, ok: 'Entrar fora del temps fa que soni viu.' },
  { id: 'acaba', text: 'Acaba en una <b>nota de l\'acord</b>.', check: (s) => s.lastInChord, ok: 'Final rodó.' },
  { id: 'repeteix', text: 'Inventa una idea i <b>repeteix-la</b> a la volta següent.', check: null, ok: 'Repetir una idea és el que la fa reconeixible.' },
];

/** Friendly reading of what happened. Never a mark, never a star. */
export function readStats(s) {
  const lines = [];
  if (!s.notes) {
    lines.push('No has tocat res aquesta vegada: cap problema, torna-hi quan vulguis.');
    return lines;
  }
  lines.push(`Has tocat <b>${s.notes} ${s.notes === 1 ? 'nota' : 'notes'}</b> en ${s.bars} compassos, amb <b>${s.distinct}</b> ${s.distinct === 1 ? 'nota diferent' : 'notes diferents'}.`);
  const share = Math.round((s.inChord / s.notes) * 100);
  lines.push(share >= 80
    ? `Gairebé tot eren notes de l'acord (${share}%): sona molt segur. Prova d'afegir-hi alguna nota de pas.`
    : share >= 40
      ? `${share}% de les notes eren de l'acord que sonava: barreja bona entre notes segures i notes de pas.`
      : `Només ${share}% de notes de l'acord: molt lliure. Si vols que s'assenti més, cau en una nota de l'acord al final de cada frase.`);
  const places = s.places;
  lines.push(places <= 2
    ? 'Has tocat gairebé sempre al mateix lloc del compàs: prova d\'entrar a contratemps.'
    : places >= 5
      ? 'Has fet servir molts llocs diferents del compàs: ritme ben variat.'
      : 'Ritme amb una mica de varietat dins del compàs.');
  if (s.emptyBars) lines.push(`Has deixat <b>${s.emptyBars} ${s.emptyBars === 1 ? 'compàs' : 'compassos'}</b> de silenci: molt bé, deixar respirar també toca.`);
  else lines.push('No has parat gens: prova de deixar un compàs sencer de silenci, fa que el que ve després es senti més.');
  return lines;
}

/** A new, empty set of counters for one improvisation. */
export function emptyStats() {
  return { notes: 0, inChord: 0, inScale: 0, distinct: 0, places: 0, bars: 0, emptyBars: 0, onBeat: 0, offBeat: 0, first: null, last: null, lastInChord: false, _pcs: new Set(), _slots: new Set(), _barsWith: new Set() };
}

/**
 * One note played: `f` is where it fell in the bar (0..1), `bar` which bar,
 * `chordSymbol` what the band was playing, `pulses` the beats in the bar.
 */
export function countNote(s, { note, f, bar, chordSymbol, guide, key, pulses = 4 }) {
  const pc = pitchClass(note);
  const { full, strong } = guideNotes(chordSymbol, key, guide === 'res' ? 'escala' : guide);
  s.notes++;
  s._pcs.add(pc);
  s.distinct = s._pcs.size;
  const slot = Math.round(f * pulses * 2) % (pulses * 2);
  s._slots.add(slot);
  s.places = s._slots.size;
  s._barsWith.add(bar);
  if (strong.includes(pc)) s.inChord++;
  if (full.includes(pc)) s.inScale++;
  if (slot % 2 === 0) s.onBeat++;
  else s.offBeat++;
  if (s.first === null) s.first = note;
  s.last = note;
  s.lastInChord = strong.includes(pc);
}

/** Called when the improvisation ends: fills in how many bars went by empty. */
export function closeStats(s, bars) {
  s.bars = bars;
  s.emptyBars = Math.max(0, bars - s._barsWith.size);
  return s;
}
