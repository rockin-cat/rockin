// The adaptive path ("Camí intel·ligent"): instead of a fixed order, the game
// keeps an estimate of what the student knows and picks what to do next.
//
// Skills of a chord wheel, in stages (each stage needs the ones before):
//   0 notes (find the notes of the wheel) · read (read a card on one note)
//   1 chord:X for every chord of the wheel
//   2 change:A>B for every change of the wheel
//   3 tempo (the wheel with long notes, with the music)
//   4 basic (a card with a note on every beat)
//   5 rests (cards with silences) · long (cards with held notes)
//   6 mix (several cards in a row, no help)
//   7 band (without stopping, a new card every round)
//   8 medium (cards with the first subdivision of the beat)
//   9 hard (cards with smaller subdivisions)
//  10 arp (arpeggios: melodic cards going up and down) · 11 contour (any melodic card)
//
// It starts at the bottom and jumps fast: every good result moves the student
// up, and a run of good results moves them up two or three stages at a time
// (a staircase: the better it goes, the bigger the step). A good result at a
// higher stage counts the skipped and untested skills below as known; a bad
// one sends the student back to test or practise what is still unknown or
// weak. Below the stage already reached, only what clearly fails comes back,
// so the game does not keep asking for things the student can already do.
// Timed tries also say which chord or change failed (wrong or missing notes on
// that bar), so those skills go down.

import { chordName, wheelChanges } from './missions.js';

export const MASTERED = 0.8;
const INFERRED = 0.85;
// Below the level already reached, only a clearly weak skill is asked again:
// a small slip on something easier does not drag the student back down.
const REVISIT = 0.6;

/**
 * kit: { wheel: ['C', 'G', ...], cards: { plain, rests, long, whole, mix: [], band: [], medium: [], hard: [], melodic: { arp: [], contour: [] } } }
 * Returns the skill list for this wheel.
 */
export function skillsFor(kit) {
  const chords = [...new Set(kit.wheel)];
  const changes = wheelChanges(kit.wheel);
  const skills = [
    { id: 'notes', stage: 0, label: 'Les notes', icon: '🔍' },
    { id: 'read', stage: 0, label: 'Llegir cartes', icon: '◉' },
    ...chords.map((c) => ({ id: `chord:${c}`, stage: 1, label: chordName(c), icon: '🧱', chord: c })),
    ...changes.map(({ from, to }) => ({ id: `change:${from}>${to}`, stage: 2, label: `${chordName(from)} → ${chordName(to)}`, icon: '⇄', from, to })),
    { id: 'tempo', stage: 3, label: 'La roda a tempo', icon: '⏱' },
    { id: 'basic', stage: 4, label: 'Un acord a cada temps', icon: '♩' },
    { id: 'rests', stage: 5, label: 'Silencis', icon: '○' },
    { id: 'long', stage: 5, label: 'Notes llargues', icon: '━' },
    { id: 'mix', stage: 6, label: 'Cartes seguides', icon: '★' },
    { id: 'band', stage: 7, label: 'Amb la banda', icon: '♪♪' },
  ];
  if (kit.cards.medium?.length) skills.push({ id: 'medium', stage: 8, label: 'Cartes intermèdies', icon: '½' });
  if (kit.cards.hard?.length) skills.push({ id: 'hard', stage: 9, label: 'Cartes difícils', icon: '¼' });
  if (kit.cards.melodic) {
    skills.push({ id: 'arp', stage: 10, label: 'Arpegis', icon: '⤴' });
    skills.push({ id: 'contour', stage: 11, label: 'Contorn melòdic', icon: '〰' });
  }
  return skills;
}

export const STAGE_NAMES = ['Notes i cartes', 'Acords', 'Canvis', 'A tempo', 'Ritme', 'Silencis i notes llargues', 'Cartes seguides', 'Banda', 'Cartes intermèdies', 'Cartes difícils', 'Arpegis', 'Contorn melòdic'];

const known = (state, id) => state.skills[id] && state.skills[id].m !== null && state.skills[id].m !== undefined;
const mastery = (state, id) => (known(state, id) ? state.skills[id].m : null);
const weak = (state, id) => known(state, id) && state.skills[id].m < MASTERED;
const ok = (state, id) => known(state, id) && state.skills[id].m >= MASTERED;

export function emptyState() {
  return { skills: {}, streak: 0, skipped: [], history: [] };
}

/** Adds one piece of evidence (0..1) about a skill. */
export function record(state, id, score, { at = Date.now() } = {}) {
  const s = state.skills[id];
  const m = !s || s.m === null || s.m === undefined || s.inferred ? score : 0.5 * s.m + 0.5 * score;
  state.skills[id] = { m: Math.round(m * 100) / 100, n: (s?.n ?? 0) + 1, t: at, inferred: false };
  state.skipped = state.skipped.filter((x) => x !== id);
}

/** Every skill below `stage` that is still unknown counts as known. */
function inferBelow(state, skills, stage) {
  for (const sk of skills) {
    // Playing melodic cards well says nothing about harder rhythm cards.
    const otherFamily = stage >= 10 && (sk.stage === 8 || sk.stage === 9);
    if (sk.stage < stage && !known(state, sk.id) && !otherFamily) {
      state.skills[sk.id] = { m: INFERRED, n: 0, t: Date.now(), inferred: true };
    }
  }
  state.skipped = state.skipped.filter((id) => skills.find((s) => s.id === id)?.stage >= stage);
}

/**
 * Applies the result of an activity.
 * outcome: { skill?, stage, score (0..1), perChord?: {X: score}, perChange?: {'A>B': score}, timing?: 0..1 }
 */
export function applyOutcome(state, skills, outcome) {
  const { stage, score } = outcome;
  for (const [c, v] of Object.entries(outcome.perChord ?? {})) record(state, `chord:${c}`, v);
  for (const [k, v] of Object.entries(outcome.perChange ?? {})) {
    if (skills.some((s) => s.id === `change:${k}`)) record(state, `change:${k}`, v);
  }
  if (outcome.skill) record(state, outcome.skill, score);
  // The staircase: a good result is a step, a perfect one is two.
  state.streak = score >= 0.95 ? state.streak + 2 : score >= MASTERED ? state.streak + 1 : 0;
  if (score >= MASTERED) inferBelow(state, skills, stage);
  // Almost there: at least everything two stages below can be taken as known.
  else if (score >= REVISIT) inferBelow(state, skills, stage - 1);
  // A bad result: what was only deduced in the two stages below has to be tested for real.
  if (score < 0.5) {
    for (const sk of skills) {
      if (sk.stage < stage && sk.stage >= stage - 2 && state.skills[sk.id]?.inferred) delete state.skills[sk.id];
    }
  }
  state.history.push({ skill: outcome.skill ?? `stage:${stage}`, score: Math.round(score * 100) / 100, t: Date.now() });
  if (state.history.length > 60) state.history.splice(0, state.history.length - 60);
}

/**
 * What to do next: { stage, skill, mode: 'probe' | 'practise' | 'review', reason }.
 * For stages 1 and 2 a probe tests all the chords / changes at once.
 */
export function nextStep(state, skills) {
  const stages = [...new Set(skills.map((s) => s.stage))].sort((a, b) => a - b);
  const inStage = (st) => skills.filter((s) => s.stage === st);
  const top = Math.max(-1, ...skills.filter((s) => known(state, s.id) && !state.skills[s.id].inferred).map((s) => s.stage));
  const weakAbove = (st) => skills.some((s) => s.stage > st && weak(state, s.id));
  // Tried three times lately without getting there: park it and do something
  // else, so the path never turns into the same activity over and over.
  const tally = new Map();
  for (const e of state.history.slice(-4)) {
    if (e.score < MASTERED) tally.set(e.skill, (tally.get(e.skill) ?? 0) + 1);
  }
  const stuck = [...tally].filter(([, n]) => n >= 3).map(([id]) => id);
  const parked = (id) => stuck.includes(id);

  for (const st of stages) {
    const list = inStage(st);
    // At the stage you are working on, anything under 0.8 gets practised; below
    // it, only what clearly fails (so the game stops asking for the easy stuff).
    const limit = st < top ? REVISIT : MASTERED;
    const weakOnes = list.filter((s) => known(state, s.id) && state.skills[s.id].m < limit && !parked(s.id))
      .sort((a, b) => state.skills[a.id].m - state.skills[b.id].m);
    const unknown = list.filter((s) => !known(state, s.id));
    const unknownOpen = unknown.filter((s) => !state.skipped.includes(s.id) || weakAbove(st));
    if (weakOnes.length) {
      const sk = weakOnes[0];
      return { stage: st, skill: sk.id, mode: 'practise', reason: `Encara et costa: ${sk.label}.` };
    }
    if (unknownOpen.length && st <= Math.max(top, 0)) {
      if (st === 1 || st === 2) {
        return { stage: st, skill: null, mode: 'probe', reason: st === 1 ? 'Veiem quins acords ja saps construir.' : 'Veiem quins canvis ja et surten.' };
      }
      const sk = unknownOpen[0];
      return { stage: st, skill: sk.id, mode: 'probe', reason: top < 0 ? 'Comencem! Veiem què saps.' : `Provem: ${sk.label}.` };
    }
  }

  // Everything tested so far is fine: go up, and by more than one stage when
  // the last results say the student is comfortably above this level.
  const higher = stages.filter((st) => st > top && inStage(st).some((s) => !known(state, s.id)));
  // Something is parked: better a change of scenery than something even harder.
  if (higher.length && !stuck.length) {
    const jump = jumpSize(state.streak);
    let idx = 0;
    if (jump > 1 && higher.length > 1 && higher[0] > 0) {
      idx = Math.min(jump - 1, higher.length - 1);
      // What is jumped over is not forgotten: it comes back if something above fails.
      for (let i = 0; i < idx; i++) {
        for (const s of inStage(higher[i])) if (!known(state, s.id) && !state.skipped.includes(s.id)) state.skipped.push(s.id);
      }
    }
    const target = higher[idx];
    const up = idx > 0 ? `Molt bé! Puges a ${STAGE_NAMES[target].toLowerCase()}` : null;
    const list = inStage(target).filter((s) => !known(state, s.id));
    if (target === 1 || target === 2) {
      return { stage: target, skill: null, mode: 'probe', reason: up ? `${up}.` : 'Següent pas.' };
    }
    return { stage: target, skill: list[0].id, mode: 'probe', reason: up ? `${up}: ${list[0].label}.` : `Següent pas: ${list[0].label}.` };
  }

  // All known: review the least solid (or the oldest) skill.
  const byNeed = (list) => list.sort((a, b) => {
    const A = state.skills[a.id];
    const B = state.skills[b.id];
    return (A.inferred ? 0.5 : A.m) - (B.inferred ? 0.5 : B.m) || A.t - B.t;
  });
  const done = skills.filter((s) => known(state, s.id));
  const all = byNeed(done.filter((s) => !parked(s.id)));
  const sk = all.find((s) => s.stage >= 3) ?? all[0] ?? byNeed(done)[0];
  if (!sk) return { stage: 0, skill: skills[0].id, mode: 'probe', reason: 'Comencem! Veiem què saps.' };
  if (stuck.length) return { stage: sk.stage, skill: sk.id, mode: weak(state, sk.id) ? 'practise' : 'review', reason: `Canviem una estona: ${sk.label}.` };
  return { stage: sk.stage, skill: sk.id, mode: 'review', reason: `Ho saps tot! Repàs: ${sk.label}.` };
}

/** How many stages to move up after a run of good results. */
export const jumpSize = (streak) => (streak >= 4 ? 3 : streak >= 2 ? 2 : 1);

/**
 * Where the student is placed right now: which stage, out of the stages this
 * wheel has. `stage` is the stage of the next step.
 */
export function levelOf(state, skills, stage) {
  const stages = [...new Set(skills.map((s) => s.stage))].sort((a, b) => a - b);
  const i = stages.indexOf(stage);
  return { n: (i < 0 ? 0 : i) + 1, total: stages.length, name: STAGE_NAMES[stage] ?? '' };
}

/** Share of skills known (tested or deduced) and mastered. */
export function progressOf(state, skills) {
  const good = skills.filter((s) => ok(state, s.id)).length;
  return { good, total: skills.length };
}

export { known, mastery, weak, ok };
