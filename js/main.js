// Wires the page together: settings form, game modes, card display, transport,
// MIDI input, on-screen keyboard and evaluation feedback.

import { noteName, parseProgression, parseTimeSignature, pitchClass } from './theory.js';
import { TIERS, cardLabel, createDeck, loadCards, playableCards, tierOf } from './cards.js';
import { KEY_OFFSETS, attachComputerKeyboard, connectMidi } from './midi.js';
import { STYLES, createBacking, pedalHarmony } from './backing.js';
import { createTransport, outputLatencyMs, scheduling, setExtraLatency } from './transport.js';
import { LEVELS, createEvaluator } from './evaluator.js';
import { derivedCard, twoHandCards, twoHandJudge } from './twohands.js';
import { TWO_HANDS_RANGE, leftHandVoicing, rightHandVoicing } from './voicing.js';

// "Què toques" 5–7: two hands with two-row cards (blue = right, orange = left), as in Juga.
const HAND_LEVELS = {
  5: { left: 'chord', name: 'Dues mans: el mateix acord' },
  6: { left: 'bass', name: 'Dues mans: l\'esquerra fa el baix' },
  7: { left: 'bass', own: true, name: 'Dues mans: cada mà el seu ritme' },
};
const levelInfo = (level) => LEVELS[level] ?? { cardType: 'rhythmic', name: HAND_LEVELS[level].name };
import { createInstrument } from './instrument.js';
import { createPlayhead } from './playhead.js';
import { createProgressionEditor } from './progression-editor.js';
import { createKeyboard } from './keyboard.js';
import { createLearn } from './learn.js';
import { createPlay } from './play.js';
import {
  EXAM_PASS_STARS,
  HELP,
  helpIndex,
  PASS_ROUNDS,
  buildMap,
  createProgress,
  defaultTarget,
  examRounds,
  findTarget,
  nextCardInTier,
  renderMap,
  starText,
  starsFor,
  targetLabel,
  trackKey,
} from './challenge.js';

const COUNT_IN_BARS = 1;
const LANE_SECONDS = 3; // how far ahead the moving notes show
const ROUND_GRACE_MS = 400; // late verdicts of a round's last note still count for that round

const $ = (id) => document.getElementById(id);
const ui = {
  form: $('setup'),
  progression: $('progression'),
  tempo: $('tempo'),
  tempoLabel: $('tempo-label'),
  tempoDown: $('tempo-down'),
  tempoUp: $('tempo-up'),
  style: $('style'),
  styleHint: $('style-hint'),
  backingVolume: $('backing-volume'),
  backingChords: $('backing-chords'),
  level: $('level'),
  difficulty: $('difficulty'),
  cardChange: $('card-change'),
  help: $('help'),
  helpHint: $('help-hint'),
  inversions: $('inversions'),
  roundBanner: $('round-banner'),
  nextCard: $('next-card'),
  skipCard: $('skip-card'),
  nextImage: $('next-image'),
  nextLabel: $('next-label'),
  fullscreen: $('fullscreen'),
  gameView: $('game-view'),
  learnView: $('learn-view'),
  homeView: $('home-view'),
  playView: $('play-view'),
  guideNote: $('guide-note'),
  challengePanel: $('challenge-panel'),
  challengeMap: $('challenge-map'),
  challengeStatus: $('challenge-status'),
  unlockAll: $('unlock-all'),
  resetProgress: $('reset-progress'),
  demo: $('demo'),
  start: $('start'),
  stop: $('stop'),
  error: $('error'),
  midiStatus: $('midi-status'),
  keyboardSound: $('keyboard-sound'),
  soundHint: $('sound-hint'),
  stage: $('stage'),
  chords: $('chords'),
  cardImage: $('card-image'),
  countIn: $('count-in'),
  verdict: $('verdict'),
  hits: $('hits'),
  misses: $('misses'),
  orientation: $('orientation'),
  latency: $('latency'),
  latencyLabel: $('latency-label'),
  audioInfo: $('audio-info'),
  result: $('result'),
  resultTitle: $('result-title'),
  resultStars: $('result-stars'),
  resultText: $('result-text'),
  resultOk: $('result-ok'),
};

const storage = {
  get(key) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch {
      // storage unavailable: the setting just isn't remembered
    }
  },
};

const playhead = createPlayhead($('playhead'));
const keyboard = createKeyboard($('piano'), {
  onKeyDown: (note, timeStamp) => {
    unlockAudio();
    handleNoteOn({ note, velocity: 90, timeStamp, source: 'piano de la pantalla' });
  },
  onKeyUp: (note, timeStamp) => handleNoteOff({ note, velocity: 0, timeStamp, source: 'piano de la pantalla' }),
});
const progress = createProgress();
let cards = [];
let session = null;
let verdictTimer;
let instrument = null;
const notesDown = new Map(); // note -> how many inputs hold it
let keyLabels = new Map();
// Playing with the computer letters is an option (off by default): the letters on the keys can confuse.
const NO_LABELS = new Map();
let computerKeys = storage.get('rockin.computerKeys') === 'yes';
const shownLabels = () => (computerKeys ? keyLabels : NO_LABELS);
let challengeTarget = null;

// ---- Settings controls ------------------------------------------------------

createProgressionEditor({
  container: $('progression-editor'),
  textInput: ui.progression,
  onError: showError,
  initial: ui.progression.value,
  // A known song also sets a fitting backing style and tempo.
  onSong: (song) => {
    ui.style.value = song.style;
    ui.style.dispatchEvent(new Event('change'));
    setTempo(song.tempo);
  },
});

for (const style of STYLES) ui.style.append(new Option(style.name, style.id));
const showStyleHint = () => {
  ui.styleHint.textContent = STYLES.find((s) => s.id === ui.style.value)?.hint ?? '';
};
showStyleHint();

const setTempo = (value) => {
  const tempo = Math.min(240, Math.max(30, Math.round(value)));
  ui.tempo.value = String(tempo);
  ui.tempoLabel.textContent = String(tempo);
};
ui.tempo.addEventListener('input', () => setTempo(Number(ui.tempo.value)));
ui.tempoDown.addEventListener('click', () => setTempo(Number(ui.tempo.value) - 5));
ui.tempoUp.addEventListener('click', () => setTempo(Number(ui.tempo.value) + 5));

// Style, volume and piano can change while the music plays.
ui.style.addEventListener('change', () => {
  showStyleHint();
  session?.backing.setStyle(ui.style.value);
});
ui.backingVolume.addEventListener('input', () => session?.backing.setVolume(Number(ui.backingVolume.value)));
ui.backingChords.addEventListener('change', () => session?.backing.setChords(ui.backingChords.checked));

const mode = () => ui.form.elements.mode.value;
const meterValue = () => ui.form.elements.meter.value;

function settingsChanged() {
  const challenge = mode() === 'challenge';
  ui.form.classList.toggle('challenge', challenge);
  ui.challengePanel.hidden = !challenge;
  ui.guideNote.hidden = ui.level.value !== '3';
  ui.form.classList.toggle('chords-level', ['2', '4', '5', '6', '7'].includes(ui.level.value));
  showHelpHint();
  refreshMap();
}
for (const input of ui.form.querySelectorAll('input[name="mode"], input[name="meter"]')) input.addEventListener('change', settingsChanged);
ui.level.addEventListener('change', settingsChanged);

ui.unlockAll.checked = progress.unlockAll;
ui.unlockAll.addEventListener('change', () => {
  progress.setUnlockAll(ui.unlockAll.checked);
  refreshMap();
});
ui.resetProgress.addEventListener('click', () => {
  if (!window.confirm('Segur que vols esborrar tot el progrés dels reptes?')) return;
  progress.reset();
  challengeTarget = null;
  refreshMap();
});

// Keyboard help: how much the on-screen keyboard shows.
function showHelpHint() {
  const help = HELP.find((h) => h.id === ui.help.value);
  ui.helpHint.textContent = `${help.name}: ${help.hint}.` + (mode() === 'challenge' ? " Als reptes finals sempre es juga només amb la carta." : '');
  storage.set('rockin.help', ui.help.value);
}
if (HELP.some((h) => h.id === storage.get('rockin.help'))) ui.help.value = storage.get('rockin.help');
ui.help.addEventListener('change', showHelpHint);
const currentHelp = () => (session?.target?.kind === 'exam' ? 'none' : ui.help.value);

// Sections: home, the guided game ("Juga"), and the studio (game settings and
// the introductions to notes and chords).
let learn = null;
let play = null;
let view = 'home';
for (const tab of document.querySelectorAll('.view-tab')) {
  tab.addEventListener('click', () => setView(tab.dataset.view));
}
document.getElementById('guide-link')?.addEventListener('click', () => {
  setView('play', 'juga');
  play?.openGuide();
});
for (const door of document.querySelectorAll('[data-go]')) {
  door.addEventListener('click', () => setView(door.dataset.go, door.dataset.section));
}
function setView(next, section = 'juga') {
  if (next === view && (next !== 'play' || play?.section === section)) return;
  view = next;
  for (const tab of document.querySelectorAll('.view-tab')) {
    tab.classList.toggle('active', tab.dataset.view === view);
    tab.setAttribute('aria-pressed', String(tab.dataset.view === view));
  }
  document.body.dataset.view = view;
  ui.homeView.hidden = view !== 'home';
  ui.gameView.hidden = view !== 'game';
  ui.learnView.hidden = view !== 'learn';
  if (view !== 'game') stop();
  if (view === 'play') {
    play ??= createPlay({
      root: ui.playView,
      getCards: () => cards,
      playNotes,
      getLabels: () => shownLabels(),
      getHeld: () => new Set(notesDown.keys()),
      storage,
    });
    play.setKeyHooks(
      (note, timeStamp) => {
        unlockAudio();
        handleNoteOn({ note, velocity: 90, timeStamp, source: 'piano de la pantalla' });
      },
      (note, timeStamp) => handleNoteOff({ note, velocity: 0, timeStamp, source: 'piano de la pantalla' }),
    );
    play.show(section);
  } else {
    play?.hide();
  }
  window.scrollTo({ top: 0 });
  if (view === 'learn') {
    stop();
    learn ??= createLearn({
      root: $('learn-sections'),
      keyboard: createKeyboard($('learn-piano'), {
        onKeyDown: (note, timeStamp) => {
          unlockAudio();
          handleNoteOn({ note, velocity: 90, timeStamp, source: 'piano de la pantalla' });
        },
        onKeyUp: (note, timeStamp) => handleNoteOff({ note, velocity: 0, timeStamp, source: 'piano de la pantalla' }),
      }),
      playNotes,
    });
  } else {
    learn?.stop();
  }
}

/** Plays notes on the student's instrument: together, then one by one. */
async function playNotes(notes, { arpeggio = false } = {}) {
  await Tone.start();
  instrument ??= createInstrument();
  notes.forEach((n) => instrument.noteOn(n, 90));
  setTimeout(() => notes.forEach((n) => instrument.noteOff(n)), 900);
  if (!arpeggio) return;
  notes.forEach((n, i) => {
    setTimeout(() => instrument.noteOn(n, 90), 1100 + i * 380);
    setTimeout(() => instrument.noteOff(n), 1100 + i * 380 + 340);
  });
}

// Full screen: the card, the chords and the keyboard.
let fullscreenLeftAt = 0;
ui.fullscreen.addEventListener('click', () => {
  if (document.fullscreenElement) document.exitFullscreen();
  else (ui.stage.requestFullscreen ?? ui.stage.webkitRequestFullscreen)?.call(ui.stage);
});
document.addEventListener('fullscreenchange', () => {
  const on = document.fullscreenElement === ui.stage;
  ui.stage.classList.toggle('is-fullscreen', on);
  ui.fullscreen.textContent = on ? '✕ Surt de pantalla completa' : '⛶ Pantalla completa';
  if (!on) fullscreenLeftAt = performance.now();
  // The result dialog must live inside the full-screen element to be seen.
  (on ? ui.stage : document.body).append(ui.result);
});

// Extra audio delay (Bluetooth etc.), remembered in this browser.
function setLatency(value) {
  const ms = Math.max(-50, Math.min(300, Number(value) || 0));
  ui.latency.value = String(ms);
  ui.latencyLabel.textContent = String(ms);
  setExtraLatency(ms);
  storage.set('rockin.latency', String(ms));
}
setLatency(storage.get('rockin.latency') ?? 0);
ui.latency.addEventListener('input', () => setLatency(ui.latency.value));

// A small readout of the audio timing, to spot problems.
setInterval(() => {
  if (Tone.getContext().state !== 'running') {
    ui.audioInfo.textContent = '';
    return;
  }
  const out = outputLatencyMs();
  const late = Math.round(scheduling.worstLateMs);
  scheduling.worstLateMs = 0;
  const parts = [`retard de sortida ${out} ms`];
  if (late > 0) parts.push(`base programada tard: ${late} ms`);
  ui.audioInfo.textContent = `· ${parts.join(' · ')}`;
  ui.audioInfo.classList.toggle('warn', late > 0 || out > 80);
  ui.audioInfo.title = out > 80 ? 'Retard de sortida alt: si fas servir Bluetooth, prova amb cable o ajusta la sincronia.' : '';
}, 1000);

// Keyboard orientation, remembered in this browser.
function setOrientation(value) {
  keyboard.setOrientation(value);
  ui.stage.classList.toggle('vertical', value === 'vertical');
  ui.orientation.textContent = value === 'vertical' ? '↔ Horitzontal' : '↕ Vertical';
  ui.orientation.dataset.value = value;
  storage.set('rockin.orientation', value);
}
setOrientation(storage.get('rockin.orientation') === 'vertical' ? 'vertical' : 'horizontal');
ui.orientation.addEventListener('click', () => setOrientation(ui.orientation.dataset.value === 'vertical' ? 'horizontal' : 'vertical'));

// Settings that only take effect when a game starts are locked while it runs.
const lockedWhilePlaying = () => [
  ...ui.form.querySelectorAll('input[name="meter"], input[name="mode"]'),
  ui.tempo,
  ui.tempoDown,
  ui.tempoUp,
  ui.level,
  ui.difficulty,
  ui.inversions,
  ui.cardChange,
];

function updateControls() {
  const playing = Boolean(session);
  ui.form.classList.toggle('playing', playing);
  for (const control of lockedWhilePlaying()) control.disabled = playing;
  ui.stop.disabled = !playing;
  ui.start.textContent = !playing ? '▶ Comença' : session.transport.paused ? '▶ Continua' : '❚❚ Pausa';
  const exam = playing ? session.target?.kind === 'exam' : mode() === 'challenge' && challengeTarget?.kind === 'exam';
  ui.demo.disabled = exam || Boolean(playing && session.demoUntil !== null && session.demoUntil > (session.lastBar ?? -1));
  const cardTarget = playing ? session.target?.kind === 'card' : mode() === 'challenge' && challengeTarget?.kind === 'card';
  ui.skipCard.hidden = !cardTarget;
  ui.demo.title = exam ? "Al repte final no hi ha exemples" : 'El programa toca la carta durant una ronda sencera; aquesta ronda no puntua';
}

ui.form.addEventListener('submit', (event) => {
  event.preventDefault();
  togglePlay();
});
ui.stop.addEventListener('click', stop);
ui.demo.addEventListener('click', requestDemo);
ui.skipCard.addEventListener('click', () => {
  ui.skipCard.blur();
  skipCard();
});
ui.resultOk.addEventListener('click', () => {
  ui.result.hidden = true;
});

// Space starts and pauses, Escape stops. Not while typing in a text box.
window.addEventListener(
  'keydown',
  (event) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.target.closest?.('textarea, select, input:not([type="checkbox"]):not([type="radio"]):not([type="range"])')) return;
    if (view === 'play') {
      if ((event.code === 'Space' || event.key === 'Escape') && !event.repeat) {
        if (document.activeElement instanceof HTMLButtonElement) document.activeElement.blur();
        if (play?.key(event)) event.preventDefault();
      }
      if (event.code === 'Space') event.preventDefault();
      return;
    }
    if (view !== 'game') return;
    if (event.code === 'Space') {
      event.preventDefault();
      if (event.repeat) return;
      if (document.activeElement instanceof HTMLButtonElement) document.activeElement.blur();
      if (!ui.result.hidden) {
        ui.result.hidden = true;
        return;
      }
      togglePlay();
    } else if (event.key === 'Escape') {
      // In full screen, Esc belongs to the browser (it leaves full screen).
      if (document.fullscreenElement || performance.now() - fullscreenLeftAt < 300) return;
      if (!ui.result.hidden) ui.result.hidden = true;
      else stop();
    }
  },
  true,
);

// Browsers only let audio start from a click or key press on the page (a MIDI
// message does not count). Registered before the computer keyboard, so audio is
// already starting when its first note arrives.
function unlockAudio() {
  if (Tone.getContext().state !== 'running') Tone.start();
}
window.addEventListener('pointerdown', unlockAudio);
window.addEventListener('keydown', unlockAudio);
ui.keyboardSound.addEventListener('change', () => {
  if (!ui.keyboardSound.checked) instrument?.releaseAll();
});

const computerKeysBox = $('computer-keys');
computerKeysBox.checked = computerKeys;
computerKeysBox.addEventListener('change', () => {
  computerKeys = computerKeysBox.checked;
  storage.set('rockin.computerKeys', computerKeys ? 'yes' : 'no');
  computerKeysBox.blur();
});

attachComputerKeyboard({
  enabled: () => computerKeys,
  onNoteOn: handleNoteOn,
  onNoteOff: handleNoteOff,
  onOctaveChange: (base) => {
    keyLabels = new Map(Object.entries(KEY_OFFSETS).map(([key, offset]) => [base + offset, key.toUpperCase()]));
  },
});
connectMidi({ onNoteOn: handleNoteOn, onNoteOff: handleNoteOff, onInputsChanged: showMidiInputs }).catch((error) => {
  ui.midiStatus.textContent = `MIDI no disponible: ${error.message}`;
  console.warn('[MIDI]', error);
});

loadCards().then(
  (loaded) => {
    cards = loaded;
    console.log(`[Cards] loaded ${cards.length} cards from data/cards.json`);
    settingsChanged();
    play?.cardsReady();
  },
  (error) => showError(`${error.message}. Obre la carpeta amb un servidor http (npm start) en lloc d'obrir el fitxer directament.`),
);

settingsChanged();
updateControls();
document.body.dataset.view = view;
requestAnimationFrame(frame);

// ---- Challenge map ------------------------------------------------------------

function currentTrack() {
  const level = Number(ui.level.value);
  const meter = parseTimeSignature(meterValue());
  let pool = playableCards(cards, { cardType: levelInfo(level).cardType, meter });
  if (HAND_LEVELS[level]) {
    const fourFour = meter.pulses === 4 && !meter.compound;
    pool = HAND_LEVELS[level].own ? (fourFour ? twoHandCards() : []) : pool.map(derivedCard);
  }
  const key = trackKey(level, meter);
  return { level, meter, pool, key, map: buildMap(pool, progress, key) };
}

function refreshMap() {
  if (mode() !== 'challenge' || !cards.length) {
    updateControls();
    return;
  }
  const { map } = currentTrack();
  challengeTarget = findTarget(map, challengeTarget) ?? defaultTarget(map);
  renderMap(ui.challengeMap, map, challengeTarget, (target) => {
    challengeTarget = target;
    refreshMap();
  });
  updateControls();
}

// ---- Game -------------------------------------------------------------------

function togglePlay() {
  if (!session) {
    start();
  } else if (session.transport.paused) {
    session.transport.resume();
    updateControls();
  } else {
    session.transport.pause();
    session.backing.silence();
    updateControls();
  }
}

async function start({ demoFirst = false } = {}) {
  let settings;
  try {
    settings = readSettings();
  } catch (error) {
    showError(error.message);
    return;
  }
  // Browsers only start audio from a user gesture, so this stays the first await.
  await Tone.start();
  stop();
  showError(null);
  ui.result.hidden = true;
  // Enough look-ahead that a busy page never schedules the backing late. What is
  // drawn and judged follows the audible clock, so this adds no visible delay.
  Tone.getContext().lookAhead = 0.1;

  const { progression, meter, tempo, level, changeEvery, pool, target, track } = settings;
  const deck = createDeck(pool, { progressionLength: progression.length, changeEvery });
  if (target?.kind === 'card') deck.setFixed(target.card, 0);
  else if (changeEvery === 'pass') deck.setFixed(deck.pick(), 0);
  preloadCards(deck, 0);

  const backing = createBacking({
    style: ui.style.value,
    chords: ui.backingChords.checked,
    volume: Number(ui.backingVolume.value),
  });
  // Level 1 on a single chord: the student holds one note, so the band moves
  // around it with chords of the same key instead of repeating the same one.
  if (level === 1 && new Set(progression.map((c) => c.symbol)).size === 1) {
    backing.setHarmony(pedalHarmony(progression[0].symbol));
  }
  const transport = createTransport({ progression, meter, tempo, countInBars: COUNT_IN_BARS, backing });
  const hands = HAND_LEVELS[level];
  // Two hands: show from F2 to C6 so both hands fit, also in full screen.
  keyboard.setKeyRange(hands ? TWO_HANDS_RANGE : null);
  const evaluator = hands
    ? twoHandJudge({
        make: (lv, handDeck, onResult) => createEvaluator({ level: lv, transport, deck: handDeck, onResult }),
        deck,
        onResult: showResult,
        left: hands.left,
        voices: (bar) => {
          const symbol = transport.chordForBar(bar).symbol;
          return { right: rightHandVoicing(symbol), left: leftHandVoicing(symbol, hands.left) };
        },
      })
    : createEvaluator({ level, transport, deck, onResult: showResult, inversions: ui.inversions.checked });
  session = {
    transport,
    backing,
    deck,
    evaluator,
    level,
    target,
    track,
    roundLength: progression.length,
    rounds: new Map(), // round -> { hits, misses }
    marks: new Map(), // bar -> marks on the card
    nextRound: 0, // first round not yet scored
    countFrom: 0, // rounds before this one don't count (card just changed)
    streak: 0,
    changeEvery,
    holdUntilRound: 0, // the card can't change before this round (after an example)
    roundHelp: new Map(), // round -> most help used (lowest HELP index)
    examRounds: target?.kind === 'exam' ? examRounds(progression.length) : null,
    demoUntil: null,
    lastBar: null,
    shownBar: null,
    shownCard: null,
    hits: 0,
    misses: 0,
  };
  if (demoFirst) scheduleDemo(0);

  ui.chords.replaceChildren(...progression.map((chord) => Object.assign(document.createElement('li'), { textContent: chord.symbol })));
  ui.hits.textContent = '0';
  ui.misses.textContent = '0';
  ui.guideNote.hidden = level !== 3;
  ui.roundBanner.hidden = true;
  ui.nextCard.hidden = true;
  updateControls();
  showChallengeStatus();
  console.log(`[Game] Level ${level}: ${levelInfo(level).name} · style ${ui.style.value} · ${target ? targetLabel(target) : 'free play'}`);
  // Starting with Enter leaves the focus in a text box, where the piano keys would type.
  document.activeElement?.blur();
  ui.chords.scrollIntoView({ behavior: 'smooth', block: 'start' });
  transport.start();
}

function readSettings() {
  if (!cards.length) throw new Error("Les cartes encara no s'han carregat");
  const tempo = Number(ui.tempo.value);
  if (!Number.isFinite(tempo) || tempo < 30 || tempo > 240) throw new Error("El tempo ha d'estar entre 30 i 240");
  const progression = parseProgression(ui.progression.value);
  const track = currentTrack();
  const base = { progression, meter: track.meter, tempo, level: track.level, track };

  if (mode() === 'challenge') {
    const target = challengeTarget;
    if (!target) throw new Error('Tria una carta del camí de reptes');
    if (target.kind === 'exam') {
      const pool = track.pool.filter((card) => tierOf(card) === target.tier);
      return { ...base, pool, target, changeEvery: 'bar' };
    }
    return { ...base, pool: [target.card], target, changeEvery: 'loop' };
  }

  const difficulty = ui.difficulty.value;
  const pool = difficulty === 'all' ? track.pool : track.pool.filter((card) => tierOf(card) === difficulty);
  if (!pool.length) {
    const available = TIERS.filter((t) => track.pool.some((card) => tierOf(card) === t.id)).map((t) => t.name.toLowerCase());
    throw new Error(
      `No hi ha cartes de dificultat «${ui.difficulty.selectedOptions[0].textContent}» per a ${track.level === 3 ? 'aquest nivell' : track.meter.label}. ` +
        `Hi ha: ${available.join(', ') || 'cap'}.`,
    );
  }
  return { ...base, pool, target: null, changeEvery: ui.cardChange.value };
}

function stop() {
  if (!session) return;
  const { transport, backing } = session;
  session = null;
  transport.dispose();
  backing.silence();
  setTimeout(() => backing.dispose(), 1500); // let notes already scheduled finish
  playhead.clear();
  highlightChord(-1);
  ui.countIn.textContent = '';
  ui.challengeStatus.hidden = true;
  ui.nextCard.hidden = true;
  updateControls();
  refreshMap();
  console.log('[Transport] stopped');
}

function frame() {
  requestAnimationFrame(frame);
  if (view === 'learn') {
    learn?.draw(new Set(notesDown.keys()), shownLabels());
    return;
  }
  if (view === 'play') {
    play?.frame();
    return;
  }
  if (view === 'home') return;
  if (!session || !(session.transport.running || session.transport.paused)) {
    drawKeyboard(null);
    return;
  }
  const { transport, deck, evaluator } = session;
  const position = transport.positionAt();
  if (position.bar !== session.shownBar) enterBar(position);
  evaluator.update(position);
  // The card keeps the marks of the bar just played until the next one starts to be judged.
  const marks = session.marks.get(position.bar) ?? [];
  playhead.draw({ position, card: deck.cardForBar(position.bar), markers: evaluator.markersForBar(position.bar), markersLeft: evaluator.markersLeft?.(position.bar) ?? null, marks });
  ui.countIn.textContent = transport.paused ? 'Pausa' : position.countIn ? String(position.pulse + 1) : '';
  drawKeyboard(position);
  if (!position.countIn) {
    const used = helpIndex(currentHelp());
    session.roundHelp.set(position.loop, Math.min(session.roundHelp.get(position.loop) ?? used, used));
  }
  scoreRounds(position);
}

function drawKeyboard(position) {
  const pressed = new Map();
  const allowed = position && !position.countIn ? session.evaluator.allowedPitchClasses(position.bar) : null;
  for (const note of notesDown.keys()) {
    pressed.set(note, allowed ? (allowed.includes(pitchClass(note)) ? 'good' : 'bad') : 'neutral');
  }
  if (!position) {
    keyboard.draw({ pressed, labels: shownLabels(), message: 'Prem Espai o ▶ Comença: les notes que has de tocar arribaran fins al teclat' });
    return;
  }

  const { transport, evaluator, deck } = session;
  const help = currentHelp();
  if (help !== 'full' && help !== 'cards') {
    // No timing on the keyboard: the rhythm has to be read from the card.
    const marks = new Map();
    if (help === 'keys') {
      for (const item of evaluator.guideForBar(Math.max(0, position.bar))) {
        for (const n of item.notes) marks.set(n, { colour: '#ffc012' });
      }
    }
    const message = help === 'none' ? 'Només la carta: llegeix-la i toca' : 'Els punts marquen les tecles de l\'acord: el ritme, llegeix-lo a la carta';
    keyboard.draw({ pressed, labels: shownLabels(), marks, message });
    return;
  }
  const window = LANE_SECONDS * transport.ticksPerSecond;
  const firstBar = Math.max(0, position.bar - 1);
  // The keyboard keeps two lanes' worth of music ready.
  const lastBar = Math.max(0, Math.floor((position.ticks + 2 * window - transport.barStartTicks(0)) / transport.barTicks));
  const notes = [];
  const bars = [];
  for (let bar = firstBar; bar <= lastBar; bar++) {
    // The notes take the colour of the card's circles: blue (right hand) or orange (left hand).
    const items = evaluator.guideForBar(bar);
    notes.push(...(session.level === 3 ? items : items.map((item) => (item.hand ? item : { ...item, hand: 'right' }))));
    const example = evaluator.isDemo(bar) ? ' · escolta' : '';
    bars.push({ tick: transport.barStartTicks(bar), label: `${bar + 1} · ${transport.chordForBar(bar).symbol}${example}` });
  }
  // Changes whenever a note is judged or the bars in view change, so the keyboard
  // knows when to redraw its notes.
  let cards = null;
  if (help === 'cards') {
    cards = [];
    for (let bar = firstBar; bar <= lastBar; bar++) {
      const items = evaluator.guideForBar(bar);
      cards.push({
        startTick: transport.barStartTicks(bar),
        endTick: transport.barStartTicks(bar + 1),
        pattern: deck.cardForBar(bar).pattern,
        notes: items[0]?.notes ?? [],
        onsets: items,
      });
    }
  }
  const revision = `${session.hits}|${session.misses}|${firstBar}|${lastBar}|${session.demoUntil}|${session.target?.card?.filename ?? ''}|${help}`;
  keyboard.draw({ now: position.ticks, window, notes, bars, cards, pressed, labels: shownLabels(), revision });
}



// Only the next couple of cards are fetched ahead: loading every card image at
// once makes the browser stop for memory clean-up, which delays the music.
const preloaded = new Map();
function preloadCards(deck, fromBar) {
  for (let bar = fromBar; bar < fromBar + 2; bar++) {
    const card = deck.cardForBar(bar);
    if (preloaded.has(card.src)) continue;
    const image = new Image();
    image.decoding = 'async';
    image.src = card.src;
    preloaded.set(card.src, image);
    if (preloaded.size > 12) preloaded.delete(preloaded.keys().next().value);
  }
}

function enterBar(position) {
  session.shownBar = position.bar;
  session.lastBar = position.bar;
  const card = session.deck.cardForBar(position.bar);
  preloadCards(session.deck, position.bar + 1);
  if (card !== session.shownCard) {
    session.shownCard = card;
    ui.cardImage.onerror = () => {
      // No light copy yet (tools/make-web-assets.py not run): use the original.
      if (ui.cardImage.getAttribute('src') !== card.fullSrc) ui.cardImage.src = card.fullSrc;
    };
    ui.cardImage.src = card.src;
    ui.cardImage.alt = `Carta ${cardLabel(card)}`;
    ui.cardImage.hidden = false;
  }
  highlightChord(position.countIn ? -1 : position.chordIndex);
  showNextCard(position.bar, card);
  ui.stage.classList.toggle('demo-bar', session.evaluator.isDemo(position.bar));
  updateControls();
  showChallengeStatus();
  if (position.countIn) {
    console.log(`[Transport] count-in · first card ${card.filename}`);
  } else {
    console.log(
      `[Transport] bar ${position.bar + 1} (time round ${position.loop + 1}) · chord ${position.chord.symbol} · card ${card.filename}\n` +
        `            ${session.evaluator.describeBar(position.bar)}`,
    );
  }
}

/** Shows the next different card coming up in the next two rounds, if any. */
function showNextCard(bar, card) {
  const { deck, roundLength } = session;
  const horizon = Math.max(2, roundLength * 2);
  for (let b = Math.max(0, bar + 1); b <= bar + horizon; b++) {
    const next = deck.cardForBar(b);
    if (next === card) continue;
    ui.nextImage.onerror = () => {
      if (ui.nextImage.getAttribute('src') !== next.fullSrc) ui.nextImage.src = next.fullSrc;
    };
    if (ui.nextImage.dataset.card !== next.filename) {
      ui.nextImage.src = next.src;
      ui.nextImage.dataset.card = next.filename;
      ui.nextImage.alt = `Carta ${cardLabel(next)}`;
    }
    const barsAway = b - bar;
    ui.nextLabel.textContent = barsAway === 1 ? `al compàs següent (${b + 1})` : `d'aquí a ${barsAway} compassos (compàs ${b + 1})`;
    ui.nextCard.classList.toggle('soon', barsAway === 1);
    ui.nextCard.hidden = false;
    return;
  }
  ui.nextCard.hidden = true;
}

// ---- Example ("Escolta") ----------------------------------------------------------

function requestDemo() {
  if (!session) {
    start({ demoFirst: true });
    return;
  }
  if (session.target?.kind === 'exam') return;
  const position = session.transport.positionAt();
  // A whole round, starting with the next one.
  const from = position.countIn ? 0 : (position.loop + 1) * session.roundLength;
  // The card on screen, unless a new one is already on its way (it was just
  // earned): then the example is of the new card.
  const card =
    session.target?.kind === 'card'
      ? session.target.card
      : session.changeEvery === 'pass'
        ? session.deck.cardForBar(from)
        : session.deck.cardForBar(Math.max(0, position.bar));
  scheduleDemo(from, card);
  updateControls();
  showChallengeStatus();
}

function scheduleDemo(from, card = session.deck.cardForBar(from)) {
  const { transport, evaluator, backing, roundLength, deck } = session;
  const to = from + roundLength;
  // The example plays the card on screen, and the round after it asks for that
  // same card again.
  deck.setFixed(card, from, to + roundLength);
  evaluator.forgetFrom(from);
  session.holdUntilRound = Math.max(session.holdUntilRound, to / roundLength + 1);
  evaluator.setDemo(from, to);
  session.demoUntil = to;
  for (let bar = from; bar < to; bar++) {
    for (const item of evaluator.guideForBar(bar)) {
      const seconds = ((item.endTick - item.startTick) / transport.ticksPerSecond) * 0.92;
      transport.scheduleAt(item.startTick, (time) => backing.playDemo(item.notes, seconds, time));
    }
  }
  if (session.shownCard) showNextCard(session.shownBar, session.shownCard);
  console.log(`[Game] example in bars ${from + 1}-${to}`);
}

// ---- Challenge scoring -----------------------------------------------------------

function scoreRounds(position) {
  const { transport, roundLength } = session;
  const grace = (ROUND_GRACE_MS / 1000) * transport.ticksPerSecond;
  while (session && position.ticks > transport.barStartTicks((session.nextRound + 1) * roundLength) + grace) {
    const round = session.nextRound++;
    if (session.target?.kind === 'exam') finishExamRound(round);
    else if (session.target) finishCardRound(round);
    else finishFreeRound(round);
  }
}

function roundHasDemo(round) {
  const from = round * session.roundLength;
  for (let bar = from; bar < from + session.roundLength; bar++) if (session.evaluator.isDemo(bar)) return true;
  return false;
}

/** Result of one round: { hits, misses, clean }, or null if it doesn't count. */
function roundResult(round) {
  if (round < session.countFrom) return null;
  if (roundHasDemo(round)) {
    showRoundBanner('info', 'Volta d\'exemple', 'Ara et toca a tu amb la mateixa carta.');
    return null;
  }
  const { hits = 0, misses = 0, slips = 0 } = session.rounds.get(round) ?? {};
  // One slip of timing (a note a bit early or late) doesn't spoil the round:
  // repeating a whole card for that is discouraging.
  return { hits, misses, slips, clean: hits > 0 && (misses === 0 || (misses === 1 && slips === 1)) };
}

const errorsText = (n) => `${n} error${n === 1 ? '' : 's'}`;

/** The round from which a new card may appear. */
function nextCardRound() {
  return Math.max(session.nextRound + 1, session.holdUntilRound);
}

function switchCard(card, fromRound) {
  const fromBar = fromRound * session.roundLength;
  session.deck.setFixed(card, fromBar);
  session.evaluator.forgetFrom(fromBar);
  session.countFrom = fromRound;
  session.streak = 0;
  if (session.shownCard) showNextCard(session.shownBar, session.shownCard);
}

/** Jumps over a card that doesn't come out: the next one opens, and this one stays pending (⏭). */
function skipCard() {
  if (mode() !== 'challenge') return;
  const target = session ? session.target : challengeTarget;
  if (target?.kind !== 'card') return;
  const track = session ? session.track : currentTrack();
  progress.markSkipped(track.key, target.card);
  const map = buildMap(track.pool, progress, track.key);
  const next = nextCardInTier(map, target);
  console.log(`[Game] skipped ${cardLabel(target.card)} → ${next ? cardLabel(next.card) : 'exam'}`);
  if (!session) {
    challengeTarget = next ?? defaultTarget(map);
    refreshMap();
    return;
  }
  if (next) {
    const fromRound = nextCardRound();
    switchCard(next.card, fromRound);
    session.target = next;
    challengeTarget = next;
    showRoundBanner('info', `${cardLabel(target.card)} saltada ⏭`, `Següent: ${cardLabel(next.card)}, a partir de la volta ${fromRound + 1}. La carta saltada la pots tornar a provar quan vulguis.`);
    showChallengeStatus();
    refreshMapQuietly();
    return;
  }
  challengeTarget = map.find((t) => t.id === target.tier)?.examUnlocked ? { kind: 'exam', tier: target.tier } : defaultTarget(map);
  stop();
  showDialog('Carta saltada ⏭', '', challengeTarget?.kind === 'exam'
    ? 'Ja no queden més cartes per provar en aquesta dificultat: pots fer el repte final (prem Espai) o tornar a les cartes saltades quan vulguis.'
    : 'Ja no queden més cartes per provar en aquesta dificultat. Torna a provar les cartes saltades (⏭) quan vulguis.');
}

/** Redraws the map while playing, so the chips show the new state. */
function refreshMapQuietly() {
  const { map } = currentTrack();
  renderMap(ui.challengeMap, map, challengeTarget, (t) => {
    challengeTarget = t;
    refreshMap();
  });
}

function finishFreeRound(round) {
  const result = roundResult(round);
  if (!result) return;
  console.log(`[Game] round ${round + 1}: ${result.hits} hits, ${result.misses} misses`);
  if (session.changeEvery !== 'pass') {
    if (result.clean) showRoundBanner('good', 'Volta neta!', result.misses ? 'Un peteig de temps perdonat.' : '');
    else showRoundBanner('bad', `Volta amb ${errorsText(result.misses)}`, '');
    return;
  }
  if (!result.clean) {
    showRoundBanner('bad', `Volta amb ${errorsText(result.misses)}`, 'Repetim la mateixa carta.');
    return;
  }
  const current = session.deck.cardForBar(round * session.roundLength);
  const fromRound = nextCardRound();
  switchCard(session.deck.pick(current), fromRound);
  showRoundBanner('good', 'Volta neta!', `Carta nova a la volta ${fromRound + 1}. Mira-la a «Següent carta».`);
}

function finishCardRound(round) {
  const result = roundResult(round);
  if (!result) return;
  const { hits, misses, clean } = result;
  session.streak = clean ? session.streak + 1 : 0;
  console.log(`[Game] round ${round + 1}: ${hits} hits, ${misses} misses → streak ${session.streak}/${PASS_ROUNDS}`);
  if (session.streak < PASS_ROUNDS) {
    if (clean) {
      showRoundBanner('good', `Volta neta (${session.streak} de ${PASS_ROUNDS})`, `${result.misses ? 'Un peteig de temps perdonat. ' : ''}Encara no està desbloquejada: una altra volta neta!`);
    } else {
      showRoundBanner('bad', `Volta amb ${errorsText(misses)}`, `No desbloquejada. Repetim la carta; calen ${PASS_ROUNDS} voltes netes seguides.`);
    }
    showChallengeStatus();
    return;
  }

  const { track, target } = session;
  // The help recorded is the most generous one used in the passing rounds.
  let used = 2;
  for (let r = round - PASS_ROUNDS + 1; r <= round; r++) used = Math.min(used, session.roundHelp.get(r) ?? 0);
  progress.markPassed(track.key, target.card, HELP[used].id);
  const map = buildMap(track.pool, progress, track.key);
  const next = nextCardInTier(map, target);
  if (next) {
    const fromRound = nextCardRound();
    switchCard(next.card, fromRound);
    session.target = next;
    challengeTarget = next;
    showRoundBanner(
      'good',
      `${cardLabel(target.card)} desbloquejada! ${HELP[used].mark}`,
      `Següent: ${cardLabel(next.card)}, a partir de la volta ${fromRound + 1}.` +
        (used < 2 ? ` Per aconseguir ★, supera-la amb l'ajuda «${HELP[2].name}».` : ''),
    );
    showChallengeStatus();
    return;
  }

  const tier = TIERS.find((t) => t.id === target.tier);
  const rounds = examRounds(session.roundLength);
  challengeTarget = { kind: 'exam', tier: target.tier };
  stop();
  showDialog(
    map.find((t) => t.id === target.tier)?.allPassed ? `Has superat totes les cartes «${tier.name}»!` : `Has fet totes les cartes «${tier.name}»!`,
    '',
    `Ara toca el repte final: ${rounds === 1 ? 'una ronda' : `${rounds} rondes`} de la progressió amb una carta diferent a cada compàs. Prem Espai quan estiguis a punt.`,
  );
}

function finishExamRound(round) {
  const done = round + 1;
  const last = session.rounds.get(round) ?? { hits: 0, misses: 0 };
  showRoundBanner(last.misses ? 'bad' : 'good', `Volta ${done} de ${session.examRounds}`, `${last.hits} encerts, ${errorsText(last.misses)}`);
  showChallengeStatus();
  if (done < session.examRounds) return;
  let hits = 0;
  let misses = 0;
  for (const stats of session.rounds.values()) {
    hits += stats.hits;
    misses += stats.misses;
  }
  const ratio = hits + misses ? hits / (hits + misses) : 0;
  const stars = starsFor(ratio);
  const { track, target } = session;
  progress.setExamStars(track.key, target.tier, stars);
  const tier = TIERS.find((t) => t.id === target.tier);
  const passed = stars >= EXAM_PASS_STARS;
  const map = buildMap(track.pool, progress, track.key);
  const nextTier = map[map.findIndex((t) => t.id === target.tier) + 1];
  challengeTarget = passed ? null : target;
  stop();
  showDialog(
    passed ? `Repte final ${tier.name.toLowerCase()} superat!` : `Repte final ${tier.name.toLowerCase()}: encara no`,
    starText(stars),
    `${Math.round(ratio * 100)}% d'encerts (${hits} encerts, ${misses} errors). ` +
      (passed
        ? nextTier
          ? `S'ha obert la dificultat «${nextTier.name}».`
          : 'Has completat totes les dificultats d\'aquest nivell i compàs!'
        : `Calen ${EXAM_PASS_STARS} estrelles (75% d'encerts). Pots repassar les cartes o tornar-ho a provar amb Espai.`),
  );
}

function showChallengeStatus(note = '') {
  const demoActive = Boolean(session && session.demoUntil !== null && session.demoUntil > (session.lastBar ?? -1));
  if (!session || (!session.target && !demoActive)) {
    ui.challengeStatus.hidden = true;
    return;
  }
  const { target } = session;
  const parts = target ? [`<strong>${targetLabel(target)}</strong>`] : [];
  if (!target) {
    // free play: only the example note below
  } else if (target.kind === 'exam') {
    const round = Math.min(session.nextRound + 1, session.examRounds);
    parts.push(`Ronda ${round} de ${session.examRounds}`);
  } else {
    const dots = Array.from({ length: PASS_ROUNDS }, (_, i) => (i < session.streak ? '●' : '○')).join(' ');
    parts.push(`Rondes netes seguides: <span class="dots">${dots}</span>`);
  }
  if (demoActive) {
    const first = session.demoUntil - session.roundLength + 1;
    const bars = first === session.demoUntil ? `al compàs ${first}` : `als compassos ${first}–${session.demoUntil}`;
    parts.push(`♪ Exemple ${bars} (no puntua)`);
  }
  if (note) parts.push(`<em>${note}</em>`);
  ui.challengeStatus.innerHTML = parts.join('<br>');
  ui.challengeStatus.hidden = false;
}

let bannerTimer;
function showRoundBanner(kind, title, text) {
  ui.roundBanner.className = `round-banner ${kind}`;
  ui.roundBanner.replaceChildren(
    Object.assign(document.createElement('strong'), { textContent: title }),
    Object.assign(document.createElement('span'), { textContent: text }),
  );
  ui.roundBanner.hidden = false;
  clearTimeout(bannerTimer);
  bannerTimer = setTimeout(() => {
    ui.roundBanner.hidden = true;
  }, 6000);
}

function showDialog(title, stars, text) {
  ui.resultTitle.textContent = title;
  ui.resultStars.textContent = stars;
  ui.resultStars.hidden = !stars;
  ui.resultText.textContent = text;
  ui.result.hidden = false;
  ui.resultOk.focus();
}

// ---- Input ------------------------------------------------------------------

// The student hears their own notes at any time, not only during a game.
function hearNote({ note, velocity }) {
  if (!ui.keyboardSound.checked) return;
  if (Tone.getContext().state === 'running') {
    instrument ??= createInstrument();
    instrument.noteOn(note, velocity);
    return;
  }
  // Audio is still locked. Ask for a click, and play the note once audio runs if
  // it is still held by then (a key press unlocks audio within milliseconds).
  ui.soundHint.hidden = false;
  Tone.start().then(() => {
    ui.soundHint.hidden = true;
    if (notesDown.has(note)) hearNote({ note, velocity });
  });
}

function handleNoteOn(message) {
  const count = notesDown.get(message.note) ?? 0;
  notesDown.set(message.note, count + 1);
  if (count > 0) return; // already sounding from another input
  hearNote(message);
  console.log(`[MIDI] note on  ${noteName(message.note)} (${message.note}) velocity ${message.velocity} · ${message.source}`);
  if (view === 'play') play?.noteOn(message);
  else if (view === 'learn') learn?.noteOn(message.note, new Set(notesDown.keys()));
  else if (session && !session.transport.paused) session.evaluator.noteOn(message);
}

function handleNoteOff(message) {
  const count = notesDown.get(message.note) ?? 0;
  if (count > 1) {
    notesDown.set(message.note, count - 1);
    return;
  }
  notesDown.delete(message.note);
  instrument?.noteOff(message.note);
  if (view === 'play') play?.noteOff(message);
  else if (view === 'learn') learn?.noteOff(message.note, new Set(notesDown.keys()));
  else if (session && !session.transport.paused) session.evaluator.noteOff(message);
}

// ---- Feedback -----------------------------------------------------------------

function highlightChord(index) {
  [...ui.chords.children].forEach((li, i) => li.classList.toggle('active', i === index));
}

const NOTE_NAMES = ['Do', 'Do♯', 'Re', 'Mi♭', 'Mi', 'Fa', 'Fa♯', 'Sol', 'La♭', 'La', 'Si♭', 'Si'];
const MARK_LABEL = { incomplete: 'incomplet', spread: 'juntes!', rest: 'aixeca', short: 'mantén!' };
function showResult({ verdict, bar, message, kind, fraction, note, missing, hand, index }) {
  if (!session) return;
  // Marks on the card, as in "Juga".
  if (fraction !== undefined || index !== undefined) {
    const name = note !== undefined ? NOTE_NAMES[pitchClass(note)] : '';
    const text = kind === 'wrong' || kind === 'extra' ? name
      : kind === 'contour' ? `${name} ↕`
      : kind === 'incomplete' && missing?.length ? `falta ${missing.map((pc) => NOTE_NAMES[pc]).join(', ')}`
      : MARK_LABEL[kind] ?? '';
    if (!session.marks.has(bar)) session.marks.set(bar, []);
    session.marks.get(bar).push({ f: fraction ?? 0, kind, label: text, hand, index });
  }
  const hit = verdict === 'hit';
  if (hit) session.hits++;
  else session.misses++;
  ui.hits.textContent = session.hits;
  ui.misses.textContent = session.misses;
  const round = Math.floor(bar / session.roundLength);
  const stats = session.rounds.get(round) ?? { hits: 0, misses: 0, slips: 0 };
  stats[hit ? 'hits' : 'misses']++;
  if (!hit && kind === 'offbeat') stats.slips = (stats.slips ?? 0) + 1;
  session.rounds.set(round, stats);
  flash(verdict, hit ? 'Encert' : 'Error', message);
}

function flash(verdict, title, message) {
  ui.verdict.className = `verdict show ${verdict}`;
  ui.verdict.replaceChildren(title, Object.assign(document.createElement('small'), { textContent: message }));
  clearTimeout(verdictTimer);
  verdictTimer = setTimeout(() => ui.verdict.classList.remove('show'), title === 'Carta superada!' ? 2500 : 700);
}

function showMidiInputs(names) {
  ui.midiStatus.textContent = names.length ? `MIDI: ${names.join(', ')}` : 'MIDI: cap teclat connectat';
  ui.midiStatus.classList.toggle('connected', names.length > 0);
}

function showError(message) {
  ui.error.hidden = !message;
  ui.error.textContent = message ?? '';
}

// For debugging from the browser console (and automated tests).
window.rockin = {
  get session() {
    return session;
  },
  get playSession() {
    return play?.session ?? null;
  },
  noteOn: handleNoteOn,
  noteOff: handleNoteOff,
};
