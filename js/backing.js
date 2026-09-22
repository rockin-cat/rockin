// Backing track: synthesised drums, bass and (optionally) a piano that comps
// the chords, in several styles, plus a count-in click. The transport decides
// when each grid step happens; this module decides what sounds on it.
//
// The grid is fine enough for every style: 12 steps per pulse in simple meters
// (so both sixteenths and triplets land on it) and 6 per pulse in compound
// meters (the pulse already divides in three).

import { mod, noteAtOrAbove, parseChord } from './theory.js';
import { pianoSound } from './piano-sound.js';

export const STYLES = [
  { id: 'rock', name: 'Rock / Pop', hint: 'Corxeres rectes. En 6/8 i 12/8 sona com un blues lent.' },
  { id: 'shuffle', name: 'Blues shuffle', hint: 'Corxeres swing i baix de boogie.' },
  { id: 'ballad', name: 'Balada', hint: 'Bateria suau, baix llarg i pad.' },
  { id: 'swing', name: 'Swing / Jazz', hint: 'Ride de swing i walking bass.' },
  { id: 'bossa', name: 'Bossa nova', hint: 'Clave de bossa, millor en 4/4.' },
  { id: 'funk', name: 'Funk', hint: 'Semicorxeres i baix sincopat.' },
  { id: 'reggaeton', name: 'Reggaeton', hint: 'Ritme dembow: bombo a cada temps i caixa sincopada.' },
  { id: 'rumba', name: 'Rumba catalana', hint: 'Ventilador: rasgueig a cada temps i palmes al 2 i al 4.' },
  { id: 'reggae', name: 'Reggae', hint: 'One drop: bombo al 3r temps i skank als contratemps.' },
  { id: 'ska', name: 'Ska', hint: 'Rasgueigs a tots els contratemps i baix caminant. Va molt de pressa.' },
  { id: 'cumbia', name: 'Cúmbia', hint: 'Güira a les corxeres, baix als temps 2 i 4 i guitarra als contratemps.' },
  { id: 'hiphop', name: 'Hip-hop', hint: 'Boom bap: bombo greu, caixa als temps 2 i 4 i baix llarg. Millor a poc a poc.' },
  { id: 'vals', name: 'Vals', hint: 'Baix al primer temps i acord als altres dos. Pensat per al 3/4.' },
  { id: 'metronome', name: 'Només metrònom', hint: 'Un clic a cada pols.' },
];

export const stepsPerPulse = (meter) => (meter.compound ? 6 : 12);

const SHARP_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLAT_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
/**
 * Chords of the same key to move around a single chord: with one note held as a
 * pedal (level 1), the band playing I – vi – IV – V is far less tiring than the
 * same chord over and over, and every chord still fits the note.
 */
/** The dominant (V7) of a chord: the natural chord to come in from. */
export function dominantOf(symbol) {
  try {
    const chord = parseChord(symbol);
    const minor = mod(chord.triad[1] - chord.root, 12) === 3;
    const names = [5, 10, 3, 8, 1].includes(mod(chord.root + (minor ? 3 : 0), 12)) ? FLAT_NAMES : SHARP_NAMES;
    return `${names[mod(chord.root + 7, 12)]}7`;
  } catch {
    return symbol;
  }
}

export function pedalHarmony(symbol) {
  try {
    const chord = parseChord(symbol);
    const minor = mod(chord.triad[1] - chord.root, 12) === 3;
    const steps = minor ? [[0, 'm'], [8, ''], [3, ''], [10, '']] : [[0, ''], [9, 'm'], [5, ''], [7, '']];
    const names = [5, 10, 3, 8, 1].includes(mod(chord.root + (minor ? 3 : 0), 12)) ? FLAT_NAMES : SHARP_NAMES;
    return steps.map(([i, q]) => parseChord(`${names[mod(chord.root + i, 12)]}${q}`));
  } catch {
    return null;
  }
}

const BASS_LOW = 33; // A1: bass notes sit between A1 and G#2 (plus octaves)
const COMP_LOW = 52; // E3: lowest note of the piano voicings

const midiToFreq = (note) => Tone.Frequency(note, 'midi').toFrequency();
const midiToName = (note) => Tone.Frequency(note, 'midi').toNote();

export function createBacking({ style = 'rock', chords = true, volume = -6, metronome = false, endBar = Infinity } = {}) {
  const output = new Tone.Volume(volume).toDestination();

  const bass = new Tone.MonoSynth({
    oscillator: { type: 'sawtooth' },
    filter: { type: 'lowpass', rolloff: -24, Q: 1 },
    envelope: { attack: 0.005, decay: 0.2, sustain: 0.6, release: 0.12 },
    filterEnvelope: { attack: 0.005, decay: 0.15, sustain: 0.3, release: 0.2, baseFrequency: 120, octaves: 2.5 },
    volume: -4,
  }).connect(output);

  const kick = new Tone.MembraneSynth({
    pitchDecay: 0.03,
    octaves: 6,
    envelope: { attack: 0.001, decay: 0.35, sustain: 0 },
  }).connect(output);

  const snareFilter = new Tone.Filter(1800, 'highpass').connect(output);
  const snare = new Tone.NoiseSynth({
    noise: { type: 'white' },
    envelope: { attack: 0.001, decay: 0.14, sustain: 0 },
    volume: -10,
  }).connect(snareFilter);

  const rim = new Tone.MembraneSynth({
    pitchDecay: 0.005,
    octaves: 1.5,
    envelope: { attack: 0.001, decay: 0.05, sustain: 0 },
    volume: -14,
  }).connect(output);

  // Cymbals are filtered noise: much lighter on the CPU than Tone.MetalSynth.
  const hatFilter = new Tone.Filter(7000, 'highpass').connect(output);
  const hat = new Tone.NoiseSynth({
    noise: { type: 'white' },
    envelope: { attack: 0.001, decay: 0.04, sustain: 0, release: 0.01 },
    volume: -20,
  }).connect(hatFilter);
  const openHat = new Tone.NoiseSynth({
    noise: { type: 'white' },
    envelope: { attack: 0.001, decay: 0.25, sustain: 0, release: 0.05 },
    volume: -24,
  }).connect(hatFilter);
  const rideFilter = new Tone.Filter({ frequency: 5500, type: 'bandpass', Q: 0.8 }).connect(output);
  const ride = new Tone.NoiseSynth({
    noise: { type: 'white' },
    envelope: { attack: 0.001, decay: 0.45, sustain: 0, release: 0.1 },
    volume: -18,
  }).connect(rideFilter);

  const click = new Tone.Synth({
    oscillator: { type: 'square' },
    envelope: { attack: 0.001, decay: 0.04, sustain: 0, release: 0.01 },
    volume: -12,
  }).connect(output);

  // One oscillator per voice (a single wave with a few harmonics) keeps the piano light.
  // It sits behind the band: the student's own playing has to be the loudest thing.
  const piano = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'custom', partials: [1, 0.5, 0.25, 0.12] },
    envelope: { attack: 0.004, decay: 0.8, sustain: 0.12, release: 0.3 },
    volume: -24,
  }).connect(output);
  piano.maxPolyphony = 12;

  // Guitar: a short plucked sound, strummed note by note. It carries the off-beats
  // and the skanks, so the mix doesn't rest on the piano alone.
  const guitarFilter = new Tone.Filter(180, 'highpass').connect(output);
  const guitar = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'custom', partials: [1, 0.7, 0.45, 0.3, 0.15] },
    envelope: { attack: 0.002, decay: 0.45, sustain: 0.08, release: 0.3 },
    volume: -9,
  }).connect(guitarFilter);
  guitar.maxPolyphony = 12;

  const tom = new Tone.MembraneSynth({
    pitchDecay: 0.05,
    octaves: 3,
    envelope: { attack: 0.001, decay: 0.25, sustain: 0 },
    volume: -12,
  }).connect(output);

  const crash = new Tone.NoiseSynth({
    noise: { type: 'white' },
    envelope: { attack: 0.002, decay: 1.2, sustain: 0, release: 0.4 },
    volume: -26,
  }).connect(rideFilter);

  const padFilter = new Tone.Filter(1400, 'lowpass').connect(output);
  const pad = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'sawtooth' },
    envelope: { attack: 0.35, decay: 0.3, sustain: 0.7, release: 0.8 },
    volume: -24,
  }).connect(padFilter);
  pad.maxPolyphony = 8;

  // The example ("Escolta") plays on the shared piano, not affected by the backing volume.
  const demo = pianoSound();

  // A separate click that can sound over any style (count-in and metronome).
  const beatClick = new Tone.Synth({
    oscillator: { type: 'square' },
    envelope: { attack: 0.001, decay: 0.05, sustain: 0, release: 0.01 },
    volume: -8,
  }).toDestination();

  const nodes = [beatClick, bass, kick, snare, snareFilter, rim, hat, openHat, hatFilter, ride, rideFilter, crash, tom, click, piano, guitar, guitarFilter, pad, padFilter, output];

  let styleId = style;
  let chordsOn = chords;
  let metronomeOn = metronome;
  // When the student is holding one single note (a pedal), the band can move
  // around it with chords of the same key, so the loop isn't exhausting.
  let harmony = null;
  let harmonyFrom = 0; // the bar where the cycle's first chord falls

  // ---- Sound helpers --------------------------------------------------------

  const bassRoot = (chord) => noteAtOrAbove(chord.bass, BASS_LOW);
  const interval = (chord, n) => noteAtOrAbove(chord.root, BASS_LOW) + n; // `n` semitones above the chord root
  const third = (chord) => mod(chord.triad[1] - chord.root, 12);

  function playBass(s, note, beats, velocity = 0.8) {
    bass.triggerAttackRelease(midiToFreq(note), Math.max(0.05, beats * s.beat * 0.9), s.time, hum(s, velocity, 0.14, 9));
  }

  function voicingNotes(chord) {
    const notes = [];
    // Root on top of the other tones is fine; the bass already has it.
    for (const pc of chord.tones) {
      notes.push(noteAtOrAbove(pc, COMP_LOW));
    }
    notes.sort((a, b) => a - b);
    // Keep the voicing within about an octave and a half.
    return notes.map((n) => (n - notes[0] > 16 ? n - 12 : n)).sort((a, b) => a - b);
  }

  const voicing = (chord) => voicingNotes(chord).map(midiToName);

  function comp(s, beats, velocity = 0.6) {
    if (!chordsOn) return;
    piano.triggerAttackRelease(voicing(s.chord), Math.max(0.05, beats * s.beat), s.time, hum(s, velocity, 0.18, 10));
  }

  function padChord(s, beats, velocity = 0.5) {
    if (!chordsOn) return;
    pad.triggerAttackRelease(voicing(s.chord), beats * s.beat * 0.95, s.time, velocity);
  }

  /** The guitar's chord, a bit higher than the piano's. */
  function guitarVoicing(chord) {
    const notes = voicingNotes(chord);
    const up = notes[0] < 55 ? 12 : 0;
    return notes.map((n) => midiToName(n + up));
  }

  /** A strum: the notes one after another, down or up. */
  function strum(s, beats, velocity = 0.5, down = true) {
    if (!chordsOn) return;
    const notes = guitarVoicing(s.chord);
    const order = down ? notes : [...notes].reverse();
    const gap = Math.min(0.018, (s.beat * beats) / 8);
    order.forEach((note, k) => {
      guitar.triggerAttackRelease(note, Math.max(0.05, beats * s.beat), s.time + k * gap, hum(s, velocity * (down ? 1 - k * 0.06 : 0.85), 0.16, 11 + k));
    });
  }

  /** One note of the chord, for arpeggios. */
  function pluck(s, index, beats, velocity = 0.45) {
    if (!chordsOn) return;
    const notes = guitarVoicing(s.chord);
    guitar.triggerAttackRelease(notes[mod(index, notes.length)], Math.max(0.05, beats * s.beat), s.time, velocity);
  }

  // A deterministic wobble in the velocities: without it the band sounds like a
  // machine, and a real band never plays two bars exactly the same.
  const wobble = (s, k = 0) => {
    const n = Math.sin((s.bar * 37.13 + s.pulse * 11.7 + s.sub * 3.31 + k * 7.9) * 12.9898) * 43758.5453;
    return n - Math.floor(n);
  };
  const hum = (s, v, spread = 0.14, k = 0) => Math.max(0.05, Math.min(1, v * (1 - spread / 2 + wobble(s, k) * spread)));

  const kickAt = (s, v = 0.9) => kick.triggerAttackRelease('C1', 0.2, s.time, hum(s, v, 0.12, 1));
  const tomAt = (s, v = 0.7, note = 'G2') => tom.triggerAttackRelease(note, 0.18, s.time, hum(s, v, 0.12, 2));
  const crashAt = (s, v = 0.4) => crash.triggerAttackRelease(0.8, s.time, hum(s, v, 0.1, 3));
  const snareAt = (s, v = 0.9) => snare.triggerAttackRelease(0.12, s.time, hum(s, v, 0.16, 4));
  const rimAt = (s, v = 0.8) => rim.triggerAttackRelease('A5', 0.03, s.time, hum(s, v, 0.16, 5));
  const hatAt = (s, v = 0.6) => hat.triggerAttackRelease(0.03, s.time, hum(s, v, 0.3, 6));
  const openHatAt = (s, v = 0.6) => openHat.triggerAttackRelease(0.2, s.time, hum(s, v, 0.2, 7));
  const rideAt = (s, v = 0.6) => ride.triggerAttackRelease(0.3, s.time, hum(s, v, 0.22, 8));
  const clickAt = (s, accent) => click.triggerAttackRelease(accent ? 'C6' : 'G5', 0.03, s.time);

  // Every four bars the drums answer with a small fill on the last beat, and the
  // next phrase opens with a crash: it marks the phrases and keeps the loop alive.
  const FILL_SIMPLE = [0, 0.25, 0.5, 0.75];
  const FILL_COMPOUND = [0, 1 / 3, 2 / 3];
  function fill(s) {
    if ((s.bar + 1) % 4 !== 0 || s.pulse !== s.pulses - 1) return false;
    const spots = s.compound ? FILL_COMPOUND : FILL_SIMPLE;
    const k = spots.findIndex((f) => s.is(f));
    if (k < 0) return false;
    const v = 0.4 + k * 0.15;
    if (k === 0) snareAt(s, v);
    else if (k === spots.length - 1) tomAt(s, v + 0.1, 'E2');
    else tomAt(s, v, k % 2 ? 'C3' : 'A2');
    // The bass answers the fill walking up to the next chord.
    if (k > 0) {
      const target = bassRoot(s.next);
      const steps = spots.length - 1;
      playBass(s, target - 2 * (steps - k), 1 / spots.length, 0.7);
    }
    return true;
  }

  // Every other phrase the guitar adds a little lick over the fill.
  function guitarLick(s) {
    if ((s.bar + 1) % 8 !== 0 || s.pulse !== s.pulses - 1 || !chordsOn) return;
    if (s.is(0.5)) pluck(s, 2, 0.3, 0.4);
    if (s.is(0.75)) pluck(s, 1, 0.3, 0.35);
  }

  const phraseStart = (s) => s.bar % 4 === 0 && s.pulse === 0 && s.sub === 0;

  // ---- Styles ---------------------------------------------------------------
  // Each receives the step `s` (see playStep) and plays whatever falls on it.

  const styles = {
    rock(s) {
      if (phraseStart(s)) crashAt(s, 0.45);
      const filling = fill(s);
      if (!filling && s.isAny(s.eighths)) hatAt(s, s.sub === 0 ? 0.9 : 0.5);
      if (s.sub === 0) {
        if (s.strong) kickAt(s);
        if (s.backbeat && !filling) snareAt(s, s.pulses % 2 ? 0.5 : 0.9);
        // The piano only marks the chord on the first (and middle) beat; the guitar does the rest.
        if (s.pulse === 0 || (s.pulses >= 4 && s.pulse === Math.floor(s.pulses / 2))) {
          comp(s, s.compound ? 1 : 0.9, s.pulse === 0 ? 0.55 : 0.35);
        }
        if (s.pulse === 0) strum(s, 0.4, 0.34);
      }
      // Guitar chops on the off-beats: they fill the bar without covering the student.
      if (!s.compound && s.is(0.5) && !filling) strum(s, 0.25, s.backbeat ? 0.32 : 0.22, false);
      if (s.compound && s.isAny([2 / 3]) && !filling) strum(s, 0.2, 0.26, false);
      if (s.pulses === 4 && s.pulse === 2 && s.is(0.5)) kickAt(s, 0.7);
      // Every second bar breathes differently: an open hat at the end and a
      // ghost note on the snare, so two bars are never identical.
      const second = s.bar % 2 === 1;
      if (second && !filling && s.pulse === s.pulses - 1 && s.is(0.5)) openHatAt(s, 0.45);
      if (second && !filling && s.pulses === 4 && s.pulse === 1 && s.is(0.75)) snareAt(s, 0.18);
      if (s.isAny(s.eighths)) {
        const lastEighth = s.pulse === s.pulses - 1 && s.sub !== 0;
        // The bass lifts to the fifth in the second bar, and walks out at the end.
        const note = lastEighth && s.compound
          ? interval(s.chord, 7)
          : second && s.pulse >= s.pulses - 2 && s.sub !== 0
            ? interval(s.chord, 7)
            : bassRoot(s.chord);
        playBass(s, note, s.compound ? 1 / 3 : 0.5, s.sub === 0 ? 0.85 : 0.6);
      }
    },

    shuffle(s) {
      if (phraseStart(s)) crashAt(s, 0.4);
      const filling = fill(s);
      if (!s.isAny(s.swing)) return;
      const up = s.sub !== 0;
      if (!filling) hatAt(s, up ? 0.45 : 0.85);
      if (!up) {
        if (s.strong) kickAt(s);
        if (s.backbeat && !filling) snareAt(s, 0.85);
      }
      if (up && s.backbeat) strum(s, 0.25, 0.4, false);
      if (!up && s.pulse === 0) comp(s, 0.3, 0.5);
      if (!up && s.backbeat) strum(s, 0.3, 0.3);
      // Boogie line: 1 3 5 6 b7 6 5 3 on the swung eighths.
      const line = [0, third(s.chord), 7, 9, 10, 9, 7, third(s.chord)];
      const index = (s.pulse * 2 + (up ? 1 : 0)) % line.length;
      playBass(s, interval(s.chord, line[index]), up ? 0.33 : 0.66, up ? 0.6 : 0.85);
    },

    ballad(s) {
      if (phraseStart(s)) crashAt(s, 0.25);
      if (s.isAny(s.eighths)) hatAt(s, s.sub === 0 ? 0.45 : 0.25);
      // A guitar arpeggio: one note of the chord on every eighth, going up and down.
      if (s.isAny(s.eighths)) {
        const step = s.compound ? s.pulse * 3 + Math.round(s.sub / (s.subsPerPulse / 3)) : s.pulse * 2 + (s.sub === 0 ? 0 : 1);
        const shape = [0, 1, 2, 1];
        pluck(s, shape[step % shape.length] + (step >= 4 ? 1 : 0), 0.9, s.sub === 0 ? 0.4 : 0.3);
      }
      if (s.sub === 0) {
        if (s.pulse === 0 || (s.pulses === 4 && s.pulse === 2)) kickAt(s, 0.7);
        if (s.backbeat) rimAt(s, 0.6);
        if (s.pulse === 0) {
          padChord(s, s.pulses);
          const half = s.pulses >= 4 ? s.pulses / 2 : s.pulses;
          playBass(s, bassRoot(s.chord), half, 0.8);
        } else if (s.pulses >= 4 && s.pulse === s.pulses / 2) {
          playBass(s, interval(s.chord, 7), s.pulses / 2, 0.65);
        }
      }
      if (s.pulses === 4 && s.pulse === 1 && s.is(0.5)) kickAt(s, 0.45);
      if ((s.bar + 1) % 4 === 0 && s.pulse === s.pulses - 1 && s.is(0.5)) tomAt(s, 0.4, 'A2');
    },

    swing(s) {
      if (!s.isAny(s.swing)) return;
      const up = s.sub !== 0;
      // Ride: ding, ding-ga, ding, ding-ga.
      if (!up || s.backbeat) rideAt(s, up ? 0.45 : 0.8);
      if (up) {
        if (s.pulse === 0 && s.bar % 2 === 1) snareAt(s, 0.25);
        if (s.pulse === 1 && s.pulses >= 3) comp(s, 0.4, 0.5);
        // A push into the next bar, every second bar.
        if (s.bar % 2 === 1 && s.pulse === s.pulses - 1) comp(s, 0.3, 0.42);
        return;
      }
      kickAt(s, 0.25); // feathered
      if (s.backbeat) hatAt(s, 0.7);
      if (s.pulse === 0) comp(s, 0.5, 0.55);
      playBass(s, walkingNote(s), 1, s.pulse === 0 ? 0.9 : 0.7);
    },

    bossa(s) {
      const eighth = s.eighthIndex;
      if (s.isAny(s.eighths)) hatAt(s, s.sub === 0 ? 0.4 : 0.25);
      // Bossa clave over two bars of eight eighths: x..x..x...x..x..
      if (Number.isInteger(eighth)) {
        const perBar = s.pulses * (s.compound ? 3 : 2);
        const clave = perBar === 8 ? [0, 3, 6, 10, 13] : [0, 3, 6].filter((n) => n < perBar);
        const pos = perBar === 8 ? (s.bar % 2) * perBar + eighth : eighth;
        if (clave.includes(pos)) rimAt(s, 0.7);
        if (eighth === 0) comp(s, 0.45, 0.5);
        if ([3, 6].includes(eighth)) strum(s, 0.4, 0.34, eighth === 3);
        if (s.bar % 2 === 1 && eighth === 5) comp(s, 0.3, 0.3);
      }
      if (s.sub === 0) kickAt(s, s.pulse % 2 === 0 ? 0.75 : 0.45);
      if (s.pulse % 2 === 0 && s.is(0.75)) kickAt(s, 0.4);
      // Bass: root, fifth anticipated on the "and", fifth, root anticipated.
      if (s.sub === 0 && s.pulse % 2 === 0) {
        playBass(s, s.pulse % 4 === 0 ? bassRoot(s.chord) : interval(s.chord, 7), 1.5, 0.85);
      } else if (s.pulse % 2 === 1 && s.is(0.5)) {
        const nextIsLast = s.pulse + 1 >= s.pulses;
        const note = nextIsLast ? bassRoot(s.next) : (s.pulse + 1) % 4 === 0 ? bassRoot(s.chord) : interval(s.chord, 7);
        playBass(s, note, 0.5, 0.7);
      }
    },

    funk(s) {
      const i = s.sixteenthIndex;
      if (!Number.isInteger(i)) return;
      const onEighth = s.isAny(s.eighths);
      if (s.pulse === s.pulses - 1 && s.is(0.5)) openHatAt(s, 0.6);
      else hatAt(s, onEighth ? 0.7 : 0.35);
      const perPulse = s.compound ? 6 : 4;
      const inBar = s.pulses * perPulse;
      const kicks = s.pulses === 4 && !s.compound ? [0, 3, 6, 10] : [0, 3, Math.round(inBar / 2)];
      if (kicks.includes(i)) kickAt(s, i === 0 ? 0.95 : 0.7);
      const filling = fill(s);
      if (!filling && s.sub === 0 && s.backbeat) snareAt(s, 0.95);
      else if (!filling && s.backbeat && s.is(0.75)) snareAt(s, 0.2);
      // Two-beat bass cell: root, octave, fifth, flat seventh.
      const cell = s.bar % 4 < 2 ? { 0: 0, 3: 12, 6: 7, 7: 10 } : { 0: 0, 2: 7, 5: 12, 6: 10, 7: 0 };
      const note = cell[i % (perPulse * 2)];
      if (note !== undefined) playBass(s, interval(s.chord, note), 0.2, note === 0 ? 0.95 : 0.7);
      if ([2, 5].includes(i % (perPulse * 2))) strum(s, 0.12, 0.42, i % 4 === 2);
      if (i === 0 && s.bar % 2 === 0) comp(s, 0.2, 0.4);
      if (phraseStart(s)) crashAt(s, 0.35);
    },

    reggae(s) {
      if (s.isAny(s.eighths)) hatAt(s, s.sub === 0 ? 0.5 : 0.3);
      const drop = s.pulses >= 4 ? s.pulses / 2 : s.pulses - 1;
      if (s.sub === 0 && s.pulse === drop) {
        kickAt(s, 0.9);
        rimAt(s, 0.9);
      }
      // Skank on the backbeats: guitar, with the piano underneath on the first beat of every second bar.
      if (s.sub === 0 && s.backbeat) strum(s, 0.18, 0.5);
      if (s.sub === 0 && s.pulse === 0 && s.bar % 2 === 0) comp(s, 0.25, 0.35);
      // The organ "bubble": short chords on the off-eighths, very quiet.
      if (!s.compound && s.is(0.5) && !s.backbeat) comp(s, 0.12, 0.2);
      if (phraseStart(s)) crashAt(s, 0.3);
      const eighth = s.eighthIndex;
      const line = { 1: 0, 2: 0, 3: third(s.chord), 5: 7, 6: 12 };
      if (Number.isInteger(eighth) && line[eighth % 8] !== undefined) {
        playBass(s, interval(s.chord, line[eighth % 8]), 0.45, 0.85);
      }
    },

    rumba(s) {
      const eighth = s.eighthIndex;
      if (Number.isInteger(eighth)) {
        // Ventilador: a strum on every beat and on the "and" of 2 and 4; claps on 2 and 4.
        const e = eighth % 8;
        if ([0, 2, 3, 4, 6, 7].includes(e)) strum(s, 0.13, e === 0 || e === 4 ? 0.55 : 0.34, e % 2 === 0);
        if (e === 0 && s.bar % 2 === 0) comp(s, 0.3, 0.32);
        if (e === 2 || e === 6) rimAt(s, 0.75);
        hatAt(s, s.sub === 0 ? 0.35 : 0.18);
      }
      if (s.sub === 0 && s.pulse % 2 === 0) {
        kickAt(s, 0.7);
        playBass(s, s.pulse === 0 ? bassRoot(s.chord) : interval(s.chord, 7), 0.9, 0.8);
      }
    },

    reggaeton(s) {
      const i = s.sixteenthIndex;
      if (!Number.isInteger(i)) return;
      const perPulse = s.compound ? 6 : 4;
      if (s.sub === 0) kickAt(s, 0.95);
      // Dembow: snare on the "a" of beats 1 and 3 and on the "and" of beats 2 and 4.
      const inPulse = i % perPulse;
      if (inPulse === (s.pulse % 2 === 0 ? 3 : 2)) snareAt(s, 0.75);
      if (s.isAny(s.eighths)) hatAt(s, s.sub === 0 ? 0.5 : 0.35);
      if (s.sub === 0) playBass(s, s.pulse % 2 === 0 ? bassRoot(s.chord) : interval(s.chord, 7), 0.9, 0.85);
      if (i % (perPulse * 2) === 0) comp(s, 0.3, 0.38);
      if (i % (perPulse * 2) === 3) strum(s, 0.2, 0.4, false);
      if (phraseStart(s)) crashAt(s, 0.3);
      fill(s);
    },

    // Ska: the guitar chops every off-beat and the bass walks in eighths.
    ska(s) {
      if (phraseStart(s)) crashAt(s, 0.35);
      const filling = fill(s);
      if (s.sub === 0) {
        if (s.strong) kickAt(s, 0.85);
        if (s.backbeat && !filling) snareAt(s, 0.9);
      }
      if (!filling && s.isAny(s.eighths)) hatAt(s, s.sub === 0 ? 0.5 : 0.75);
      if (!s.compound && s.is(0.5) && !filling) strum(s, 0.12, 0.55, false);
      if (s.compound && s.isAny([2 / 3])) strum(s, 0.12, 0.5, false);
      if (s.isAny(s.eighths)) {
        const line = [0, 7, 12, 7];
        const k = (s.pulse * 2 + (s.sub === 0 ? 0 : 1)) % line.length;
        playBass(s, interval(s.chord, line[k]), 0.45, s.sub === 0 ? 0.9 : 0.7);
      }
    },

    // Cúmbia: güira on the eighths, bass on the weak beats, guitar off-beats.
    cumbia(s) {
      if (phraseStart(s)) crashAt(s, 0.25);
      if (s.isAny(s.eighths)) hatAt(s, s.sub === 0 ? 0.35 : 0.65);
      if (s.sub === 0) {
        if (s.pulse % 2 === 0) kickAt(s, s.pulse === 0 ? 0.85 : 0.6);
        if (s.backbeat) rimAt(s, 0.7);
        // The bass answers on beats 2 and 4: that's what makes it walk.
        if (s.backbeat) playBass(s, s.pulse === 1 ? bassRoot(s.chord) : interval(s.chord, 7), 0.9, 0.9);
        if (s.pulse === 0 && s.bar % 2 === 0) comp(s, 0.35, 0.34);
      }
      if (!s.compound && s.is(0.5)) strum(s, 0.16, s.backbeat ? 0.42 : 0.3, false);
      if ((s.bar + 1) % 4 === 0 && s.pulse === s.pulses - 1 && s.is(0.5)) tomAt(s, 0.5, 'C3');
    },

    // Hip-hop (boom bap): deep kick, snare on the backbeats, long bass.
    hiphop(s) {
      const i = s.sixteenthIndex;
      if (!Number.isInteger(i)) return;
      const perPulse = s.compound ? 6 : 4;
      const inBar = s.pulses * perPulse;
      if (s.isAny(s.eighths)) hatAt(s, s.sub === 0 ? 0.55 : 0.3);
      const kicks = s.pulses === 4 && !s.compound ? (s.bar % 2 ? [0, 10, 14] : [0, 7, 10]) : [0, Math.round(inBar / 2)];
      if (kicks.includes(i)) kickAt(s, i === 0 ? 0.95 : 0.65);
      const filling = fill(s);
      if (!filling && s.sub === 0 && s.backbeat) snareAt(s, 0.9);
      if (i === 0) {
        playBass(s, bassRoot(s.chord), s.pulses / 2, 0.9);
        comp(s, s.pulses, 0.32);
      }
      if (s.pulses === 4 && i === 10) playBass(s, interval(s.chord, s.bar % 2 ? 7 : 12), 1, 0.7);
      if (i % (perPulse * 2) === 6) strum(s, 0.3, 0.26, false);
      if (phraseStart(s)) crashAt(s, 0.25);
    },

    // Waltz: bass on the first beat, chord on the other two.
    vals(s) {
      if (s.sub !== 0) return;
      if (phraseStart(s)) crashAt(s, 0.2);
      if (s.pulse === 0) {
        kickAt(s, 0.8);
        playBass(s, bassRoot(s.chord), 1, 0.9);
      } else {
        rimAt(s, s.pulse === 1 ? 0.5 : 0.4);
        strum(s, 0.8, s.pulse === 1 ? 0.4 : 0.32, s.pulse % 2 === 1);
        if (s.pulse === 1 && s.bar % 2 === 0) comp(s, 0.9, 0.3);
      }
      // Every fourth bar the bass steps up to the next chord.
      if ((s.bar + 1) % 4 === 0 && s.pulse === s.pulses - 1) {
        const target = bassRoot(s.next);
        playBass(s, target - 2, 1, 0.7);
      }
    },

    metronome(s) {
      if (s.sub === 0) clickAt(s, s.pulse === 0);
    },
  };

  // Walking bass: root on the downbeat, chord tones in between and a chromatic
  // approach to the next chord on the last beat.
  let lastWalk = null;
  function walkingNote(s) {
    const root = bassRoot(s.chord);
    let note;
    if (s.pulse === 0) {
      note = root;
    } else if (s.pulse === s.pulses - 1) {
      const target = bassRoot(s.next);
      note = lastWalk !== null && lastWalk < target ? target - 1 : target + 1;
    } else {
      const tones = [third(s.chord), 7, 12, 7];
      note = interval(s.chord, tones[(s.pulse - 1) % tones.length]);
    }
    lastWalk = note;
    return note;
  }

  // ---- Public interface -----------------------------------------------------

  /**
   * Plays one grid step. `pulse` is the felt beat within the bar and `sub` the
   * step within that pulse (0 … subsPerPulse-1).
   */
  function playStep({ time, countIn, chord, nextChord, bar, pulse, sub, subsPerPulse, pulses, compound, pulseSeconds }) {
    const frac = sub / subsPerPulse;
    const is = (f) => Math.abs(frac - f) < 1e-6;
    // The cycle is lined up with the first bar the student plays, so the bar
    // just before the entry is the V and the entry lands on the tonic.
    const at = (b) => (harmony ? harmony[mod(b - harmonyFrom, harmony.length)] : null);
    const playedChord = (!countIn && at(bar)) || chord;
    const nextPlayed = (!countIn && at(bar + 1)) || nextChord || chord;
    const s = {
      time,
      chord: playedChord,
      next: nextPlayed,
      bar,
      pulse,
      sub,
      pulses,
      compound,
      subsPerPulse,
      beat: pulseSeconds,
      is,
      isAny: (list) => list.some(is),
      eighths: compound ? [0, 1 / 3, 2 / 3] : [0, 0.5],
      swing: compound ? [0, 2 / 3] : [0, 2 / 3],
      eighthIndex: compound ? pulse * 3 + frac * 3 : pulse * 2 + frac * 2,
      sixteenthIndex: compound ? pulse * 6 + frac * 6 : pulse * 4 + frac * 4,
      strong: pulse === 0 || (pulses % 2 === 0 && pulse % 2 === 0),
      backbeat: pulses % 2 === 0 ? pulse % 2 === 1 : pulse > 0,
    };
    s.eighthIndex = Math.abs(s.eighthIndex - Math.round(s.eighthIndex)) < 1e-6 ? Math.round(s.eighthIndex) : NaN;
    s.sixteenthIndex = Math.abs(s.sixteenthIndex - Math.round(s.sixteenthIndex)) < 1e-6 ? Math.round(s.sixteenthIndex) : NaN;

    // After the last bar: one final chord on the downbeat, then silence.
    if (bar >= endBar) {
      if (bar === endBar && pulse === 0 && sub === 0 && chord) {
        kickAt(s, 0.9);
        crashAt(s, 0.5);
        playBass(s, bassRoot(chord), pulses, 0.9);
        piano.triggerAttackRelease(voicing(chord), Math.max(0.5, pulses * pulseSeconds * 0.9), time, 0.6);
        strum(s, pulses, 0.5);
      }
      return;
    }
    if (countIn) {
      if (sub === 0) beatClick.triggerAttackRelease(pulse === 0 ? 'C6' : 'G5', 0.04, time, 1);
      return;
    }
    if (metronomeOn && sub === 0 && styleId !== 'metronome') {
      beatClick.triggerAttackRelease(pulse === 0 ? 'C6' : 'G5', 0.03, time, 0.45);
    }
    if (styleId !== 'metronome') guitarLick(s);
    (styles[styleId] ?? styles.rock)(s);
  }

  return {
    playStep,
    setStyle(id) {
      styleId = id;
    },
    /** Chords (parsed) the band plays instead of the student's single chord; null = off. */
    setHarmony(list, from = 0) {
      harmony = list?.length ? list : null;
      harmonyFrom = from;
    },
    setChords(on) {
      chordsOn = on;
      if (!on) {
        piano.releaseAll();
        guitar.releaseAll();
        pad.releaseAll();
      }
    },
    /** Plays the example notes (MIDI numbers) for `seconds` at audio time `time`. */
    playDemo(notes, seconds, time) {
      demo.play(notes, seconds, time, 0.8);
    },
    /** A metronome click at audio time `time`. */
    click(time, accent = false, loud = false) {
      beatClick.triggerAttackRelease(accent ? 'C6' : 'G5', 0.04, time, loud ? 1 : 0.45);
    },
    setMetronome(on) {
      metronomeOn = on;
    },
    silence() {
      for (const synth of [piano, guitar, pad, demo]) synth.releaseAll();
      bass.triggerRelease();
    },
    setVolume(db) {
      output.volume.rampTo(db, 0.05);
    },
    dispose() {
      for (const node of nodes) node.dispose();
    },
  };
}
