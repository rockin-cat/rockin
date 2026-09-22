// "Juga": the guided game for students.
//
// A map of worlds; each world has a goal (a chord wheel) and short missions
// that lead to it. While playing, the whole try is shown as a score of cards
// (chord written above each card) with a ball bouncing from card to card, and
// every card keeps marks of how it was played, so the student sees the whole
// and can check afterwards what went wrong and where.
//
// The keyboard only paints which keys to use (and, when learning a change,
// what each finger does); WHEN to play is always read on the cards.
//
// Several students can share a computer: each one picks their name, and the
// teacher view shows everyone's progress. Besides the built-in ROCKIN path, a
// teacher can build a path for any chord wheel and meter.

import { ROCKIN_PATH, SPEEDS, WORKSHOP_PATH, buildPath, chordName, makePath, triadNoteNames } from './missions.js';
import { contourNotes, parseChord, parseTimeSignature, pitchClass, splitChord, mod } from './theory.js';
import { STYLES, createBacking, dominantOf, pedalHarmony } from './backing.js';
import { createTransport } from './transport.js';
import { createEvaluator } from './evaluator.js';
import { createKeyboard } from './keyboard.js';
import { cardLabel, playableCards, tierOf } from './cards.js';
import { createScore } from './score.js';
import { pianoSound } from './piano-sound.js';
import { SONGS } from './progression-editor.js';
import { TWO_HANDS_RANGE, closestVoicing, describeChange, fingers, inversionOf, leftFingers, leftHandVoicing, rightHandVoicing, rootVoicing, voiceChain } from './voicing.js';
import { LEFT_COLOUR, RIGHT_COLOUR, derivedCard, handCard, twoHandCards, twoHandName, twoHandsPath, twoName, whenIconReady } from './twohands.js';
import { REFLECTIONS, changeDiagram, changeLegend, keyName, renderSheet, renderTeacher } from './play-extra.js';
import { FUNCTIONS, degreeOf, keyChords } from './degrees.js';
import { SONGBOOK, songbookSpec } from './songbook.js';
import { renderGuide, renderGuidePrint } from './guide.js';
import { STAGE_NAMES, applyOutcome, emptyState, known, levelOf, nextStep, progressOf, skillsFor, weak } from './adaptive.js';
import { CHALLENGES, GUIDES, MODES, callPhrase, closeStats, countNote, emptyStats, guideNotes, readStats } from './improvise.js';

const STORAGE_KEY = 'rockin.play.v1';
const PATHS_KEY = 'rockin.play.paths';
const BARS = 4; // bars per card when the wheel is shorter than 3 chords
const GRACE_MS = 400;
const AUTO_NEXT_SECONDS = 5;
const AUTO_RETRY_SECONDS = 7; // after a miss, the same mission starts again by itself
const TEMPO_STEP = 8; // how much slower the next try is after a hard one
const TEMPO_MAX_DROP = 24;
const SOLFEGE = ['Do', 'Do♯', 'Re', 'Mi♭', 'Mi', 'Fa', 'Fa♯', 'Sol', 'La♭', 'La', 'Si♭', 'Si'];
const SHAPE = '#ffe38a';
const SHAPE_NEXT = '#ffb37a';
const SHARED = '#7ee2a8';
const COUNT = '#b9e6ff';
const SPLIT = 60; // two hands: notes below middle C are the left hand
const GLYPH = { arpeggio: '⤴', 'probe-chords': '🧱', 'probe-changes': '⇄', find: '🔍', jump: '↷', build: '🧱', rush: '⏱', lesson: '?', chord: '♫', change: '⇄', steps: '⋯', pattern: '♩', mix: '★', song: '♬', structure: '§', band: '♪♪', invert: '↻' };
const TYPE_LABEL = {
  find: 'Troba la nota',
  jump: 'Salta tecles',
  build: 'Construeix',
  placement: 'Prova de nivell',
  arpeggio: 'Arpegi',
  'probe-chords': 'Quins acords saps?',
  'probe-changes': 'Quins canvis saps?',
  rush: 'Contra rellotge',
  lesson: 'Lliçó',
  chord: 'Acord nou',
  change: 'Canvi',
  steps: 'Pas a pas',
  pattern: 'Ritme',
  mix: 'Objectiu',
  song: 'Cançó',
  structure: 'Estructura',
  band: 'Banda',
  invert: 'Inversions',
};
const REFLECT_TYPES = new Set(['mix', 'song', 'structure', 'band']);
const METERS = ['4/4', '3/4', '6/8', '12/8'];
const STAR_SCORE = { 3: 1, 2: 0.8, 1: 0.55, 0: 0.2 };

const el = (tag, props = {}, children = []) => {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children.filter((c) => c !== null && c !== undefined && c !== false));
  return node;
};
const LETTER_PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const setChildren = (node, ...children) => node.replaceChildren(...children.filter((c) => c !== null && c !== undefined && c !== false));
const pcOf = (name) => mod(LETTER_PC[name[0]] + (name[1] === '#' ? 1 : name[1] === 'b' ? -1 : 0), 12);

/** Long Catalan name: "Do major", "La menor". */
function chordLong(symbol) {
  const { root, suffix } = splitChord(symbol);
  const quality = suffix === '' ? ' major' : suffix === 'm' ? ' menor' : ` ${suffix}`;
  return `${chordName(root)}${quality}`;
}

/**
 * A chord name with the colour of its degree (as in the songbook) and the degree
 * below. state: '' (not learnt yet: faded), 'on' or 'now'.
 */
function chordChip(symbol, key, state = 'on', title = '') {
  const d = degreeOf(symbol, key);
  const chip = el('span', {
    className: `play-chord-chip deg${state ? ` ${state}` : ''}${d.diatonic ? '' : ' borrowed'}`,
    title: title || `${chordLong(symbol)} · grau ${d.label}`,
  }, [el('b', { textContent: chordName(symbol) }), el('i', { textContent: d.label })]);
  chip.style.setProperty('--deg', d.colour);
  chip.style.setProperty('--deg-ink', d.ink);
  return chip;
}

const starText = (n) => '★'.repeat(n) + '☆'.repeat(3 - n);
/** The key of a song spec: the one given or, without it, the first chord. */
function keyOf(spec) {
  if (spec.key) return spec.key;
  const first = (spec.progression ?? 'C').split('|')[0].trim() || 'C';
  const { root, suffix } = splitChord(first);
  return `${root}${suffix.startsWith('m') && !suffix.startsWith('maj') ? 'm' : ''}`;
}
const splitProgression = (text) => text.split('|').map((s) => s.trim()).filter(Boolean);
const isTriad = (symbol) => ['', 'm'].includes(splitChord(symbol).suffix);

function starsFor(ratio, type) {
  // Passing shouldn't hang on a single slip: one bad bar out of eight still passes.
  if (type === 'band') return ratio >= 0.85 ? 3 : ratio >= 0.7 ? 2 : ratio >= 0.5 ? 1 : 0;
  return ratio >= 0.95 ? 3 : ratio >= 0.8 ? 2 : ratio >= 0.6 ? 1 : 0;
}

function load(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}

function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage unavailable
  }
}

/** Progress of every student on this computer (older saves had one student). */
function loadStore() {
  const raw = load(STORAGE_KEY, {});
  const store = { unlockAll: Boolean(raw.unlockAll), students: raw.students ?? {}, current: raw.current ?? null };
  if (raw.stars && !raw.students && Object.keys(raw.stars).length) {
    store.students.s1 = { name: 'Alumne 1', stars: raw.stars, log: [] };
    store.current = 's1';
  }
  for (const st of Object.values(store.students)) {
    st.stars ??= {};
    st.log ??= [];
  }
  if (!store.students[store.current]) store.current = null;
  return store;
}

export function createPlay({ root, getCards, playNotes, getLabels, getHeld, storage }) {
  const store = loadStore();
  // The teacher can try everything as "Professor/a": all open, nothing saved.
  const TEACHER_ID = '__professor';
  let teacherProfile = { name: 'Professor/a', stars: {}, log: [], welcomed: true, teacher: true };
  const me = () => (store.current === TEACHER_ID ? teacherProfile : store.students[store.current]);
  const isTeacher = () => store.current === TEACHER_ID;
  const saveStore = () => save(STORAGE_KEY, store);
  const starsOf = (id) => me()?.stars[id] ?? 0;
  let customSpecs = load(PATHS_KEY, []);
  const bookSpecs = SONGBOOK.map(songbookSpec);
  const allSpecs = () => [...bookSpecs, ...customSpecs];
  let speed = SPEEDS.find((s) => s.id === storage.get('rockin.play.speed')) ?? SPEEDS[1];
  let names = storage.get('rockin.play.names') !== 'no';
  // The drums already carry the pulse: the click while playing is off unless the
  // teacher asks for it (a new key, so old settings don't bring the click back).
  let metronome = storage.get('rockin.play.click') === 'yes';
  let grooveOn = localStorage.getItem('rockin.play.groove') !== 'off'; // the band between challenges
  // Finger numbers on the painted keys: off unless the teacher wants them (the
  // numbers can be read as degrees, and every teacher fingers chords their way).
  let showFingers = storage.get('rockin.play.fingers') === 'yes';
  let fingerMap = readFingerMap(); // chord symbol -> [f1, f2, f3], low to high (right hand)
  const tempoDrop = new Map(); // mission id -> bpm less than normal, after hard tries
  const helpBoost = new Map(); // mission id -> the keys light up again, after a missed try
  let pathId = storage.get('rockin.play.path') ?? null; // song path chosen in "Cançons"
  let section = 'juga'; // juga | cancons | banda
  const homeScreen = () => (section === 'cancons' ? 'songs' : section === 'banda' ? 'jam' : section === 'improvisa' ? 'improv' : 'map');
  let path = ROCKIN_PATH;
  let screen = 'map'; // map | creator | teacher | who | welcome
  let board = ['taller', 'adapt'].includes(storage.get('rockin.play.board')) ? storage.get('rockin.play.board') : 'cami'; // which map the student sees
  let songBoard = storage.get('rockin.play.songBoard') === 'adapt' ? 'adapt' : 'cami'; // the same for a song

  // ---- Layout -----------------------------------------------------------------------------------

  const mapScreen = el('section', { className: 'play-map' });
  const missionScreen = el('section', { className: 'play-mission', hidden: true });
  const fx = el('canvas', { className: 'play-fx' });
  const sheetBox = el('div', { className: 'print-box' });
  root.append(mapScreen, missionScreen, fx);
  document.body.append(sheetBox);

  const backButton = el('button', { type: 'button', className: 'play-btn ghost small', textContent: '← Mapa' });
  const fullButton = el('button', { type: 'button', className: 'play-btn ghost small', textContent: '⛶ Pantalla completa', title: 'La carta i el teclat ocupen tota la pantalla (tecla F)' });
  const hud = el('div', { className: 'play-hud' });
  const missionStars = el('div', { className: 'play-stars' });
  const panel = el('div', { className: 'play-panel' });
  const scoreBox = el('div', { hidden: true });
  const scoreLegend = el('div', { className: 'score-legend', hidden: true, innerHTML:
    '<span><i class="lg-dot"></i> tocat bé (a l\'esquerra de la rodona: avançat; a la dreta: endarrerit)</span>' +
    '<span><i class="lg-x">✕</i> nota que no era o de més</span>' +
    '<span><i class="lg-ring"></i> rodona sense tocar</span>' +
    '<span><i class="lg-ring warn"></i> acord incomplet</span>' +
    '<span><i class="lg-x">~</i> calia aixecar el dit</span>' +
    '<span><i class="lg-x">✕</i> «mantén!»: a la barra calia mantenir la tecla</span>' });
  const pianoCanvas = el('canvas');
  const animCanvas = el('canvas', { className: 'piano-anim' });
  const piano = el('div', { className: 'piano play-piano' }, [el('div', { className: 'piano-canvas' }, [pianoCanvas, animCanvas])]);
  // Always on screen while playing: which band level you are at, and what the
  // next one asks for (click it to see the whole ladder).
  const levelPill = el('button', { type: 'button', className: 'play-level-pill', title: 'El teu nivell per tocar amb els companys' });
  const levelLadder = el('div', { className: 'play-level-ladder', hidden: true });
  const levelBox = el('div', { className: 'play-level-box' }, [levelPill, levelLadder]);
  levelPill.addEventListener('click', () => {
    levelLadder.hidden = !levelLadder.hidden;
  });
  missionScreen.append(el('div', { className: 'play-top' }, [backButton, hud, levelBox, missionStars, fullButton]), panel, scoreBox, scoreLegend, piano);
  backButton.addEventListener('click', () => showMap());

  // Full screen: the card and the keyboard fill the screen, for playing in class
  // without anything else in the way. Space and Escape keep working.
  function toggleFullscreen() {
    // Going in and out has to be safe even if the browser answers slowly: a
    // rejected promise used to leave the class on and the page half-painted.
    const current = document.fullscreenElement ?? document.webkitFullscreenElement;
    // The whole game view goes full screen, not only the mission: that way the
    // map, the menus and every button keep working with the mouse.
    try {
      if (current) Promise.resolve(document.exitFullscreen?.() ?? document.webkitExitFullscreen?.()).catch(() => {});
      else Promise.resolve((root.requestFullscreen ?? root.webkitRequestFullscreen)?.call(root)).catch(() => {});
    } catch {
      /* the browser said no: stay as we are */
    }
  }
  fullButton.addEventListener('click', toggleFullscreen);
  const onFullscreenChange = () => {
    const el2 = document.fullscreenElement ?? document.webkitFullscreenElement;
    const on = el2 === root || el2 === missionScreen;
    missionScreen.classList.toggle('is-fullscreen', on);
    root.classList.toggle('is-fullscreen', on);
    fullButton.textContent = on ? '✕ Surt' : '⛶ Pantalla completa';
  };
  document.addEventListener('fullscreenchange', onFullscreenChange);
  document.addEventListener('webkitfullscreenchange', onFullscreenChange);

  const score = createScore(scoreBox);
  const hooks = {};
  const keyboard = createKeyboard(pianoCanvas, {
    range: [48, 84],
    compact: true,
    onKeyDown: (note, timeStamp) => hooks.keyDown?.(note, timeStamp),
    onKeyUp: (note, timeStamp) => hooks.keyUp?.(note, timeStamp),
  });

  let view = { marks: new Map(), message: '' };
  let feedback = new Map(); // note -> 'good' | 'bad', outside of music
  let session = null;
  let mission = null;
  let step = null; // { noteOn, noteOff, space, escape }
  let autoNext = null;
  let scoreState = null; // { ball: () => ball | null, data: (bar) => tile data }

  // ---- Paths ----------------------------------------------------------------------------------------

  /** The path of the section: the ROCKIN path in "Juga", the chosen song path in "Cançons". */
  function resolvePath() {
    if (section !== 'cancons') return ROCKIN_PATH;
    const spec = allSpecs().find((x) => x.id === pathId);
    if (!spec || !getCards().length) return null;
    try {
      return buildPath(spec, getCards());
    } catch (error) {
      console.warn('[Play] path could not be built', error);
      return null;
    }
  }

  // ---- One hand or two ------------------------------------------------------------------------------
  // Each student chooses at the start: one hand, two hands playing the same
  // chord, or two hands with the left one on the bass. With two hands the path
  // is the same, but the cards have two rows (blue = right, orange = left), the
  // keyboard paints both hands and stars are kept apart for each way.

  const HANDS = {
    1: { label: '✋ Una mà', short: 'una mà' },
    chord: { label: '🙌 Dues mans: el mateix acord', short: 'dues mans (el mateix acord)' },
    bass: { label: '🙌 Dues mans: l\'esquerra fa el baix', short: 'dues mans (esquerra al baix)' },
  };
  const handsMode = () => (HANDS[me()?.hands] ? me().hands : 1);

  const TWO_INTRO = {
    card: twoName('rhythm_binary_01.png'),
    title: 'Dues files, dues mans',
    text: 'Ara les cartes tenen dues files. La <b style="color:#3fb2f5">blava</b> és la <b>mà dreta</b> i la <b style="color:#ff8a2a">taronja</b>, la <b>mà esquerra</b>. Si les dues tenen rodona al mateix temps, toquen <b>alhora</b>.',
  };

  const handPaths = new Map();
  /** The path as the student plays it: `base` itself with one hand, or its two-hand version. */
  function handsPath(base, mode = handsMode()) {
    if (mode === 1 || !base || base === WORKSHOP_PATH) return base;
    const cacheKey = `${base.id}@${mode}`;
    if (handPaths.has(cacheKey)) return handPaths.get(cacheKey);
    const suffix = mode === 'bass' ? '@2b' : '@2';
    const firstLesson = base.missions.find((m) => m.type === 'lesson')?.id;
    const convert = (m) => ({
      ...m,
      id: `${m.id}${suffix}`,
      card: m.card && twoName(m.card),
      cards: m.cards?.map(twoName),
      sections: m.sections?.map((sec) => ({ ...sec, card: twoName(sec.card) })),
      slides: m.slides && [...(m.id === firstLesson ? [TWO_INTRO] : []), ...m.slides.map((sl) => ({ ...sl, card: twoName(sl.card) }))],
    });
    // Level 2 (arpeggios and melodic cards) stays one-handed.
    const worlds = base.worlds.filter((w) => !w.level2).map((w) => ({ ...w, twoHands: true, left: w.level === 1 ? 'bass' : mode, missions: w.missions.map(convert) }));
    if (mode === 'bass') {
      // At the end, each hand with its own rhythm (bass and chord apart).
      const kit = kitFor(base);
      const [, , own, hard] = twoHandsPath({ ...kit, custom: base.custom });
      worlds.push({ ...own, id: `${base.id}:mans-ritmes`, style: kit.style ?? own.style });
      worlds.push({ ...hard, id: `${base.id}:mans-dificil`, style: kit.style ?? hard.style });
    }
    worlds.push(...base.worlds.filter((w) => w.level2));
    const made = { ...makePath({ id: base.id, title: base.title, worlds, custom: base.custom, key: base.key, spec: base.spec }), twoHands: true, hands: mode, base };
    handPaths.set(cacheKey, made);
    return made;
  }

  /** "Toques amb: …" and a button to change it. */
  function handsChip() {
    const b = el('button', { type: 'button', className: 'play-hands-chip', title: 'Canvia: una mà o dues' }, [
      el('span', { textContent: `Toques amb ${HANDS[handsMode()].short}` }),
      el('b', { textContent: 'Canvia' }),
    ]);
    b.addEventListener('click', () => {
      screen = 'hands';
      showMap();
    });
    return b;
  }

  /** The question at the start (and from the map): one hand or two. */
  function showHands(then) {
    const st = me();
    const option = (mode, art, title, text) => {
      const b = el('button', { type: 'button', className: `play-hands-option${handsMode() === mode && st.hands ? ' on' : ''}` }, [
        el('span', { className: 'play-hands-art', textContent: art }),
        el('strong', { textContent: title }),
        el('small', { innerHTML: text }),
      ]);
      b.addEventListener('click', () => {
        st.hands = mode;
        saveStore();
        then();
      });
      return b;
    };
    setChildren(mapScreen,
      el('div', { className: 'play-world play-welcome play-hands' }, [
        el('h2', { textContent: 'Amb quantes mans vols tocar?' }),
        el('p', { textContent: 'El camí és el mateix, fins i tot tocar amb la banda. Ho pots canviar quan vulguis des del mapa.' }),
        el('div', { className: 'play-hands-options' }, [
          option(1, '✋', 'Una mà', 'La mà dreta toca els acords.'),
          option('chord', '🙌', 'Dues mans, el mateix acord', 'Les dues mans fan l\'acord: l\'esquerra, més greu. Cartes amb fila <b style="color:#3fb2f5">blava</b> i <b style="color:#ff8a2a">taronja</b>.'),
          option('bass', '🙌', 'Dues mans, l\'esquerra fa el baix', 'La dreta fa l\'acord i l\'esquerra només la nota de baix del mateix acord.'),
        ]),
      ]),
    );
    step = null;
    toTop();
  }

  function openSongPath(id) {
    pathId = id;
    storage.set('rockin.play.path', id);
    screen = 'map';
    showMap();
  }

  // ---- Small helpers ---------------------------------------------------------------------------------

  function button(label, onClick, kind = 'primary') {
    const b = el('button', { type: 'button', className: `play-btn ${kind}`, textContent: label });
    b.addEventListener('click', () => {
      cancelAutoNext();
      onClick();
    });
    return b;
  }

  function setPanel({ kicker, title, big, text, list: items, extra, dots, buttons = [], tone = '', note, side = null }) {
    panel.className = `play-panel ${tone}${side ? ' with-side' : ''}`;
    panel.replaceChildren(...[
      el('div', { className: 'play-panel-main' }, [
        kicker ? el('div', { className: 'play-kicker', textContent: kicker }) : null,
        title ? el('h2', { textContent: title }) : null,
        big ? el('div', { className: 'play-big' }, big) : null,
        text ? el('p', { innerHTML: text }) : null,
        items?.length ? el('ul', {}, items.map((item) => el('li', { innerHTML: item }))) : null,
        extra ?? null,
        dots ? el('div', { className: 'play-dots' }, dots) : null,
        note ? el('p', { className: 'play-note', innerHTML: note }) : null,
      ]),
      side ? el('div', { className: 'play-panel-side' }, side.filter(Boolean)) : null,
      buttons.length ? el('div', { className: 'play-buttons' }, buttons.filter(Boolean)) : null,
    ].filter(Boolean));
  }

  /** One line above the score while the music plays. */
  function setStatus({ kicker, text, tone = '', buttons = [] }) {
    panel.className = `play-panel status ${tone}`;
    panel.replaceChildren(...[
      el('div', { className: 'play-panel-main' }, [
        el('span', { className: 'play-kicker', textContent: kicker }),
        el('span', { className: 'play-status-text', innerHTML: text }),
      ]),
      buttons.length ? el('div', { className: 'play-buttons' }, buttons) : null,
    ].filter(Boolean));
  }

  /**
   * The chords the game uses, so the teacher can write the fingering of each
   * one (Si♭ with 1-2-4 instead of 1-3-5, for instance). Empty = automatic.
   */
  function fingeringTable() {
    const found = new Set();
    const add = (text) => {
      try {
        for (const c of splitProgression(text ?? '')) found.add(c);
      } catch {
        /* a progression we can't read: skip it */
      }
    };
    for (const w of ROCKIN_PATH.worlds) add(w.progression);
    for (const spec of [...SONGBOOK, ...customSpecs]) {
      for (const part of Object.values(spec.parts ?? {})) add(part);
      add(spec.progression);
    }
    const list = [...found].filter(Boolean).sort((a, b) => a.localeCompare(b));
    const row = (symbol) => {
      let auto = '';
      try {
        auto = fingers(rootVoicing(symbol)).join('-');
      } catch {
        return null;
      }
      const input = el('input', {
        type: 'text',
        className: 'play-finger-input',
        value: fingerMap[symbol]?.join('-') ?? '',
        placeholder: auto,
        size: 6,
        inputMode: 'numeric',
      });
      input.addEventListener('change', () => {
        const f = input.value.match(/[1-5]/g)?.map(Number) ?? [];
        if (f.length >= 2) fingerMap[symbol] = f;
        else delete fingerMap[symbol];
        input.value = fingerMap[symbol]?.join('-') ?? '';
        saveFingerMap();
      });
      return el('label', { className: 'play-finger-row' }, [
        el('b', { textContent: chordName(symbol) }),
        input,
      ]);
    };
    return el('div', { className: 'play-fingering' }, [
      el('p', { className: 'play-note', innerHTML: 'Digitació de cada acord en <b>posició fonamental</b>, de la nota més greu a la més aguda i per a la <b>mà dreta</b> (l\'esquerra ho fa al revés). Buit = automàtica (la que hi ha escrita en gris).' }),
      el('div', { className: 'play-finger-grid' }, list.map(row).filter(Boolean)),
    ]);
  }

  /** The teacher's fingering table: { 'Bb': [1, 2, 4], … }, low to high, right hand. */
  function readFingerMap() {
    try {
      const raw = JSON.parse(storage.get('rockin.play.fingering') ?? '{}');
      const out = {};
      for (const [symbol, list] of Object.entries(raw)) {
        const f = String(list).match(/[1-5]/g)?.map(Number) ?? [];
        if (f.length >= 2) out[symbol] = f;
      }
      return out;
    } catch {
      return {};
    }
  }
  const saveFingerMap = () => storage.set('rockin.play.fingering', JSON.stringify(fingerMap));

  const noteLabel = (n) => (names ? '' : SOLFEGE[pitchClass(n)]);
  const shapeMarks = (notes, colour = SHAPE) => new Map(notes.map((n) => [n, { fill: true, colour, text: noteLabel(n) }]));
  /**
   * The fingers written on the painted keys. They are only written when the
   * teacher turns them on, and a chord with its own fingering in the teacher's
   * table (Si♭ with 1-2-4, for instance) uses that one instead of the automatic
   * 1-3-5. `symbol`: the chord, when it is known; `hand`: 'left' mirrors it.
   */
  const fingerRow = (notes, symbol = null, hand = 'right') => {
    const custom = symbol ? fingerMap[symbol] : null;
    if (custom && custom.length === notes.length) return hand === 'left' ? [...custom].reverse().map((f) => f) : custom;
    return hand === 'left' ? leftFingers(notes) : fingers(notes);
  };
  const fingerText = (row, i) => (showFingers ? String(row[i] ?? '') : '');

  const fingerMarks = (notes, colour = SHAPE, fill = true, symbol = null) => {
    const f = fingerRow(notes, symbol);
    const sorted = [...notes].sort((a, b) => a - b);
    return new Map(sorted.map((n, i) => [n, { fill, colour, text: fingerText(f, i) }]));
  };

  /** Two hands: the right hand's keys in blue and the left hand's in orange, with finger numbers. */
  const handMarks = (right, left, { fill = true, next = false, symbol = null } = {}) => {
    const marks = new Map();
    const fr = fingerRow(right, symbol);
    [...right].sort((a, b) => a - b).forEach((n, i) => marks.set(n, { fill, colour: next ? '#9fd8fb' : RIGHT_COLOUR, text: fingerText(fr, i) }));
    const fl = fingerRow(left, left.length === 3 ? symbol : null, 'left');
    [...left].sort((a, b) => a - b).forEach((n, i) => marks.set(n, { fill, colour: next ? '#ffc596' : LEFT_COLOUR, text: fingerText(fl, i) }));
    return marks;
  };
  /** Melodic cards: the chord's notes painted on the keys, without numbers (numbers mean fingers or degrees elsewhere). */
  // The suggested notes are filled; the other notes of the chord nearby are outlined (any starting note is fine).
  const melodicMarks = (symbol, card, colour = SHAPE) => {
    const chord = parseChord(symbol);
    const marks = new Map();
    for (let n = 55; n <= 79; n++) if (chord.triad.includes(pitchClass(n))) marks.set(n, { fill: false, colour, text: '' });
    for (const n of contourNotes(chord, card.contour)) marks.set(n, { fill: true, colour, text: '' });
    return marks;
  };
  const leftMode = (m = mission) => m?.left ?? m?.world?.left ?? 'chord';

  const keysText = (notes) => {
    const labels = getLabels();
    const letters = notes.map((n) => labels.get(n)).filter(Boolean);
    return letters.length === notes.length ? ` <span class="play-keys">tecles ${letters.map((l) => `<kbd>${l}</kbd>`).join(' ')}</span>` : '';
  };

  /** Colour and degree of a chord for the score, in the key of the path. */
  const colourOf = (symbol) => {
    const d = degreeOf(symbol, path?.key ?? 'C');
    return { colour: d.colour, ink: d.ink, degree: d.label };
  };
  const cardByName = (filename) => {
    if (filename?.startsWith('2x:')) return derivedCard(getCards().find((c) => c.filename === filename.slice(3)));
    return getCards().find((c) => c.filename === filename) ?? twoHandCards().find((c) => c.filename === filename);
  };
  whenIconReady(() => {
    if (!root.hidden && !mission) showMap();
  });
  const setFocus = (mode) => {
    missionScreen.dataset.focus = mode;
  };
  const showScore = (on, legend = false) => {
    scoreBox.hidden = !on;
    scoreLegend.hidden = !legend;
    if (!on) scoreState = null;
  };

  /** A card with one long note for the meter of `world` (for the step-by-step missions). */
  function longCard(world) {
    const meter = parseTimeSignature(world.meter ?? '4/4');
    const cards = getCards().filter((c) => c.type === 'rhythmic' && c.pattern.length === meter.pulses);
    return cards.find((c) => c.pattern.every((beat, i) => beat.length === 1 && beat[0] === (i === 0 ? 1 : 2))) ?? cards[0];
  }

  /** The voicing of each chord in `symbols`, in order (closest positions in the inversions world). */
  const chainFor = (symbols, world, level = world.level) =>
    level === 1 ? symbols.map((s) => [rootVoicing(s)[0]]) : voiceChain(symbols, Boolean(world.inversions));

  /** Keys that belong to both chords, marked green, over the other marks. */
  function sharedMarks(marks, a, b) {
    for (const n of a) if (b.includes(n)) marks.set(n, { fill: true, colour: SHARED, text: '=' });
    return marks;
  }

  // ---- Moving dots: how the fingers go from one chord to the next -----------------------------------

  let anim = null; // { from, to, start, loop, sound, onPhase, marks }
  const MOVE = { showA: 1000, move: 1100, showB: 1200, rest: 500 };
  const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

  /** Loops: chord A, the dots travel, chord B. `once`: a single quick move (no A/B pause). */
  function animateChange(from, to, { loop = true, once = false, sound = true, duration = 600 } = {}) {
    anim = { from: [...from].sort((a, b) => a - b), to: [...to].sort((a, b) => a - b), start: performance.now(), loop, once, sound, duration, lastPhase: null, loops: 0 };
  }
  const stopAnimation = () => {
    anim = null;
  };

  function drawAnimation(now) {
    const w = animCanvas.clientWidth;
    const h = animCanvas.clientHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (animCanvas.width !== Math.round(w * dpr) || animCanvas.height !== Math.round(h * dpr)) {
      animCanvas.width = Math.round(w * dpr);
      animCanvas.height = Math.round(h * dpr);
    }
    const ctx = animCanvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    if (!anim) return;
    const { from, to } = anim;
    let t = now - anim.start;
    let phase;
    let s = 0;
    if (anim.once) {
      s = Math.min(1, t / anim.duration);
      phase = s >= 1 ? 'done' : 'move';
    } else {
      const cycle = MOVE.showA + MOVE.move + MOVE.showB + MOVE.rest;
      const loops = Math.floor(t / cycle);
      if (!anim.loop && loops >= 1) t = cycle - MOVE.rest - 1;
      else t %= cycle;
      if (loops !== anim.loops) anim.loops = loops;
      if (t < MOVE.showA) phase = 'A';
      else if (t < MOVE.showA + MOVE.move) {
        phase = 'move';
        s = (t - MOVE.showA) / MOVE.move;
      } else if (t < MOVE.showA + MOVE.move + MOVE.showB) {
        phase = 'B';
        s = 1;
      } else phase = 'rest';
    }
    if (phase !== anim.lastPhase) {
      anim.lastPhase = phase;
      if (anim.sound && anim.loops < 2) {
        if (phase === 'A') playNotes(from);
        if (phase === 'B') playNotes(to);
      }
      if (!anim.once) {
        const marks = phase === 'A' || phase === 'move' ? fingerMarks(from, SHAPE) : phase === 'B' ? fingerMarks(to, SHAPE_NEXT) : new Map();
        view = { ...view, marks };
      }
    }
    if (phase === 'rest' || phase === 'done') {
      if (phase === 'done') anim = null;
      return;
    }
    const fa = fingers(from);
    const fb = fingers(to);
    const e = easeInOut(s);
    to.forEach((target, i) => {
      const pa = keyboard.keyPoint(from[i]);
      const pb = keyboard.keyPoint(target);
      if (!pa || !pb) return;
      const still = from[i] === target;
      const lift = still ? 0 : 26 + Math.min(40, Math.abs(pb.x - pa.x) * 0.25);
      const x = pa.x + (pb.x - pa.x) * e;
      const y = pa.y + (pb.y - pa.y) * e - Math.sin(Math.PI * e) * lift;
      const r = 12;
      // Trail of the jump.
      if (phase === 'move' && !still) {
        ctx.beginPath();
        ctx.setLineDash([4, 5]);
        ctx.moveTo(pa.x, pa.y);
        const steps = 16;
        for (let k = 1; k <= steps; k++) {
          const u = (k / steps) * e;
          ctx.lineTo(pa.x + (pb.x - pa.x) * u, pa.y + (pb.y - pa.y) * u - Math.sin(Math.PI * u) * lift);
        }
        ctx.strokeStyle = 'rgba(255,255,255,0.7)';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.setLineDash([]);
      }
      ctx.beginPath();
      ctx.arc(x, y, still ? r + 2 * Math.sin(now / 150) : r, 0, Math.PI * 2);
      ctx.fillStyle = still ? SHARED : phase === 'B' ? SHAPE_NEXT : e > 0.5 ? SHAPE_NEXT : SHAPE;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#1d1d1f';
      ctx.stroke();
      ctx.fillStyle = '#1d1d1f';
      ctx.font = '800 12px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(e > 0.5 ? fb[i] : fa[i]), x, y + 0.5);
    });
  }

  // ---- Sounds and celebration ----------------------------------------------------------------------------

  const sfx = {
    good() {
      const p = pianoSound();
      [72, 76, 79, 84].forEach((n, i) => p.play([n], 0.4, Tone.now() + i * 0.09, 0.6));
    },
    ok() {
      const p = pianoSound();
      [72, 76, 79].forEach((n, i) => p.play([n], 0.3, Tone.now() + i * 0.1, 0.5));
    },
    bad() {
      pianoSound().play([55, 54], 0.5, Tone.now(), 0.4);
    },
    step() {
      pianoSound().play([84], 0.15, Tone.now(), 0.25);
    },
    /** One tick of the countdown between challenges; the last one is higher. */
    tick(last = false) {
      pianoSound().play([last ? 88 : 81], 0.12, Tone.now(), last ? 0.35 : 0.2);
    },
  };

  function confetti() {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const ctx = fx.getContext('2d');
    const w = (fx.width = window.innerWidth);
    const h = (fx.height = window.innerHeight);
    const colours = ['#ffc012', '#36c5f0', '#ff5c8a', '#35b36b', '#ffffff'];
    const parts = Array.from({ length: 120 }, () => ({
      x: w / 2 + (Math.random() - 0.5) * w * 0.3,
      y: h * 0.45,
      vx: (Math.random() - 0.5) * 14,
      vy: -Math.random() * 14 - 4,
      r: Math.random() * 6 + 3,
      c: colours[Math.floor(Math.random() * colours.length)],
      a: Math.random() * Math.PI,
    }));
    const start = performance.now();
    const tick = (t) => {
      const age = (t - start) / 1000;
      ctx.clearRect(0, 0, w, h);
      if (age > 1.8) return;
      for (const p of parts) {
        p.vy += 0.45;
        p.x += p.vx;
        p.y += p.vy;
        p.a += 0.2;
        ctx.save();
        ctx.globalAlpha = Math.max(0, 1 - age / 1.8);
        ctx.translate(p.x, p.y);
        ctx.rotate(p.a);
        ctx.fillStyle = p.c;
        ctx.fillRect(-p.r, -p.r / 2, p.r * 2, p.r);
        ctx.restore();
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  // ---- Map ------------------------------------------------------------------------------------------------

  /** Where the placement test put the student in this path (missions before it are open). */
  const startIndex = () => ((path.base ?? path) === ROCKIN_PATH ? me()?.start?.rockin ?? 0 : 0);
  const unlocked = (index) =>
    path === WORKSHOP_PATH || store.unlockAll || isTeacher() || index <= startIndex() || starsOf(path.missions[index - 1].id) >= 1;
  const nextIndex = () => {
    const from = startIndex();
    let i = path.missions.findIndex((m, k) => k >= from && unlocked(k) && starsOf(m.id) < 1);
    if (i === -1) i = path.missions.findIndex((m, k) => unlocked(k) && starsOf(m.id) < 1);
    return i === -1 ? null : i;
  };
  /** Chords taught before mission `index` (or before the end of the path). */
  const learnedBefore = (index) => (path.twoHands
    ? new Set(splitProgression(path.worlds[0].progression))
    : new Set(path.missions.slice(0, index).filter((m) => m.type === 'chord').map((m) => m.chord)));

  function toggle(label, value, onChange) {
    const input = el('input', { type: 'checkbox', checked: value });
    input.addEventListener('change', () => onChange(input.checked));
    return el('label', { className: 'play-toggle' }, [input, el('span', { textContent: label })]);
  }

  const escapeHtml = (text) => text.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

  function leaveMission() {
    stopAnimation();
    stopSession();
    cancelAutoNext();
    step = null;
    mission = null;
    showScore(false);
    missionScreen.hidden = true;
    mapScreen.hidden = false;
  }

  /** Everything open (camí, taller, cançons), nothing saved. */
  function enterTeacherMode() {
    teacherProfile = { name: 'Professor/a', stars: {}, log: [], welcomed: true, placed: true, teacher: true };
    store.current = TEACHER_ID;
    saveStore();
    screen = screen === 'songs' ? 'songs' : 'map';
    showMap();
  }

  const unlockButton = () => (isTeacher() ? null : button('🔓 Desbloqueja-ho tot (mode professor)', () => {
    if (!window.confirm('Mode professor: tots els camins i missions oberts per provar-ho tot. Les estrelles no es guarden. Continuar?')) return;
    enterTeacherMode();
  }, 'ghost small'));

  function teacherBannerEl() {
    if (!isTeacher()) return null;
    return el('div', { className: 'play-teacher-banner' }, [
      el('span', { innerHTML: '🔓 <b>Mode professor</b>: tot obert; les estrelles no es guarden.' }),
      button('Surt del mode professor', () => {
        store.current = null;
        saveStore();
        screen = 'who';
        showMap();
      }, 'ghost small'),
    ]);
  }

  /** Tabs above a map: the path, the adaptive path (and the workshop in "Juga"). */
  function boardTabs() {
    const songs = section === 'cancons';
    const current = songs ? songBoard : board;
    const tab = (id, label) => {
      const b = el('button', { type: 'button', className: `play-board-tab${current === id ? ' on' : ''}`, textContent: label });
      b.addEventListener('click', () => {
        if (songs) {
          songBoard = id;
          storage.set('rockin.play.songBoard', id);
        } else {
          board = id;
          storage.set('rockin.play.board', id);
        }
        showMap();
      });
      return b;
    };
    if (!songs) return el('div', { className: 'play-board-tabs' }, [tab('cami', '🎸 El camí'), tab('adapt', '🧭 Camí intel·ligent'), tab('taller', '🎹 Taller d\'acords')]);
    return el('div', { className: 'play-board-tabs' }, [
      button('← Totes les cançons', () => {
        screen = 'songs';
        showMap();
      }, 'ghost'),
      tab('cami', '🎸 El camí'),
      tab('adapt', '🧭 Camí intel·ligent'),
      button('🖨 Fitxa', () => printSheet(), 'ghost small'),
    ]);
  }

  function showMap() {
    stopLounge();
    leaveMission();
    if (!me() && screen !== 'creator' && screen !== 'teacher' && screen !== 'guide') screen = 'who';
    if (screen === 'guide') return showGuide();
    if (section === 'cancons') {
      const songPath = resolvePath();
      if (screen === 'map' && !songPath) screen = 'songs';
      path = songPath ? handsPath(songPath) : ROCKIN_PATH;
    } else if (section === 'banda') {
      if (!['who', 'welcome', 'hands', 'teacher'].includes(screen)) screen = 'jam';
      path = ROCKIN_PATH;
    } else if (section === 'improvisa') {
      if (!['who', 'welcome', 'hands', 'teacher'].includes(screen)) screen = 'improv';
      path = ROCKIN_PATH;
    } else {
      if (['songs', 'creator', 'jam', 'improv'].includes(screen)) screen = 'map';
      path = board === 'taller' && screen === 'map' ? WORKSHOP_PATH : handsPath(ROCKIN_PATH);
    }
    if (screen === 'who') return showWho();
    if (screen === 'songs') return showSongs();
    if (screen === 'creator') return showCreator();
    if (screen === 'teacher') return showTeacher();
    if (screen === 'welcome') return showWelcome();
    if (['map', 'jam', 'improv'].includes(screen) && me() && !me().hands && !me().teacher) screen = 'hands';
    if (screen === 'improv') return showImprov();
    if (screen === 'jam') return showJam();
    if (screen === 'hands') return showHands(() => {
      screen = homeScreen();
      showMap();
    });
    if (screen === 'map' && (section === 'cancons' ? songBoard === 'adapt' : board === 'adapt')) return showAdaptive(withHands(kitFor(path.base ?? path)));
    const st = me();
    const total = path.missions.reduce((sum, m) => sum + starsOf(m.id), 0);
    const resume = nextIndex();
    const next = resume !== null ? path.missions[resume] : null;
    const spec = allSpecs().find((x) => x.id === (path.base ?? path).id);

    let index = 0;
    const workshop = path === WORKSHOP_PATH;
    const songs = section === 'cancons';
    setChildren(mapScreen,
      teacherBannerEl(),
      boardTabs(),
      el('div', { className: 'play-hello' }, [
        el('div', { className: 'play-hello-text' }, [
          path.custom ? el('div', { className: 'play-kicker', textContent: spec.book ? `Llibre ROCKIN · ${spec.name} (${spec.artist}) · ${styleName(spec.style)} ${spec.tempo} bpm` : `Cançó: ${path.title} · compàs ${spec.meter}` }) : null,
          workshop ? el('div', { className: 'play-kicker', textContent: 'Taller d\'acords · tria el joc que vulguis' }) : null,
          el('h2', { textContent: `Hola, ${st.name}!` }),
          el('div', { className: 'play-total' }, [el('span', { textContent: '★' }), ` ${total} estrelles`]),
          workshop ? null : handsChip(),
        ]),
        next
          ? el('div', { className: 'play-resume' }, [
              el('small', { textContent: total ? 'Continua per aquí:' : 'Comença per aquí:' }),
              el('strong', { textContent: next.title }),
              button('▶ Juga', () => openMission(resume)),
            ])
          : el('div', { className: 'play-resume' }, [el('strong', { textContent: 'Has completat tot el camí! 🎉' })]),
      ]),
      workshop ? null : bandCard(),
      songs && spec ? songGrid(spec) : workshop ? null : keyStrip(path.key, splitProgression(ROCKIN_PATH.worlds[1].progression)),
      ...path.worlds.flatMap((world, w) => {
        const levelHead = world.level2 && !path.worlds[w - 1]?.level2
          ? el('div', { className: 'play-level-head' }, [
              el('strong', { textContent: '⭐ Nivell 2: arpegis i contorn melòdic' }),
              el('span', { textContent: 'Les notes de l\'acord d\'una en una, seguint la línia de les cartes melòdiques. Es fa amb la mà dreta.' }),
            ])
          : null;
        const first = index;
        const count = world.missions.length;
        index += count;
        const done = world.missions.every((m) => starsOf(m.id) >= 1);
        const current = next?.world === world;
        const locked = !workshop && !store.unlockAll && !isTeacher() && !done && !current && !unlocked(first);
        const worldStars = world.missions.reduce((sum, m) => sum + starsOf(m.id), 0);
        const learned = learnedBefore(first + count);
        const box = el('details', { className: `play-world${current ? ' current' : ''}${done ? ' done' : ''}${locked ? ' locked' : ''}`, open: workshop || current || ((store.unlockAll || isTeacher()) && !done) });
        box.append(
          el('summary', { className: 'play-world-head' }, [
            el('span', { className: 'play-world-number', textContent: locked ? '🔒' : done ? '✓' : String(w + 1) }),
            el('div', { className: 'play-world-text' }, [
              el('h3', { textContent: world.title }),
              locked ? el('p', { textContent: 'Acaba el món anterior per obrir-lo.' }) : el('p', { textContent: world.goal }),
            ]),
            el('span', { className: 'play-world-stars', textContent: `★ ${worldStars}/${count * 3}` }),
          ]),
        );
        if (!locked) {
          if (!workshop) {
            box.append(el('div', { className: 'play-goal-chords' }, splitProgression(world.progression).map((c) =>
              chordChip(c, path.key, learned.has(c) ? 'on' : ''),
            )));
          }
          box.append(
            el('ol', { className: 'play-path' }, world.missions.map((m, k) => {
              const i = first + k;
              const open = unlocked(i);
              const got = starsOf(m.id);
              const node = el('button', {
                type: 'button',
                className: `play-node ${m.type}${got ? ' done' : ''}${i === resume ? ' next' : ''}`,
                disabled: !open,
                title: open ? m.title : 'Aconsegueix almenys una estrella a la missió anterior',
              }, [
                el('span', { className: 'play-node-dot', textContent: open ? GLYPH[m.type] : '·' }),
                el('span', { className: 'play-node-title', textContent: m.title }),
                el('span', { className: 'play-node-stars', textContent: open ? starText(got) : '' }),
              ]);
              node.addEventListener('click', () => openMission(i));
              return el('li', {}, [node]);
            })),
          );
          const strip = cardStrip(world);
          if (strip) box.append(strip);
        }
        return levelHead ? [levelHead, box] : [box];
      }),
      el('div', { className: 'play-map-foot' }, [
        button('❓ Com es juga?', () => {
          screen = 'welcome';
          showMap();
        }, 'ghost small'),
        !songs && !workshop && !st.teacher ? button('🎯 Prova de nivell', () => placementTest(), 'ghost small') : null,
        st.teacher ? null : button(`No ets ${st.name}? Canvia`, () => {
          screen = 'who';
          showMap();
        }, 'ghost small'),
        songs ? unlockButton() : null,
        songs ? null : button('⚙ Professorat', () => {
          screen = 'teacher';
          showMap();
        }, 'ghost small'),
      ]),
    );
    step = resume !== null ? { space: () => openMission(resume) } : null;
    toTop();
  }

  // ---- Songs: paths made for a song or a chord wheel ------------------------------------------------

  const styleName = (id) => STYLES.find((x) => x.id === id)?.name ?? id;

  /** The seven chords of the key with their colours and tonal functions (as the side strip of the book). */
  function keyStrip(key, used = []) {
    const chords = keyChords(key);
    const byIndex = new Map(chords.map((c) => [degreeOf(c, key).index, c]));
    return el('details', { className: 'play-keystrip' }, [
      el('summary', { className: 'play-keystrip-head' }, [
        el('strong', { textContent: `🎨 Els colors dels acords · tonalitat de ${chordLong(key)}` }),
        el('span', { className: 'play-keystrip-mini' }, chords.map((c) => {
          const i = el('i', { title: chordName(c) });
          i.style.background = degreeOf(c, key).colour;
          return i;
        })),
      ]),
      el('p', { className: 'play-note', textContent: 'Cada acord té el color del seu grau, com al llibre: el mateix color vol dir la mateixa funció, en qualsevol cançó. El número romà és el grau (majúscula = acord major, minúscula = menor).' }),
      el('div', { className: 'play-functions' }, FUNCTIONS.map((f) => el('div', { className: 'play-function' }, [
        el('b', { textContent: f.name }),
        el('small', { textContent: f.text }),
        el('div', { className: 'play-goal-chords' }, f.degrees.map((k) => byIndex.get(k)).filter(Boolean).map((c) => chordChip(c, key, used.includes(c) ? 'on' : ''))),
      ]))),
      el('p', { className: 'play-note', innerHTML: 'Els acords de fora de la tonalitat (per exemple el <b>♭VII</b>) són <span class="play-borrowed">rosa clar</span>.' }),
    ]);
  }

  /** The structure grid of a song, as in the book: one row per part, coloured chords. */
  function songGrid(spec) {
    const key = spec.key ?? keyOf(spec);
    const parts = spec.parts
      ? Object.entries(spec.parts)
      : [['Estrofa', spec.progression], ...(spec.chorus ? [['Tornada', spec.chorus]] : [])];
    const cell = (c) => {
      const d = degreeOf(c, key);
      const node = el('span', { className: 'grid-cell', title: `${chordLong(c)} · ${d.label}` }, [el('b', { textContent: chordName(c) }), el('i', { textContent: d.label })]);
      node.style.background = d.colour;
      node.style.color = d.ink;
      return node;
    };
    return el('div', { className: 'play-world play-songgrid' }, [
      el('div', { className: 'play-songgrid-head' }, [
        el('h3', { textContent: 'La graella de la cançó' }),
        el('span', { className: 'play-note', textContent: `Estructura: ${(spec.order ?? parts.map(([n]) => n)).join(' – ')} · ${styleName(spec.style)} · ${spec.tempo} bpm · tonalitat: ${chordLong(key)}` }),
      ]),
      el('div', { className: 'play-grid-rows' }, parts.map(([name, text]) => {
        const bars = splitProgression(text);
        const rows = [];
        const chunk = bars.length > 8 ? 4 : bars.length;
        for (let k = 0; k < bars.length; k += chunk) rows.push(bars.slice(k, k + chunk));
        return el('div', { className: 'grid-part' }, [
          el('div', { className: 'grid-name', textContent: name }),
          el('div', { className: 'grid-bars' }, rows.map((r) => el('div', { className: 'grid-row' }, r.map(cell)))),
        ]);
      })),
      spec.note ? el('p', { className: 'play-note', textContent: spec.note }) : null,
      keyStrip(key, [...new Set(parts.flatMap(([, t]) => splitProgression(t)))]),
    ]);
  }

  function showSongs() {
    const quick = (song, i) => {
      const b = el('button', { type: 'button', className: 'play-song-quick' }, [
        el('strong', { textContent: song.songs.split(/[·(]/)[0].replace(/[«»]/g, '').trim() }),
        el('span', { textContent: song.chords.split(' ').map(chordName).join(' – ') }),
      ]);
      b.addEventListener('click', () => {
        const spec = {
          id: `p${Date.now().toString(36)}${i}`,
          name: song.songs.split(/[·(,]/)[0].replace(/[«»]/g, '').trim(),
          progression: song.chords.split(' ').join(' | '),
          chorus: '',
          meter: '4/4',
          style: song.style,
          tempo: song.tempo,
          readCards: false,
        };
        customSpecs = [...customSpecs, spec];
        save(PATHS_KEY, customSpecs);
        openSongPath(spec.id);
      });
      return b;
    };
    const starsIn = (spec) => {
      try {
        const p = buildPath(spec, getCards());
        return { stars: p.missions.reduce((sum, m) => sum + starsOf(m.id), 0), total: p.missions.length * 3 };
      } catch {
        return { stars: 0, total: 0 };
      }
    };
    const bookCards = bookSpecs.map((spec) => {
      const { stars, total } = starsIn(spec);
      const card = el('button', { type: 'button', className: 'play-song book' }, [
        el('span', { className: 'play-song-icon', textContent: '📖' }),
        el('strong', { textContent: spec.name }),
        el('small', { className: 'play-song-artist', textContent: spec.artist }),
        el('div', { className: 'play-goal-chords' }, splitProgression(spec.progression).map((c) => chordChip(c, spec.key))),
        el('small', { textContent: `${styleName(spec.style)} · ${spec.tempo} bpm${stars ? ` · ★ ${stars}/${total}` : ''}` }),
      ]);
      card.addEventListener('click', () => openSongPath(spec.id));
      return card;
    });
    const cards = customSpecs.map((spec) => {
      let stars = 0;
      let total = 0;
      try {
        const p = buildPath(spec, getCards());
        stars = p.missions.reduce((sum, m) => sum + starsOf(m.id), 0);
        total = p.missions.length * 3;
      } catch {
        // cards not loaded yet
      }
      const remove = el('button', { type: 'button', className: 'play-song-remove', title: 'Esborra aquest camí', textContent: '✕' });
      remove.addEventListener('click', (event) => {
        event.stopPropagation();
        if (!window.confirm(`Esborrar el camí «${spec.name}»? (Les estrelles que s'hi han guanyat es perden.)`)) return;
        customSpecs = customSpecs.filter((x) => x.id !== spec.id);
        save(PATHS_KEY, customSpecs);
        showSongs();
      });
      const card = el('div', { className: 'play-song', role: 'button', tabIndex: 0 }, [
        remove,
        el('span', { className: 'play-song-icon', textContent: '♬' }),
        el('strong', { textContent: spec.name || spec.progression }),
        el('div', { className: 'play-goal-chords' }, spec.progression.split('|').map((c) => chordChip(c.trim(), spec.key ?? keyOf(spec)))),
        el('small', { textContent: `Compàs ${spec.meter}${spec.chorus ? ' · amb tornada' : ''}${total ? ` · ★ ${stars}/${total}` : ''}` }),
      ]);
      card.addEventListener('click', () => openSongPath(spec.id));
      card.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') openSongPath(spec.id);
      });
      return card;
    });
    setChildren(mapScreen,
      teacherBannerEl(),
      el('div', { className: 'play-hello' }, [
        el('div', { className: 'play-hello-text' }, [
          el('div', { className: 'play-kicker', textContent: 'Cançons' }),
          el('h2', { textContent: 'Aprèn a tocar una cançó' }),
          el('p', { className: 'play-note', textContent: 'Cada cançó té el seu camí: aprendre els acords, els canvis, la roda amb les cartes i tocar-la amb la banda.' }),
        ]),
        el('div', { className: 'play-resume' }, [
          el('small', { textContent: 'Una cançó teva o una progressió de classe' }),
          button('+ Crea un camí', () => {
            screen = 'creator';
            showMap();
          }),
        ]),
      ]),
      el('div', { className: 'play-world' }, [
        el('h3', { textContent: '📖 Cançons del llibre ROCKIN' }),
        el('p', { className: 'play-note', textContent: 'Amb la graella de cada cançó i els acords pintats pel seu grau, com al llibre.' }),
        el('div', { className: 'play-songs' }, bookCards),
      ]),
      cards.length
        ? el('div', { className: 'play-world' }, [el('h3', { textContent: 'Els teus camins' }), el('div', { className: 'play-songs' }, cards)])
        : null,
      el('div', { className: 'play-world' }, [
        el('h3', { textContent: 'Cançons conegudes' }),
        el('p', { className: 'play-note', textContent: 'Tria\'n una i es crea el camí al moment.' }),
        el('div', { className: 'play-songs quick' }, SONGS.slice(0, 12).map(quick)),
      ]),
      el('div', { className: 'play-map-foot' }, [
        isTeacher() ? null : button(`No ets ${me()?.name ?? ''}? Canvia`, () => {
          screen = 'who';
          showMap();
        }, 'ghost small'),
        unlockButton(),
      ]),
    );
    step = null;
    toTop();
  }

  // ---- First time: how the game works --------------------------------------------------------------------

  function showWelcome() {
    const st = me();
    const slides = [
      {
        art: el('img', { className: 'welcome-logo', src: 'assets/brand/rockin-logo-dark.png', alt: 'ROCKIN' }),
        title: `Hola, ${st?.name ?? ''}!`,
        text: 'Aquí aprendràs a <b>acompanyar cançons</b> amb el teclat, com si toquessis en un grup.',
      },
      {
        art: el('div', { className: 'welcome-card' }, [
          el('span', { className: 'welcome-ball' }),
          ...[1, 2, 3, 4].map((k) => el('i', { className: k === 3 ? 'rest' : '' })),
        ]),
        title: 'La carta et diu QUAN tocar',
        text: 'Una pilota bota sobre les rodones. Quan cau sobre una <b>rodona blava</b>, toca. A la <b>blanca</b>, espera.',
      },
      {
        art: el('div', { className: 'welcome-keys' }, Array.from({ length: 8 }, (_, k) => el('i', { className: [0, 2, 4].includes(k) ? 'on' : '' }))),
        title: 'El teclat et diu QUINES notes',
        text: 'Les tecles <b>grogues</b> són les que has de tocar. Pots fer servir un teclat de veritat o el ratolí. Sense teclat? Activa <b>«Tocar amb l\'ordinador»</b> a dalt de tot.',
      },
      {
        art: el('div', { className: 'welcome-art', textContent: '✋ 👂' }),
        title: 'Primer escoltes, després toques',
        text: 'Quan veus la <b>mà</b>, escolta i no toquis. Quan surt <b>«Ara tu!»</b>, compta i entra.',
      },
      {
        art: el('div', { className: 'welcome-art stars', textContent: '★★★' }),
        title: 'Guanya estrelles',
        text: 'Cada missió dona fins a 3 estrelles. Amb <b>una</b> ja passes a la següent. Si t\'equivoques, les marques de la carta et diuen on.',
      },
    ];
    let i = 0;
    const finish = () => {
      if (st) {
        st.welcomed = true;
        saveStore();
      }
      screen = homeScreen();
      if (st && !st.hands) return showHands(finish);
      if (section !== 'juga' || st?.teacher || st?.placed) return showMap();
      // First time on the ROCKIN path: from the start, or a placement test.
      path = handsPath(ROCKIN_PATH);
      setChildren(mapScreen,
        el('div', { className: 'play-world play-welcome' }, [
          el('div', { className: 'welcome-art', textContent: '🎯' }),
          el('h2', { textContent: 'Per on comences?' }),
          el('p', { innerHTML: 'Si és el primer cop que toques acords, comença pel principi. Si ja en saps una mica, fes la <b>prova de nivell</b>: 4 proves curtes i el joc et porta al lloc que et toca.' }),
          el('div', { className: 'play-buttons' }, [
            button('Comença pel principi', () => {
              if (st) {
                st.placed = true;
                saveStore();
              }
              openMission(0);
            }, 'ghost'),
            button('🎯 Fes la prova de nivell', () => placementTest()),
          ]),
        ]),
      );
      step = { space: () => placementTest() };
    };
    const render = () => {
      const slide = slides[i];
      const last = i === slides.length - 1;
      setChildren(mapScreen,
        el('div', { className: 'play-world play-welcome' }, [
          slide.art,
          el('h2', { textContent: slide.title }),
          el('p', { innerHTML: slide.text }),
          el('div', { className: 'play-dots' }, slides.map((_, k) => el('span', { className: k < i ? 'on' : k === i ? 'now' : '' }))),
          el('div', { className: 'play-buttons' }, [
            i > 0 ? button('← Enrere', () => { i--; render(); }, 'ghost') : button('Salta', finish, 'ghost'),
            button(last ? 'Som-hi! ▶' : 'Següent →', () => {
              if (last) finish();
              else {
                i++;
                render();
              }
            }),
          ]),
        ]),
      );
      step = { space: () => (last ? finish() : (i++, render())) };
    };
    render();
  }

  // ---- Who plays ---------------------------------------------------------------------------------------------

  function showWho() {
    const input = el('input', { type: 'text', placeholder: 'El teu nom', maxLength: 30, autocomplete: 'off' });
    const enter = (id) => {
      teacherProfile = { ...teacherProfile, stars: {}, log: [] };
      store.current = id;
      saveStore();
      screen = store.students[id].welcomed ? (homeScreen()) : 'welcome';
      showMap();
    };
    const create = () => {
      const name = input.value.trim();
      if (!name) return input.focus();
      const existing = Object.entries(store.students).find(([, st]) => st.name.toLowerCase() === name.toLowerCase());
      if (existing) return enter(existing[0]);
      const id = `s${Date.now().toString(36)}`;
      store.students[id] = { name, stars: {}, log: [] };
      enter(id);
    };
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') create();
    });
    const list = Object.entries(store.students).sort((a, b) => a[1].name.localeCompare(b[1].name));
    setChildren(mapScreen,
      el('div', { className: 'play-world play-who-screen' }, [
        el('div', { className: 'play-kicker', textContent: 'Benvinguda' }),
        el('h2', { textContent: 'Qui juga?' }),
        list.length ? el('div', { className: 'play-who-list' }, list.map(([id, st]) => {
          const got = Object.values(st.stars).reduce((a, b) => a + b, 0);
          const b = button(`${st.name} · ★ ${got}`, () => enter(id), id === store.current ? 'primary' : 'ghost');
          b.classList.add('play-who-name');
          return b;
        })) : null,
        el('p', { textContent: list.length ? 'No hi ets? Escriu el teu nom:' : 'Escriu el teu nom per guardar les teves estrelles en aquest ordinador:' }),
        el('div', { className: 'play-who-new' }, [input, button('Entra', create)]),
      ]),
    );
    step = null;
    setTimeout(() => input.focus(), 0);
  }

  // ---- Teacher view and printable sheet ------------------------------------------------------------------

  function showTeacher() {
    path = ROCKIN_PATH;
    const speedButtons = SPEEDS.map((x) => {
      const b = el('button', { type: 'button', className: `play-chip${x === speed ? ' on' : ''}`, textContent: `${x.name} (${x.tempo})` });
      b.addEventListener('click', () => {
        speed = x;
        storage.set('rockin.play.speed', x.id);
        showTeacher();
      });
      return b;
    });
    const back = () => {
      screen = 'map';
      showMap();
    };
    setChildren(mapScreen,
      el('div', { className: 'play-teacher-top' }, [
        button('← Torna al joc', back, 'ghost'),
        el('h2', { textContent: '⚙ Zona del professorat' }),
        button('📘 Guia del professorat', () => {
          guideBack = 'teacher';
          screen = 'guide';
          showMap();
        }),
      ]),
      el('div', { className: 'play-world' }, [
        el('h3', { textContent: 'Prova-ho tot' }),
        el('p', { className: 'play-note', textContent: 'Entra com a professor/a: totes les missions obertes (camí, taller i cançons) i no es guarda cap estrella ni cap intent.' }),
        el('div', { className: 'play-buttons' }, [button('🔓 Entra en mode professor', enterTeacherMode)]),
      ]),
      el('div', { className: 'play-world' }, [
        el('h3', { textContent: 'Fitxa per imprimir' }),
        el('p', { className: 'play-note', textContent: 'La fitxa del camí ROCKIN. La de cada cançó és al mapa de la cançó (portada → Cançons).' }),
        el('div', { className: 'play-buttons' }, [button('🖨 Fitxa del camí ROCKIN (1 pàgina horitzontal)', () => printSheet(), 'ghost')]),
      ]),
      el('div', { className: 'play-world' }, [
        el('h3', { textContent: 'Opcions del joc' }),
        el('div', { className: 'play-settings' }, [el('span', { textContent: 'Velocitat' }), ...speedButtons]),
        el('div', { className: 'play-settings' }, [
          toggle('Clic de metrònom mentre toquen (la bateria ja marca el pols)', metronome, (v) => {
            metronome = v;
            storage.set('rockin.play.click', v ? 'yes' : 'no');
          }),
          toggle('Noms de les notes a les tecles', names, (v) => {
            names = v;
            storage.set('rockin.play.names', v ? 'yes' : 'no');
          }),
          toggle('Obre totes les missions a tots els alumnes', store.unlockAll, (v) => {
            store.unlockAll = v;
            saveStore();
          }),
          toggle('Números de dit a les tecles pintades', showFingers, (v) => {
            showFingers = v;
            storage.set('rockin.play.fingers', v ? 'yes' : 'no');
            showMap();
          }),
        ]),
        showFingers ? fingeringTable() : null,
        el('p', { className: 'play-note', innerHTML: 'La <b>Sessió</b> (progressions lliures i reptes per treballar a classe) és a la portada: <b>⌂ Inici → Sessió</b>.' }),
      ]),
      adaptiveSummary(),
      ...[ROCKIN_PATH, handsPath(ROCKIN_PATH, 'chord'), handsPath(ROCKIN_PATH, 'bass'), WORKSHOP_PATH, ...bookSpecs.filter((spec) => Object.values(store.students).some((st) => st.log.some((e) => e.p === spec.id))), ...customSpecs].map((spec) => {
        if (spec.worlds) return spec;
        try {
          return buildPath(spec, getCards());
        } catch {
          return null;
        }
      }).filter(Boolean).map((p) => renderTeacher({
        store,
        path: p,
        button,
        onDelete: (id) => {
          if (!window.confirm(`Esborrar ${store.students[id].name} i tot el seu progrés?`)) return;
          delete store.students[id];
          if (store.current === id) store.current = null;
          saveStore();
          showTeacher();
        },
        onRename: (id) => {
          const name = window.prompt('Nom nou', store.students[id].name)?.trim();
          if (!name) return;
          store.students[id].name = name;
          saveStore();
          showTeacher();
        },
      })),
    );
    step = null;
    toTop();
  }

  /** What each student knows in the adaptive path (ROCKIN and every song with data). */
  function adaptiveSummary() {
    const students = Object.entries(store.students);
    const kits = [kitFor(ROCKIN_PATH)];
    for (const spec of allSpecs()) {
      if (!students.some(([, st]) => st.adaptive?.[spec.id])) continue;
      try {
        kits.push(kitFor(buildPath(spec, getCards())));
      } catch {
        // cards not loaded yet
      }
    }
    const blocks = kits.map((kit) => {
      const skills = skillsFor(kit);
      const rows = students.filter(([, st]) => st.adaptive?.[kit.key]?.history.length).map(([, st]) => {
        const state = st.adaptive[kit.key];
        const { good, total } = progressOf(state, skills);
        const weakOnes = skills.filter((x) => weak(state, x.id)).map((x) => x.label);
        const untested = skills.filter((x) => !known(state, x.id)).length;
        return el('tr', {}, [
          el('td', { textContent: st.name }),
          el('td', {}, [el('b', { textContent: `${good}/${total}` })]),
          el('td', { textContent: weakOnes.join(', ') || '—' }),
          el('td', { textContent: untested ? String(untested) : '—' }),
          el('td', { textContent: String(state.history.length) }),
        ]);
      });
      return el('div', {}, [
        el('h4', { textContent: kit.title }),
        rows.length
          ? el('table', { className: 'teacher-table' }, [
              el('thead', {}, [el('tr', {}, ['Alumne', 'Sap', 'Cal practicar', 'Per provar', 'Reptes'].map((t) => el('th', { textContent: t })))]),
              el('tbody', {}, rows),
            ])
          : el('p', { className: 'play-note', textContent: 'Encara ningú no hi ha jugat.' }),
      ]);
    });
    return el('div', { className: 'play-world' }, [
      el('h3', { textContent: '🧭 Camí intel·ligent: què sap cada alumne' }),
      el('p', { className: 'play-note', textContent: '«Sap» compta els aprenentatges demostrats o deduïts (notes, llegir cartes, cada acord, cada canvi, la roda a tempo, els ritmes, la banda…).' }),
      ...blocks,
    ]);
  }

  let guideBack = 'teacher';
  function showGuide() {
    setChildren(mapScreen, renderGuide({
      button,
      onBack: () => {
        if (guideBack === 'home') {
          screen = homeScreen();
          document.querySelector('[data-view="home"]')?.click();
          return;
        }
        screen = guideBack;
        showMap();
      },
      onPrint: () => {
        sheetBox.replaceChildren(renderGuidePrint());
        document.body.classList.add('printing');
        const done = () => {
          document.body.classList.remove('printing');
          window.removeEventListener('afterprint', done);
        };
        window.addEventListener('afterprint', done);
        setTimeout(() => window.print(), 200);
      },
    }));
    step = null;
    toTop();
  }

  function printSheet() {
    const sheet = renderSheet({ path: path.base ?? path, cards: getCards(), student: null });
    sheetBox.replaceChildren(sheet);
    document.body.classList.add('printing');
    // Fit it on one landscape A4 page: 273 × 186 mm printable.
    const mm = 96 / 25.4;
    const fit = () => {
      let zoom = 1;
      for (let k = 0; k < 3; k++) {
        sheet.style.zoom = zoom === 1 ? '' : String(zoom);
        sheet.style.width = `${(273 * mm) / zoom}px`;
        const height = sheet.getBoundingClientRect().height;
        const limit = 186 * mm - 10;
        if (height <= limit + 1) break;
        zoom = Math.floor(zoom * (limit / height) * 100) / 100;
      }
    };
    const done = () => {
      document.body.classList.remove('printing');
      window.removeEventListener('afterprint', done);
    };
    window.addEventListener('afterprint', done);
    // Wait for the card images, then fit and print.
    const images = [...sheet.querySelectorAll('img')].map((img) => img.decode().catch(() => {}));
    Promise.race([Promise.all(images), new Promise((r) => setTimeout(r, 1500))]).then(() => {
      fit();
      window.print();
    });
  }

  // ---- Path creator -----------------------------------------------------------------------------------

  function showCreator() {
    const nameInput = el('input', { type: 'text', placeholder: 'p. ex. Despacito, Cançó de la classe', maxLength: 40 });
    const songSelect = el('select', {}, [
      new Option('Escric la meva roda…', ''),
      ...SONGS.map((song, i) => new Option(`${song.chords.split(' ').join(' – ')} · ${song.songs}`, String(i))),
    ]);
    const progInput = el('input', { type: 'text', value: 'C | G | Am | F', spellcheck: false });
    const chorusInput = el('input', { type: 'text', value: '', placeholder: 'p. ex. F | G | C | Am', spellcheck: false });
    const keySelect = el('select', {}, SOLFEGE.map((n, pc) => new Option(`${n}${pc ? ` (${pc > 6 ? `-${12 - pc}` : `+${pc}`} semitons)` : ' (sense canvis)'}`, String(pc))));
    const meterSelect = el('select', {}, METERS.map((m) => new Option(m, m)));
    const styleSelect = el('select', {}, STYLES.filter((s) => s.id !== 'metronome').map((s) => new Option(s.name, s.id)));
    const tempoInput = el('input', { type: 'number', min: 40, max: 180, value: 80 });
    const readCards = el('input', { type: 'checkbox' });
    const preview = el('div', { className: 'play-creator-preview' });
    const error = el('p', { className: 'play-note bad-text' });

    const NAMES_SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const NAMES_FLAT = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
    const transpose = (text, shift) => {
      const list = [1, 3, 5, 8, 10].includes(mod(shift, 12)) ? NAMES_FLAT : NAMES_SHARP;
      const move = (n) => list[mod(pcOf(n) + shift, 12)];
      return splitProgression(text)
        .map((symbol) => {
          const { root: r, suffix, bass } = splitChord(symbol);
          return `${move(r)}${suffix}${bass ? `/${move(bass)}` : ''}`;
        })
        .join(' | ');
    };
    const shifted = (text) => {
      const shift = Number(keySelect.value);
      return shift && text.trim() ? transpose(text, shift) : text;
    };
    const refresh = () => {
      try {
        const bars = splitProgression(shifted(progInput.value));
        const chorus = splitProgression(shifted(chorusInput.value));
        if (!bars.length) throw new Error('Escriu almenys un acord');
        const all = [...new Set([...bars, ...chorus])];
        all.forEach((c) => parseChord(c));
        const odd = all.filter((c) => !isTriad(c));
        setChildren(preview,
          el('div', {}, [el('small', { textContent: 'Estrofa' }), el('div', { className: 'play-goal-chords' }, bars.map((c) => chordChip(c, keyOf({ progression: bars.join('|') }))))]),
          chorus.length ? el('div', {}, [el('small', { textContent: 'Tornada' }), el('div', { className: 'play-goal-chords' }, chorus.map((c) => chordChip(c, keyOf({ progression: bars.join('|') }))))]) : null,
          el('p', {
            className: 'play-note',
            textContent: `Mons: ${readCards.checked ? 'llegir cartes, ' : ''}aprendre la roda (${[...new Set(bars)].map(chordName).join(', ')} i els seus canvis), la roda amb ritme, la cançó${chorus.length ? ' amb estrofa i tornada' : ''} i les inversions.` +
              (odd.length ? ` Els acords ${odd.map(chordName).join(', ')} no són tríades majors o menors: es poden tocar, però no es construeixen comptant semitons.` : ''),
          }),
        );
        error.textContent = '';
        return { bars, chorus };
      } catch (e) {
        preview.replaceChildren();
        error.textContent = e.message;
        return null;
      }
    };
    songSelect.addEventListener('change', () => {
      const song = SONGS[Number(songSelect.value)];
      if (!song) return;
      progInput.value = song.chords.split(' ').join(' | ');
      styleSelect.value = song.style;
      tempoInput.value = String(song.tempo);
      if (!nameInput.value) nameInput.value = song.songs.split(/[·(,]/)[0].replace(/[«»]/g, '').trim();
      refresh();
    });
    for (const input of [progInput, chorusInput]) input.addEventListener('input', refresh);
    for (const input of [keySelect, readCards]) input.addEventListener('change', refresh);

    const field = (label, control, hint) => el('label', { className: 'play-field' }, [el('span', { textContent: label }), control, hint ? el('small', { textContent: hint }) : null]);
    setChildren(mapScreen,
      el('div', { className: 'play-teacher-top' }, [
        button('← Totes les cançons', () => {
          screen = 'songs';
          showMap();
        }, 'ghost'),
      ]),
      el('div', { className: 'play-world play-creator' }, [
        el('div', { className: 'play-kicker', textContent: 'Cançons' }),
        el('h2', { textContent: 'Crea un camí per a una cançó' }),
        el('p', { textContent: 'Tria la roda d\'acords i el compàs. El joc prepara els mateixos passos que el camí ROCKIN: aprendre la roda sencera amb notes llargues (cada acord des de la fonamental i cada canvi), la roda amb cartes de ritme, la cançó i, al final, les inversions.' }),
        el('div', { className: 'play-creator-grid' }, [
          field('Nom del camí', nameInput),
          field('Cançó coneguda', songSelect, 'Omple la roda, l\'estil i el tempo'),
          field('Roda d\'acords (estrofa)', progInput, 'Acords separats per | (p. ex. Am | F | C | G)'),
          field('Tornada (opcional)', chorusInput, 'Si la cançó té una tornada amb una altra roda'),
          field('Transporta', keySelect),
          field('Compàs', meterSelect),
          field('Estil de la base', styleSelect),
          field('Tempo de la cançó', tempoInput, 'Pulsacions per minut a la missió de la cançó'),
        ]),
        el('label', { className: 'play-toggle' }, [readCards, el('span', { textContent: 'Comença amb «Llegeix les cartes» (si encara no saben llegir-les)' })]),
        preview,
        error,
        el('div', { className: 'play-buttons' }, [
          button('Crea el camí', () => {
            const result = refresh();
            if (!result) return;
            const spec = {
              id: `p${Date.now().toString(36)}`,
              name: nameInput.value.trim() || result.bars.join(' '),
              progression: result.bars.join(' | '),
              chorus: result.chorus.join(' | '),
              meter: meterSelect.value,
              style: styleSelect.value,
              tempo: Math.min(180, Math.max(40, Number(tempoInput.value) || 80)),
              readCards: readCards.checked,
            };
            try {
              buildPath(spec, getCards());
            } catch (e) {
              error.textContent = e.message;
              return;
            }
            customSpecs = [...customSpecs, spec];
            save(PATHS_KEY, customSpecs);
            openSongPath(spec.id);
          }),
          button('Cancel·la', () => {
            screen = 'songs';
            showMap();
          }, 'ghost'),
        ]),
      ]),
    );
    refresh();
    step = null;
  }

  // ---- Mission screen ---------------------------------------------------------------------------------------

  /** Opens a mission of the path by index, or a mission object (the adaptive path). */
  function openMission(index) {
    stopAnimation();
    stopSession();
    cancelAutoNext();
    mission = typeof index === 'object' ? { ...index, index: -1 } : { ...path.missions[index], index };
    keyboard.setKeyRange(mission.world?.twoHands ? TWO_HANDS_RANGE : [48, 84]);
    const worldIndex = path.worlds.indexOf(mission.world);
    mapScreen.hidden = true;
    missionScreen.hidden = false;
    showKeyboard(true); // card missions may hide it again below
    levelLadder.hidden = true;
    refreshLevelPill();
    showScore(false);
    renderHud(worldIndex);
    updateStars();
    feedback = new Map();
    view = { marks: new Map(), message: '' };
    const run = {
      lesson: lessonMission,
      chord: chordMission,
      change: changeMission,
      steps: stepsMission,
      invert: invertMission,
      pattern: cardsMission,
      mix: cardsMission,
      song: cardsMission,
      band: cardsMission,
      structure: cardsMission,
      find: findGame,
      jump: jumpGame,
      build: buildGame,
      rush: rushGame,
      'probe-chords': probeChords,
      arpeggio: arpeggioMission,
      'probe-changes': probeChanges,
    }[mission.type];
    run();
    toTop();
  }

  /** Turns the band between challenges on and off. */
  function grooveButton() {
    return button(grooveOn ? '♫ Banda entre reptes' : '♪ Banda aturada', () => {
      grooveOn = !grooveOn;
      localStorage.setItem('rockin.play.groove', grooveOn ? 'on' : 'off');
      if (!grooveOn) stopLounge();
      renderHud(path.worlds.indexOf(mission.world));
    }, 'ghost small');
  }

  const hudTools = (...items) => el('div', { className: 'play-hud-tools' }, items.filter(Boolean));

  // ---- Visual supports, taken away little by little ---------------------------
  // The picture of the keyboard and the repeated cards of a wheel help at the
  // start and get in the way later: from band level 3 on (playing from memory)
  // the keyboard only appears when the mission paints keys, and from level 4 a
  // row where every bar uses the same card shows one card ("una per acord").
  // `keysManual` (the 🎹 button) overrides it for the session.
  let keysManual = null;
  const bandStep = () => (isTeacher() ? 0 : me()?.band ?? 0);
  const keysWanted = (helpMode) => {
    if (keysManual !== null) return keysManual;
    return helpMode === 'shape' || bandStep() < 3;
  };
  const compactCards = () => keysManual !== true && bandStep() >= 4;
  const showKeyboard = (on) => {
    piano.hidden = !on;
    missionScreen.classList.toggle('no-keys', !on);
  };
  let hudRefresh = () => {};
  const keysButton = () => button(piano.hidden ? '🎹 Mostra el teclat' : '🎹 Amaga el teclat', () => {
    keysManual = piano.hidden;
    showKeyboard(piano.hidden);
    hudRefresh();
  }, 'ghost small');

  function renderHud(worldIndex) {
    hudRefresh = () => renderHud(worldIndex);
    if (mission.adaptive) return renderAdaptiveHud();
    const world = mission.world;
    const learned = learnedBefore(mission.index);
    const current = mission.type === 'chord' ? mission.chord : null;
    const pair = mission.type === 'change' ? [mission.from, mission.to] : [];
    hud.replaceChildren(
      el('div', { className: 'play-hud-text' }, [
        el('small', { textContent: `Món ${worldIndex + 1} · ${world.title}` }),
        el('strong', { textContent: mission.title }),
      ]),
      world.workshop ? el('div', { className: 'play-hud-goal' }, [el('small', { textContent: 'Objectiu' }), el('b', { textContent: world.goal })]) : el('div', { className: 'play-hud-goal' }, [
        el('small', { textContent: 'Objectiu del món' }),
        el('div', { className: 'play-goal-chords' }, splitProgression(world.progression).map((c) =>
          chordChip(c, path.key, c === current || pair.includes(c) ? 'now' : learned.has(c) ? 'on' : ''),
        )),
      ]),
      el('div', { className: 'play-hud-progress', title: 'Missions d\'aquest món' }, [
        el('small', { textContent: `Missió ${mission.step + 1} de ${world.missions.length}` }),
        el('div', { className: 'play-hud-bar' }, world.missions.map((m, k) =>
          el('i', { className: `${k === mission.step ? 'now' : ''}${starsOf(m.id) >= 1 ? ' done' : ''}` }),
        )),
      ]),
      hudTools(
        mission.index > 0 ? button('↩ Anterior', () => openMission(mission.index - 1), 'ghost small') : null,
        mission.index >= 0 && path.missions[mission.index + 1] ? button('⏭ Salta', () => openMission(mission.index + 1), 'ghost small') : null,
        keysButton(),
        grooveButton(),
      ),
    );
  }

  /** Plays the current mission again. */
  const again = () => openMission(mission.index < 0 ? mission : mission.index);

  function updateStars() {
    missionStars.textContent = starText(starsOf(mission.id));
  }

  /** Back to the top, except in full screen (there is nothing to scroll there). */
  const toTop = () => {
    if (!document.fullscreenElement) window.scrollTo({ top: 0 });
  };

  // ---- What you can already do with your group ------------------------------
  // The game says it out loud: every step of the path means something concrete
  // when you sit down to play with other people.
  const BAND_LEVELS = [
    { title: 'Comences', can: 'Estàs trobant les notes al teclat.', next: 'Construir els acords sense ajuda.' },
    { title: 'Acords, amb temps per pensar', can: 'Amb el teu grup podries fer tots els acords <b>si els companys t\'esperen</b> entre canvi i canvi.', next: 'Encadenar els canvis sense parar.' },
    { title: 'Canvis fluids', can: 'Podries seguir la roda <b>sense que ningú t\'esperi</b>: els canvis et surten a temps.', next: 'Acompanyar amb ritmes diferents.' },
    { title: 'Patrons amb les cartes', can: 'Podries acompanyar amb <b>ritmes diferents</b> mirant les cartes.', next: 'Fer-ho de memòria, sense mirar el teclat ni les cartes.' },
    { title: 'Sense suport visual', can: 'Podries acompanyar <b>de memòria</b>, mirant els companys en comptes de la pantalla.', next: 'Aguantar una cançó sencera sense parar.' },
    { title: 'Toques amb la banda', can: 'Podries fer <b>una cançó sencera sense parar</b>: si t\'equivoques, tornes a entrar.', next: 'Triar tu els patrons i combinar-los.' },
    { title: 'Tries i combines', can: 'Podries <b>triar els patrons a cada moment</b> i combinar-los al teu gust (i fer arpegis, contorn melòdic o dues mans).', next: null },
  ];

  /** The band level a mission proves, when it's passed. */
  function bandLevelOf(m) {
    if (!m) return 0;
    if (m.world?.level2 || m.type === 'jam') return 6;
    const byType = { lesson: 0, notes: 0, rush: 1, chord: 1, change: 1, steps: 2, tempo: 2, pattern: 3, song: 3, structure: 3, mix: 4, band: 5 };
    let level = byType[m.type] ?? 0;
    // A card mission with no help on the keyboard is already playing "blind".
    if (m.type === 'pattern' && m.help === 'none') level = 4;
    // Cards on a single note are still reading, not accompanying with chords.
    if ((m.world?.level ?? 2) < 2) level = 0;
    return level;
  }

  const bandLevel = () => Math.max(0, Math.min(BAND_LEVELS.length - 1, me()?.band ?? 0));

  /** Records a new band level; returns the line to show when it goes up. */
  function raiseBandLevel(level) {
    const st = me();
    if (!st || st.teacher || !(level > (st.band ?? 0))) return null;
    st.band = level;
    saveStore();
    refreshLevelPill();
    return `<b>Nivell de banda ${level}: ${BAND_LEVELS[level].title}.</b> ${BAND_LEVELS[level].can}`;
  }

  /** The level pill in the mission bar and its ladder, kept up to date. */
  function refreshLevelPill() {
    const st = me();
    levelBox.hidden = !st || st.teacher || section === 'improvisa';
    if (levelBox.hidden) return;
    const level = bandLevel();
    const info = BAND_LEVELS[level];
    levelPill.replaceChildren(
      el('small', { textContent: 'El teu nivell' }),
      el('strong', { textContent: `${level} de ${BAND_LEVELS.length - 1} · ${info.title}` }),
      el('span', { className: 'play-band-dots' }, BAND_LEVELS.map((_, k) => el('i', { className: k <= level ? 'on' : '' }))),
    );
    levelLadder.replaceChildren(
      el('strong', { textContent: 'Què podries fer amb el teu grup' }),
      ...BAND_LEVELS.map((lv, k) => el('div', { className: `play-level-step${k < level ? ' done' : k === level ? ' now' : ''}` }, [
        el('b', { textContent: k < level ? '✓' : k === level ? '●' : String(k) }),
        el('div', {}, [
          el('span', { className: 'play-level-title', textContent: `Nivell ${k} · ${lv.title}` }),
          el('p', { innerHTML: lv.can }),
        ]),
      ])),
      info.next ? el('p', { className: 'play-note', innerHTML: `<b>Et falta:</b> ${info.next}` }) : el('p', { className: 'play-note', textContent: 'Ja ets al nivell més alt!' }),
    );
  }

  /** The card on the map: what you could already do playing with other people. */
  function bandCard() {
    const level = bandLevel();
    const info = BAND_LEVELS[level];
    return el('div', { className: 'play-band-level' }, [
      el('div', { className: 'play-band-head' }, [
        el('small', { textContent: 'Per tocar amb els companys' }),
        el('strong', { textContent: `Nivell ${level} · ${info.title}` }),
      ]),
      el('div', { className: 'play-band-dots' }, BAND_LEVELS.map((_, k) => el('i', { className: k <= level ? 'on' : '' }))),
      el('p', { innerHTML: info.can }),
      info.next ? el('p', { className: 'play-note', innerHTML: `Següent: ${info.next}` }) : null,
    ].filter(Boolean));
  }

  function cancelAutoNext() {
    if (autoNext) clearInterval(autoNext.timer);
    autoNext = null;
  }

  /**
   * Fewer clicks: the game goes on by itself. Shows «<label> en N s…» in `node`
   * and calls `go()` when the count reaches zero; any button stops the count.
   */
  function autoGo(node, seconds, label, go) {
    cancelAutoNext();
    let left = seconds;
    const render = () => {
      node.textContent = `${label} en ${left}… (o prem Espai)`;
    };
    render();
    autoNext = {
      timer: setInterval(() => {
        left--;
        // The last seconds are also counted out loud, like a count-in.
        if (left <= 3 && left > 0) sfx.tick(left === 1);
        if (left <= 0) {
          cancelAutoNext();
          go();
        } else render();
      }, 1000),
    };
  }

  /** A mission's first screen: it starts by itself after a few seconds. */
  function startPanel({ seconds = 6, start, ...panelProps }) {
    const go = () => {
      cancelAutoNext();
      start();
    };
    const countdown = el('p', { className: 'play-note' });
    setPanel({ ...panelProps, extra: countdown, buttons: [button('▶ Comença ara', go), ...(panelProps.buttons ?? [])] });
    step = { space: go, ...(panelProps.step ?? {}) };
    autoGo(countdown, seconds, 'Comença', go);
    return go;
  }

  function logTry(entry) {
    const st = me();
    if (!st || st.teacher) return null;
    const item = { m: mission.id, p: path.id, t: Date.now(), ...entry };
    st.log.push(item);
    if (st.log.length > 400) st.log.splice(0, st.log.length - 400);
    return item;
  }

  function finishMission(got, { title, text, tips = [], retry, retryLabel = '↻ Torna-ho a provar', extra = [], ratio = null, tempo = null, detail = null, groove = null }) {
    const st = me();
    const adaptive = mission.adaptive ?? null;
    if (st && !adaptive && !mission.study) st.stars[mission.id] = Math.max(got, st.stars[mission.id] ?? 0);
    const entry = logTry({ s: got, r: ratio, tempo, ...(adaptive ? { a: adaptive.step.skill ?? `stage:${adaptive.step.stage}`, k: adaptive.kit.key } : {}) });
    const learnt = adaptive ? adaptiveResult(got, ratio, detail) : null;
    const band = got >= 1 ? raiseBandLevel(bandLevelOf(mission)) : null;
    saveStore();
    updateStars();
    renderHud(path.worlds.indexOf(mission.world));
    const next = adaptive ? null : path.missions[mission.index + 1];
    const worldDone = next && next.world !== mission.world;
    const goNext = adaptive ? () => openAdaptive(adaptive.kit) : () => openMission(mission.index + 1);
    const canGo = adaptive ? true : got >= 1 && Boolean(next);
    const stars = el('div', { className: 'play-result-stars' }, [0, 1, 2].map((k) =>
      el('span', { className: k < got ? 'on' : '', style: `animation-delay:${0.15 + k * 0.25}s`, textContent: '★' }),
    ));
    const buttons = [];
    if (retry) buttons.push(button(retryLabel, retry, got >= 1 ? 'ghost' : 'primary'));
    if (canGo) buttons.unshift(button(adaptive ? 'Següent repte →' : worldDone ? 'Món següent →' : 'Següent →', goNext));
    buttons.push(...extra);
    buttons.push(button(adaptive ? 'El meu camí' : 'Mapa', showMap, 'ghost'));
    const countdown = el('p', { className: 'play-note' });
    if (learnt) {
      text = `${text ?? ''}<br><span class="play-learnt">${learnt}</span>`;
    }
    if (band) {
      text = `${text ?? ''}<br><span class="play-band-up">🎸 ${band}</span>`;
    }

    // Self-assessment after the goal missions.
    let reflect = null;
    if (REFLECT_TYPES.has(mission.type) && entry) {
      const chips = REFLECTIONS.map((r) => {
        const b = el('button', { type: 'button', className: 'play-chip', textContent: r.label });
        b.addEventListener('click', () => {
          cancelAutoNext();
          countdown.textContent = '';
          entry.reflect = r.id;
          saveStore();
          chips.forEach((c) => c.classList.toggle('on', c === b));
        });
        return b;
      });
      reflect = el('div', { className: 'play-reflect' }, [el('b', { textContent: got === 3 ? 'Com t\'ha anat?' : 'On has perdut el fil?' }), el('div', {}, chips)]);
    }

    const side = tips.length || reflect
      ? [tips.length ? el('ul', {}, tips.map((t) => el('li', { innerHTML: t }))) : null, reflect]
      : null;
    setPanel({
      kicker: got >= 1 ? 'Missió superada' : 'Encara no',
      title,
      big: [stars],
      text,
      extra: countdown,
      side,
      buttons,
      tone: got >= 1 ? 'good' : 'bad',
    });
    if (got >= 2) {
      sfx.good();
      confetti();
    } else if (got === 1) sfx.ok();
    else sfx.bad();
    // The band keeps playing while the next challenge is announced.
    if (groove) setTimeout(() => startLounge(groove), 900);
    step = { space: canGo ? goNext : retry };
    // The goal missions wait for the self-assessment; the rest goes on by itself:
    // passed → next mission, not passed → the same one again (with more help).
    if (!reflect) {
      if (canGo && got >= 1) autoGo(countdown, AUTO_NEXT_SECONDS, adaptive ? 'Següent repte' : 'Següent missió', goNext);
      else if (retry && got === 0) autoGo(countdown, AUTO_RETRY_SECONDS, 'Ho tornem a provar', retry);
    }
  }

  // ---- Lesson ---------------------------------------------------------------------------------------------------

  function lessonMission() {
    const { slides } = mission;
    const world = mission.world;
    const rootChord = splitProgression(world.progression)[0];
    let i = 0;
    const done = () => finishMission(3, { title: 'Lliçó acabada!', text: 'Ja saps llegir aquestes cartes. Ara, a tocar-les!' });
    setFocus(world.twoHands ? 'both' : 'card');
    const show = () => {
      stopSession();
      const slide = slides[i];
      const card = cardByName(slide.card);
      showScore(true);
      score.setBars([{ card, name: '', kind: 'play' }], { rows: [{ bars: [0] }], columns: 1 });
      scoreState = { ball: () => null, data: () => ({}) };
      const rightNow = world.level === 1 ? [rightHandVoicing(rootChord)[0]] : rightHandVoicing(rootChord);
      view = { marks: world.twoHands ? handMarks(rightNow, leftHandVoicing(rootChord, world.level === 1 ? 'bass' : leftMode())) : new Map(), message: '' };
      const last = i === slides.length - 1;
      const next = () => {
        if (last) done();
        else {
          i++;
          show();
        }
      };
      setPanel({
        kicker: `Lliçó · ${i + 1} de ${slides.length}`,
        title: slide.title,
        text: slide.text,
        buttons: [
          button('♪ Escolta-la', () => {
            setStatus({ kicker: 'Escolta', text: 'Mira la pilota i escolta quan sona el piano.', buttons: [button('Atura', show, 'ghost')] });
            step = { space: show, escape: show };
            const two = Boolean(world.twoHands);
            runMusic({
              bars: [{ card, chord: rootChord, kind: 'demo', name: '' }, { card, chord: rootChord, kind: 'demo', name: '' }],
              rows: [{ bars: [0, 1] }],
              columns: 2,
              level: world.level,
              voicings: two ? [0, 1].map(() => (world.level === 1 ? [rightHandVoicing(rootChord)[0]] : rightHandVoicing(rootChord))) : null,
              hands: two ? { left: leftMode(), leftVoicings: [0, 1].map(() => leftHandVoicing(rootChord, world.level === 1 ? 'bass' : leftMode())) } : null,
              meter: world.meter,
              style: world.style,
              onEnd: show,
            });
          }, 'ghost'),
          i > 0 ? button('← Enrere', () => { i--; show(); }, 'ghost') : null,
          button(last ? 'Entesos! ✓' : 'Següent →', next),
        ],
      });
      step = { space: next };
    };
    show();
  }

  // ---- Learn a chord ----------------------------------------------------------------------------------------------

  function chordMission() {
    const symbol = mission.chord;
    const chord = parseChord(symbol);
    const notes = rootVoicing(symbol);
    const name = chordName(symbol);
    const countable = isTriad(symbol); // major and minor triads are built by counting
    const noteNames = countable ? triadNoteNames(symbol) : notes.map((n) => SOLFEGE[pitchClass(n)]);
    const minor = splitChord(symbol).suffix === 'm';
    const third = mod(chord.triad[1] - chord.root, 12);
    const fifth = mod(chord.triad[2] - chord.triad[1], 12);
    const world = mission.world;
    const wheel = splitProgression(world.progression);
    const why = wheel.length > 1
      ? `És un dels acords de la roda <b>${wheel.map(chordName).join(' – ')}</b>.`
      : 'És el primer acord del camí.';
    let hinted = false;
    setFocus('keys');

    // 1. Look and listen
    const look = () => {
      view = { marks: fingerMarks(notes, SHAPE, true, symbol), message: `${chordLong(symbol)}: ${noteNames.join(' – ')}` };
      const facts = countable
        ? [
            minor
              ? `Per trobar-lo: comença al <b>${noteNames[0]}</b>, salta <b>3 tecles</b> i després <b>4 tecles</b> més (compta blanques i negres). La <b>m</b> vol dir <b>menor</b>: el primer salt és de 3.`
              : `Per trobar-lo: comença al <b>${noteNames[0]}</b>, salta <b>4 tecles</b> i després <b>3 tecles</b> més (compta blanques i negres).`,
            'Els números de les tecles són els dits de la mà dreta: <b>1</b> és el polze.',
          ]
        : ['Els números de les tecles són els dits de la mà dreta.'];
      setPanel({
        kicker: `Acord nou · 1 de ${countable ? 3 : 2}`,
        title: `L'acord de ${chordLong(symbol)}`,
        text: `${why} Té tres notes: <b>${noteNames.join(' – ')}</b>${keysText(notes)}.`,
        list: facts,
        buttons: [
          button('♪ Escolta\'l', () => playNotes(notes, { arpeggio: true }), 'ghost'),
          button(countable ? 'Construeix-lo tu →' : 'Toca\'l →', countable ? build : practise),
        ],
      });
      step = { space: countable ? build : practise };
      playNotes(notes, { arpeggio: true });
    };

    // 2. Build it by counting keys (semitones, without the word)
    const build = () => {
      let base = null;
      let stage = 'root';
      let mistakes = 0;
      const render = (message = '', tone = '') => {
        const marks = new Map();
        let title;
        let text;
        if (stage === 'root') {
          title = `Troba el ${noteNames[0]}`;
          text = `Tot acord comença per la nota que li dona el nom, la <b>fonamental</b>. Toca un <b>${noteNames[0]}</b>.`;
          if (mistakes >= 2) marks.set(notes[0], { fill: true, colour: SHAPE, text: '' });
        } else if (stage === 'third' || stage === 'fifth') {
          const from = stage === 'third' ? base : base + third;
          const steps = stage === 'third' ? third : fifth;
          for (let k = 1; k <= steps; k++) marks.set(from + k, { colour: COUNT, text: String(k) });
          marks.set(from, { fill: true, colour: SHAPE, text: '' });
          if (stage === 'third') {
            title = `Compta ${third} tecles`;
            text = `Des del ${noteNames[0]}, ves cap a la dreta comptant <b>totes</b> les tecles, blanques i negres: 1, 2${third > 2 ? ', 3' : ''}${third > 3 ? ', 4' : ''}. Hi tens els números. Toca la tecla <b>${third}</b>.`;
          } else {
            title = `Ara ${fifth} tecles més`;
            text = `Des de la nota que acabes de tocar, torna a comptar: fins a <b>${fifth}</b>. Toca aquesta tecla.`;
          }
        } else {
          for (const n of [base, base + third, base + third + fifth]) marks.set(n, { fill: true, colour: SHAPE, text: '' });
          title = 'Ara les tres alhora!';
          text = `${noteNames.join(' + ')}: prem-les <b>juntes</b>.`;
        }
        view = { marks, message: '' };
        setPanel({ kicker: 'Acord nou · 2 de 3', title, text, note: message, tone, buttons: [button('← Torna a mirar-lo', look, 'ghost')] });
      };
      const wrong = (note, expected) => {
        mistakes++;
        feedback.set(note, 'bad');
        render(`Això és <b>${SOLFEGE[pitchClass(note)]}</b>. ${expected}`, 'bad');
      };
      step = {
        noteOn: ({ note }) => {
          if (stage === 'root') {
            if (pitchClass(note) !== chord.root) return wrong(note, 'Busca el nom a les tecles.');
            base = note >= 72 ? note - 12 : note < 48 ? note + 12 : note;
            feedback.set(note, 'good');
            stage = 'third';
            mistakes = 0;
            return render('Molt bé!', 'good');
          }
          if (stage === 'third' || stage === 'fifth') {
            const target = stage === 'third' ? base + third : base + third + fifth;
            if (pitchClass(note) === pitchClass(base) || (stage === 'fifth' && pitchClass(note) === pitchClass(base + third))) return;
            if (pitchClass(note) !== pitchClass(target)) return wrong(note, 'Torna a comptar els números de les tecles.');
            feedback.set(note, 'good');
            stage = stage === 'third' ? 'fifth' : 'all';
            return render('Exacte!', 'good');
          }
          if (stage !== 'all') return;
          const held = [...getHeld()];
          const stray = held.find((n) => !chord.triad.includes(pitchClass(n)));
          if (stray !== undefined) return wrong(stray, 'Només les tres tecles pintades.');
          if (new Set(held.map(pitchClass)).size === 3) {
            stage = 'done';
            setTimeout(practise, 500);
            render('Això és l\'acord!', 'good');
          }
        },
        noteOff: ({ note }) => feedback.delete(note),
      };
      render();
    };

    // 3. Play it: once with the keys painted, twice from memory
    const practise = () => {
      const plan = [true, false, false];
      let done = 0;
      let wrongHere = 0; // mistakes on this try: after two, the keys are shown
      let armed = getHeld().size === 0;
      const render = (message = '', tone = '') => {
        const painted = plan[done];
        const helped = !painted && wrongHere >= 2;
        view = { marks: painted || helped ? fingerMarks(notes, SHAPE, true, symbol) : new Map(), message: painted || helped ? '' : 'De memòria!' };
        setPanel({
          kicker: `Acord nou · ${countable ? 3 : 2} de ${countable ? 3 : 2}`,
          title: painted ? `Toca ${name}` : `${name} de memòria`,
          text: painted
            ? `Prem les tres tecles pintades <b>alhora</b>${keysText(notes)}.`
            : `Sense ajuda: toca l'acord de <b>${chordLong(symbol)}</b>, amb la fonamental a baix. Pots tocar-lo en qualsevol octava.`,
          dots: plan.map((_, k) => el('span', { className: k < done ? 'on' : k === done ? 'now' : '' })),
          note: message,
          tone,
          buttons: [
            !painted ? button('Pista', () => {
              hinted = true;
              view = { marks: fingerMarks(notes, SHAPE, true, symbol), message: '' };
            }, 'ghost') : null,
            button('♪ Escolta\'l', () => playNotes(notes), 'ghost'),
          ],
        });
      };
      // A mistake from memory: after the second one the keys are painted (and it counts as a hint).
      const miss = (text) => {
        wrongHere++;
        if (!plan[done] && wrongHere === 2) {
          hinted = true;
          return render(`${text} <b>Pista:</b> et marquem les tecles.`, 'bad');
        }
        return render(text, 'bad');
      };
      const check = () => {
        const held = [...getHeld()];
        if (!held.length) {
          armed = true;
          return;
        }
        if (!armed) return;
        const wrongNote = held.find((n) => !chord.triad.includes(pitchClass(n)));
        if (wrongNote !== undefined) {
          armed = false;
          feedback.set(wrongNote, 'bad');
          return miss(`<b>${SOLFEGE[pitchClass(wrongNote)]}</b> no és de ${name}. Recorda: ${noteNames.join(' – ')}.`);
        }
        if (new Set(held.map(pitchClass)).size < 3) return;
        armed = false;
        if (countable && pitchClass(Math.min(...held)) !== chord.root) {
          held.forEach((n) => feedback.set(n, 'bad'));
          return miss(`Són les notes bones, però la de baix ha de ser la fonamental, <b>${noteNames[0]}</b>. Aixeca els dits i torna-hi.`);
        }
        held.forEach((n) => feedback.set(n, 'good'));
        done++;
        wrongHere = 0;
        if (done >= plan.length) {
          finishMission(hinted ? 2 : 3, {
            title: `Ja saps el ${chordLong(symbol)}!`,
            text: `${name} = <b>${noteNames.join(' – ')}</b>` +
              (countable ? `: comença al ${noteNames[0]}, salta ${third} tecles i després ${fifth}.` : '.') +
              (hinted ? ' Has fet servir una pista: torna-ho a provar per a la tercera estrella.' : ''),
            retry: () => again(),
          });
          return;
        }
        render('Molt bé! Aixeca els dits.', 'good');
      };
      step = { noteOn: check, noteOff: ({ note }) => { feedback.delete(note); check(); } };
      render();
    };

    look();
  }

  // ---- Step by step: the game waits until the chord is right ---------------------------------------------------

  /**
   * items: [{ chord, notes (voicing), painted }]. Shows them on the score with a
   * long-note card; the ball waits on the current card until the chord is
   * played, then hops to the next. Wrong notes are marked on the card.
   */
  function runSteps({ items, columns, kicker, intro, onDone, strictVoicing = false }) {
    const world = mission.world;
    const two = Boolean(world.twoHands) && items.every((item) => item.left); // items then have `left` notes too
    const mode = leftMode();
    const card = two ? cardByName(twoHandName(2)) : longCard(world);
    const bars = items.map((item, k) => ({
      card,
      ...colourOf(item.chord),
      name: chordName(item.chord),
      kind: 'play',
      tag: item.painted ? '' : k === items.findIndex((x) => !x.painted) ? 'de memòria' : '',
    }));
    const rows = [];
    for (let k = 0; k < items.length; k += columns) rows.push({ bars: bars.slice(k, k + columns).map((_, j) => k + j) });
    showScore(true);
    score.setBars(bars, { rows, columns });
    const marks = new Map();
    const status = new Map();
    let i = 0;
    let mistakes = 0;
    let hints = 0;
    const perItem = items.map(() => 0);
    let armed = getHeld().size === 0;
    let moving = null; // performance.now() when the ball started to move on
    let moveMs = 650;
    let finished = false;
    const started = performance.now();
    scoreState = {
      ball: () => {
        if (finished) return null;
        const now = performance.now();
        if (moving !== null) {
          const f = Math.min(1, (now - moving) / moveMs);
          if (f >= 1) {
            moving = null;
            i++;
            if (i >= items.length) return finish();
            score.setCurrent(i);
            render();
          }
          // One smooth jump from this card to the next one.
          return { bar: Math.min(i, items.length - 1), jump: easeInOut(f) };
        }
        return { bar: i, f: 0, inPlace: ((now - started) / 1100) % 1 };
      },
      data: (b) => ({ onsets: [status.get(b) === 'ok' ? 'hit' : 'pending'], marks: marks.get(b) ?? [] }),
    };
    const finish = () => {
      finished = true;
      const bad = mistakes + hints;
      onDone({ mistakes, hints, perItem, stars: bad === 0 ? 3 : bad <= 2 ? 2 : 1 });
      return null;
    };
    const render = (message = '', tone = '') => {
      const item = items[i];
      const next = items[i + 1];
      const paintNow = item.painted || item.hint;
      // Only the chord to play now is painted: showing the next one too mixed up the finger numbers.
      const km = !paintNow ? new Map() : two ? handMarks(item.notes, item.left) : fingerMarks(item.notes);
      view = { marks: km, message: item.painted ? '' : `${chordLong(item.chord)} de memòria` };
      const nextText = next ? ` Després: <b>${chordName(next.chord)}</b>.` : ' És l\'últim!';
      setPanel({
        kicker,
        title: `Toca ${chordLong(item.chord)}`,
        text: `${intro} ${item.painted ? (two ? `Tecles <b style="color:${RIGHT_COLOUR}">blaves</b>: mà dreta; <b style="color:${LEFT_COLOUR}">taronja</b>: mà esquerra (${mode === 'bass' ? 'només el baix' : 'el mateix acord'}). Els números són els dits.` : 'Toca les tecles grogues; els números són els dits.') : 'Sense ajuda: el joc t\'espera.'}${nextText}`,
        note: message,
        tone,
        buttons: [
          !item.painted ? button('Pista', () => {
            hints++;
            perItem[i]++;
            item.hint = true;
            render();
          }, 'ghost') : null,
          button('♪ Escolta\'l', () => playNotes(two ? [...item.left, ...item.notes] : item.notes), 'ghost'),
        ],
      });
    };
    const miss = (text, notes) => {
      armed = false;
      mistakes++;
      perItem[i]++;
      notes.forEach((n) => feedback.set(n, 'bad'));
      render(text, 'bad');
    };
    /** Two hands: true when both hands are right; false when not complete yet. */
    const twoHandsReady = (held, item, chord) => {
      const right = held.filter((n) => n >= SPLIT);
      const left = held.filter((n) => n < SPLIT);
      if (new Set(right.map(pitchClass)).size < 3) return false;
      if (mode === 'bass' ? !left.some((n) => pitchClass(n) === chord.root) : new Set(left.map(pitchClass)).size < 3) return false;
      armed = false;
      if (mode === 'bass' && left.some((n) => pitchClass(n) !== chord.root)) {
        miss(`Amb la mà <b style="color:${LEFT_COLOUR}">esquerra</b>, només el baix: <b>${triadNoteNames(item.chord)[0]}</b>.`, left);
        return null;
      }
      if (pitchClass(Math.min(...right)) !== chord.root || pitchClass(Math.min(...left)) !== chord.root) {
        miss(`Notes bones, però a baix de cada mà hi va la fonamental (<b>${triadNoteNames(item.chord)[0]}</b>).`, held);
        return null;
      }
      return true;
    };
    const check = () => {
      const held = [...getHeld()];
      if (!held.length) {
        armed = true;
        return;
      }
      if (!armed || moving !== null || finished) return;
      const item = items[i];
      const chord = parseChord(item.chord);
      const wrongNote = held.find((n) => !chord.triad.includes(pitchClass(n)));
      if (wrongNote !== undefined) {
        armed = false;
        mistakes++;
        perItem[i]++;
        feedback.set(wrongNote, 'bad');
        const list = marks.get(i) ?? [];
        list.push({ f: 0.15 + Math.min(0.7, list.length * 0.18), kind: 'wrong', label: SOLFEGE[pitchClass(wrongNote)] });
        marks.set(i, list);
        score.touch(i);
        return render(`<b>${SOLFEGE[pitchClass(wrongNote)]}</b> no és de ${chordName(item.chord)}. Aixeca els dits i torna-hi.`, 'bad');
      }
      if (two) {
        const ready = twoHandsReady(held, item, chord);
        if (!ready) return;
      } else if (new Set(held.map(pitchClass)).size < 3) return;
      armed = false;
      if (two) {
        // checked above
      } else if (strictVoicing) {
        const want = inversionOf(item.chord, item.notes);
        if (inversionOf(item.chord, held) !== want) {
          mistakes++;
          perItem[i]++;
          held.forEach((n) => feedback.set(n, 'bad'));
          return render('Són les notes bones, però en una altra posició. Busca la de les tecles marcades, la que mou menys la mà.', 'bad');
        }
      } else if (!world.inversions && isTriad(item.chord) && pitchClass(Math.min(...held)) !== chord.root) {
        mistakes++;
        perItem[i]++;
        held.forEach((n) => feedback.set(n, 'bad'));
        return render(`Notes bones, però la de baix ha de ser la fonamental (<b>${triadNoteNames(item.chord)[0]}</b>).`, 'bad');
      }
      held.forEach((n) => feedback.set(n, 'good'));
      status.set(i, 'ok');
      score.setStatus(i, 'ok');
      score.touch(i);
      sfx.step();
      moving = performance.now();
      const next = items[i + 1];
      // The keys go blank while the ball hops: the next chord's numbers appear only when it is its turn.
      moveMs = 650;
      view = { marks: new Map(), message: '' };
      if (next) setPanel({ kicker, title: 'Molt bé!', text: `Ara, <b>${chordName(next.chord)}</b>…`, tone: 'good' });
      else render('Molt bé!', 'good');
    };
    step = { noteOn: check, noteOff: ({ note }) => { feedback.delete(note); check(); } };
    score.setCurrent(0);
    render();
  }

  function stepsMission() {
    const world = mission.world;
    const symbols = [...mission.chords, ...mission.chords];
    const two = Boolean(world.twoHands);
    const voicings = two ? symbols.map(rightHandVoicing) : chainFor(symbols, world, 2);
    const pass = mission.chords.length;
    const items = symbols.map((chord, k) => ({ chord, notes: voicings[k], left: two ? leftHandVoicing(chord, leftMode()) : null, painted: k < pass }));
    setFocus('both');
    const start = () => runSteps({
      items,
      columns: Math.min(8, pass),
      kicker: 'Pas a pas · el joc t\'espera',
      intro: two
        ? (leftMode() === 'bass' ? 'Dreta: l\'acord. Esquerra: la nota de baix del mateix acord. Les dues alhora.' : 'Les dues mans fan el mateix acord, alhora.')
        : world.inversions ? 'Toca cada acord a la posició marcada, la més propera a l\'anterior.' : 'Toca cada acord amb la fonamental a baix.',
      strictVoicing: Boolean(world.inversions),
      onDone: ({ mistakes, hints, stars }) => finishMission(stars, {
        title: 'Roda feta!',
        text: `Dues voltes a la roda: la primera amb ajuda i la segona de memòria. ${mistakes || hints ? `${mistakes} errada${mistakes === 1 ? '' : 'es'} i ${hints} ${hints === 1 ? 'pista' : 'pistes'}.` : 'Cap errada!'}`,
        retry: () => again(),
      }),
    });
    startPanel({
      kicker: `${TYPE_LABEL.steps} · ${world.title}`,
      title: mission.title,
      text: `Tota la roda, acord per acord, sense música: <b>el joc t'espera</b> fins que toques l'acord bé. La primera volta tens les tecles pintades; la segona, de memòria. Fixa't en el <b>gest</b> de la mà entre acords.`,
      start,
    });
    // Preview of the score before starting.
    showScore(true);
    const card = two ? cardByName(twoHandName(2)) : longCard(world);
    score.setBars(symbols.map((c) => ({ card, name: chordName(c), kind: 'play', ...colourOf(c) })), {
      rows: [0, 1].map((r) => ({ bars: mission.chords.map((_, k) => r * pass + k) })),
      columns: Math.min(8, pass),
    });
    scoreState = { ball: () => null, data: () => ({ onsets: ['pending'] }) };
  }

  // ---- A change between two chords ---------------------------------------------------------------------------

  function changeMission() {
    const world = mission.world;
    const { from, to } = mission;
    let a;
    let b;
    if (world.inversions) {
      const wheel = splitProgression(world.progression);
      const chain = voiceChain(wheel, true);
      const k = wheel.indexOf(from);
      a = k >= 0 ? chain[k] : rootVoicing(from);
      b = closestVoicing(a, to);
    } else {
      a = rootVoicing(from);
      b = rootVoicing(to);
    }
    const info = describeChange(a, b, (n, which) => keyName(n, which === 'from' ? from : to));
    setFocus('keys');

    // 1. Watch: the dots jump from one chord to the next, again and again.
    const look = () => {
      showScore(false);
      animateChange(a, b);
      const words = el('details', { className: 'cd-words' }, [
        el('summary', { textContent: 'Explica-m\'ho amb paraules' }),
        el('ul', {}, info.lines.map((line) => el('li', { innerHTML: line }))),
      ]);
      setPanel({
        kicker: TYPE_LABEL.change,
        title: `${chordName(from)} → ${chordName(to)}`,
        big: [el('div', { className: 'cd-box' }, [
          changeLegend({ from, to, key: path.key, a, b }),
          changeDiagram({ from, to, a, b, key: path.key }),
        ])],
        text: 'Els números són els dits. Cada fletxa: on va aquell dit. Mira-ho també al teclat de baix.',
        extra: words,
        buttons: [
          button('Practica-ho →', practise),
        ],
      });
      step = { space: practise };
    };

    const practise = () => {
      stopAnimation();
      const plan = [from, to, from, to, from, to];
      const items = plan.map((chord, k) => ({ chord, notes: k % 2 ? b : a, painted: k < 2 }));
      runSteps({
        items,
        columns: 6,
        kicker: 'Canvi · el joc t\'espera',
        intro: `Va i torna: ${chordName(from)} – ${chordName(to)}.`,
        strictVoicing: Boolean(world.inversions),
        onDone: ({ mistakes, hints, stars }) => finishMission(stars, {
          title: 'Canvi après!',
          text: `Tres vegades ${chordName(from)} → ${chordName(to)}. ${mistakes || hints ? `${mistakes} errada${mistakes === 1 ? '' : 'es'} i ${hints} ${hints === 1 ? 'pista' : 'pistes'}.` : 'Cap errada!'}`,
          retry: () => again(),
          extra: [button('Torna a mirar el canvi', look, 'ghost')],
        }),
      });
    };
    look();
  }

  // ---- Inversions of a chord ---------------------------------------------------------------------------------------

  function invertMission() {
    const symbol = mission.chord;
    const chord = parseChord(symbol);
    const names3 = triadNoteNames(symbol);
    const base = rootVoicing(symbol);
    const positions = [base, [base[1], base[2], base[0] + 12], [base[2], base[0] + 12, base[1] + 12]];
    const LABEL = ['posició fonamental', '1a inversió', '2a inversió'];
    const HOW = [
      `La fonamental (<b>${names3[0]}</b>) és a baix: és com l'has après.`,
      `Agafa la nota de baix (<b>${names3[0]}</b>) i posa-la <b>una octava amunt</b>. Ara la de baix és <b>${names3[1]}</b>.`,
      `Torna-ho a fer: la de baix (<b>${names3[1]}</b>) puja una octava. Ara la de baix és <b>${names3[2]}</b>.`,
    ];
    const plan = [0, 1, 2, 2, 0, 1];
    let k = 0;
    let mistakes = 0;
    let hints = 0;
    let armed = getHeld().size === 0;
    let hint = false;
    setFocus('keys');
    showScore(false);

    const render = (message = '', tone = '') => {
      const inv = plan[k];
      const painted = k < 3 || hint;
      const marks = painted ? fingerMarks(positions[inv]) : new Map();
      if (k > 0 && k < 3) {
        const moved = positions[inv - 1][0];
        if (!marks.has(moved)) marks.set(moved, { fill: false, colour: SHAPE_NEXT, text: '↑' });
      }
      view = { marks, message: painted ? '' : `${chordName(symbol)}, ${LABEL[inv]}, de memòria` };
      setPanel({
        kicker: `Inversions · ${k < 3 ? 'aprèn-les' : 'de memòria'}`,
        title: `${chordLong(symbol)}: ${LABEL[inv]}`,
        text: k < 3 ? `${HOW[inv]} Toca: <b>${positions[inv].map((n) => keyName(n, symbol)).join(' – ')}</b>.` : `Sense ajuda: toca <b>${chordName(symbol)}</b> en <b>${LABEL[inv]}</b> (a baix, <b>${names3[inv]}</b>).`,
        list: k === 0 ? ['Les tres posicions tenen les mateixes notes: només canvia quina és a baix.', 'Les inversions serveixen per moure menys la mà entre acords.'] : [],
        dots: plan.map((_, j) => el('span', { className: j < k ? 'on' : j === k ? 'now' : '' })),
        note: message,
        tone,
        buttons: [
          k >= 3 && !hint ? button('Pista', () => {
            hints++;
            hint = true;
            render();
          }, 'ghost') : null,
          button('♪ Escolta-la', () => playNotes(positions[inv]), 'ghost'),
        ],
      });
    };
    const check = () => {
      const held = [...getHeld()];
      if (!held.length) {
        armed = true;
        return;
      }
      if (!armed) return;
      const wrongNote = held.find((n) => !chord.triad.includes(pitchClass(n)));
      if (wrongNote !== undefined) {
        armed = false;
        mistakes++;
        feedback.set(wrongNote, 'bad');
        return render(`<b>${SOLFEGE[pitchClass(wrongNote)]}</b> no és de ${chordName(symbol)}.`, 'bad');
      }
      if (held.length < 3 || new Set(held.map(pitchClass)).size < 3) return;
      armed = false;
      const inv = plan[k];
      const low = Math.min(...held);
      if (pitchClass(low) !== chord.triad[inv] || Math.max(...held) - low > 12) {
        mistakes++;
        held.forEach((n) => feedback.set(n, 'bad'));
        return render(`Notes bones, però a baix hi ha d'haver <b>${names3[inv]}</b> i les tres notes juntes (dins d'una octava).`, 'bad');
      }
      held.forEach((n) => feedback.set(n, 'good'));
      k++;
      hint = false;
      if (k >= plan.length) {
        const bad = mistakes + hints;
        finishMission(bad === 0 ? 3 : bad <= 2 ? 2 : 1, {
          title: 'Inversions apreses!',
          text: `${chordName(symbol)}: ${positions.map((p) => p.map((n) => keyName(n, symbol)).join('-')).join(' · ')}.`,
          retry: () => again(),
        });
        return;
      }
      render('Molt bé! Aixeca els dits.', 'good');
    };
    step = { noteOn: check, noteOff: ({ note }) => { feedback.delete(note); check(); } };
    render();
  }


  // ---- Play with the band ("Toca amb la banda") -----------------------------------------------------
  // The student picks a song and plays without stopping, in sets of four cards
  // over the wheel. After each set the game moves up a level (harder cards,
  // then faster) when it went well, and down when it did not.

  const JAM_LEVELS = [
    { tier: 'easy', tempo: -8, name: 'Cartes fàcils, a poc a poc' },
    { tier: 'easy', tempo: 0, name: 'Cartes fàcils' },
    { tier: 'medium', tempo: -8, name: 'Cartes intermèdies, a poc a poc' },
    { tier: 'medium', tempo: 0, name: 'Cartes intermèdies' },
    { tier: 'medium', tempo: 8, name: 'Cartes intermèdies, més ràpid' },
    { tier: 'hard', tempo: -4, name: 'Cartes difícils' },
    { tier: 'hard', tempo: 6, name: 'Cartes difícils, més ràpid' },
    { tier: 'hard', tempo: 14, name: 'Mestre de la banda' },
  ];
  const JAM_UP = 0.85;
  const JAM_DOWN = 0.6;

  /** The songs to play with the band: the ROCKIN wheel, the book and the student's own paths. */
  function jamSongs() {
    return [
      { key: 'rockin', name: 'La roda ROCKIN', sub: 'Do – Sol – La m – Fa', wheel: ['C', 'G', 'Am', 'F'], chordKey: 'C', style: 'rock', tempo: null, meter: '4/4' },
      ...allSpecs().map((spec) => ({
        key: spec.id,
        name: spec.name || spec.progression,
        sub: spec.artist ?? '',
        wheel: splitProgression(spec.progression),
        chordKey: spec.key ?? keyOf(spec),
        style: spec.style,
        tempo: spec.tempo,
        meter: spec.meter ?? '4/4',
        book: spec.book,
      })),
    ];
  }

  const jamMemory = (song) => {
    const st = me();
    st.jam ??= {};
    const mode = handsMode();
    const key = mode === 1 ? song.key : `${song.key}@${mode === 'bass' ? '2b' : '2'}`;
    st.jam[key] ??= { level: 0, best: 0, sets: 0 };
    return st.jam[key];
  };

  function showJam() {
    const card = (song) => {
      const memory = jamMemory(song);
      const b = el('button', { type: 'button', className: `play-song${song.book ? ' book' : ''} jam` }, [
        el('span', { className: 'play-song-icon', textContent: song.key === 'rockin' ? '🎸' : song.book ? '📖' : '♬' }),
        el('strong', { textContent: song.name }),
        song.sub ? el('small', { className: 'play-song-artist', textContent: song.sub }) : null,
        el('div', { className: 'play-goal-chords' }, song.wheel.map((c) => chordChip(c, song.chordKey))),
        el('small', { textContent: memory.sets ? `Rècord: nivell ${memory.best + 1} de ${JAM_LEVELS.length}` : 'Encara no hi has tocat' }),
      ]);
      b.addEventListener('click', () => startJam(song));
      return b;
    };
    const songs = jamSongs();
    setChildren(mapScreen,
      teacherBannerEl(),
      el('div', { className: 'play-hello' }, [
        el('div', { className: 'play-hello-text' }, [
          el('div', { className: 'play-kicker', textContent: 'Toca amb la banda' }),
          el('h2', { textContent: 'Posa-ho tot a prova' }),
          el('p', { className: 'play-note', textContent: 'Tria una cançó i toca amb la banda sense parar. Cada tanda són quatre cartes: si et surt bé, la següent és més difícil (cartes amb el temps partit i més velocitat); si et costa, més fàcil.' }),
          handsChip(),
        ]),
      ]),
      el('div', { className: 'play-world' }, [
        el('h3', { textContent: 'Tria la cançó' }),
        el('div', { className: 'play-songs' }, songs.map(card)),
      ]),
      el('div', { className: 'play-map-foot' }, [
        me()?.teacher ? null : button(`No ets ${me()?.name ?? ''}? Canvia`, () => {
          screen = 'who';
          showMap();
        }, 'ghost small'),
      ]),
    );
    step = null;
    toTop();
  }

  function startJam(song) {
    stopAnimation();
    stopSession();
    cancelAutoNext();
    const memory = jamMemory(song);
    const mode = handsMode();
    const two = mode !== 1;
    let levelIndex = Math.max(0, Math.min(JAM_LEVELS.length - 1, memory.level));
    let sets = 0;
    let clean = 0;
    let total = 0;
    let best = levelIndex;
    let stopped = false;
    const meter = parseTimeSignature(song.meter);
    const songTempo = song.tempo ? Math.round(song.tempo * (speed.tempo / 76) * (meter.compound ? 0.8 : 1)) : speed.tempo;
    const baseTempo = Math.max(60, Math.min(126, songTempo));
    const world = {
      id: `jam:${song.key}`,
      title: 'Toca amb la banda',
      goal: song.name,
      progression: song.wheel.join(' | '),
      chords: [...new Set(song.wheel)],
      level: 2,
      meter: song.meter,
      style: song.style,
      missions: [],
      ...(two ? { twoHands: true, left: mode } : {}),
    };
    path = { ...ROCKIN_PATH, key: song.chordKey };
    mission = { id: `jam:${song.key}`, type: 'band', title: 'Toca amb la banda', world, index: -1, step: 0, jam: true };
    mapScreen.hidden = true;
    missionScreen.hidden = false;
    keyboard.setKeyRange(two ? TWO_HANDS_RANGE : [48, 84]);
    feedback = new Map();
    view = { marks: new Map(), message: '' };
    missionStars.textContent = '';
    setFocus('card');

    const hudNow = () => {
      hud.replaceChildren(
        el('div', { className: 'play-hud-text' }, [
          el('small', { textContent: `Toca amb la banda · ${song.name}` }),
          el('strong', { textContent: `Nivell ${levelIndex + 1} · ${JAM_LEVELS[levelIndex].name}` }),
        ]),
        el('div', { className: 'play-hud-goal' }, [
          el('small', { textContent: 'La roda' }),
          el('div', { className: 'play-goal-chords' }, song.wheel.map((c) => chordChip(c, song.chordKey))),
        ]),
        el('div', { className: 'play-hud-progress', title: 'Nivells' }, [
          el('small', { textContent: `Rècord: nivell ${Math.max(best, memory.best) + 1}` }),
          el('div', { className: 'play-hud-bar' }, JAM_LEVELS.map((_, k) => el('i', { className: k === levelIndex ? 'now' : k < levelIndex ? 'done' : '' }))),
        ]),
      );
    };

    const pickCards = (tier) => {
      // Left hand on the bass: from the medium levels on, cards where each hand has its own rhythm.
      if (mode === 'bass' && tier !== 'easy' && !meter.compound && meter.pulses === 4) {
        const own = twoHandCards().filter((c) => tierOf(c) === tier);
        if (own.length) {
          const shuffled = [...own].sort(() => Math.random() - 0.5);
          return Array.from({ length: 4 }, (_, i) => shuffled[i % shuffled.length]);
        }
      }
      const pool = playableCards(getCards(), { cardType: 'rhythmic', meter }).filter((c) => tierOf(c) === tier);
      const list = pool.length ? pool : playableCards(getCards(), { cardType: 'rhythmic', meter });
      const shuffled = [...list].sort(() => Math.random() - 0.5);
      return Array.from({ length: 4 }, (_, i) => shuffled[i % shuffled.length]).map((c) => (two ? cardByName(twoName(c.filename)) : c));
    };

    const save = () => {
      memory.level = levelIndex;
      memory.best = Math.max(memory.best, best);
      saveStore();
    };

    const finish = () => {
      stopped = true;
      stopSession();
      save();
      const st = me();
      if (st && !st.teacher && sets) {
        st.log.push({ m: 'jam', p: song.key, t: Date.now(), s: best + 1, r: total ? clean / total : 0 });
        saveStore();
      }
      setPanel({
        kicker: 'Toca amb la banda',
        title: sets ? 'Bona sessió!' : 'Aturat',
        big: [el('div', { className: 'play-target good' }, [
          el('small', { textContent: 'Nivell més alt' }),
          el('strong', { textContent: String(best + 1) }),
          el('span', { textContent: JAM_LEVELS[best].name }),
        ])],
        text: sets ? `${sets} ${sets === 1 ? 'tanda' : 'tandes'} · ${clean} de ${total} compassos nets. La propera vegada comences al nivell ${levelIndex + 1}.` : '',
        tone: 'good',
        buttons: [
          button('▶ Torna a tocar', () => startJam(song)),
          button('Tria una altra cançó', () => {
            screen = 'jam';
            showMap();
          }, 'ghost'),
        ],
      });
      step = { space: () => startJam(song) };
    };

    const playSet = () => {
      if (stopped) return;
      const level = JAM_LEVELS[levelIndex];
      const cards = pickCards(level.tier);
      const perRow = song.wheel.length >= 3 ? song.wheel.length : BARS;
      const bars = [];
      const rows = [];
      cards.forEach((c, r) => {
        const row = { bars: [], label: r === 0 ? `Tanda ${sets + 1} · nivell ${levelIndex + 1}` : '' };
        for (let k = 0; k < perRow; k++) {
          const chord = song.wheel[k % song.wheel.length];
          row.bars.push(bars.length);
          bars.push({ card: c, chord, kind: 'play', name: chordName(chord), tag: k === 0 && r > 0 ? 'carta nova' : '', ...colourOf(chord) });
        }
        rows.push(row);
      });
      const voicings = two ? bars.map((b) => rightHandVoicing(b.chord)) : chainFor(bars.map((b) => b.chord), world, 2);
      const leftVoicings = two ? bars.map((b) => leftHandVoicing(b.chord, mode)) : null;
      const tempo = baseTempo + level.tempo;
      hudNow();
      const buttons = [button('■ Atura', finish, 'ghost')];
      step = { space: () => session?.togglePause(), escape: finish };
      runMusic({
        bars,
        rows,
        columns: Math.min(8, perRow),
        level: 2,
        meter: song.meter,
        style: song.style,
        tempo,
        help: 'none',
        voicings,
        hands: two ? { left: mode, leftVoicings } : null,
        onPhase: (phase) => setStatus({
          kicker: phase === 'play' ? `Nivell ${levelIndex + 1}` : phase === 'end' ? 'Fi de la tanda' : 'Preparat',
          text: phase === 'play' ? `${level.name} · ${tempo} bpm. <span class="play-muted">Espai: pausa · Esc: atura</span>` : phase === 'end' ? 'Escolta com acaba…' : 'Compta amb la banda…',
          tone: phase === 'play' ? '' : 'ready',
          buttons,
        }),
        onEnd: ({ results }) => {
          if (stopped) return;
          const good = results.filter((r) => r.clean).length;
          const ratio = good / results.length;
          sets++;
          memory.sets++;
          clean += good;
          total += results.length;
          // Playing a whole set with the band is exactly what the top band level says.
          if (ratio >= 0.6) raiseBandLevel(levelIndex >= 2 ? 6 : 5);
          let message;
          let tone = '';
          if (ratio >= JAM_UP && levelIndex < JAM_LEVELS.length - 1) {
            levelIndex++;
            best = Math.max(best, levelIndex);
            message = `Molt bé! Pugem al <b>nivell ${levelIndex + 1}</b>: ${JAM_LEVELS[levelIndex].name.toLowerCase()}.`;
            tone = 'good';
            sfx.good();
          } else if (ratio >= JAM_UP) {
            message = 'Perfecte al nivell més alt! Seguim.';
            tone = 'good';
            sfx.good();
          } else if (ratio < JAM_DOWN && levelIndex > 0) {
            levelIndex--;
            message = `Baixem al <b>nivell ${levelIndex + 1}</b> per agafar confiança.`;
            sfx.ok();
          } else {
            message = 'Seguim al mateix nivell.';
          }
          save();
          hudNow();
          let left = 4;
          const tick = () => {
            if (stopped) return;
            setPanel({
              kicker: `Tanda ${sets}`,
              title: `${good} de ${results.length} compassos nets`,
              text: `${message} Mira les marques de les cartes.`,
              note: `La banda torna a començar en ${left} s…`,
              tone,
              buttons: [button('▶ Ara', go), button('■ Atura', finish, 'ghost')],
            });
          };
          const go = () => {
            clearInterval(timer);
            if (!stopped && mission?.jam) playSet();
          };
          const timer = setInterval(() => {
            left--;
            if (left <= 0 || stopped || !mission?.jam) go();
            else tick();
          }, 1000);
          tick();
          step = { space: go, escape: () => { clearInterval(timer); finish(); } };
        },
      });
    };

    hudNow();
    showScore(false);
    setPanel({
      kicker: 'Toca amb la banda',
      title: song.name,
      text: `Comences al <b>nivell ${levelIndex + 1}</b> (${JAM_LEVELS[levelIndex].name.toLowerCase()}). La banda no s'atura: si t'equivoques, torna a entrar a la carta següent. ${two ? `Toques amb <b>${HANDS[mode].short}</b>.` : ''}`,
      list: ['Quatre cartes per tanda, una per volta de la roda.', 'Amb el 85% de compassos nets pugeu de nivell; per sota del 60%, baixeu.'],
      buttons: [button('▶ Comença', playSet), button('Tria una altra cançó', () => {
        screen = 'jam';
        showMap();
      }, 'ghost')],
    });
    step = { space: playSet };
  }

  // ---- Arpeggio: the chord's notes one by one, from the root up ----------------------------------------

  function arpeggioMission() {
    const world = mission.world;
    const wheel = [...new Set(splitProgression(world.progression))];
    const plan = [...wheel.map((chord) => ({ chord, painted: true })), ...wheel.map((chord) => ({ chord, painted: false }))];
    let k = 0;
    let n = 0;
    let mistakes = 0;
    let hints = 0;
    let hint = false;
    let last = null;
    setFocus('keys');
    showScore(false);
    const notesOf = (chord) => contourNotes(parseChord(chord), [0, 1, 2]);
    const render = (message = '', tone = '') => {
      const item = plan[k];
      const notes = notesOf(item.chord);
      const names3 = triadNoteNames(item.chord);
      const marks = new Map();
      if (item.painted || hint) {
        // No numbers: the note to play now is filled; the ones already played are green; the next ones, only outlined.
        notes.forEach((note, i) => marks.set(note, { fill: i <= n, colour: i < n ? SHARED : i === n ? SHAPE : SHAPE_NEXT, text: '' }));
      }
      view = { marks, message: item.painted ? '' : `${chordLong(item.chord)}, nota a nota, de memòria` };
      setPanel({
        kicker: `Arpegi · ${item.painted ? 'amb ajuda' : 'de memòria'}`,
        title: `${chordLong(item.chord)}, nota a nota`,
        big: [el('div', { className: 'arp-steps' }, names3.flatMap((name, i) => [
          i ? el('i', { textContent: '↗' }) : null,
          el('span', { className: i < n ? 'on' : i === n ? 'now' : '', textContent: name }),
        ]).filter(Boolean))],
        text: item.painted
          ? 'Toca les notes <b>d\'una en una</b>, cap amunt: la fonamental, la tercera i la quinta. Al teclat, la tecla <b>groga</b> és la que toca ara; les <b>verdes</b>, les que ja has tocat.'
          : 'Ara sense ajuda: les tres notes de l\'acord, d\'una en una i cap amunt.',
        dots: plan.map((_, j) => el('span', { className: j < k ? 'on' : j === k ? 'now' : '' })),
        note: message,
        tone,
        buttons: [
          !item.painted && !hint ? button('Pista', () => {
            hints++;
            hint = true;
            render();
          }, 'ghost') : null,
          button('♪ Escolta\'l', () => playNotes(notes, { arpeggio: true }), 'ghost'),
        ],
      });
    };
    step = {
      noteOn: ({ note }) => {
        const item = plan[k];
        if (!item) return;
        const target = notesOf(item.chord)[n];
        const higher = last === null || note > last;
        if (pitchClass(note) !== pitchClass(target) || !higher) {
          mistakes++;
          feedback.set(note, 'bad');
          const want = triadNoteNames(item.chord)[n];
          return render(pitchClass(note) === pitchClass(target) ? `Bona nota, però ha d'anar <b>més amunt</b> que l'anterior.` : `Ara toca el <b>${want}</b>${n ? ', més amunt' : ''}.`, 'bad');
        }
        feedback.set(note, 'good');
        last = note;
        n++;
        if (n < 3) return render();
        sfx.step();
        k++;
        n = 0;
        last = null;
        hint = false;
        if (k >= plan.length) {
          const bad = mistakes + hints;
          return finishMission(bad === 0 ? 3 : bad <= 2 ? 2 : 1, {
            title: 'Arpegis fets!',
            text: `Tots els acords de la roda, nota a nota. ${bad ? `${mistakes} errada${mistakes === 1 ? '' : 'es'} i ${hints} ${hints === 1 ? 'pista' : 'pistes'}.` : 'Cap errada!'}`,
            retry: again,
          });
        }
        render('Molt bé!', 'good');
      },
      noteOff: ({ note }) => feedback.delete(note),
    };
    render();
  }

  // ---- Adaptive path ("Camí intel·ligent") ------------------------------------------------------------
  // The same skills as the path (notes, cards, each chord, each change, tempo,
  // patterns…), but the game tests and decides what comes next (js/adaptive.js).

  const rockinCard = (n) => `rhythm_binary_${String(n).padStart(2, '0')}.png`;

  /** What the adaptive path needs from a path: the wheel and the cards for each skill. */
  /** Rhythm cards of a tier that fit a meter (for the adaptive path and the band). */
  const tierCards = (meterText, tier) => playableCards(getCards(), { cardType: 'rhythmic', meter: parseTimeSignature(meterText ?? '4/4') })
    .filter((c) => tierOf(c) === tier)
    .map((c) => c.filename);
  const MELODIC = {
    // From two different notes (arpeggios) to three and four (contour).
    arp: [9, 7, 26, 10, 27, 20].map((n) => `melodic_${String(n).padStart(2, '0')}.png`),
    contour: [5, 6, 21, 23, 22, 13, 14, 17, 15, 18].map((n) => `melodic_${String(n).padStart(2, '0')}.png`),
  };
  // The hardest cards (the pulse split in four) only make sense between the two
  // hands: with one hand they are more subdivision than music. So with one hand
  // the adaptive path stops at the medium ones.
  const hardCards = (meterText) => (handsMode() === 1 ? [] : twoHandCards().filter((c) => c.tier === 'hard').map((c) => c.filename));
  const withTiers = (kit) => ({ ...kit, cards: { ...kit.cards, medium: tierCards(kit.meter, 'medium'), hard: hardCards(kit.meter), melodic: MELODIC } });

  function kitFor(p) {
    return withTiers(baseKit(p));
  }

  function baseKit(p) {
    if (!p.custom) {
      return {
        key: 'rockin',
        title: 'Camí ROCKIN',
        wheel: ['C', 'G', 'Am', 'F'],
        meter: '4/4',
        style: 'rock',
        cards: {
          read: rockinCard(2),
          plain: rockinCard(1),
          rests: rockinCard(2),
          long: rockinCard(6),
          whole: rockinCard(5),
          mix: [7, 3, 4].map(rockinCard),
          band: [1, 2, 6, 5].map(rockinCard),
        },
      };
    }
    const world = (suffix) => p.worlds.find((w) => w.id.endsWith(suffix));
    const roda = world(':roda');
    const rr = world(':ritme-roda');
    const fin = world(':final');
    return {
      key: p.id,
      title: p.title,
      wheel: splitProgression(roda.progression),
      meter: roda.meter,
      style: roda.style,
      tempo: fin.missions[0].tempo,
      cards: {
        read: rr.missions[2].card,
        plain: rr.missions[0].card,
        long: rr.missions[1].card,
        rests: rr.missions[2].card,
        whole: roda.missions.find((m) => m.id.endsWith(':long'))?.card ?? rr.missions[1].card,
        mix: rr.missions[3].cards,
        band: rr.missions[4].cards,
      },
    };
  }

  function adaptiveState(kit) {
    const st = me();
    st.adaptive ??= {};
    st.adaptive[kit.key] ??= emptyState();
    return st.adaptive[kit.key];
  }

  /** The kit for the way the student plays: two-hand cards and its own model (one hand and two are learnt apart). */
  function withHands(kit) {
    const mode = handsMode();
    if (mode === 1) return kit;
    const c = kit.cards;
    const map = (x) => (Array.isArray(x) ? x.map(twoName) : twoName(x));
    return {
      ...kit,
      key: `${kit.key}${mode === 'bass' ? '@2b' : '@2'}`,
      hands: mode,
      cards: Object.fromEntries(Object.entries(c).map(([k, v]) => [k, k === 'melodic' || k === 'hard' ? v : map(v)])),
    };
  }

  const adaptiveWorld = (kit) => ({
    ...(kit.hands ? { twoHands: true, left: kit.hands } : {}),
    id: `adapt:${kit.key}`,
    title: 'Camí intel·ligent',
    goal: `Tocar ${kit.wheel.map(chordName).join(' – ')} seguint les cartes`,
    progression: kit.wheel.join(' | '),
    chords: [...new Set(kit.wheel)],
    level: 2,
    meter: kit.meter,
    style: kit.style,
    missions: [],
  });

  /** The activity for one step of the adaptive path. */
  function adaptiveMission(kit, next) {
    const world = adaptiveWorld(kit);
    const skills = skillsFor(kit);
    const state = adaptiveState(kit);
    const probe = next.mode !== 'practise';
    const help = probe ? 'none' : 'shape';
    const c = kit.cards;
    const id = `adapt:${kit.key}:${next.skill ?? `stage${next.stage}`}`;
    const base = { id, world, step: 0, adaptive: { kit, step: next } };
    const chords = [...new Set(kit.wheel)];
    if (next.skill === null && next.stage === 1) {
      const unknown = chords.filter((x) => !known(state, `chord:${x}`));
      return { ...base, type: 'probe-chords', title: 'Quins acords saps?', chords: unknown.length ? unknown : chords };
    }
    if (next.skill === null) return { ...base, type: 'probe-changes', title: 'Quins canvis et surten?', wheel: kit.wheel };
    const skill = skills.find((s) => s.id === next.skill);
    if (skill.chord) {
      return probe
        ? { ...base, type: 'probe-chords', title: `Saps fer ${chordName(skill.chord)}?`, chords: [skill.chord] }
        : { ...base, type: 'chord', title: `Construeix ${chordName(skill.chord)}`, chord: skill.chord };
    }
    if (skill.from) return { ...base, type: 'change', title: `Canvi ${skill.label}`, from: skill.from, to: skill.to };
    const pcs = [...new Set(chords.flatMap((x) => parseChord(x).triad))];
    // A different set of cards each time the skill comes back.
    const turn = state.skills[next.skill]?.n ?? 0;
    const rotate = (list, count) => Array.from({ length: Math.min(count, list.length) }, (_, i) => list[(turn * count + i) % list.length]);
    const tierMission = (tier, title) => (probe
      ? { ...base, type: 'mix', title, cards: rotate(c[tier], 3) }
      : { ...base, type: 'pattern', title, card: rotate(c[tier], 1)[0], help: 'shape' });
    const melodicWorld = { ...world, level: 3, twoHands: false, left: undefined, style: 'ballad' };
    const read = { ...world, level: 1, left: 'bass', progression: kit.wheel[0], chords: [kit.wheel[0]], goal: 'Llegir una carta i tocar quan toca' };
    return {
      notes: { ...base, type: 'find', title: 'Troba les notes de la roda', pcs, rounds: probe ? 6 : 8, names: false },
      read: { ...base, world: read, type: 'pattern', title: 'Llegeix una carta', card: c.read, help: 'shape' },
      tempo: { ...base, type: 'pattern', title: 'La roda a tempo', card: c.whole, help },
      basic: { ...base, type: 'pattern', title: 'Un acord a cada temps', card: c.plain, help },
      rests: { ...base, type: 'pattern', title: 'Cartes amb silencis', card: c.rests, help },
      long: { ...base, type: 'pattern', title: 'Cartes amb notes llargues', card: c.long, help },
      mix: { ...base, type: 'mix', title: 'Cartes seguides', cards: c.mix },
      band: { ...base, type: 'band', title: 'Toca amb la banda', cards: c.band },
      medium: tierMission('medium', 'Cartes intermèdies'),
      hard: tierMission('hard', 'Cartes difícils'),
      arp: probe
        ? { ...base, world: melodicWorld, type: 'mix', title: 'Arpegis', cards: rotate(c.melodic.arp, 3) }
        : { ...base, world: melodicWorld, type: 'pattern', title: 'Arpegis', card: rotate(c.melodic.arp, 1)[0], help: 'shape' },
      contour: probe
        ? { ...base, world: melodicWorld, type: 'mix', title: 'Contorn melòdic', cards: rotate(c.melodic.contour, 3) }
        : { ...base, world: melodicWorld, type: 'pattern', title: 'Contorn melòdic', card: rotate(c.melodic.contour, 1)[0], help: 'shape' },
    }[skill.id];
  }

  function openAdaptive(kit, forced = null) {
    const state = adaptiveState(kit);
    const next = forced ?? nextStep(state, skillsFor(kit));
    saveStore();
    openMission(adaptiveMission(kit, next));
  }

  /** Feeds a result into the model; returns a line about what changed. */
  function adaptiveResult(got, ratio, detail) {
    const { kit, step: s } = mission.adaptive;
    const state = adaptiveState(kit);
    const skills = skillsFor(kit);
    const score = ratio !== null && ratio !== undefined ? ratio : STAR_SCORE[got] ?? 0;
    const outcome = { stage: s.stage, skill: s.skill, score };
    if (detail?.perChord || detail?.perChange) {
      outcome.perChord = detail.perChord ?? {};
      outcome.perChange = detail.perChange ?? {};
      if (s.skill?.startsWith('chord:')) outcome.skill = null;
    }
    if (detail?.results) {
      // Which chord or change failed: wrong or missing notes on its bars.
      const perChord = {};
      const perChange = {};
      const bad = new Set();
      for (const r of detail.results) {
        const chordError = r.kinds.some((k) => ['wrong', 'incomplete', 'spread'].includes(k));
        const change = r.prev && r.prev !== r.chord ? `${r.prev}>${r.chord}` : null;
        if (chordError) {
          if (change) perChange[change] = 0.45;
          else perChord[r.chord] = 0.45;
          bad.add(change ?? r.chord);
        }
      }
      if (score >= 0.9) {
        for (const r of detail.results) {
          const change = r.prev && r.prev !== r.chord ? `${r.prev}>${r.chord}` : null;
          if (!bad.has(r.chord) && weak(state, `chord:${r.chord}`)) perChord[r.chord] = 0.9;
          if (change && !bad.has(change) && weak(state, `change:${change}`)) perChange[change] = 0.9;
        }
      }
      outcome.perChord = perChord;
      outcome.perChange = perChange;
    }
    const before = progressOf(state, skills).good;
    const weakBefore = new Set(skills.filter((x) => weak(state, x.id)).map((x) => x.id));
    const levelBefore = levelOf(state, skills, s.stage);
    applyOutcome(state, skills, outcome);
    const after = progressOf(state, skills).good;
    const nowWeak = skills.filter((x) => weak(state, x.id) && !weakBefore.has(x.id));
    const parts = [];
    // "If you get it right you go up a level": say it out loud.
    const levelAfter = levelOf(state, skills, nextStep(structuredClone(state), skills).stage);
    if (levelAfter.n > levelBefore.n) parts.push(`🎚 Puges al nivell ${levelAfter.n} de ${levelAfter.total}: ${levelAfter.name}.`);
    if (after > before) parts.push(`🧭 +${after - before} ${after - before === 1 ? 'aprenentatge' : 'aprenentatges'}: ja en saps ${after} de ${skills.length}.`);
    else parts.push(`🧭 Saps ${after} de ${skills.length} aprenentatges.`);
    if (nowWeak.length) parts.push(`Cal practicar: ${nowWeak.map((x) => x.label).join(', ')}.`);
    return parts.join(' ');
  }

  function renderAdaptiveHud() {
    hudRefresh = renderAdaptiveHud;
    const { kit, step: s } = mission.adaptive;
    const state = adaptiveState(kit);
    const skills = skillsFor(kit);
    const { good, total } = progressOf(state, skills);
    const MODE = { probe: 'Prova', practise: 'Pràctica', review: 'Repàs' };
    const lvl = levelOf(state, skills, s.stage);
    hud.replaceChildren(
      el('div', { className: 'play-hud-text' }, [
        el('small', { textContent: `Nivell ${lvl.n}/${lvl.total} · ${lvl.name} · ${MODE[s.mode]}${kit.key.startsWith('rockin') ? '' : ` · ${kit.title}`}` }),
        el('strong', { textContent: mission.title }),
      ]),
      el('div', { className: 'play-hud-goal' }, [
        el('small', { textContent: 'La roda' }),
        el('div', { className: 'play-goal-chords' }, kit.wheel.map((c) => chordChip(c, path.key,
          mission.chord === c || mission.from === c || mission.to === c ? 'now' : known(state, `chord:${c}`) && !weak(state, `chord:${c}`) ? 'on' : ''))),
      ]),
      el('div', { className: 'play-hud-progress', title: 'Aprenentatges que ja saps' }, [
        el('small', { textContent: `Saps ${good} de ${total}` }),
        el('div', { className: 'play-hud-bar' }, skills.map((x) => el('i', { className: `${weak(state, x.id) ? 'weak' : known(state, x.id) ? 'done' : ''}${x.id === s.skill ? ' now' : ''}` }))),
      ]),
      // You are never stuck in the loop: you can always go easier or jump ahead.
      hudTools(
        button('↩ Més fàcil', () => adaptiveJump(-1), 'ghost small'),
        button('⏭ Salta', () => adaptiveJump(1), 'ghost small'),
        button('🧭 El meu camí', () => {
          screen = 'map';
          showMap();
        }, 'ghost small'),
        keysButton(),
        grooveButton(),
      ),
    );
  }

  /** Jumps a stage of the adaptive path: -1 something easier, +1 skip ahead. */
  function adaptiveJump(dir) {
    const { kit, step: s } = mission.adaptive;
    const state = adaptiveState(kit);
    const skills = skillsFor(kit);
    const stages = [...new Set(skills.map((x) => x.stage))].sort((a, b) => a - b);
    if (dir > 0 && s.skill && !state.skipped.includes(s.skill)) state.skipped.push(s.skill);
    const target = dir > 0 ? stages.find((st) => st > s.stage) : [...stages].reverse().find((st) => st < s.stage);
    saveStore();
    stopLounge();
    if (target === undefined) return openAdaptive(kit);
    const list = skills.filter((x) => x.stage === target);
    const pick = list.find((x) => !known(state, x.id)) ?? list[0];
    const probe = target === 1 || target === 2;
    openAdaptive(kit, {
      stage: target,
      skill: probe ? null : pick.id,
      mode: probe ? 'probe' : known(state, pick.id) ? 'review' : 'probe',
      reason: dir > 0 ? 'Fem un salt endavant.' : `Anem a una cosa més fàcil: ${probe ? STAGE_NAMES[target].toLowerCase() : pick.label}.`,
    });
  }

  /** Build every chord alone; each one gets its own score. */
  function probeChords() {
    const list = mission.chords;
    const per = {};
    let k = 0;
    setFocus('keys');
    const nextChord = () => {
      if (k >= list.length) {
        const values = Object.values(per);
        const avg = values.reduce((a, b) => a + b, 0) / values.length;
        const first = values.filter((v) => v === 1).length;
        return finishMission(avg >= 0.95 ? 3 : avg >= 0.75 ? 2 : avg >= 0.5 ? 1 : 0, {
          title: first === list.length ? 'Els saps tots!' : 'Fet!',
          text: list.length === 1 ? (first ? 'A la primera!' : 'Aquest acord encara s\'ha de practicar.') : `${first} de ${list.length} acords a la primera.`,
          retry: again,
          detail: { perChord: per },
        });
      }
      const symbol = list[k];
      buildRound({
        symbol,
        guided: false,
        anyInversion: true,
        header: () => ({ done: k, total: list.length }),
        onDone: (m) => {
          per[symbol] = m === 0 ? 1 : m === 1 ? 0.6 : 0.3;
          k++;
          nextChord();
        },
      });
    };
    view = { marks: new Map(), message: '' };
    startPanel({
      kicker: 'Prova',
      title: mission.title,
      text: `Construeix ${list.length === 1 ? 'aquest acord' : `aquests ${list.length} acords`} <b>sense ajuda</b>: ${list.map((x) => `<b>${chordName(x)}</b>`).join(', ')}. Les tres notes alhora, <b>en l'ordre que vulguis</b>. Si no te'n recordes, hi ha ajuda pas a pas.`,
      start: nextChord,
    });
  }

  /** The whole wheel alone, chord by chord: which changes are hard. */
  function probeChanges() {
    const wheel = mission.wheel;
    const symbols = [...wheel, wheel[0]];
    setFocus('keys');
    const start = () => runSteps({
      items: symbols.map((chord) => (mission.world.twoHands
        ? { chord, notes: rightHandVoicing(chord), left: leftHandVoicing(chord, leftMode()), painted: false }
        : { chord, notes: rootVoicing(chord), painted: false })),
      columns: Math.min(8, symbols.length),
      kicker: 'Prova · el joc t\'espera',
      intro: 'Sense ajuda: tota la roda, acord per acord.',
      onDone: ({ mistakes, hints, stars, perItem }) => {
        const perChange = {};
        const perChord = {};
        symbols.forEach((chord, k) => {
          const bad = perItem[k] ?? 0;
          if (k > 0 && symbols[k - 1] !== chord) {
            const key = `${symbols[k - 1]}>${chord}`;
            perChange[key] = Math.min(perChange[key] ?? 1, bad === 0 ? 1 : bad === 1 ? 0.6 : 0.35);
          }
          if (bad >= 2) perChord[chord] = 0.5;
        });
        finishMission(stars, {
          title: mistakes + hints ? 'Roda feta!' : 'Cap errada!',
          text: mistakes + hints ? `${mistakes} errada${mistakes === 1 ? '' : 'es'} i ${hints} ${hints === 1 ? 'pista' : 'pistes'}.` : 'Tots els canvis a la primera.',
          retry: again,
          detail: { perChange, perChord },
        });
      },
    });
    view = { marks: new Map(), message: '' };
    startPanel({
      kicker: 'Prova',
      title: mission.title,
      text: `Toca la roda <b>${symbols.map(chordName).join(' – ')}</b> sense ajuda. No hi ha música: <b>el joc t'espera</b> a cada acord.`,
      start,
    });
  }

  function showAdaptive(kit) {
    const st = me();
    const state = adaptiveState(kit);
    const skills = skillsFor(kit);
    const peek = nextStep(structuredClone(state), skills);
    const nextMission = adaptiveMission(kit, peek);
    const { good, total } = progressOf(state, skills);
    const fresh = !state.history.length;
    const inNext = (x) => x.id === peek.skill || (peek.skill === null && x.stage === peek.stage && (peek.stage === 2 || !known(state, x.id)));
    const stages = [...new Set(skills.map((x) => x.stage))].sort((a, b) => a - b);
    const chip = (x) => {
      const s = state.skills[x.id];
      const cls = !known(state, x.id) ? 'unknown' : weak(state, x.id) ? 'weak' : s.inferred ? 'inferred' : 'ok';
      const b = el('button', {
        type: 'button',
        className: `play-skill ${cls}${inNext(x) ? ' next' : ''}`,
        title: { unknown: 'Encara no ho has provat', weak: 'Encara et costa', inferred: 'Ho saps (ho has demostrat en un repte més difícil)', ok: 'Ho saps' }[cls],
      }, [el('span', { textContent: x.icon }), ` ${x.label}`]);
      b.addEventListener('click', () => openAdaptive(kit, { stage: x.stage, skill: x.id, mode: known(state, x.id) ? 'practise' : 'probe', reason: '' }));
      return b;
    };
    setChildren(mapScreen,
      teacherBannerEl(),
      boardTabs(),
      el('div', { className: 'play-hello' }, [
        el('div', { className: 'play-hello-text' }, [
          el('div', { className: 'play-kicker', textContent: `Camí intel·ligent${kit.key.startsWith('rockin') ? '' : ` · ${kit.title}`}` }),
          el('h2', { textContent: `Hola, ${st.name}!` }),
          handsChip(),
          el('p', { className: 'play-note', textContent: fresh
            ? 'Aquí no hi ha un ordre fix: el joc et proposa reptes, mira què et surt i tria el següent. El que ja saps, se\'l salta; el que et costa, el practiques.'
            : 'El joc tria el repte que més t\'ajudarà ara.' }),
          el('div', { className: 'play-adapt-progress' }, [
            el('div', { className: 'play-adapt-bar' }, [el('i', { style: `width:${Math.round((good / total) * 100)}%` })]),
            el('small', { textContent: `Saps ${good} de ${total} aprenentatges` }),
          ]),
        ]),
        el('div', { className: 'play-resume' }, [
          el('small', { textContent: fresh ? 'Comencem:' : `Nivell ${levelOf(state, skills, peek.stage).n} de ${levelOf(state, skills, peek.stage).total} · ${STAGE_NAMES[peek.stage]}` }),
          el('strong', { textContent: nextMission.title }),
          el('span', { className: 'play-note', textContent: peek.reason }),
          button('▶ Juga', () => openAdaptive(kit)),
        ]),
      ]),
      el('div', { className: 'play-world play-skills' }, [
        el('h3', { textContent: 'Què saps' }),
        el('div', { className: 'play-skill-legend' }, [
          el('span', { className: 'play-skill ok', textContent: 'ho saps' }),
          el('span', { className: 'play-skill inferred', textContent: 'ho saps (deduït)' }),
          el('span', { className: 'play-skill weak', textContent: 'cal practicar' }),
          el('span', { className: 'play-skill unknown', textContent: 'per provar' }),
        ]),
        ...stages.map((stage) => el('div', { className: 'play-skill-row' }, [
          el('small', { textContent: STAGE_NAMES[stage] }),
          el('div', {}, skills.filter((x) => x.stage === stage).map(chip)),
        ])),
        el('p', { className: 'play-note', textContent: 'Pots tocar qualsevol aprenentatge per practicar-lo quan vulguis.' }),
      ]),
      el('div', { className: 'play-map-foot' }, [
        button('❓ Com es juga?', () => {
          screen = 'welcome';
          showMap();
        }, 'ghost small'),
        fresh ? null : button('↺ Torna a començar', () => {
          if (!window.confirm('Esborrar el que el camí intel·ligent sap de tu i tornar a començar?')) return;
          st.adaptive[kit.key] = emptyState();
          saveStore();
          showMap();
        }, 'ghost small'),
        st.teacher ? null : button(`No ets ${st.name}? Canvia`, () => {
          screen = 'who';
          showMap();
        }, 'ghost small'),
        section === 'cancons' ? unlockButton() : null,
        section === 'cancons' ? null : button('⚙ Professorat', () => {
          screen = 'teacher';
          showMap();
        }, 'ghost small'),
      ]),
    );
    step = { space: () => openAdaptive(kit) };
    toTop();
  }

  // ---- Placement test: where to start on the ROCKIN path ------------------------------------------------

  let TESTS_GO = [];

  function placementTest() {
    stopAnimation();
    stopLounge();
    stopSession();
    cancelAutoNext();
    path = ROCKIN_PATH;
    const worlds = ROCKIN_PATH.worlds;
    const indexOf = (id) => ROCKIN_PATH.missions.findIndex((m) => m.id === id);
    const card = (n) => cardByName(`rhythm_binary_${String(n).padStart(2, '0')}.png`);
    const WHEEL = ['C', 'G', 'Am', 'F'];
    mission = { id: 'placement', type: 'placement', title: 'Prova de nivell', world: worlds[1], index: -1, step: 0 };
    mapScreen.hidden = true;
    missionScreen.hidden = false;
    showScore(false);
    feedback = new Map();
    view = { marks: new Map(), message: '' };
    const TESTS = ['Ritme', 'Acords', 'Canvis', 'La roda amb cartes'];
    // Where each test would place the student, so «Comença aquí» always works.
    const PLACE_AT = ['ritme-lliçó', 'roda-do', 'roda-do-sol', 'rr-1'];
    const hudFor = (k) => {
      hud.replaceChildren(
        el('div', { className: 'play-hud-text' }, [el('small', { textContent: 'Prova de nivell' }), el('strong', { textContent: `${k + 1}. ${TESTS[k]}` })]),
        el('div', { className: 'play-hud-progress' }, [
          el('small', { textContent: `Prova ${k + 1} de ${TESTS.length}` }),
          el('div', { className: 'play-hud-bar' }, TESTS.map((_, j) => el('i', { className: j < k ? 'done' : j === k ? 'now' : '' }))),
        ]),
        // Never stuck: skip a test, or stop here and start playing at this level.
        hudTools(
          k > 0 ? button('↩ Prova anterior', () => TESTS_GO[k - 1](), 'ghost small') : null,
          button('⏭ Salta la prova', () => (k + 1 < TESTS.length ? TESTS_GO[k + 1]() : place('cançó-1', k)), 'ghost small'),
          button('▶ Comença aquí', () => place(PLACE_AT[k], k), 'ghost small'),
        ),
      );
      missionStars.textContent = '';
    };

    const place = (missionId, passed) => {
      stopSession();
      const index = Math.max(0, indexOf(missionId));
      const st = me();
      // Starting further on means the missions before are known: the band level
      // shows it from the first minute.
      const proved = Math.min(4, Math.max(0, ...ROCKIN_PATH.missions.slice(0, index).map(bandLevelOf)));
      const bandLine = proved > 0 ? raiseBandLevel(proved) : null;
      if (st && !st.teacher) {
        st.start = { ...(st.start ?? {}), rockin: index };
        st.placed = true;
        st.log.push({ m: 'placement', p: 'rockin', t: Date.now(), s: passed, r: passed / TESTS.length, start: missionId });
        saveStore();
      }
      const target = ROCKIN_PATH.missions[index];
      hud.replaceChildren(el('div', { className: 'play-hud-text' }, [el('small', { textContent: 'Prova de nivell' }), el('strong', { textContent: 'Resultat' })]));
      showScore(false);
      view = { marks: new Map(), message: '' };
      setPanel({
        kicker: 'Prova de nivell',
        title: passed === TESTS.length ? 'Ja en saps molt!' : passed ? 'Molt bé!' : 'Som-hi des del principi!',
        big: [el('div', { className: 'play-target good' }, [
          el('small', { textContent: 'Començaràs a' }),
          el('strong', { textContent: target.world.title }),
          el('span', { textContent: target.title }),
        ])],
        text: `Has superat ${passed} de ${TESTS.length} proves. Els mons d'abans queden oberts per si vols repassar.${bandLine ? `<br>${bandLine}` : ''}`,
        tone: 'good',
        buttons: [
          button('▶ Som-hi', () => {
            path = handsPath(ROCKIN_PATH);
            openMission(index);
          }),
          button('Mapa', () => {
            screen = 'map';
            showMap();
          }, 'ghost'),
        ],
      });
      step = {
        space: () => {
          path = handsPath(ROCKIN_PATH);
          openMission(index);
        },
      };
      sfx.good();
    };

    // The test runs on its own: each part starts by itself after a few seconds.
    const intro = (k, text, start) => {
      cancelAutoNext();
      hudFor(k);
      setFocus(k === 0 || k === 3 ? 'card' : 'keys');
      view = { marks: new Map(), message: '' };
      const go = () => {
        cancelAutoNext();
        start();
      };
      const countdown = el('p', { className: 'play-note' });
      setPanel({
        kicker: `Prova ${k + 1} de ${TESTS.length}`,
        title: TESTS[k],
        text,
        note: k === 0 ? 'Si una prova no et surt, cap problema: començaràs just allà. La prova va sola: cada part comença tota sola.' : '',
        extra: countdown,
        buttons: [button('▶ Comença ara', go)],
      });
      step = { space: go };
      autoGo(countdown, k === 0 ? 5 : 3, 'Comença', go);
    };

    // A timed try over the backing; `onEnd(ratio)`.
    const timed = ({ cards, chords, level, onEnd }) => {
      const playBars = [];
      const rows = [];
      for (const c of cards) {
        const row = { bars: [] };
        chords.forEach((chord) => {
          row.bars.push(playBars.length);
          playBars.push({ card: c, chord, kind: 'play', name: level === 1 ? 'Do' : chordName(chord) });
        });
        rows.push(row);
      }
        const demoCount = new Set(chords).size === 1 ? 1 : chords.length;
      // The last bar you listen to is already the count-in.
      const demo = playBars.slice(0, demoCount).map((b, k) => ({ ...b, kind: 'demo', tag: k === demoCount - 1 ? 'Ara tu!' : '', lead: k === demoCount - 1 }));
      const bars = [...demo, ...playBars];
      const offset = demo.length;
      const allRows = [{ label: 'Escolta', kind: 'listen', bars: demo.map((_, i) => i) }, ...rows.map((r) => ({ bars: r.bars.map((b) => b + offset) }))];
      const voicings = bars.map((b) => (level === 1 ? [60] : rootVoicing(b.chord)));
      step = {
        space: () => session?.togglePause(),
        escape: () => {
          screen = 'map';
          showMap();
        },
      };
      runMusic({
        bars,
        rows: allRows,
        columns: chords.length === 1 ? 4 : chords.length,
        level,
        meter: '4/4',
        style: 'rock',
        tempo: SPEEDS[1].tempo,
        help: 'none',
        voicings,
        onPhase: (phase) => setStatus({
          kicker: phase === 'demo' ? 'Escolta' : phase === 'play' ? 'Toca' : 'Preparat',
          text: phase === 'demo' ? 'Escolta i mira la pilota. <b>Encara no toquis.</b>' : phase === 'play' ? 'Segueix les cartes.' : 'Compta…',
          tone: phase === 'demo' ? 'listen' : phase === 'play' ? '' : 'ready',
        }),
        onEnd: ({ results }) => onEnd(results.filter((r) => r.clean).length / results.length),
      });
    };
    // One card and one note: two bars are enough, so the test stays short.
    const rhythmRows = () => timed({ cards: [card(2)], chords: ['C', 'C'], level: 1, onEnd: (ratio) => (ratio >= 0.75 ? test2() : place('ritme-lliçó', 0)) });

    const test1 = () => intro(0, 'Toca el <b>Do</b> seguint la carta, amb la música. Primer l\'escoltes una vegada.', rhythmRows);

    const test2 = () => intro(1, 'Construeix quatre acords <b>sense ajuda</b>: Do, Sol, La m i Fa. Les tres notes alhora, <b>en l\'ordre que vulguis</b>: si ja els inverteixes, també val.', () => {
      const list = ['C', 'G', 'Am', 'F'];
      let k = 0;
      let good = 0;
      const nextChord = () => {
        if (k >= list.length) return good >= 3 ? test3() : place('roda-do', 1);
        const symbol = list[k];
        buildRound({
          symbol,
          guided: false,
          anyInversion: true,
          header: () => ({ done: k, total: list.length }),
          onDone: (m) => {
            if (m === 0) good++;
            k++;
            nextChord();
          },
        });
      };
      nextChord();
    });

    const test3 = () => intro(2, 'Toca la roda <b>Do – Sol – La m – Fa – Do</b>, acord per acord, sense ajuda. El joc t\'espera.', () => {
      const symbols = [...WHEEL, 'C'];
      runSteps({
        items: symbols.map((chord) => ({ chord, notes: rootVoicing(chord), painted: false })),
        columns: symbols.length,
        kicker: 'Prova de nivell · Canvis',
        intro: 'Sense ajuda.',
        onDone: ({ mistakes, hints }) => (mistakes + hints <= 1 ? test4() : place('roda-do-sol', 2)),
      });
    });

    const test4 = () => intro(3, 'Toca la roda <b>Do – Sol – La m – Fa</b> seguint dues cartes, amb la música i sense ajuda al teclat.', () =>
      timed({ cards: [card(1), card(2)], chords: WHEEL, level: 2, onEnd: (ratio) => (ratio >= 0.75 ? place('cançó-1', 4) : place('rr-1', 3)) }),
    );

    TESTS_GO = [test1, test2, test3, test4];
    test1();
  }

  // ---- Chord workshop games ---------------------------------------------------------------------------

  const WHITE_PCS = [0, 2, 4, 5, 7, 9, 11];
  const BLACK_PCS = [1, 3, 6, 8, 10];
  const BLACK_NAMES = { 1: 'Do♯ / Re♭', 3: 'Re♯ / Mi♭', 6: 'Fa♯ / Sol♭', 8: 'Sol♯ / La♭', 10: 'La♯ / Si♭' };
  const pickOther = (list, last) => {
    const options = list.length > 1 ? list.filter((x) => x !== last) : list;
    return options[Math.floor(Math.random() * options.length)];
  };
  const keysOfPc = (pc) => Array.from({ length: 37 }, (_, k) => 48 + k).filter((n) => pitchClass(n) === pc);
  const starsForMistakes = (m) => (m <= 1 ? 3 : m <= 3 ? 2 : 1);
  let clockText = null; // the race clock, while a race is on

  /** The big question of a workshop game. */
  function gamePanel({ ask, target, sub = '', message = '', tone = '', done, total, buttons = [] }) {
    setPanel({
      kicker: `${TYPE_LABEL[mission.type]} · ${mission.title}`,
      big: [el('div', { className: `play-target ${tone}` }, [
        mission.type === 'rush' ? el('div', { className: 'play-clock', textContent: clockText?.() ?? '' }) : null,
        el('small', { textContent: ask }),
        el('strong', { textContent: target }),
        sub ? el('span', { textContent: sub }) : null,
      ])],
      dots: total ? Array.from({ length: total }, (_, k) => el('span', { className: k < done ? 'on' : k === done ? 'now' : '' })) : null,
      note: message,
      tone,
      buttons,
    });
  }

  /** Numbers appear one by one on the keys after `from` (with a soft note each), up to `steps`. */
  function countingMarks(from, steps, base = new Map(), start = performance.now()) {
    let shown = 0;
    return (now) => {
      const k = Math.min(steps, Math.floor((now - start) / 420));
      if (k > shown) {
        shown = k;
        pianoSound().play([from + k], 0.18, Tone.now(), 0.25);
      }
      const marks = new Map(base);
      for (let i = 1; i <= k; i++) marks.set(from + i, { colour: COUNT, text: String(i) });
      return marks;
    };
  }

  function findGame() {
    const rounds = mission.rounds ?? 8;
    const pcs = mission.pcs ?? (mission.set === 'black' ? BLACK_PCS : WHITE_PCS);
    let done = 0;
    let mistakes = 0;
    let wrongHere = 0;
    let pc = null;
    let waiting = false;
    setFocus('keys');
    const name = (x) => (mission.set === 'black' ? BLACK_NAMES[x] : SOLFEGE[x]);
    const next = () => {
      if (done >= rounds) {
        return finishMission(starsForMistakes(mistakes), {
          title: 'Molt bé!',
          text: mistakes ? `${rounds} notes trobades amb ${mistakes} ${mistakes === 1 ? 'errada' : 'errades'}.` : `${rounds} notes trobades sense cap errada!`,
          retry: () => again(),
        });
      }
      pc = pickOther(pcs, pc);
      wrongHere = 0;
      waiting = false;
      render();
    };
    const render = (message = '', tone = '') => {
      const showNames = mission.names && done < 4;
      view = {
        marks: wrongHere >= 2 ? new Map(keysOfPc(pc).map((n) => [n, { fill: true, colour: SHAPE, text: '' }])) : new Map(),
        message: '',
        names: showNames,
      };
      gamePanel({ ask: 'Troba el', target: name(pc), sub: mission.set === 'black' ? 'una tecla negra' : '', message, tone, done, total: rounds });
    };
    step = {
      noteOn: ({ note }) => {
        if (waiting) return;
        if (pitchClass(note) === pc) {
          feedback.set(note, 'good');
          done++;
          waiting = true;
          gamePanel({ ask: 'Molt bé!', target: name(pc), tone: 'good', done, total: rounds });
          setTimeout(next, 600);
        } else {
          feedback.set(note, 'bad');
          mistakes++;
          wrongHere++;
          render(`Això és <b>${mission.set === 'black' && BLACK_NAMES[pitchClass(note)] ? BLACK_NAMES[pitchClass(note)] : SOLFEGE[pitchClass(note)]}</b>. ${wrongHere >= 2 ? 'Mira les tecles pintades.' : 'Torna-hi!'}`, 'bad');
        }
      },
      noteOff: ({ note }) => feedback.delete(note),
    };
    next();
  }

  function jumpGame() {
    const rounds = 8;
    let done = 0;
    let mistakes = 0;
    let from = null;
    let steps = null;
    let helped = false;
    let waiting = false;
    setFocus('keys');
    const next = () => {
      if (done >= rounds) {
        return finishMission(starsForMistakes(mistakes), {
          title: 'Bons salts!',
          text: mistakes ? `${rounds} salts amb ${mistakes} ${mistakes === 1 ? 'errada' : 'errades'}.` : `${rounds} salts perfectes!`,
          retry: () => again(),
        });
      }
      steps = pickOther(mission.steps, steps);
      const choices = Array.from({ length: 12 }, (_, k) => 55 + k).filter((n) => n !== from);
      from = choices[Math.floor(Math.random() * choices.length)];
      helped = mission.numbers;
      waiting = false;
      render();
    };
    const render = (message = '', tone = '') => {
      const base = new Map([[from, { fill: true, colour: SHAPE, text: '0' }]]);
      view = { marks: base, marksFn: helped ? countingMarks(from, steps, base) : null, message: '' };
      gamePanel({
        ask: `Des de la tecla groga (${SOLFEGE[pitchClass(from)]}), salta`,
        target: `${steps} ${steps === 1 ? 'tecla' : 'tecles'} →`,
        sub: 'compta blanques i negres',
        message,
        tone,
        done,
        total: rounds,
        buttons: helped ? [] : [button('Ajuda: compta amb mi', () => {
          helped = true;
          mistakes++;
          render();
        }, 'ghost')],
      });
    };
    step = {
      noteOn: ({ note }) => {
        if (waiting || note === from) return;
        if (note === from + steps) {
          feedback.set(note, 'good');
          done++;
          waiting = true;
          gamePanel({ ask: 'Exacte!', target: `${SOLFEGE[pitchClass(note)]}`, sub: `${steps} ${steps === 1 ? 'tecla' : 'tecles'} des del ${SOLFEGE[pitchClass(from)]}`, tone: 'good', done, total: rounds });
          setTimeout(next, 800);
        } else {
          feedback.set(note, 'bad');
          mistakes++;
          helped = true;
          render(note > from ? `Aquesta és a <b>${note - from}</b>. Compta amb els números.` : 'Cap a la <b>dreta</b>!', 'bad');
        }
      },
      noteOff: ({ note }) => feedback.delete(note),
    };
    next();
  }

  /**
   * One chord to build. guided: root, then count the first jump, then the
   * second, then all three together. Alone: the three together directly (a
   * mistake offers the guided way). Calls onDone(mistakes).
   */
  /**
   * One chord built from scratch. `anyInversion`: any order of the three notes
   * counts (in the placement test, playing it inverted means it is known).
   */
  function buildRound({ symbol, guided, onDone, header, anyInversion = false }) {
    const chord = parseChord(symbol);
    const names3 = triadNoteNames(symbol);
    const minor = splitChord(symbol).suffix === 'm';
    const third = mod(chord.triad[1] - chord.root, 12);
    const fifth = mod(chord.triad[2] - chord.triad[1], 12);
    const quality = minor ? 'menor' : 'major';
    let stage = guided ? 'root' : 'all';
    let base = null;
    let mistakes = 0;
    let armed = getHeld().size === 0;
    let finished = false;
    const render = (message = '', tone = '') => {
      const h = header();
      if (stage === 'root') {
        view = { marks: mistakes >= 2 ? new Map(keysOfPc(chord.root).map((n) => [n, { fill: true, colour: SHAPE, text: '' }])) : new Map(), message: '' };
        gamePanel({ ...h, ask: `Construeix ${chordName(symbol)} (${quality})`, target: `1. Toca el ${names3[0]}`, sub: 'la primera nota dona nom a l\'acord', message, tone });
      } else if (stage === 'jump1' || stage === 'jump2') {
        const from = stage === 'jump1' ? base : base + third;
        const n = stage === 'jump1' ? third : fifth;
        const baseMarks = new Map([[base, { fill: true, colour: SHAPE, text: '' }]]);
        if (stage === 'jump2') baseMarks.set(base + third, { fill: true, colour: SHAPE, text: '' });
        view = { marks: baseMarks, marksFn: countingMarks(from, n, baseMarks), message: '' };
        gamePanel({ ...h, ask: `Construeix ${chordName(symbol)} (${quality})`, target: `${stage === 'jump1' ? '2' : '3'}. Salta ${n} → toca la ${n}`, sub: stage === 'jump1' ? `${minor ? 'menor: primer 3' : 'major: primer 4'}` : `${minor ? 'i després 4' : 'i després 3'}`, message, tone });
      } else {
        const notes = guided ? [base, base + third, base + third + fifth] : [];
        view = { marks: new Map(notes.map((n) => [n, { fill: true, colour: SHAPE, text: '' }])), message: '' };
        gamePanel({
          ...h,
          ask: guided ? 'Ara les tres alhora!' : `Construeix l'acord`,
          target: chordName(symbol),
          sub: guided ? names3.join(' + ') : quality,
          message,
          tone,
          buttons: guided ? [] : [button('Ajuda pas a pas', () => {
            mistakes++;
            stage = 'root';
            guided = true;
            render();
          }, 'ghost')],
        });
      }
    };
    const wrong = (note, text) => {
      mistakes++;
      feedback.set(note, 'bad');
      render(text, 'bad');
    };
    const check = () => {
      if (finished) return;
      const held = [...getHeld()];
      if (!held.length) {
        armed = true;
        return;
      }
      if (stage !== 'all') return;
      if (!armed) return;
      const bad = held.find((n) => !chord.triad.includes(pitchClass(n)));
      if (bad !== undefined) {
        armed = false;
        return wrong(bad, `<b>${SOLFEGE[pitchClass(bad)]}</b> no és de ${chordName(symbol)}.${guided ? '' : ' Prova l\'ajuda pas a pas.'}`);
      }
      if (new Set(held.map(pitchClass)).size < 3) return;
      armed = false;
      const inverted = pitchClass(Math.min(...held)) !== chord.root;
      if (inverted && !anyInversion) {
        mistakes++;
        held.forEach((n) => feedback.set(n, 'bad'));
        return render(`Notes bones, però a baix hi va el <b>${names3[0]}</b>.`, 'bad');
      }
      held.forEach((n) => feedback.set(n, 'good'));
      finished = true;
      view = { marks: new Map(held.map((n) => [n, { fill: true, colour: SHARED, text: '' }])), message: '' };
      gamePanel({ ...header(), ask: inverted ? 'Aquest és, i en inversió!' : 'Aquest és', target: chordName(symbol), sub: inverted ? `${names3.join(' – ')} · les mateixes notes en un altre ordre` : names3.join(' – '), tone: 'good' });
      setTimeout(() => onDone(mistakes), 900);
    };
    step = {
      noteOn: ({ note }) => {
        if (finished) return;
        if (stage === 'root') {
          if (pitchClass(note) !== chord.root) return wrong(note, `Això és <b>${SOLFEGE[pitchClass(note)]}</b>. Busca el <b>${names3[0]}</b>.`);
          base = note >= 72 ? note - 12 : note;
          feedback.set(note, 'good');
          stage = 'jump1';
          return render();
        }
        if (stage === 'jump1' || stage === 'jump2') {
          const from = stage === 'jump1' ? base : base + third;
          const target = stage === 'jump1' ? base + third : base + third + fifth;
          if (note === base || (stage === 'jump2' && note === base + third)) return;
          if (pitchClass(note) !== pitchClass(target)) return wrong(note, `Aquesta tecla és a <b>${note - from}</b>. Segueix els números.`);
          feedback.set(note, 'good');
          stage = stage === 'jump1' ? 'jump2' : 'all';
          armed = false;
          return render(stage === 'all' ? 'Ara aixeca els dits i toca les tres juntes.' : '');
        }
        check();
      },
      noteOff: ({ note }) => {
        feedback.delete(note);
        check();
      },
    };
    render();
  }

  function chordFor(root, quality) {
    const q = quality === 'mix' ? (Math.random() < 0.5 ? '' : 'm') : quality;
    return `${root}${q}`;
  }

  function buildGame() {
    const rounds = mission.guided ? 4 : 6;
    let done = 0;
    let mistakes = 0;
    let last = null;
    setFocus('keys');
    const next = () => {
      if (done >= rounds) {
        return finishMission(starsForMistakes(mistakes), {
          title: 'Acords construïts!',
          text: mistakes ? `${rounds} acords amb ${mistakes} ${mistakes === 1 ? 'errada o ajuda' : 'errades o ajudes'}.` : `${rounds} acords sense cap errada!`,
          retry: () => again(),
        });
      }
      let symbol;
      do symbol = chordFor(mission.roots[Math.floor(Math.random() * mission.roots.length)], mission.quality);
      while (symbol === last && mission.roots.length > 1);
      last = symbol;
      buildRound({
        symbol,
        guided: mission.guided,
        header: () => ({ done, total: rounds }),
        onDone: (m) => {
          mistakes += m;
          done++;
          next();
        },
      });
    };
    next();
  }

  function rushGame() {
    const seconds = mission.seconds ?? 60;
    const own = mission;
    let built = 0;
    let started = null;
    let timer = null;
    let last = null;
    let ended = false;
    setFocus('keys');
    const left = () => Math.max(0, Math.ceil(seconds - (performance.now() - started) / 1000));
    const end = () => {
      if (ended) return;
      ended = true;
      clearInterval(timer);
      clockText = null;
      step = null;
      const got = built >= 10 ? 3 : built >= 6 ? 2 : built >= 3 ? 1 : 0;
      finishMission(got, {
        title: `${built} ${built === 1 ? 'acord' : 'acords'}!`,
        text: `En ${seconds} segons. Per a 1 estrella en calen 3; per a 2, 6; per a 3, 10.`,
        retry: () => again(),
      });
    };
    const round = () => {
      if (ended) return;
      if (!left()) return end();
      let symbol;
      do symbol = chordFor(mission.roots[Math.floor(Math.random() * mission.roots.length)], 'mix');
      while (symbol === last);
      last = symbol;
      buildRound({
        symbol,
        guided: false,
        header: () => ({ done: 0, total: 0 }),
        onDone: () => {
          built++;
          round();
        },
      });
    };
    const start = () => {
      started = performance.now();
      clockText = () => `⏱ ${left()} s · ${built} ${built === 1 ? 'acord' : 'acords'}`;
      timer = setInterval(() => {
        if (mission !== own) {
          clearInterval(timer);
          clockText = null;
          return;
        }
        const clock = panel.querySelector('.play-clock');
        if (clock) clock.textContent = clockText();
        if (!left()) end();
      }, 250);
      round();
    };
    view = { marks: new Map(), message: '' };
    startPanel({
      kicker: TYPE_LABEL.rush,
      title: 'Quants acords pots construir en un minut?',
      text: 'Surt un acord: toca les tres notes alhora, amb la primera a baix. Majors i menors barrejats.',
      seconds: 8,
      start,
    });
  }

  // ---- Cards: pattern, mix, song, structure and band ------------------------------------------------------------

  function cardsMission() {
    const world = mission.world;
    const type = mission.type;
    const level = world.level;
    const meter = parseTimeSignature(world.meter ?? '4/4');
    const style = mission.style ?? world.style;
    const baseTempo = Math.round((mission.tempo ?? speed.tempo) * (mission.tempo ? speed.tempo / 76 : 1) * (meter.compound ? 0.8 : 1));
    const help = type === 'pattern' ? mission.help : 'none';
    const tempoNow = () => Math.max(44, baseTempo - (tempoDrop.get(mission.id) ?? 0));

    // The bars to play, in rows: one card per row, each row a whole wheel (or 4 bars).
    const rowsOf = [];
    const playBars = [];
    const addRow = (card, progression, label) => {
      const perRow = progression.length >= 3 ? progression.length : BARS;
      // Long parts of a song go in rows of four bars.
      const chunk = perRow > 8 ? 4 : perRow;
      for (let k = 0; k < perRow; k++) {
        if (k % chunk === 0) rowsOf.push({ label: k ? '' : label, bars: [] });
        rowsOf.at(-1).bars.push(playBars.length);
        playBars.push({ card, chord: progression[k % progression.length], kind: 'play', section: label });
      }
    };
    let progression;
    if (type === 'structure') {
      const sections = mission.sections.map((s) => ({ ...s, bars: splitProgression(s.progression), cardObj: cardByName(s.card) }));
      for (const i of mission.order) addRow(sections[i].cardObj, sections[i].bars, sections[i].name);
      progression = sections[0].bars;
    } else {
      progression = splitProgression(mission.progression ?? world.progression);
      const cards = (mission.cards ?? [mission.card]).map(cardByName);
      for (const card of cards) addRow(card, progression, '');
      // A single round is too short: play it twice, on the same cards ("×2").
      // With one single note (level 1) it would only be long, so it goes once.
      const oneNote = level === 1 || new Set(progression).size === 1;
      if (rowsOf.length === 1 && rowsOf[0].bars.length <= 8 && !oneNote) {
        const row = rowsOf[0];
        row.repeat = 2;
        for (const b of [...row.bars]) playBars.push({ ...playBars[b], repeatOf: b });
      }
    }
    // One card per wheel: when every bar of a row uses the same card, an
    // advanced student doesn't need to see it four times (`compactCards`).
    if (compactCards()) {
      for (const row of rowsOf) {
        if (row.bars.length < 3) continue;
        const first = row.bars[0];
        if (!row.bars.every((b) => playBars[b].card === playBars[first].card)) continue;
        for (const b of row.bars.slice(1)) playBars[b].repeatOf = first;
        row.perChord = row.bars.length;
        row.chordBars = [...row.bars]; // the whole wheel is still shown, as chips
        row.bars = [first];
      }
    }
    const columns = Math.min(8, Math.max(...rowsOf.map((r) => r.bars.length)));
    playBars.forEach((bar, b) => {
      const previous = playBars[b - 1];
      bar.name = level === 1 ? SOLFEGE[parseChord(bar.chord).root] : chordName(bar.chord);
      if (level !== 1) Object.assign(bar, colourOf(bar.chord));
      bar.tag = !previous ? '' : previous.card !== bar.card ? 'carta nova' : '';
    });
    const two = Boolean(world.twoHands);
    const mode = leftMode();
    const rightOf = (chord) => (level === 1 ? [rightHandVoicing(chord)[0]] : rightHandVoicing(chord));
    const voicings = two ? playBars.map((b) => rightOf(b.chord)) : chainFor(playBars.map((b) => b.chord), world, level);
    const leftVoicings = two ? playBars.map((b) => leftHandVoicing(b.chord, level === 1 ? 'bass' : mode)) : null;
    const cards = [...new Set(playBars.map((b) => b.card))];
    const chords = [...new Set(progression)];
    const wheel = progression.map(chordName).join(' – ');
    const rootName = SOLFEGE[parseChord(progression[0]).root];

    const what = level === 3
      ? `Toca les notes de l'acord <b>d'una en una</b>, seguint la línia de la carta: si puja, una nota més aguda; si baixa, més greu. <b>Pots començar per qualsevol nota de l'acord</b>: el que compta és cap on va la línia. La pilota bota amb el pols.`
      : two && level === 1
      ? `Toca el <b>${rootName}</b> amb les dues mans: la <b style="color:${RIGHT_COLOUR}">dreta</b> segueix la fila blava i l'<b style="color:${LEFT_COLOUR}">esquerra</b>, més greu, la taronja.`
      : two && cards.some((c) => c.alternate)
      ? `Les mans <b>s'alternen</b> dins del mateix temps: cada tros <b style="color:${RIGHT_COLOUR}">blau</b> és de la <b>dreta</b> (l'acord) i cada tros <b style="color:${LEFT_COLOUR}">taronja</b>, de l'<b>esquerra</b> (${mode === 'bass' ? 'la nota de baix' : 'el mateix acord, més greu'}). No toquis mai les dues alhora: una i l'altra, com un merengue. Mà relaxada i moviment petit.`
      : two
      ? `<b style="color:${RIGHT_COLOUR}">Dreta</b>: l'acord escrit a sobre (${chords.map(chordName).join(', ')}). <b style="color:${LEFT_COLOUR}">Esquerra</b>: ${mode === 'bass' ? 'només la nota de baix' : 'el mateix acord, més greu'}. Cada mà segueix la seva fila. <b>L'octava la tries tu</b>: les tecles pintades són una proposta, i el joc compta les notes encara que les toquis una mica més amunt o més avall.`
      : level === 1
      ? `Toca el <b>${rootName}</b>${keysText(voicings[0])} quan la pilota caigui en una rodona blava.`
      : type === 'structure'
        ? 'Cada fila és una part de la cançó. Segueix la pilota fila per fila.'
        : chords.length === 1
          ? `Toca <b>${chordName(chords[0])}</b> (les tres tecles alhora) quan la pilota caigui en una rodona blava.`
          : `Toca <b>${wheel}</b>: a cada carta, l'acord que hi ha escrit a sobre, amb el ritme de la carta.${world.inversions ? ' Cada acord a prop de l\'anterior.' : ''}`;
    const context = {
      song: `${mission.songs}. Són acords que ja saps!`,
      structure: (mission.sections?.length ?? 0) > 2
        ? `${mission.songs}. Cada fila és una part de la cançó (${[...new Set(mission.order.map((k) => mission.sections[k].name))].join(', ')}), en l'ordre de la graella.${path.spec?.note ? ` <i>${path.spec.note}</i>` : ''}`
        : `${mission.songs}. <b>Estrofa</b> i <b>tornada</b> tenen rodes diferents: l'ordre és el de la partitura.`,
      mix: `<b>Objectiu del món.</b> ${cards.length > 1 ? `${cards.length} cartes seguides i` : 'Aquesta vegada'} el teclat ja no t'ajuda.`,
      band: '<b>Com amb els companys:</b> la música no s\'atura. Si t\'equivoques, no paris: torna a entrar a la carta següent.',
      pattern: `Pas cap a l'objectiu: <b>${world.goal[0].toLowerCase()}${world.goal.slice(1)}</b>.`,
    }[type];
    setFocus(help === 'shape' ? 'both' : 'card');

    // Listening: one bar for a single chord, otherwise the first row (the whole wheel); both parts of a song.
    const listenBoth = type === 'structure' && mission.sections.length <= 2;
    // Careful: a compacted row shows one card but is still played once per chord,
    // so the example has to play the whole wheel, not the single card.
    const rowLength = (row) => (row.chordBars ?? row.bars).length;
    const demoCount = listenBoth ? rowLength(rowsOf[0]) + rowLength(rowsOf[1]) : chords.length === 1 ? 1 : rowLength(rowsOf[0]);
    const canListen = type !== 'band';

    const preview = () => {
      showScore(true, true);
      score.setBars(playBars, { rows: rowsOf, columns, meterPulses: meter.pulses });
      scoreState = { ball: () => null, data: () => ({ onsets: [] }) };
    };

    const intro = (note = '') => {
      stopSession();
      preview();
      // Two hands: the first chord is always painted on the start screen, as a
      // reference for which octave each hand goes to (during the try it is only
      // painted when the mission gives help).
      view = { marks: help !== 'shape' && !two ? new Map() : two ? handMarks(voicings[0], leftVoicings[0], { symbol: playBars[0].chord }) : level === 3 ? melodicMarks(playBars[0].chord, playBars[0].card) : shapeMarks(voicings[0]), message: '' };
      const drop = tempoDrop.get(mission.id) ?? 0;
      const tried = me()?.log.some((e) => e.m === mission.id && e.p === path.id);
      const boosted = helpFor() === 'shape' && help !== 'shape';
      setFocus(helpFor() === 'shape' ? 'both' : 'card');
      showKeyboard(keysWanted(helpFor()));
      hudRefresh();
      if (boosted) view = { marks: two ? handMarks(voicings[0], leftVoicings[0], { symbol: playBars[0].chord }) : level === 3 ? melodicMarks(playBars[0].chord, playBars[0].card) : shapeMarks(voicings[0]), message: '' };
      startPanel({
        kicker: TYPE_LABEL[type],
        title: mission.title,
        text: `${type === 'pattern' || type === 'mix' ? '' : `${context}<br>`}${what}`,
        list: cardLegend(cards),
        note: [
          note,
          drop ? 'Aquesta vegada anirà <b>més a poc a poc</b>.' : '',
          boosted ? 'I les <b>tecles s\'il·luminen</b> per ajudar-te; quan et surti, tornarem a treure l\'ajuda.' : '',
          help === 'shape' || boosted ? '' : 'Mira les cartes, no el teclat.',
        ].filter(Boolean).join('<br>'),
        seconds: 7,
        start: () => play(canListen),
        buttons: [canListen && tried ? button('Sense escoltar', () => play(false), 'ghost small') : null],
      });
    };

    /** After a missed try the keys light up again ("si t'equivoques, t'ajuda"). */
    const helpFor = () => (help === 'none' && helpBoost.get(mission.id) ? 'shape' : help);

    const play = (listenFirst) => {
      // Listening to the whole wheel: the last bar of the example counts you in.
      // Listening to a single card: one extra bar on the dominant, so you come in
      // resolving instead of hearing the same chord twice.
      const single = listenFirst && demoCount === 1;
      const demo = listenFirst
        ? playBars.slice(0, demoCount).map((bar, k) => ({ ...bar, kind: 'demo', tag: !single && k === demoCount - 1 ? 'Ara tu!' : '', lead: !single && k === demoCount - 1 }))
        : [];
      const ready = single ? [{ ...playBars[0], kind: 'ready', name: 'Ara tu!', tag: '', colour: null, dominant: true }] : [];
      const offset = demo.length + ready.length;
      const bars = [...demo, ...ready, ...playBars.map((bar) => (bar.repeatOf === undefined ? bar : { ...bar, repeatOf: bar.repeatOf + offset }))];
      const rows = [];
      if (listenFirst) {
        const listenRows = listenBoth ? [rowsOf[0], rowsOf[1]] : [{ bars: demo.map((_, k) => k), label: type === 'structure' ? rowsOf[0].label : '' }];
        let k = 0;
        listenRows.forEach((row, r) => {
          const idx = Array.from({ length: listenBoth ? rowLength(row) : row.bars.length }, () => k++);
          if (single && r === listenRows.length - 1) idx.push(k);
          const out = { label: `Escolta${row.label ? ` · ${row.label}` : ''}`, kind: 'listen', bars: idx };
          // The example follows the same rule as what you then play: if the wheel
          // is played on one card, you listen to it on one card too.
          const same = idx.length >= 3 && idx.every((b) => bars[b]?.card === bars[idx[0]].card);
          if (compactCards() && same) {
            for (const b of idx.slice(1)) bars[b].repeatOf = idx[0];
            out.perChord = idx.length;
            out.chordBars = idx;
            out.bars = [idx[0]];
          }
          rows.push(out);
        });
      }
      for (const row of rowsOf) rows.push({ label: row.label, repeat: row.repeat, perChord: row.perChord, chordBars: row.chordBars?.map((b) => b + offset), bars: row.bars.map((b) => b + offset) });
      const allVoicings = listenFirst ? [...voicings.slice(0, demo.length), ...ready.map(() => voicings[0]), ...voicings] : voicings;
      const allLeft = two ? (listenFirst ? [...leftVoicings.slice(0, demo.length), ...ready.map(() => leftVoicings[0]), ...leftVoicings] : leftVoicings) : null;

      const buttons = () => [button('Atura', () => intro(), 'ghost')];
      const statusFor = (phase) => {
        if (phase === 'demo') setStatus({ kicker: 'Escolta', text: `El piano toca ${demoCount === 1 ? 'la carta' : listenBoth ? 'l\'estrofa i la tornada' : type === 'structure' ? 'la primera part' : 'la roda sencera'}. <b>Encara no toquis</b>: mira la pilota.`, tone: 'listen', buttons: buttons() });
        else if (phase === 'ready') setStatus({ kicker: 'A punt', text: '<b>Ara tu!</b> Compta i entra a la primera carta.', tone: 'ready', buttons: buttons() });
        else if (phase === 'count') setStatus({ kicker: 'A punt', text: 'Compta amb la música…', tone: 'ready', buttons: buttons() });
        else if (phase === 'end') setStatus({ kicker: 'Fi', text: 'Escolta com acaba…', buttons: [] });
        else setStatus({ kicker: 'Toca', text: `${what} <span class="play-muted">Espai: pausa · Esc: atura</span>`, buttons: buttons() });
      };
      step = { space: () => session?.togglePause(), escape: () => intro() };
      const tempo = tempoNow();
      const slowed = (tempoDrop.get(mission.id) ?? 0) > 0;
      runMusic({
        bars,
        rows,
        columns,
        level,
        meter: world.meter,
        style,
        tempo,
        help: helpFor(),
        voicings: allVoicings,
        hands: two ? { left: mode, leftVoicings: allLeft } : null,
        onPhase: statusFor,
        onEnd: ({ results, stats }) => {
          const clean = results.filter((r) => r.clean).length;
          const ratio = clean / results.length;
          let got = starsFor(ratio, type);
          if (slowed && got === 3) got = 2;
          // Adapt the tempo of the next try.
          const drop = tempoDrop.get(mission.id) ?? 0;
          let tempoNote = '';
          // Help follows the result: a missed try lights the keys, a good one takes the help away again.
          let helpNote = '';
          if (got === 0 && help === 'none' && !helpBoost.get(mission.id)) {
            helpBoost.set(mission.id, true);
            helpNote = 'Al proper intent les tecles s\'il·luminen.';
          } else if (got >= 2 && helpBoost.get(mission.id)) {
            helpBoost.delete(mission.id);
            helpNote = 'Molt bé! El proper cop, sense tecles il·luminades.';
          }
          if (ratio < 0.5 && drop < TEMPO_MAX_DROP) {
            tempoDrop.set(mission.id, drop + TEMPO_STEP);
            tempoNote = `El proper intent anirà més lent (tempo ${tempoNow()}).`;
          } else if (ratio >= 0.999 && drop > 0) {
            tempoDrop.set(mission.id, Math.max(0, drop - TEMPO_STEP));
            tempoNote = drop - TEMPO_STEP > 0 ? `Molt bé! Ara una mica més ràpid (tempo ${tempoNow()}).` : 'Molt bé! Ara al tempo normal.';
          }
          const recoveries = results.filter((r, k) => k > 0 && r.clean && !results[k - 1].clean).length;
          const need = type === 'band' ? Math.ceil(results.length * 0.6) : Math.ceil(results.length * 0.75);
          finishMission(got, {
            title: got === 3 ? 'Perfecte!' : got === 2 ? 'Molt bé!' : got === 1 ? 'Superada!' : 'Encara no',
            ratio,
            tempo,
            text: [
              `${clean} de ${results.length} compassos sense cap error.`,
              got === 0 ? `Per superar-la en calen ${need}.` : '',
              slowed && got >= 2 ? 'Per a la tercera estrella, fes-ho perfecte al tempo normal.' : '',
              type === 'band' && recoveries ? `Has tornat a entrar ${recoveries} ${recoveries === 1 ? 'vegada' : 'vegades'} després d'un error: així es toca en grup!` : '',
              tempoNote,
              helpNote,
              clean < results.length ? 'Mira les marques de les cartes per veure què ha passat.' : '',
            ].filter(Boolean).join(' '),
            tips: clean === results.length ? [] : tipsFor(stats),
            detail: level === 1 ? null : { results },
            groove: { style, tempo, chords: progression, meter: world.meter ?? '4/4' },
            retry: () => play(false),
            retryLabel: tempoNow() < tempo ? `↻ Torna-hi més lent (${tempoNow()})` : '↻ Torna-ho a provar',
            extra: canListen ? [button('♪ Escolta i toca', () => play(true), 'ghost')] : [],
          });
        },
      });
    };

    intro();
  }

  /**
   * "Estudia una carta": every card of a world, to work on one on its own
   * (useful with the melodic ones, where each card is a different contour).
   */
  function cardStrip(world) {
    const names = [...new Set(world.missions.flatMap((m) => m.cards ?? (m.card ? [m.card] : [])))];
    const cards = names.map(cardByName).filter((c) => c && c.layout);
    if (cards.length < 2) return null;
    return el('div', { className: 'play-cardstrip' }, [
      el('small', { textContent: '🃏 Estudia una carta a part:' }),
      el('div', { className: 'play-cardstrip-row' }, cards.map((card) => {
        const img = el('img', { alt: cardLabel(card), decoding: 'async', src: card.src });
        img.onerror = () => {
          if (card.fullSrc && img.getAttribute('src') !== card.fullSrc) img.src = card.fullSrc;
        };
        const b = el('button', { type: 'button', className: 'play-cardpick', title: `Practica ${cardLabel(card)} tantes vegades com vulguis` }, [img]);
        b.addEventListener('click', () => openMission({
          id: `study:${world.id}:${card.filename}`,
          world,
          type: 'pattern',
          title: `Estudia ${cardLabel(card)}`,
          card: card.filename,
          help: 'shape',
          step: 0,
          study: true,
        }));
        return b;
      })),
    ]);
  }

  function cardLegend(cards) {
    const rows = cards.flatMap((c) => (c.twoHands ? [c.hands.right, c.hands.left] : c.pattern ? [c] : []));
    if (cards.some((c) => c.type === 'melodic')) {
      return [
        '<span class="legend line"></span> Cada punt és una nota. Si la línia <b>puja</b>, la nota és més aguda; si <b>baixa</b>, més greu; si queda a la mateixa altura, la mateixa nota.',
        'Les notes són les de l\'acord escrit a sobre: la més greu és la fonamental.',
      ];
    }
    const has = (test) => rows.some((c) => c.pattern.some((beat) => beat.some(test)));
    const split = rows.some((c) => c.subdivisions_per_beat.some((n) => n > 1));
    return [
      cards.some((c) => c.alternate)
        ? `<span class="legend two"></span> Una sola fila: cada tros <b style="color:${RIGHT_COLOUR}">blau</b> el toca la <b>dreta</b> i cada tros <b style="color:${LEFT_COLOUR}">taronja</b>, l'<b>esquerra</b>, una darrere l'altra dins del mateix temps (com un merengue).`
        : cards.some((c) => c.twoHands) ? `<span class="legend two"></span> Fila <b style="color:${RIGHT_COLOUR}">blava</b>: mà dreta · fila <b style="color:${LEFT_COLOUR}">taronja</b>: mà esquerra.` : null,
      has((v) => v === 0) ? '<span class="legend white"></span> Rodona blanca: silenci.' : null,
      has((v) => v === 2) ? '<span class="legend bar"></span> Barra: mantén la tecla.' : null,
      split ? '<span class="legend half"></span> Rodona partida: dues parts dins del temps.' : null,
    ].filter(Boolean);
  }

  function tipsFor(stats) {
    const tips = [];
    if (stats.missed) tips.push(`${stats.missed} ${stats.missed === 1 ? 'rodona' : 'rodones'} sense tocar (cercle vermell): toca just quan la pilota hi bota.`);
    if (stats.incomplete || stats.spread) tips.push('Algun acord incomplet o amb les tecles separades (cercle taronja): prem les <b>tres</b> tecles exactament alhora.');
    if (stats.wrong) tips.push(`${stats.wrong} nota${stats.wrong === 1 ? '' : 'es'} que no era de l'acord (X amb el nom): mira l'acord escrit sobre la carta.`);
    if (stats.offbeat || stats.extra) tips.push('Has tocat on no tocava (X sense nom): a les rodones blanques, espera.');
    if (stats.contour) tips.push('Alguna nota no anava cap on marca la línia de la carta (↕): si la línia puja, toca una nota més aguda; si baixa, més greu.');
    if (stats.short) tips.push('A les <b>barres</b> cal mantenir les tecles fins al final (mantén!): no les aixequis abans d\'hora.');
    if (stats.rest) tips.push('Aixeca el dit quan s\'acaba la nota (~): als silencis no ha de sonar res.');
    if (stats.early >= 3 && stats.early > stats.late * 2) tips.push('Tens tendència a <b>avançar-te</b>: espera que la pilota toqui la rodona.');
    else if (stats.late >= 3 && stats.late > stats.early * 2) tips.push('Tens tendència a <b>endarrerir-te</b>: prepara la mà abans que arribi la pilota.');
    if (!tips.length) tips.push('Escolta la demostració i segueix la pilota.');
    return tips;
  }

  // ---- Music ---------------------------------------------------------------------------------------------

  /**
   * Plays a list of bars, each { card, chord, kind, name, tag }, after a
   * count-in bar, on the score, and ends with one held chord. kind: 'demo' (the
   * piano plays it), 'ready' (clicks, nothing judged) or 'play' (judged).
   * Calls onPhase('count' | 'demo' | 'ready' | 'play' | 'end') and
   * onEnd({ results, stats }) with one result per played bar.
   */
  async function runMusic({ bars, rows, columns, level, meter: meterText = '4/4', style = 'rock', tempo = speed.tempo, help = 'none', voicings = null, hands = null, onPhase, onEnd }) {
    // hands: { left: 'chord' | 'bass', leftVoicings } for two-hand cards (voicings = right hand).
    stopLounge();
    stopSession();
    const meter = parseTimeSignature(meterText);
    showScore(true, level !== 0 && bars.some((x) => x.kind === 'play'));
    score.setBars(bars, { rows, columns, meterPulses: meter.pulses });
    await Tone.start();
    Tone.getContext().lookAhead = 0.1;
    // A bar marked `dominant` is the one that counts you in: the band plays the V
    // of what comes next, so the entry resolves instead of starting cold.
    const chords = bars.map((bar) => parseChord(bar.dominant ? dominantOf(bar.chord) : bar.chord));
    const voice = (b) => {
      if (voicings?.[b]) return voicings[b];
      const chord = bars[Math.max(0, Math.min(bars.length - 1, b))].chord;
      return level === 1 ? [rootVoicing(chord)[0]] : rootVoicing(chord);
    };
    const deck = { cardForBar: (b) => bars[Math.max(0, Math.min(bars.length - 1, b))].card };
    const backing = createBacking({ style, chords: true, volume: -12, metronome: false, endBar: bars.length });
    // One single note to play: the band moves around it with chords of the key.
    const played = [...new Set(bars.filter((b) => b.kind === 'play').map((b) => b.chord))];
    if (level === 1 && played.length === 1) {
      backing.setHarmony(pedalHarmony(played[0]), Math.max(0, bars.findIndex((b) => b.kind === 'play')));
    }
    const transport = createTransport({ progression: chords, meter, tempo, countInBars: 1, backing });
    const playIndex = [];
    let count = 0;
    bars.forEach((bar, b) => {
      if (bar.kind === 'play') playIndex[b] = count++;
    });
    const results = [];
    let previousChord = null;
    bars.forEach((bar) => {
      if (bar.kind !== 'play') return;
      results.push({ hits: 0, misses: 0, clean: false, chord: bar.chord, prev: previousChord, kinds: [] });
      previousChord = bar.chord;
    });
    const stats = { missed: 0, incomplete: 0, spread: 0, wrong: 0, offbeat: 0, extra: 0, rest: 0, early: 0, late: 0 };
    const review = { marks: new Map(), onsets: new Map(), left: new Map() };
    const addMark = (bar, mark) => {
      if (!review.marks.has(bar)) review.marks.set(bar, []);
      review.marks.get(bar).push(mark);
      score.touch(bar);
    };
    const voiceL = (b) => hands.leftVoicings[Math.max(0, Math.min(hands.leftVoicings.length - 1, b))];
    const onResult = (hand) => (r) => {
      const result = results[playIndex[r.bar]];
      if (!result) return;
      result[r.verdict === 'hit' ? 'hits' : 'misses']++;
      if (r.kind && r.kind !== 'hit') result.kinds.push(r.kind);
      if (r.kind && r.kind !== 'hit') stats[r.kind] = (stats[r.kind] ?? 0) + 1;
      if (r.offsetMs !== undefined && Math.abs(r.offsetMs) > 50) stats[r.offsetMs < 0 ? 'early' : 'late']++;
      if (r.fraction === undefined) return;
      const name = r.note !== undefined ? SOLFEGE[pitchClass(r.note)] : '';
      const label = {
        wrong: name,
        extra: name,
        offbeat: '',
        incomplete: r.missing?.length ? `falta ${r.missing.map((pc) => SOLFEGE[pc]).join(', ')}` : 'incomplet',
        spread: 'juntes!',
        rest: 'aixeca',
        short: 'mantén!',
        contour: `${name} ↕`,
      }[r.kind] ?? '';
      addMark(r.bar, { f: r.fraction, kind: r.kind, label, hand, index: r.index });
    };
    let evaluator;
    if (hands) {
      // One judge per hand, each with its row of the card; notes below middle C are the left hand.
      const handDeck = (hand) => ({ cardForBar: (b) => handCard(deck.cardForBar(b), hand) });
      const right = createEvaluator({ level: level === 1 ? 1 : 2, transport, deck: handDeck('right'), onResult: onResult('right') });
      const left = createEvaluator({ level: hands.left === 'bass' || level === 1 ? 1 : 2, transport, deck: handDeck('left'), onResult: onResult('left') });
      // Which hand a note belongs to: middle C splits the keyboard, but a note clearly
      // nearer the other hand's chord counts for that hand, so choosing a different
      // octave doesn't make a note "missing".
      let at = 0;
      const owner = new Map();
      const nearest = (list, note) => (list?.length ? Math.min(...list.map((n) => Math.abs(n - note))) : 99);
      const pick = (note, timeStamp = null) => {
        const b = Math.max(0, Math.min(bars.length - 1, at));
        const dR = nearest(voice(b), note);
        const dL = nearest(voiceL(b), note);
        // Only one hand has something to play right now (the left holding a long
        // note while the right plays short ones, say): the note is for that one,
        // unless it is clearly in the other hand's part of the keyboard — with
        // the left playing off-beats, a note played early must stay left.
        if (timeStamp !== null) {
          const wantsR = right.expectsNow(timeStamp);
          const wantsL = left.expectsNow(timeStamp);
          if (wantsR && !wantsL && dR <= dL + 7) return right;
          if (wantsL && !wantsR && dL <= dR + 7) return left;
        }
        if (dR <= 7 && dR < dL) return right;
        if (dL <= 7 && dL < dR) return left;
        return note < SPLIT ? left : right;
      };
      evaluator = {
        noteOn: (m) => {
          const judge = pick(m.note, m.timeStamp);
          owner.set(m.note, judge);
          judge.noteOn(m);
        },
        noteOff: (m) => {
          const judge = owner.get(m.note) ?? pick(m.note);
          owner.delete(m.note);
          judge.noteOff(m);
        },
        update: (p) => {
          at = p.bar ?? at;
          right.update(p);
          left.update(p);
        },
        markersForBar: (b) => right.markersForBar(b),
        markersLeft: (b) => left.markersForBar(b),
        guideForBar: (b) => [
          ...right.guideForBar(b).map((item) => ({ ...item, notes: voice(b), hand: 'right' })),
          ...left.guideForBar(b).map((item) => ({ ...item, notes: voiceL(b), hand: 'left' })),
        ],
        allowedPitchClasses: (b) => right.allowedPitchClasses(b),
        setDemo: (from, to) => {
          right.setDemo(from, to);
          left.setDemo(from, to);
        },
        isDemo: (b) => right.isDemo(b),
        forgetFrom: (b) => {
          right.forgetFrom(b);
          left.forgetFrom(b);
        },
      };
    } else {
      evaluator = createEvaluator({ level, transport, deck, onResult: onResult(null) });
    }
    for (const card of new Set(bars.map((b) => b.card).filter(Boolean))) new Image().src = card.src;
    bars.forEach((bar, b) => {
      if (bar.kind === 'play') return;
      evaluator.setDemo(b, b + 1);
      if (bar.kind === 'demo') {
        for (const item of evaluator.guideForBar(b)) {
          const seconds = ((item.endTick - item.startTick) / transport.ticksPerSecond) * 0.92;
          const notes = hands || level === 3 ? item.notes : voice(b);
          transport.scheduleAt(item.startTick, (time) => backing.playDemo(notes, seconds, time));
        }
      }
    });
    const pulseTicks = transport.barTicks / meter.pulses;
    bars.forEach((bar, b) => {
      const counting = bar.kind === 'ready' || bar.lead;
      if (counting || (bar.kind === 'play' && metronome)) {
        for (let p = 0; p < meter.pulses; p++) {
          transport.scheduleAt(transport.barStartTicks(b) + p * pulseTicks, (time) => backing.click(time, p === 0, counting));
        }
      }
    });

    const own = {
      transport,
      backing,
      evaluator,
      help,
      demo: false,
      phase: null,
      done: 0,
      shownBar: null,
      soon: null,
      togglePause() {
        if (transport.paused) transport.resume();
        else {
          transport.pause();
          backing.silence();
        }
      },
    };
    session = own;
    const grace = (GRACE_MS / 1000) * transport.ticksPerSecond;
    let position = transport.positionAt();

    scoreState = {
      ball: () => {
        if (session !== own) return null;
        const p = position;
        if (transport.paused) return { bar: Math.max(0, Math.min(bars.length - 1, p.bar)), f: p.countIn ? 0 : p.barFraction };
        if (p.countIn) return { bar: 0, f: 0, inPlace: p.pulseFraction, count: String(p.pulse + 1) };
        if (p.bar >= bars.length) return null;
        if (bars[p.bar].kind === 'ready') return { bar: p.bar, f: 0, inPlace: p.pulseFraction, count: String(p.pulse + 1) };
        return { bar: p.bar, f: p.barFraction };
      },
      data: (b) => {
        if (bars[b]?.kind !== 'play') return {};
        const live = session === own && b >= own.shownBar - 1;
        const onsets = review.onsets.get(b) ?? (live ? evaluator.markersForBar(b).map((o) => o.status) : []);
        const onsetsLeft = hands ? review.left.get(b) ?? (live ? evaluator.markersLeft(b).map((o) => o.status) : []) : null;
        return { onsets, onsetsLeft, marks: review.marks.get(b) ?? [] };
      },
    };

    own.frame = () => {
      position = transport.positionAt();
      const b = position.bar;
      const index = Math.max(0, Math.min(bars.length - 1, b));
      const bar = bars[index];
      const kind = position.countIn ? (bars[0].kind === 'demo' ? 'demo' : 'count') : b >= bars.length ? 'end' : bar.kind;
      own.demo = kind === 'demo';
      // The last bar of the example is already the count-in: no extra empty bar.
      const phase = kind === 'demo' && bar.lead && !position.countIn ? 'ready' : kind;
      if (phase !== own.phase) {
        own.phase = phase;
        onPhase?.(phase);
      }
      if (b !== own.shownBar) {
        own.shownBar = b;
        if (b < bars.length) score.setCurrent(Math.max(0, b));
        else score.setCurrent(-1);
      }
      // Warn about a new card coming.
      const nextNew = index + 1 < bars.length && bars[index + 1].card !== bar.card && bars[index + 1].kind === 'play' ? index + 1 : null;
      const soon = kind !== 'end' && !position.countIn && position.barFraction > 0.6 ? nextNew : null;
      if (soon !== own.soon) {
        if (own.soon !== null) score.flag(own.soon, 'soon', false);
        if (soon !== null) score.flag(soon, 'soon', true);
        own.soon = soon;
      }
      evaluator.update(position);

      const marks = new Map();
      if (help === 'shape' && (kind === 'play' || kind === 'ready' || kind === 'count')) {
        const nextBar = index + 1 < bars.length ? index + 1 : null;
        const changing = nextBar !== null && position.barFraction > 0.75 && bars[nextBar].chord !== bar.chord && kind === 'play';
        const targetBar = kind === 'play' ? (changing ? nextBar : index) : bars.findIndex((x) => x.kind === 'play');
        const shape = hands
          ? handMarks(voice(targetBar), voiceL(targetBar), { next: changing, symbol: bars[targetBar].chord })
          : level === 3
            ? melodicMarks(bars[targetBar].chord, bars[targetBar].card, changing ? SHAPE_NEXT : SHAPE)
            : shapeMarks(voice(targetBar), changing ? SHAPE_NEXT : SHAPE);
        for (const [n, m] of shape) marks.set(n, m);
      }
      const notes = kind === 'demo'
        ? [index, index + 1].flatMap((k) => (k < bars.length && bars[k].kind === 'demo' ? evaluator.guideForBar(k).map((item) => (hands ? item : level === 3
          // Melodic demo: the keys light up in the colour of the chord's degree, so the notes group by chord.
          ? { ...item, colour: colourOf(bars[k].chord).colour }
          : { ...item, notes: voice(k) })) : []))
        : [];
      view = { marks, message: '', notes, now: kind === 'demo' ? position.ticks : null, window: 3 * transport.ticksPerSecond };

      while (own.done < bars.length && position.ticks > transport.barStartTicks(own.done + 1) + grace) {
        const k = playIndex[own.done];
        if (k !== undefined) {
          review.onsets.set(own.done, evaluator.markersForBar(own.done).map((o) => o.status));
          if (hands) review.left.set(own.done, evaluator.markersLeft(own.done).map((o) => o.status));
          results[k].clean = results[k].misses === 0 && results[k].hits > 0;
          score.setStatus(own.done, results[k].clean ? 'ok' : 'miss');
          score.touch(own.done);
        } else {
          score.setStatus(own.done, 'past');
        }
        own.done++;
      }
      if (own.done >= bars.length) {
        stopSession({ natural: true });
        // Show the played cards, with their marks, from the top.
        score.setCurrent(bars.findIndex((x) => x.kind === 'play'));
        score.setCurrent(-1);
        onEnd?.({ results, stats });
      }
    };
    transport.start();
  }

  /** Stops the music. `natural`: the piece ended, so the final chord rings on. */
  // The band keeps playing between challenges, so the class never goes quiet.
  let lounge = null;

  function stopLounge() {
    if (!lounge) return;
    const { transport, backing } = lounge;
    lounge = null;
    try {
      transport.dispose();
      backing.silence();
      setTimeout(() => backing.dispose(), 2000);
    } catch {
      // the audio context may already be gone
    }
  }

  /** A quiet groove under the panels, at the tempo of what was just played. */
  function startLounge({ style = 'rock', tempo = speed.tempo, chords = ['C'], meter = '4/4' }) {
    stopLounge();
    if (!grooveOn) return;
    try {
      const m = parseTimeSignature(meter);
      const backing = createBacking({ style, chords: true, volume: -20, metronome: false });
      const transport = createTransport({ progression: chords.map(parseChord), meter: m, tempo, countInBars: 0, backing });
      transport.start();
      lounge = { transport, backing };
    } catch {
      lounge = null;
    }
  }

  function stopSession({ natural = false } = {}) {
    if (!session) return;
    const { transport, backing } = session;
    const own = session;
    session = null;
    transport.dispose();
    if (!natural) backing.silence();
    setTimeout(() => backing.dispose(), 3000);
    if (own.soon !== null) score.flag(own.soon, 'soon', false);
    score.setCurrent(-1);
    view = { ...view, notes: [], now: null };
  }

  // ---- Improvisa -------------------------------------------------------------------------------------------
  // The band plays a wheel and you invent over it. Nothing is judged: the game
  // only offers notes on the keyboard, suggests things to try and, at the end,
  // tells you in plain words what you did.

  const IMPROV_KEY = 'rockin.play.improv';
  const improvCfg = (() => {
    try {
      const saved = JSON.parse(storage.get(IMPROV_KEY) ?? '{}');
      return { mode: 'lliure', guide: 'acord', song: 'rockin', ...saved };
    } catch {
      return { mode: 'lliure', guide: 'acord', song: 'rockin' };
    }
  })();
  const saveImprov = () => storage.set(IMPROV_KEY, JSON.stringify(improvCfg));

  /** A wheel written by hand ("C Am F G", "Do Lam Fa Sol", "C | G | Am | F"). */
  function readWheel(text) {
    const SOLF = { do: 'C', re: 'D', mi: 'E', fa: 'F', sol: 'G', la: 'A', si: 'B' };
    const joined = text.replace(/\b(do|re|mi|fa|sol|la|si)([#b♯♭]?)\s+m\b/gi, '$1$2m');
    const tokens = joined.split(/[\s,|–-]+/).map((t) => t.trim()).filter(Boolean);
    return tokens.map((token) => {
      const cat = /^(do|re|mi|fa|sol|la|si)([#b♯♭]?)(.*)$/i.exec(token);
      const symbol = cat ? `${SOLF[cat[1].toLowerCase()]}${cat[2].replace('♯', '#').replace('♭', 'b')}${cat[3]}` : token;
      parseChord(symbol); // throws with a message in Catalan when it can't be read
      return symbol;
    });
  }

  /** "Inventa la teva roda": the student's own wheel for improvising. */
  function customWheelBox() {
    const current = improvCfg.custom?.wheel ?? [];
    const input = el('input', { type: 'text', value: current.map(chordName).join(' '), placeholder: 'p. ex. Do La m Fa Sol', spellcheck: false });
    const preview = el('div', { className: 'play-goal-chords' });
    const error = el('p', { className: 'play-note bad-text' });
    const styleSelect = el('select', {}, STYLES.filter((x) => x.id !== 'metronome').map((x) => new Option(x.name, x.id)));
    styleSelect.value = improvCfg.custom?.style ?? 'rock';
    const tempoInput = el('input', { type: 'number', min: 50, max: 160, value: improvCfg.custom?.tempo ?? 90 });
    const refresh = () => {
      try {
        const wheel = readWheel(input.value);
        preview.replaceChildren(...wheel.map((c) => chordChip(c, keyOf({ progression: wheel.join('|') }))));
        error.textContent = '';
        return wheel;
      } catch (e) {
        preview.replaceChildren();
        error.textContent = e.message;
        return null;
      }
    };
    input.addEventListener('input', refresh);
    const palette = ['C', 'Dm', 'Em', 'F', 'G', 'Am', 'D', 'E', 'A', 'Bb', 'Bm', 'Gm'].map((c) => {
      const b = el('button', { type: 'button', className: 'play-chip-add', textContent: `+ ${chordName(c)}` });
      b.addEventListener('click', () => {
        input.value = `${input.value.trim()} ${chordName(c)}`.trim();
        refresh();
      });
      return b;
    });
    const save = button('✨ Improvisa sobre aquesta roda', () => {
      const wheel = refresh();
      if (!wheel || !wheel.length) {
        error.textContent = error.textContent || 'Escriu almenys un acord.';
        return;
      }
      improvCfg.custom = { wheel, style: styleSelect.value, tempo: Math.max(50, Math.min(160, Number(tempoInput.value) || 90)) };
      improvCfg.song = 'custom';
      saveImprov();
      showMap();
    });
    refresh();
    return el('div', { className: 'play-improv-custom' }, [
      el('h3', { textContent: '✏️ Inventa la teva roda' }),
      el('p', { className: 'play-note', textContent: 'Escriu els acords en l\'ordre que vulguis (Do, La m, Sib… o C, Am, Bb…) o afegeix-los amb els botons. Un compàs per acord.' }),
      input,
      el('div', { className: 'play-chip-row' }, [
        ...palette,
        (() => {
          const b = el('button', { type: 'button', className: 'play-chip-add', textContent: '⌫' , title: 'Treu l\'últim acord' });
          b.addEventListener('click', () => {
            input.value = input.value.trim().split(/\s+/).slice(0, -1).join(' ');
            refresh();
          });
          return b;
        })(),
      ]),
      preview,
      error,
      el('div', { className: 'play-improv-custom-row' }, [
        el('label', { className: 'play-field' }, [el('span', { textContent: 'Estil' }), styleSelect]),
        el('label', { className: 'play-field' }, [el('span', { textContent: 'Tempo' }), tempoInput]),
        save,
      ]),
    ]);
  }

  /** The wheels to improvise over: your own first, then ROCKIN and every song. */
  function improvSongs() {
    const own = improvCfg.custom?.wheel?.length ? [{
      key: 'custom',
      name: 'La teva roda',
      sub: 'inventada a Improvisa',
      wheel: improvCfg.custom.wheel,
      chordKey: keyOf({ progression: improvCfg.custom.wheel.join('|') }),
      style: improvCfg.custom.style ?? 'rock',
      tempo: improvCfg.custom.tempo ?? null,
      meter: '4/4',
      own: true,
    }] : [];
    return [...own, ...jamSongs()];
  }

  function showImprov() {
    const songs = improvSongs();
    const song = songs.find((s) => s.key === improvCfg.song) ?? songs[0];
    const chooser = (items, current, onPick) => el('div', { className: 'play-improv-choice' }, items.map((item) => {
      const b = el('button', {
        type: 'button',
        className: `play-chip-big${item.id === current ? ' on' : ''}`,
      }, [el('strong', { textContent: item.label }), el('small', { textContent: item.note })]);
      b.addEventListener('click', () => onPick(item.id));
      return b;
    }));
    const songCard = (s) => {
      const b = el('button', { type: 'button', className: `play-song${s.book ? ' book' : ''}${s.key === song.key ? ' on' : ''}` }, [
        el('span', { className: 'play-song-icon', textContent: s.own ? '✏️' : s.key === 'rockin' ? '🎸' : s.book ? '📖' : '♬' }),
        el('strong', { textContent: s.name }),
        s.sub ? el('small', { className: 'play-song-artist', textContent: s.sub }) : null,
        el('div', { className: 'play-goal-chords' }, s.wheel.map((c) => chordChip(c, s.chordKey))),
      ]);
      b.addEventListener('click', () => {
        improvCfg.song = s.key;
        saveImprov();
        showMap();
      });
      return b;
    };
    setChildren(mapScreen,
      teacherBannerEl(),
      el('div', { className: 'play-hello' }, [
        el('div', { className: 'play-hello-text' }, [
          el('div', { className: 'play-kicker', textContent: 'Improvisa' }),
          el('h2', { textContent: 'Inventa per sobre de la banda' }),
          el('p', { className: 'play-note', textContent: 'Aquí no hi ha cartes ni estrelles: la banda toca una roda i tu hi poses el que vulguis. El teclat et pot marcar quines notes hi encaixen.' }),
          handsChip(),
        ]),
        el('div', { className: 'play-resume' }, [
          el('small', { textContent: 'Ara mateix' }),
          el('strong', { textContent: MODES.find((m) => m.id === improvCfg.mode)?.label ?? '' }),
          el('span', { className: 'play-note', textContent: `${song.name} · ${GUIDES.find((g) => g.id === improvCfg.guide)?.label}` }),
          button('▶ Comença', () => startImprov(song)),
        ]),
      ]),
      el('div', { className: 'play-world' }, [
        el('h3', { textContent: 'Com vols tocar-hi' }),
        chooser(MODES, improvCfg.mode, (id) => {
          improvCfg.mode = id;
          saveImprov();
          showMap();
        }),
      ]),
      el('div', { className: 'play-world' }, [
        el('h3', { textContent: 'Què et marca el teclat' }),
        chooser(GUIDES, improvCfg.guide, (id) => {
          improvCfg.guide = id;
          saveImprov();
          showMap();
        }),
      ]),
      el('div', { className: 'play-world' }, [
        el('h3', { textContent: 'Sobre quina roda' }),
        customWheelBox(),
        el('p', { className: 'play-note', textContent: 'També pots triar la roda de ROCKIN, les cançons del llibre i els camins que hagis creat a Cançons (surten tots aquí sota).' }),
        el('div', { className: 'play-songs' }, songs.map(songCard)),
      ]),
      el('div', { className: 'play-map-foot' }, [
        me()?.teacher ? null : button(`No ets ${me()?.name ?? ''}? Canvia`, () => {
          screen = 'who';
          showMap();
        }, 'ghost small'),
      ]),
    );
    step = null;
    toTop();
  }

  /** Runs one improvisation. `song` comes from jamSongs(). */
  async function startImprov(song) {
    stopAnimation();
    stopSession();
    stopLounge();
    cancelAutoNext();
    const meter = parseTimeSignature(song.meter);
    const key = song.chordKey ?? 'C';
    const wheel = song.wheel.length ? song.wheel : ['C'];
    const tempo = Math.max(60, Math.min(120, song.tempo ? Math.round(song.tempo * (speed.tempo / 76) * (meter.compound ? 0.8 : 1)) : speed.tempo));
    const mode = improvCfg.mode;
    // "Reptes": one prompt at a time, as long as you want. Nothing stops by
    // itself; "Un altre repte" says how the last one went and brings a new one.
    const newChallenge = (not) => {
      const pool = CHALLENGES.filter((c) => c !== not);
      return pool[Math.floor(Math.random() * pool.length)];
    };
    let challenge = mode === 'reptes' ? newChallenge(null) : null;
    let challengeStats = emptyStats();
    let challengeFrom = 0;
    let challengeNote = '';
    const world = { id: 'improv', title: 'Improvisa', goal: song.name, progression: wheel.join(' | '), chords: [...new Set(wheel)], level: 2, meter: song.meter, style: song.style, missions: [] };
    path = { ...path, key };
    mission = { id: `improv:${song.key}`, type: 'band', title: 'Improvisa', world, index: -1, step: 0, study: true };
    mapScreen.hidden = true;
    missionScreen.hidden = false;
    showScore(false);
    showKeyboard(true);
    keyboard.setKeyRange([48, 84]);
    feedback = new Map();
    missionStars.textContent = '';
    setFocus('keys');
    view = { marks: new Map(), message: '' };

    const stats = emptyStats();
    let bars = 0;
    let stopped = false;
    const phrase = { notes: [], from: -1 };

    const hudNow = (text) => {
      hud.replaceChildren(
        el('div', { className: 'play-hud-text' }, [
          el('small', { textContent: `Improvisa · ${MODES.find((m) => m.id === mode)?.label}` }),
          el('strong', { textContent: song.name }),
        ]),
        el('div', { className: 'play-hud-goal' }, [
          el('small', { textContent: 'La roda' }),
          el('div', { className: 'play-goal-chords' }, wheel.map((c) => chordChip(c, key, c === text ? 'now' : 'on'))),
        ]),
        hudTools(
          button('🧭 Improvisa', () => {
            stopSession();
            screen = 'improv';
            showMap();
          }, 'ghost small'),
          keysButton(),
        ),
      );
    };
    hudNow(wheel[0]);

    await Tone.start();
    Tone.getContext().lookAhead = 0.1;
    const chords = wheel.map(parseChord);
    const backing = createBacking({ style: song.style ?? 'rock', chords: true, volume: -12, metronome: false });
    const transport = createTransport({ progression: chords, meter, tempo, countInBars: 1, backing });
    const pulses = meter.pulses;
    // Call and response: the question lasts half the wheel (at least two bars)
    // and the answer the other half.
    const barsPerBlock = Math.max(2, Math.ceil(wheel.length / 2));

    const finish = () => {
      if (stopped) return;
      stopped = true;
      closeStats(stats, Math.max(1, bars));
      stopSession();
      setFocus('keys');
      view = { marks: new Map(), message: '' };
      const lines = readStats(stats);
      const done = challenge?.check ? challenge.check(closeStats(challengeStats, Math.max(1, bars - challengeFrom))) : null;
      setPanel({
        kicker: 'Improvisa',
        title: challenge ? (done === false ? 'Gairebé!' : 'Fet!') : 'Molt bé!',
        text: [
          challenge ? `<b>El repte:</b> ${challenge.text}` : '',
          challenge && done !== false ? challenge.ok : '',
          challenge && done === false ? 'Aquesta vegada no ha sortit del tot; el repte segueix aquí quan vulguis.' : '',
        ].filter(Boolean).join('<br>'),
        list: lines,
        buttons: [
          button('↻ Una altra', () => startImprov(song)),
          button('🧭 Improvisa', () => {
            screen = 'improv';
            showMap();
          }, 'ghost'),
        ],
      });
      step = { escape: () => { screen = 'improv'; showMap(); } };
    };

    const nextOne = () => {
      if (!challenge) return;
      const done = challenge.check ? challenge.check(closeStats(challengeStats, Math.max(1, bars - challengeFrom))) : null;
      challengeNote = done === false ? 'L\'anterior encara no ha sortit del tot; ja hi tornaràs. ' : `✓ ${challenge.ok} `;
      challenge = newChallenge(challenge);
      challengeStats = emptyStats();
      challengeFrom = bars;
      own.phase = '';
    };
    const buttons = () => [
      mode === 'reptes' ? button('🎲 Un altre repte', nextOne, 'ghost') : null,
      button('Prou, ja he acabat', finish, 'ghost'),
    ].filter(Boolean);
    const own = {
      transport,
      backing,
      demo: false,
      help: 'improv', // not 'none': the keys colour themselves as you play
      shownBar: -1,
      phase: '',
      evaluator: {
        noteOn: ({ note, timeStamp }) => {
          const p = transport.positionAt(timeStamp);
          if (p.countIn || p.bar < 0) return;
          if (mode === 'dialeg' && Math.floor(p.bar / barsPerBlock) % 2 === 0) return; // the piano is talking
          const counted = { note, f: p.barFraction, bar: p.bar, chordSymbol: wheel[mod(p.bar, wheel.length)], guide: improvCfg.guide, key, pulses };
          countNote(stats, counted);
          if (challenge) countNote(challengeStats, counted);
        },
        noteOff: () => {},
        update: () => {},
        allowedPitchClasses: (bar) => guideNotes(wheel[mod(Math.max(0, bar), wheel.length)], key, improvCfg.guide === 'res' ? 'escala' : improvCfg.guide).full,
      },
      togglePause: () => {
        if (transport.paused) transport.resume();
        else transport.pause();
      },
      frame: () => {
        const p = transport.positionAt();
        const bar = p.bar;
        if (bar < 0) {
          if (own.phase !== 'count') {
            own.phase = 'count';
            setStatus({ kicker: 'A punt', text: 'Compta amb la música…', tone: 'ready', buttons: buttons() });
          }
          return;
        }
        const symbol = wheel[mod(bar, wheel.length)];
        const block = Math.floor(bar / barsPerBlock);
        const listening = mode === 'dialeg' && block % 2 === 0;
        const phase = `${bar}:${listening}`;
        if (bar !== own.shownBar) {
          own.shownBar = bar;
          bars = bar + 1;
          hudNow(symbol);
          // The keyboard offers the notes that fit this chord.
          const { full, strong } = guideNotes(symbol, key, improvCfg.guide);
          const marks = new Map();
          for (let n = 48; n <= 84; n++) {
            const pc = pitchClass(n);
            if (strong.includes(pc)) marks.set(n, { fill: true, colour: SHAPE, text: '' });
            else if (full.includes(pc)) marks.set(n, { fill: false, colour: SHAPE, text: '' });
          }
          view = { marks, message: '' };
        }
        if (listening && block !== phrase.from) {
          // A new call: the piano invents a short question over this chord.
          phrase.from = block;
          phrase.notes = callPhrase(symbol, key, { pulses, bars: barsPerBlock }).map((x) => ({ ...x, done: false }));
        }
        if (listening) {
          const at = (bar % barsPerBlock) * pulses + p.pulse + (p.pulseFraction ?? 0);
          for (const item of phrase.notes) {
            if (item.done || item.at > at) continue;
            item.done = true;
            playNotes([item.note]);
            // The question is also seen: the key lights up while it sounds.
            feedback.set(item.note, 'good');
            setTimeout(() => feedback.delete(item.note), 420);
          }
        }
        if (phase !== own.phase) {
          own.phase = phase;
          const chordText = `Ara sona <b>${chordName(symbol)}</b>.`;
          if (mode === 'dialeg') {
            setStatus(listening
              ? { kicker: 'Escolta', text: `${chordText} <b>Escolta la pregunta</b> i contesta als ${barsPerBlock} compassos següents.`, tone: 'listen', buttons: buttons() }
              : { kicker: 'Contesta', text: `${chordText} <b>Ara tu!</b> Contesta com vulguis: imita-ho o canvia-ho.`, tone: 'ready', buttons: buttons() });
          } else if (mode === 'reptes') {
            setStatus({ kicker: 'Repte', text: `${challengeNote}<b>Repte:</b> ${challenge.text} ${chordText} <span class="play-muted">Quan vulguis, un altre repte o prou.</span>`, buttons: buttons() });
          } else {
            setStatus({ kicker: 'Improvisa', text: `${chordText} Toca el que vulguis: el teclat et marca les notes que hi encaixen. La banda no s'atura fins que tu diguis prou. <span class="play-muted">Espai: pausa</span>`, buttons: buttons() });
          }
        }
      },
    };
    session = own;
    step = { space: () => own.togglePause(), escape: finish };
    setStatus({ kicker: 'A punt', text: 'Compta amb la música…', tone: 'ready', buttons: buttons() });
    if (challenge) {
      setPanel({
        kicker: 'Repte',
        title: 'Improvisa',
        text: challenge.text,
        note: `Sobre ${song.name}, tanta estona com vulguis: tu decideixes quan canviar de repte i quan acabar.`,
        buttons: buttons(),
      });
    }
    transport.start();
    toTop();
  }

  // ---- Per frame ---------------------------------------------------------------------------------------------

  const NO_DATA = () => ({});
  function frame() {
    if (root.hidden || missionScreen.hidden) return;
    if (session) session.frame();
    if (scoreState && !scoreBox.hidden) score.frame(scoreState.ball(), scoreState.data ?? NO_DATA);
    drawAnimation(performance.now());
    const held = getHeld();
    const pressed = new Map();
    let allowed = null;
    if (session && !session.demo && session.help !== 'none') {
      const position = session.transport.positionAt();
      if (!position.countIn) allowed = session.evaluator.allowedPitchClasses(position.bar);
    }
    for (const n of held) pressed.set(n, feedback.get(n) ?? (allowed ? (allowed.includes(pitchClass(n)) ? 'good' : 'bad') : 'neutral'));
    const demoRunning = view.now !== null && view.now !== undefined;
    keyboard.draw({
      pressed,
      labels: getLabels(),
      marks: view.marksFn ? view.marksFn(performance.now()) : view.marks,
      message: view.message,
      names: view.names ?? names,
      lane: false,
      now: demoRunning ? view.now : null,
      window: view.window ?? 1,
      notes: view.notes ?? [],
      revision: demoRunning ? 'demo' : null,
    });
    piano.classList.toggle('demo', demoRunning);
  }

  return {
    show(next = 'juga') {
      root.hidden = false;
      document.body.classList.add('play-theme');
      if (next !== section) {
        section = next;
        mission = null;
        screen = homeScreen();
      }
      if (!mission) showMap();
    },
    /** Opens the teacher's guide (from the home page). */
    openGuide() {
      guideBack = 'home';
      screen = 'guide';
      mission = null;
      showMap();
    },
    get section() {
      return section;
    },
    hide() {
      stopSession();
      cancelAutoNext();
      root.hidden = true;
      document.body.classList.remove('play-theme');
    },
    /** The cards finished loading: a saved custom path can be built now. */
    cardsReady() {
      if (!root.hidden && !mission) showMap();
    },
    frame,
    noteOn(message) {
      // Playing the keyboard while the countdown runs doesn't stop it: you can
      // try the chord out and the next challenge still arrives on its own.
      if (session?.demo) {
        // Playing during the example: remind to wait.
        const b = session.transport.positionAt().bar;
        score.shake(Math.max(0, b));
        return;
      }
      if (session && !session.transport.paused) session.evaluator.noteOn(message);
      step?.noteOn?.(message);
    },
    noteOff(message) {
      if (session && !session.demo && !session.transport.paused) session.evaluator.noteOff(message);
      step?.noteOff?.(message);
      if (!session) feedback.delete(message.note);
    },
    key(event) {
      if (root.hidden) return false;
      if (event.target?.matches?.('input, select, textarea')) return false;
      if (event.code === 'Space' && step?.space) {
        cancelAutoNext();
        step.space();
        return true;
      }
      if ((event.key === 'f' || event.key === 'F') && !missionScreen.hidden) {
        toggleFullscreen();
        return true;
      }
      if (event.key === 'Escape' && !missionScreen.hidden) {
        if (document.fullscreenElement === root || document.fullscreenElement === missionScreen) {
          document.exitFullscreen?.();
          return true;
        }
        cancelAutoNext();
        if (step?.escape) step.escape();
        else showMap();
        return true;
      }
      return false;
    },
    get session() {
      return session;
    },
    setKeyHooks(down, up) {
      hooks.keyDown = down;
      hooks.keyUp = up;
    },
  };
}
