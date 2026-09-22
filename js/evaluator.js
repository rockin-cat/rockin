// MIDI evaluation: judges every note against the chord and card of the bar it
// belongs to, following the rules of the active pedagogical level, and reports
// each hit or miss to the console and to the page.

import { melodicSlots } from './cards.js';
import { contourNotes, noteAtOrAbove, noteName, pitchClass, pitchClassName, triadNotes } from './theory.js';

export const LEVELS = {
  1: { name: 'Ritme + fonamental', cardType: 'rhythmic' },
  2: { name: 'Ritme + tríada', cardType: 'rhythmic' },
  3: { name: 'Contorn melòdic', cardType: 'melodic' },
  4: { name: 'Baix + acord (dues mans)', cardType: 'rhythmic' },
};

const TIMING_WINDOW_MS = 180; // how early or late an attack may be and still count
const CHORD_SPREAD_MS = 220; // Level 2: longest gap between the first and last key of one chord
// A chord played ahead of the beat still belongs to that beat: without this,
// its first key lands on the beat before and is read as a doubling, and the
// chord then looks incomplete ("falta Do" going from Do to La m).
const EARLY_CHORD_MS = 320;
// A chord spread out in time still completes the beat it started on (it is
// judged "tecles massa separades", not an incomplete chord).
const LATE_CHORD_MS = 460;
const TWO_HANDS_SPREAD_MS = 180; // Level 4: the same, for bass and chord with two hands
const BASS_BELOW = 65; // Level 4: a root played up to F4 still counts as "the bass note"
const REST_GRACE_MS = 100;
const HOLD_GRACE_MS = 180; // how far a note may ring into a silence
// Long notes (a bar on the card): the keys may be lifted a bit early, so the next
// beat can be played. Only a clearly short note counts as a mistake.
const LONG_RELEASE_GRACE_MS = 350;
const LONG_RELEASE_SHARE = 0.3;
const EVENT_SLACK_MS = 30; // MIDI events reach JS a little after they happen

const names = (pitchClasses) => pitchClasses.map(pitchClassName).join('-');
const signed = (ms) => `${ms >= 0 ? '+' : ''}${ms} ms`;
const beatLabel = ({ beat, unit, units }) => (units > 1 ? `temps ${beat + 1} (${unit + 1}/${units})` : `temps ${beat + 1}`);
const relation = (rankDifference) =>
  rankDifference > 0 ? 'més aguda que' : rankDifference < 0 ? 'més greu que' : 'la mateixa nota que';

export function createEvaluator({ level, transport, deck, onResult, inversions = false }) {
  const tag = `[Eval L${level}]`;
  const msToTicks = (ms) => (ms / 1000) * transport.ticksPerSecond;
  const ticksToMs = (ticks) => Math.round((ticks / transport.ticksPerSecond) * 1000);
  const timingWindow = msToTicks(TIMING_WINDOW_MS);
  const spreadMs = level === 4 ? TWO_HANDS_SPREAD_MS : CHORD_SPREAD_MS;
  const chordSpread = msToTicks(spreadMs);
  const restGrace = msToTicks(REST_GRACE_MS);
  const earlyGrace = msToTicks(EARLY_CHORD_MS);
  const lateChord = msToTicks(LATE_CHORD_MS);
  const eventSlack = msToTicks(EVENT_SLACK_MS);

  const bars = new Map(); // bar index -> what is expected in that bar and how it went
  const held = new Map(); // MIDI note -> tick it was pressed
  const released = new Map(); // MIDI note -> tick it was let go (to judge held melodic notes)
  const demoBars = new Set(); // bars the program plays itself: nothing is judged

  const barAt = (ticks) => Math.floor((ticks - transport.barStartTicks(0)) / transport.barTicks);

  function barModel(bar) {
    if (bar < 0) return null;
    if (!bars.has(bar)) {
      const card = deck.cardForBar(bar);
      const startTick = transport.barStartTicks(bar);
      const model = { bar, card, chord: transport.chordForBar(bar), startTick, endTick: startTick + transport.barTicks, demo: demoBars.has(bar) };
      Object.assign(model, card.type === 'melodic' ? melodicExpectations(model) : rhythmicExpectations(model));
      bars.set(bar, model);
    }
    return bars.get(bar);
  }

  // Each circle of the card gets an equal share of the bar, each slice an equal
  // share of its circle. 1 = attack, 2 = previous sound keeps ringing, 0 = silence.
  function rhythmicExpectations({ card, startTick }) {
    const beatTicks = transport.barTicks / card.pattern.length;
    const onsets = [];
    const rests = [];
    let sounding = null; // the attack whose note is still ringing
    card.pattern.forEach((slices, beat) => {
      const unitTicks = beatTicks / slices.length;
      slices.forEach((value, unit) => {
        const tick = startTick + beat * beatTicks + unit * unitTicks;
        const where = { beat, unit, units: slices.length };
        if (value === 1) {
          sounding = { ...where, tick, endTick: tick + unitTicks, window: timingWindow, status: 'pending', notes: [] };
          onsets.push(sounding);
        } else if (value === 2) {
          if (sounding) {
            sounding.endTick = tick + unitTicks;
            sounding.long = true; // a bar on the card: keep the keys down to its end
          }
        } else if (value === 0) {
          sounding = null;
          const previous = rests.at(-1);
          if (previous && Math.abs(previous.endTick - tick) < 1e-6) previous.endTick += unitTicks;
          else rests.push({ ...where, startTick: tick, endTick: tick + unitTicks, flagged: false });
        }
      });
    });
    // How early or late an attack may be: the whole window, unless another
    // attack is near (then half way to it, so each note counts for its own
    // beat). An off-beat on its own therefore gets the full window, which is
    // what the left hand needs when it plays between the beats.
    onsets.forEach((onset, i) => {
      const before = onsets[i - 1] ? onset.tick - onsets[i - 1].tick : transport.barTicks - (onsets.at(-1).tick - onset.tick);
      const after = onsets[i + 1] ? onsets[i + 1].tick - onset.tick : transport.barTicks - (onset.tick - onsets[0].tick);
      const gap = Math.max(1, Math.min(before, after));
      onset.window = Math.max(msToTicks(60), Math.min(timingWindow, gap * 0.45));
    });
    return { onsets, rests };
  }

  // Melodic cards have no rhythm of their own: their points go on a steady grid (see melodicSlots).
  function melodicExpectations({ card, startTick }) {
    const { slots } = melodicSlots(card.contour.length, transport.meter ?? {});
    return {
      notes: card.contour.map((rank, index) => ({
        index,
        rank,
        tick: startTick + slots[index].f0 * transport.barTicks,
        endTick: startTick + slots[index].f1 * transport.barTicks,
        status: 'pending',
        midi: null,
      })),
    };
  }

  // `detail`: { kind, tick, note?, missing? } says where and what, for the marks on the card.
  function report(verdict, model, message, detail = {}) {
    if (model.demo) {
      console.log(`${tag} (example bar ${model.bar + 1}) ${verdict} · ${message}`);
      return;
    }
    console.log(`${tag} ${verdict === 'hit' ? '✅ HIT ' : '❌ MISS'} bar ${model.bar + 1} ${model.chord.symbol} · ${message}`);
    const fraction = detail.tick === undefined ? undefined : (detail.tick - model.startTick) / transport.barTicks;
    onResult?.({ verdict, bar: model.bar, message, ...detail, fraction });
  }

  function judge(model, onset, verdict, message, detail) {
    onset.status = verdict;
    report(verdict, model, message, detail);
  }

  // ---- Levels 1 and 2: rhythm cards --------------------------------------

  // Level 2 keeps an attack open a little longer once its first key is down,
  // so the remaining keys of the chord can arrive.
  const closesAt = (onset) =>
    onset.notes.length ? Math.max(onset.tick + onset.window, onset.notes[0].ticks + chordSpread) : onset.tick + onset.window;
  const accepts = (onset, ticks) => ticks >= onset.tick - onset.window && ticks <= closesAt(onset);

  /**
   * The notes of an attack, plus the ones still under the fingers from before
   * it. Two chords that share a note (Do → La m share the Do and the Mi) are
   * often played keeping those keys down: what is still sounding counts, as
   * long as something was really played on this beat.
   */
  function withSustained(onset) {
    const attacked = onset.notes.map((n) => n.note);
    if (!attacked.length) return attacked;
    const from = onset.tick - onset.window;
    const sustained = [...held].filter(([n, down]) => !attacked.includes(n) && down < from).map(([n]) => n);
    return [...attacked, ...sustained];
  }

  function rhythmicNoteOn(note, ticks) {
    const name = noteName(note);
    const bar = barAt(ticks);
    const candidates = [bar - 1, bar, bar + 1]
      .map(barModel)
      .filter(Boolean)
      .flatMap((model) => model.onsets.map((onset) => ({ model, onset })))
      .sort((a, b) => Math.abs(a.onset.tick - ticks) - Math.abs(b.onset.tick - ticks));
    let open = candidates.find(({ onset }) => onset.status === 'pending' && accepts(onset, ticks));
    if (!open && level !== 1) {
      // A chord started on the beat and still not complete: a key that arrives
      // late finishes that chord instead of counting somewhere else.
      const pc0 = pitchClass(note);
      open = candidates.find(({ model, onset }) => onset.status === 'pending'
        && onset.notes.length && ticks - onset.notes[0].ticks <= lateChord
        && model.chord.triad.includes(pc0)
        && !onset.notes.some((n) => pitchClass(n.note) === pc0));
    }
    if (!open) {
      // Played a little ahead of the beat, at a chord change: the note waits for
      // the chord that is coming instead of being read as a doubling of the one
      // before (Do → La m share the Do, and the Do was being eaten).
      const pc0 = pitchClass(note);
      const here = candidates[0]?.model.chord.symbol;
      open = candidates.find(({ model, onset }) => onset.status === 'pending'
        && onset.tick > ticks && onset.tick - ticks <= earlyGrace
        && model.chord.symbol !== here
        && (level === 1 ? model.chord.root === pc0 : model.chord.triad.includes(pc0)));
    }

    if (!open) {
      const nearest = candidates[0];
      if (nearest && accepts(nearest.onset, ticks)) {
        // That attack was already judged: doubling the right note is fine, anything else is not.
        const { model, onset } = nearest;
        const allowed = level === 1 ? [model.chord.root] : model.chord.triad;
        if (onset.status === 'hit' && allowed.includes(pitchClass(note))) {
          console.log(`${tag} ${name} doubles the attack on ${beatLabel(onset)}, ignored`);
        } else {
          report('miss', model, `${name} de més al ${beatLabel(onset)}`, { kind: 'extra', tick: ticks, note });
        }
      } else if (bar < 0 || !nearest) {
        console.log(`${tag} (count-in) ignoring ${name}`);
      } else {
        const { model, onset } = nearest;
        report('miss', model, `${name} fora del ritme de la carta (${signed(ticksToMs(ticks - onset.tick))} del ${beatLabel(onset)})`, {
          kind: 'offbeat',
          tick: ticks,
          note,
          offsetMs: ticksToMs(ticks - onset.tick),
        });
      }
      return;
    }

    const { model, onset } = open;
    const { chord } = model;
    const pc = pitchClass(note);

    if (level === 1) {
      if (pc === chord.root) onset.notes.push({ note, ticks });
      if (pc === chord.root) judge(model, onset, 'hit', `${name} al ${beatLabel(onset)} (${signed(ticksToMs(ticks - onset.tick))})`, { kind: 'hit', tick: ticks, offsetMs: ticksToMs(ticks - onset.tick) });
      else judge(model, onset, 'miss', `${name} al ${beatLabel(onset)}; calia la fonamental ${pitchClassName(chord.root)}`, { kind: 'wrong', tick: ticks, note });
      return;
    }

    if (!chord.triad.includes(pc)) {
      judge(model, onset, 'miss', `${name} (${beatLabel(onset)}) no és de ${chord.symbol} (${names(chord.triad)})`, { kind: 'wrong', tick: ticks, note });
      return;
    }
    onset.notes.push({ note, ticks });
    if (!chordComplete(chord, withSustained(onset))) return;

    const first = onset.notes[0].ticks;
    const keys = onset.notes.map((n) => noteName(n.note)).join(' ');
    const spread = ticksToMs(ticks - first);
    if (ticks - first <= chordSpread) {
      judge(model, onset, 'hit', `${chord.symbol} (${keys}) al ${beatLabel(onset)} (${signed(ticksToMs(first - onset.tick))}, tecles en ${spread} ms)`, {
        kind: 'hit',
        tick: first,
        offsetMs: ticksToMs(first - onset.tick),
      });
    } else {
      judge(model, onset, 'miss', `tecles de ${chord.symbol} massa separades al ${beatLabel(onset)} (${spread} ms, màx. ${spreadMs} ms)`, { kind: 'spread', tick: first });
    }
  }

  // Level 2: every note of the triad, in any order or octave. Level 4: the root
  // as a low bass (left hand) plus the whole triad above it (right hand).
  function chordComplete(chord, notes) {
    const played = new Set(notes.map(pitchClass));
    if (!chord.triad.every((p) => played.has(p))) return false;
    if (level !== 4) return true;
    // The left hand plays the root low and the right hand the triad above it.
    // Which octave each hand chooses is up to the student: it is enough that a
    // root note is at the bottom (or low on the keyboard) and that the triad is
    // complete above it. A right-hand note that happens to fall under the left
    // hand's root doesn't turn the chord into a mistake.
    const sorted = [...notes].sort((a, b) => a - b);
    const roots = sorted.filter((n) => pitchClass(n) === chord.root);
    if (!roots.length) return false;
    const bass = roots[0] === sorted[0] ? roots[0] : roots.find((n) => n < BASS_BELOW);
    if (bass === undefined) return false;
    const above = sorted.filter((n) => n !== bass);
    return chord.triad.every((p) => above.some((n) => pitchClass(n) === p));
  }

  function checkRest(model, rest, note, down, heldUntil) {
    if (rest.flagged || down >= rest.startTick || heldUntil <= rest.startTick + restGrace) return;
    rest.flagged = true;
    report('miss', model, `${noteName(note)} encara sona al silenci del ${beatLabel(rest)}`, { kind: 'rest', tick: rest.startTick, note });
  }

  // ---- Level 3: melodic cards --------------------------------------------

  /**
   * A flat bit of a melodic line is the same note twice: keeping the key down
   * counts as playing it, so the note does not have to be repeated (repeating
   * it is fine too, and is judged as usual).
   */
  function resolveHolds(model, ticks) {
    for (const n of model.notes ?? []) {
      if (n.status !== 'pending' || ticks <= n.endTick) continue;
      const before = model.notes[n.index - 1];
      if (!before || before.rank !== n.rank || before.midi === null) continue;
      // Still down, or let go once this point had already started.
      const down = held.has(before.midi) || (released.get(before.midi) ?? -Infinity) >= n.tick;
      if (!down) continue;
      n.status = 'hit';
      n.midi = before.midi;
      report('hit', model, `nota ${n.index + 1}: ${noteName(before.midi)} mantinguda (la línia no puja ni baixa)`, { kind: 'hit', index: n.index, tick: n.tick });
    }
  }

  function melodicNoteOn(note, ticks) {
    const name = noteName(note);
    // A note just before the bar line is an early first note of the next bar.
    const model = barModel(barAt(ticks + timingWindow));
    if (!model) {
      console.log(`${tag} (count-in) ignoring ${name}`);
      return;
    }
    const { chord, notes } = model;
    // A note played a touch early shouldn't land on a point that was held.
    resolveHolds(model, ticks + timingWindow);
    const expected = notes.find((n) => n.status === 'pending');
    if (!expected) {
      report('miss', model, `${name} de més: la carta té ${notes.length} notes`, { kind: 'extra', tick: ticks, note });
      return;
    }
    const at = { tick: Math.max(model.startTick, Math.min(model.endTick - 1, ticks)), note };

    const label = `nota ${expected.index + 1}/${notes.length}`;
    expected.midi = note;
    if (!chord.tones.includes(pitchClass(note))) {
      expected.status = 'miss';
      report('miss', model, `${label}: ${name} no és de ${chord.symbol} (${names(chord.tones)})`, { kind: 'wrong', index: expected.index, ...at });
      return;
    }

    // The contour fixes which notes are higher, lower or the same as each other,
    // so check the new note against every correct note played before it.
    const earlier = notes.filter((n) => n.status === 'hit').reverse();
    const clash = earlier.find((n) => Math.sign(expected.rank - n.rank) !== Math.sign(note - n.midi));
    if (clash) {
      expected.status = 'miss';
      report('miss', model, `${label}: ${name} hauria de ser ${relation(expected.rank - clash.rank)} ${noteName(clash.midi)} (nota ${clash.index + 1})`, { kind: 'contour', index: expected.index, ...at });
      return;
    }

    expected.status = 'hit';
    const step = earlier.length ? `${relation(expected.rank - earlier[0].rank)} ${noteName(earlier[0].midi)}` : 'primera nota';
    report('hit', model, `${label}: ${name}, ${step} (${signed(ticksToMs(ticks - expected.tick))})`, { kind: 'hit', index: expected.index, ...at });
  }

  // ---- Public interface ----------------------------------------------------

  /**
   * Is an attack still expected around this moment? Two-hand missions use it to
   * decide which hand a note belongs to: while the left hand holds a long note
   * it expects nothing, so the short notes go to the right hand even if they
   * are played low on the keyboard.
   */
  function expectsNow(timeStamp) {
    const { ticks } = transport.positionAt(timeStamp);
    const bar = barAt(ticks);
    for (const b of [bar - 1, bar, bar + 1]) {
      const model = barModel(b);
      if (!model || model.demo || !model.onsets) continue;
      if (model.onsets.some((onset) => onset.status === 'pending' && accepts(onset, ticks))) return true;
    }
    return false;
  }

  function noteOn({ note, timeStamp }) {
    const { ticks } = transport.positionAt(timeStamp);
    held.set(note, ticks);
    if (level === 3) melodicNoteOn(note, ticks);
    else rhythmicNoteOn(note, ticks);
  }

  function noteOff({ note, timeStamp }) {
    const down = held.get(note);
    if (down === undefined) return;
    held.delete(note);
    const { ticks } = transport.positionAt(timeStamp);
    released.set(note, ticks);
    console.log(`${tag} release ${noteName(note)} after ${ticksToMs(ticks - down)} ms`);
    if (level === 3) return;
    const bar = barAt(ticks);
    // Long notes (a bar on the card): the keys have to stay down until the bar ends.
    for (const model of [bar - 1, bar].map(barModel).filter(Boolean)) {
      for (const onset of model.onsets) {
        if (!onset.long || onset.shortFlagged || onset.status !== 'hit') continue;
        if (!onset.notes.some((n) => n.note === note && n.ticks === down)) continue;
        const slack = Math.max(msToTicks(LONG_RELEASE_GRACE_MS), (onset.endTick - onset.tick) * LONG_RELEASE_SHARE);
        if (ticks >= onset.endTick - slack) continue;
        onset.shortFlagged = true;
        report('miss', model, `${noteName(note)} s'ha aixecat abans d'hora al ${beatLabel(onset)}: la barra vol dir mantenir la tecla`, { kind: 'short', tick: ticks, note });
      }
    }
    for (const model of [bar - 1, bar].map(barModel).filter(Boolean)) {
      for (const rest of model.rests) checkRest(model, rest, note, down, ticks);
    }
  }

  /** Call every frame: closes attacks nobody played and catches notes ringing into silences. */
  function update({ ticks, bar }) {
    barModel(bar);
    for (const [index, model] of bars) {
      if (index < bar - 2) {
        bars.delete(index);
        continue;
      }

      if (model.notes) {
        resolveHolds(model, ticks);
        const unplayed = model.notes.filter((n) => n.status === 'pending');
        if (unplayed.length && ticks > model.endTick + eventSlack) {
          for (const n of unplayed) {
            n.status = 'miss';
            report('miss', model, `nota ${n.index + 1} del contorn sense tocar`, { kind: 'missed', index: n.index, tick: n.tick });
          }
        }
        continue;
      }

      for (const onset of model.onsets) {
        if (onset.status !== 'pending' || ticks <= closesAt(onset) + eventSlack) continue;
        if (level === 1 || !onset.notes.length) {
          const expected = level === 1 ? pitchClassName(model.chord.root) : model.chord.symbol;
          judge(model, onset, 'miss', `no has tocat res al ${beatLabel(onset)} (calia ${expected})`, { kind: 'missed', tick: onset.tick });
        } else {
          const played = new Set(withSustained(onset).map((n) => pitchClass(n)));
          const missing = model.chord.triad.filter((p) => !played.has(p));
          const what = missing.length ? names(missing) : `el baix greu (${pitchClassName(model.chord.root)} per sota del Do central)`;
          judge(model, onset, 'miss', `${model.chord.symbol} incomplet al ${beatLabel(onset)}: falta ${what}`, { kind: 'incomplete', tick: onset.tick, missing });
        }
      }
      for (const [note, down] of held) {
        for (const rest of model.rests) checkRest(model, rest, note, down, ticks);
      }
    }
  }

  /** One line saying what the student has to play in `bar`, for the console. */
  function describeBar(bar) {
    const model = barModel(bar);
    if (!model) return '';
    const { chord, card } = model;
    if (model.notes) {
      return `expect ${model.notes.length} notes with contour ${card.contour.join('-')} (0 = lowest) from ${names(chord.tones)}`;
    }
    const target = level === 1 ? `root ${pitchClassName(chord.root)}` : `${level === 4 ? 'bass + ' : ''}triad ${names(chord.triad)}`;
    const silences = model.rests.map(beatLabel).join(', ');
    return `expect ${target} on ${model.onsets.map(beatLabel).join(', ')}${silences ? ` · silence from ${silences}` : ''}`;
  }

  /** Status of each expected note in `bar`, in card order, for the playhead markers. */
  function markersForBar(bar) {
    const model = barModel(bar);
    if (!model) return [];
    const items = model.onsets ?? model.notes;
    return model.demo ? items.map(() => ({ status: 'pending' })) : items;
  }

  /** Marks bars [from, to) as example bars that the program plays. */
  function setDemo(from, to) {
    for (let bar = from; bar < to; bar++) {
      demoBars.add(bar);
      if (bars.has(bar)) bars.get(bar).demo = true;
    }
  }

  const isDemo = (bar) => demoBars.has(bar);

  /** Drops what was prepared for bars from `bar` on (their card changed). */
  function forgetFrom(bar) {
    for (const index of [...bars.keys()]) if (index >= bar) bars.delete(index);
  }

  /**
   * The keys the on-screen keyboard suggests for `bar`: one entry per expected
   * attack (levels 1-2) or contour note (level 3), with its time span, the
   * suggested MIDI notes and its judged status. Level 3 accepts any chord tones
   * that follow the contour; the suggestion is just one way to play it.
   */
  function guideForBar(bar) {
    const model = barModel(bar);
    if (!model) return [];
    const { chord } = model;
    const status = (s) => (model.demo ? 'demo' : s);
    if (model.notes) {
      const suggested = contourNotes(chord, model.card.contour);
      return model.notes.map((n, i) => ({
        startTick: n.tick,
        endTick: n.endTick,
        status: status(n.status),
        notes: [model.demo ? suggested[i] : (n.midi ?? suggested[i])],
      }));
    }
    const keys =
      level === 1 ? [noteAtOrAbove(chord.root, 60)]
      : level === 4 ? [noteAtOrAbove(chord.root, 43), ...voicingFor(bar)]
      : voicingFor(bar);
    return model.onsets.map((o) => ({ startTick: o.tick, endTick: o.endTick, status: status(o.status), notes: keys }));
  }

  // Right-hand chord shown on the keyboard. With inversions on, each chord takes
  // the position closest to the previous bar's, as pianists do to move less.
  const voicings = new Map();
  function voicingFor(bar) {
    if (voicings.has(bar)) return voicings.get(bar);
    const chord = transport.chordForBar(bar);
    let result = triadNotes(chord);
    if (inversions && bar > 0) {
      const previous = voicings.get(bar - 1) ?? voicingFor(bar - 1);
      if (transport.chordForBar(bar - 1) === chord) {
        result = previous;
      } else {
        let best = Infinity;
        for (let inversion = 0; inversion < 3; inversion++) {
          const pcs = [...chord.triad.slice(inversion), ...chord.triad.slice(0, inversion)];
          for (const low of [53, 60]) {
            const notes = [noteAtOrAbove(pcs[0], low)];
            for (const pc of pcs.slice(1)) notes.push(noteAtOrAbove(pc, notes.at(-1) + 1));
            if (notes[0] < 55 || notes.at(-1) > 79) continue;
            const distance = notes.reduce((sum, n, i) => sum + Math.abs(n - previous[i]), 0);
            if (distance < best) {
              best = distance;
              result = notes;
            }
          }
        }
      }
    }
    voicings.set(bar, result);
    return result;
  }

  /** Pitch classes that count as right in `bar`, for colouring pressed keys. */
  function allowedPitchClasses(bar) {
    const model = barModel(bar);
    if (!model) return null;
    return level === 1 ? [model.chord.root] : level === 3 ? model.chord.tones : model.chord.triad;
  }

  return { noteOn, noteOff, update, describeBar, markersForBar, guideForBar, allowedPitchClasses, expectsNow, setDemo, isDemo, forgetFrom };
}
