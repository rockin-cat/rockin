// A piano sound shared by the demonstrations, the backing chords and the
// student's own notes. It uses recorded piano samples (Salamander Grand Piano,
// CC BY 3.0, served by the Tone.js project) and, until they load or if they
// can't be loaded, a synthesised piano-like sound.

const SAMPLE_BASE = 'https://tonejs.github.io/audio/salamander/';
const SAMPLE_NOTES = ['A1', 'C2', 'D#2', 'F#2', 'A2', 'C3', 'D#3', 'F#3', 'A3', 'C4', 'D#4', 'F#4', 'A4', 'C5', 'D#5', 'F#5', 'A5', 'C6', 'D#6'];

let shared = null;

export function pianoSound() {
  if (shared) return shared;
  const output = new Tone.Volume(-4).toDestination();

  const synth = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'custom', partials: [1, 0.55, 0.3, 0.18, 0.08, 0.05] },
    envelope: { attack: 0.003, decay: 1.4, sustain: 0.08, release: 0.5 },
    volume: -10,
  }).connect(output);
  synth.maxPolyphony = 24;

  let sampler = null;
  let loaded = false;
  try {
    sampler = new Tone.Sampler({
      urls: Object.fromEntries(SAMPLE_NOTES.map((note) => [note, `${note.replace('#', 's')}.mp3`])),
      baseUrl: SAMPLE_BASE,
      release: 1,
      onload: () => {
        loaded = true;
        console.log('[Piano] samples loaded');
      },
      onerror: (error) => console.warn('[Piano] samples unavailable, using the synth', error),
    }).connect(output);
  } catch (error) {
    console.warn('[Piano] sampler not available', error);
  }

  const name = (midi) => Tone.Frequency(midi, 'midi').toNote();
  const voice = () => (loaded ? sampler : synth);

  shared = {
    get loaded() {
      return loaded;
    },
    /** Plays MIDI notes for `seconds` at audio time `time`. */
    play(notes, seconds, time = Tone.now(), velocity = 0.8) {
      voice().triggerAttackRelease(notes.map(name), Math.max(0.05, seconds), time, velocity);
    },
    noteOn(note, velocity = 0.8) {
      voice().triggerAttack(name(note), Tone.immediate(), velocity);
    },
    noteOff(note) {
      // Release on both, in case the samples finished loading while the key was down.
      synth.triggerRelease(name(note), Tone.immediate());
      if (loaded) sampler.triggerRelease(name(note), Tone.immediate());
    },
    releaseAll() {
      synth.releaseAll();
      if (loaded) sampler.releaseAll();
    },
    setVolume(db) {
      output.volume.value = db;
    },
  };
  return shared;
}
