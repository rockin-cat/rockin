// MIDI input: Web MIDI devices, plus a computer-keyboard fallback for testing
// without hardware. Handlers receive { note, velocity, timeStamp, source };
// timeStamp is on the performance.now() clock so the transport can map it onto
// the audio clock.

import { noteName } from './theory.js';

export async function connectMidi({ onNoteOn, onNoteOff, onInputsChanged }) {
  if (!navigator.requestMIDIAccess) {
    throw new Error('aquest navegador no té Web MIDI (fes servir Chrome, Edge o Firefox)');
  }
  const access = await navigator.requestMIDIAccess();

  const listen = (input) => (event) => {
    const [status, note, velocity = 0] = event.data;
    const command = status & 0xf0;
    const message = { note, velocity, timeStamp: event.timeStamp, source: input.name };
    if (command === 0x90 && velocity > 0) onNoteOn(message);
    else if (command === 0x80 || command === 0x90) onNoteOff(message);
  };

  const bindInputs = () => {
    const names = [];
    for (const input of access.inputs.values()) {
      input.onmidimessage = listen(input);
      names.push(input.name);
    }
    console.log(`[MIDI] inputs: ${names.length ? names.join(', ') : '(none connected)'}`);
    onInputsChanged?.(names);
  };

  access.onstatechange = (event) => {
    if (event.port.type !== 'input') return;
    console.log(`[MIDI] "${event.port.name}" ${event.port.state}`);
    bindInputs();
  };
  bindInputs();
  return access;
}

// Piano layout on the home row: A = C, W = C#, S = D ... K = C an octave up.
// Z / X shift down / up an octave.
export const KEY_OFFSETS = { a: 0, w: 1, s: 2, e: 3, d: 4, f: 5, t: 6, g: 7, y: 8, h: 9, u: 10, j: 11, k: 12, o: 13, l: 14, p: 15, ';': 16 };

export function attachComputerKeyboard({ onNoteOn, onNoteOff, onOctaveChange, baseNote = 60, enabled = () => true }) {
  let base = baseNote;
  const held = new Map();
  // Letters typed into a text box are not notes. Anywhere else (a dropdown, a
  // button) the piano keys still play.
  const isTextField = (target) => target.closest?.('textarea, input:not([type="checkbox"])');

  window.addEventListener('keydown', (event) => {
    if (event.metaKey || event.ctrlKey || isTextField(event.target) || !enabled()) return;
    const key = event.key.toLowerCase();
    const isOctaveKey = key === 'z' || key === 'x';
    if (!isOctaveKey && !(key in KEY_OFFSETS)) return;
    event.preventDefault(); // e.g. stop a focused dropdown jumping to the option starting with that letter
    if (event.repeat) return;
    if (isOctaveKey) {
      base = Math.min(84, Math.max(36, base + (key === 'z' ? -12 : 12)));
      onOctaveChange?.(base);
      console.log(`[Keys] A key is now ${noteName(base)}`);
      return;
    }
    if (held.has(key)) return;
    const note = base + KEY_OFFSETS[key];
    held.set(key, note);
    onNoteOn({ note, velocity: 96, timeStamp: event.timeStamp, source: 'teclat de l\'ordinador' });
  });

  window.addEventListener('keyup', (event) => {
    const key = event.key.toLowerCase();
    const note = held.get(key);
    if (note === undefined) return;
    held.delete(key);
    onNoteOff({ note, velocity: 0, timeStamp: event.timeStamp, source: 'teclat de l\'ordinador' });
  });
  onOctaveChange?.(base);
}
