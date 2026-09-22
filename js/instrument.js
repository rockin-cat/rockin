// The sound of the student's own notes, so the computer keyboard and MIDI
// controllers without speakers can be heard at any time, not only during a
// game. It is the shared piano (see piano-sound.js).

import { pianoSound } from './piano-sound.js';

export function createInstrument() {
  const piano = pianoSound();
  return {
    noteOn: (note, velocity) => piano.noteOn(note, Math.max(0.2, velocity / 127)),
    noteOff: (note) => piano.noteOff(note),
    releaseAll: () => piano.releaseAll(),
  };
}
