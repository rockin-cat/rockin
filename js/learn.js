// "Aprèn": two short introductions with a mini-game each, following the
// project document (5.2): the names of the keys, and what a chord is and how
// to build one. They use their own on-screen keyboard and the same inputs as
// the game (MIDI, computer keys, mouse).

import { mod, parseChord, pitchClass, noteAtOrAbove } from './theory.js';

const SOLFEGE = ['Do', 'Do#', 'Re', 'Mi♭', 'Mi', 'Fa', 'Fa#', 'Sol', 'La♭', 'La', 'Si♭', 'Si'];
const LETTER = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const WHITE = [0, 2, 4, 5, 7, 9, 11];

const CHORD_TYPES = [
  { suffix: '', name: 'Major', long: 'major', degrees: ['1', '3', '5'] },
  { suffix: 'm', name: 'menor', long: 'menor', degrees: ['1', '♭3', '5'] },
  { suffix: 'dim', name: 'dim', long: 'disminuït', degrees: ['1', '♭3', '♭5'] },
  { suffix: 'aug', name: 'aug', long: 'augmentat', degrees: ['1', '3', '♯5'] },
  { suffix: 'sus2', name: 'sus2', long: 'suspès de 2a', degrees: ['1', '2', '5'] },
  { suffix: 'sus4', name: 'sus4', long: 'suspès de 4a', degrees: ['1', '4', '5'] },
  { suffix: '7', name: '7', long: 'de 7a de dominant', degrees: ['1', '3', '5', '♭7'] },
  { suffix: 'maj7', name: 'maj7', long: 'de 7a major', degrees: ['1', '3', '5', '7'] },
  { suffix: 'm7', name: 'm7', long: 'menor amb 7a', degrees: ['1', '♭3', '5', '♭7'] },
];

const CHORD_SETS = [
  { id: 'white', name: 'Majors de tecles blanques', chords: ['C', 'F', 'G'] },
  { id: 'wheel', name: 'La roda: C G Am F Dm Em', chords: ['C', 'G', 'Am', 'F', 'Dm', 'Em'] },
  { id: 'all', name: 'Tots els majors i menors', chords: LETTER.flatMap((l) => [l, `${l}m`]) },
];

const COLOURS = { root: '#ffc012', tone: '#8fd4ff', good: '#35b36b', bad: '#e25555' };

const el = (tag, props = {}, children = []) => {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
};
const noteLabel = (pc) => `${SOLFEGE[pc]} (${LETTER[pc]})`;
const chordNameCa = (chord, type) => `${SOLFEGE[chord.root]} ${type.long}`;

/** Chord tones stacked upwards from the root, which sits at or above `low`. */
function stack(chord, low = 60) {
  const notes = [noteAtOrAbove(chord.root, low)];
  for (const pc of chord.tones.slice(1)) notes.push(noteAtOrAbove(pc, notes.at(-1) + 1));
  return notes;
}

export function createLearn({ root, keyboard, playNotes }) {
  let activeGame = null; // 'notes' | 'chord' | null
  let marks = new Map();
  let showNames = true;
  let feedback = new Map(); // midi -> 'good' | 'bad' for keys the student holds

  // ---- Part 1: the keys ---------------------------------------------------------------

  const notesScore = { streak: 0, best: 0, target: null, blacks: false };
  const notesTarget = el('div', { className: 'learn-target', textContent: '—' });
  const notesMessage = el('p', { className: 'learn-message' });
  const notesStats = el('p', { className: 'hint' });
  const blacksToggle = el('input', { type: 'checkbox' });
  blacksToggle.addEventListener('change', () => {
    notesScore.blacks = blacksToggle.checked;
  });
  const notesStart = el('button', { type: 'button', textContent: '▶ Troba la nota' });
  notesStart.addEventListener('click', () => {
    activeGame = 'notes';
    notesScore.streak = 0;
    nextNote();
    marks = new Map();
    updateButtons();
  });

  function nextNote() {
    const choices = notesScore.blacks ? [...Array(12).keys()] : WHITE;
    let pc;
    do pc = choices[Math.floor(Math.random() * choices.length)];
    while (pc === notesScore.target && choices.length > 1);
    notesScore.target = pc;
    notesTarget.textContent = noteLabel(pc);
    renderNotesStats();
  }

  function renderNotesStats() {
    notesStats.textContent = `Encerts seguits: ${notesScore.streak} · Millor ratxa: ${notesScore.best}`;
  }

  function notesNoteOn(note) {
    const pc = pitchClass(note);
    if (pc === notesScore.target) {
      feedback.set(note, 'good');
      notesScore.streak++;
      notesScore.best = Math.max(notesScore.best, notesScore.streak);
      notesMessage.textContent = `Molt bé! Això és ${noteLabel(pc)}.`;
      notesMessage.className = 'learn-message good';
      setTimeout(nextNote, 350);
    } else {
      feedback.set(note, 'bad');
      notesScore.streak = 0;
      notesMessage.textContent = `Això és ${noteLabel(pc)}. Busca ${noteLabel(notesScore.target)}.`;
      notesMessage.className = 'learn-message bad';
    }
    renderNotesStats();
  }

  const namesToggle = el('input', { type: 'checkbox', checked: true });
  namesToggle.addEventListener('change', () => {
    showNames = namesToggle.checked;
  });

  const notesSection = el('section', { className: 'panel learn-section' }, [
    el('h2', { textContent: '1 · Les notes del teclat' }),
    el('ul', { className: 'learn-text' }, [
      el('li', { innerHTML: 'El teclat repeteix sempre el mateix grup de <b>12 tecles</b>: 7 blanques i 5 negres.' }),
      el('li', { innerHTML: 'Les blanques són <b>Do, Re, Mi, Fa, Sol, La, Si</b>. Després torna a començar: Do, Re…' }),
      el('li', { innerHTML: 'Les negres van en grups de <b>2</b> i de <b>3</b>. El <b>Do</b> és la tecla blanca just a l\'esquerra del grup de 2.' }),
      el('li', { innerHTML: 'Als acords les notes s\'escriuen amb lletres: <b>C</b>=Do, <b>D</b>=Re, <b>E</b>=Mi, <b>F</b>=Fa, <b>G</b>=Sol, <b>A</b>=La, <b>B</b>=Si.' }),
      el('li', { innerHTML: 'Una tecla negra és un <b>sostingut ♯</b> de la blanca de l\'esquerra o un <b>bemoll ♭</b> de la de la dreta (Do# = Re♭).' }),
    ]),
    el('div', { className: 'learn-row' }, [
      notesStart,
      el('label', { className: 'toggle' }, [blacksToggle, ' També les tecles negres']),
      el('label', { className: 'toggle' }, [namesToggle, ' Mostra els noms a les tecles']),
    ]),
    el('div', { className: 'learn-game' }, [el('span', { className: 'hint', textContent: 'Toca:' }), notesTarget]),
    notesMessage,
    notesStats,
  ]);

  // ---- Part 2: chords ------------------------------------------------------------------

  let exploreRoot = 0;
  let exploreType = CHORD_TYPES[0];
  const exploreTitle = el('div', { className: 'learn-target small' });
  const exploreFormula = el('p', { className: 'learn-formula' });
  const rootRow = el('div', { className: 'picker-buttons' });
  const typeRow = el('div', { className: 'picker-buttons' });
  const listen = el('button', { type: 'button', className: 'secondary', textContent: '♪ Escolta' });
  listen.addEventListener('click', () => {
    const notes = stack(exploreChord());
    playNotes(notes, { arpeggio: true });
  });
  const exploreButton = el('button', { type: 'button', className: 'secondary', textContent: 'Mostra al teclat' });
  exploreButton.addEventListener('click', () => {
    activeGame = null;
    showExplore();
    updateButtons();
  });

  const exploreChord = () => parseChord(LETTER[exploreRoot] + exploreType.suffix);

  function chip(label, active, title, onClick) {
    const button = el('button', { type: 'button', className: `chip${active ? ' active' : ''}`, textContent: label, title });
    button.addEventListener('click', onClick);
    return button;
  }

  function showExplore() {
    const chord = exploreChord();
    const notes = stack(chord);
    marks = new Map(notes.map((n, i) => [n, { colour: i === 0 ? COLOURS.root : COLOURS.tone, text: exploreType.degrees[i] }]));
    exploreTitle.textContent = `${LETTER[exploreRoot]}${exploreType.suffix} · ${chordNameCa(chord, exploreType)}`;
    const steps = notes.slice(1).map((n, i) => n - notes[i]);
    exploreFormula.innerHTML =
      `<b>${notes.map((n) => SOLFEGE[pitchClass(n)]).join(' – ')}</b> ` +
      `(${notes.map((n) => LETTER[pitchClass(n)]).join('–')}) · distàncies: ${steps.join(' + ')} semitons`;
    rootRow.replaceChildren(...LETTER.map((l, pc) => chip(l, pc === exploreRoot, SOLFEGE[pc], () => {
      exploreRoot = pc;
      activeGame = null;
      showExplore();
      updateButtons();
    })));
    typeRow.replaceChildren(...CHORD_TYPES.map((t) => chip(t.name, t === exploreType, t.long, () => {
      exploreType = t;
      activeGame = null;
      showExplore();
      updateButtons();
    })));
  }

  // Build-the-chord game
  const chordGame = { set: CHORD_SETS[1], inversions: true, target: null, streak: 0, best: 0, solved: false, hint: false };
  const chordTarget = el('div', { className: 'learn-target', textContent: '—' });
  const chordMessage = el('p', { className: 'learn-message' });
  const chordStats = el('p', { className: 'hint' });
  const setSelect = el('select', {}, CHORD_SETS.map((set) => new Option(set.name, set.id, false, set === chordGame.set)));
  setSelect.addEventListener('change', () => {
    chordGame.set = CHORD_SETS.find((set) => set.id === setSelect.value);
  });
  const inversionsToggle = el('input', { type: 'checkbox', checked: true });
  inversionsToggle.addEventListener('change', () => {
    chordGame.inversions = inversionsToggle.checked;
  });
  const chordStart = el('button', { type: 'button', textContent: '▶ Construeix l\'acord' });
  chordStart.addEventListener('click', () => {
    activeGame = 'chord';
    chordGame.streak = 0;
    nextChord();
    updateButtons();
  });
  const hintButton = el('button', { type: 'button', className: 'secondary', textContent: 'Pista' });
  hintButton.addEventListener('click', () => {
    if (activeGame !== 'chord' || !chordGame.target) return;
    chordGame.hint = true;
    marks = new Map(stack(chordGame.target).map((n, i) => [n, { colour: i === 0 ? COLOURS.root : COLOURS.tone, text: SOLFEGE[pitchClass(n)] }]));
  });

  function nextChord() {
    const list = chordGame.set.chords;
    let symbol;
    do symbol = list[Math.floor(Math.random() * list.length)];
    while (chordGame.target && symbol === chordGame.target.symbol && list.length > 1);
    chordGame.target = parseChord(symbol);
    chordGame.solved = false;
    chordGame.hint = false;
    marks = new Map();
    const type = CHORD_TYPES.find((t) => t.suffix === symbol.replace(/^[A-G][#b]?/, ''));
    chordTarget.textContent = `${symbol} · ${chordNameCa(chordGame.target, type)}`;
    chordMessage.textContent = 'Toca les 3 notes alhora.';
    chordMessage.className = 'learn-message';
    renderChordStats();
  }

  function renderChordStats() {
    chordStats.textContent = `Encerts seguits: ${chordGame.streak} · Millor ratxa: ${chordGame.best}`;
  }

  function chordCheck(held) {
    const target = chordGame.target;
    if (!target || chordGame.solved) return;
    const wanted = new Set(target.triad);
    const notes = [...held].sort((a, b) => a - b);
    feedback = new Map(notes.map((n) => [n, wanted.has(pitchClass(n)) ? 'good' : 'bad']));
    const wrong = notes.filter((n) => !wanted.has(pitchClass(n)));
    if (wrong.length) {
      chordMessage.textContent = `${wrong.map((n) => SOLFEGE[pitchClass(n)]).join(', ')} no és de l'acord.`;
      chordMessage.className = 'learn-message bad';
      chordGame.streak = 0;
      renderChordStats();
      return;
    }
    const got = new Set(notes.map(pitchClass));
    if (got.size < wanted.size) {
      chordMessage.textContent = `Bé, continua: en falta${wanted.size - got.size > 1 ? 'n' : ''} ${wanted.size - got.size}.`;
      chordMessage.className = 'learn-message';
      return;
    }
    if (!chordGame.inversions && pitchClass(notes[0]) !== target.root) {
      chordMessage.textContent = `Són les notes bones, però la més greu ha de ser ${SOLFEGE[target.root]} (sense inversions).`;
      chordMessage.className = 'learn-message bad';
      return;
    }
    chordGame.solved = true;
    if (!chordGame.hint) {
      chordGame.streak++;
      chordGame.best = Math.max(chordGame.best, chordGame.streak);
    }
    const inverted = pitchClass(notes[0]) !== target.root;
    chordMessage.textContent =
      `Molt bé! ${target.symbol} = ${stack(target).map((n) => SOLFEGE[pitchClass(n)]).join(' – ')}` +
      (inverted ? ' (l\'has tocat en inversió)' : '') +
      (chordGame.hint ? ' · amb pista no compta per a la ratxa' : '');
    chordMessage.className = 'learn-message good';
    renderChordStats();
    setTimeout(() => {
      if (activeGame === 'chord') nextChord();
    }, 1200);
  }

  const chordSection = el('section', { className: 'panel learn-section' }, [
    el('h2', { textContent: '2 · Què és un acord?' }),
    el('ul', { className: 'learn-text' }, [
      el('li', { innerHTML: 'Un <b>acord</b> són 3 notes (o més) que sonen <b>alhora</b>. La nota que li dona el nom és la <b>fonamental</b>.' }),
      el('li', { innerHTML: 'Per fer l\'acord bàsic (tríada): toca la fonamental, <b>salta una tecla blanca</b>, toca la següent, salta\'n una altra i toca la següent. Són les notes <b>1 – 3 – 5</b>. Ex.: <b>C</b> = Do – Mi – Sol.' }),
      el('li', { innerHTML: '<b>Major o menor?</b> Compta totes les tecles (blanques i negres) d\'una nota a l\'altra: major = <b>4 + 3</b> semitons (C: Do→Mi→Sol), menor = <b>3 + 4</b> (Am: La→Do→Mi). La <b>m</b> vol dir menor.' }),
      el('li', { innerHTML: '<b>Inversions:</b> amb les mateixes notes en un altre ordre (Mi – Sol – Do) continua sent l\'acord de C. Serveixen per moure menys la mà d\'un acord a l\'altre.' }),
      el('li', { innerHTML: 'Al joc, el nivell <b>1</b> demana només la fonamental (com un baix), el nivell <b>2</b> l\'acord sencer i el nivell <b>4</b> el baix amb la mà esquerra i l\'acord amb la dreta.' }),
    ]),
    el('div', { className: 'learn-explore' }, [
      el('div', { className: 'picker-row' }, [el('span', { textContent: 'Fonamental' }), rootRow]),
      el('div', { className: 'picker-row' }, [el('span', { textContent: 'Tipus' }), typeRow]),
      el('div', { className: 'learn-row' }, [exploreTitle, listen, exploreButton]),
      exploreFormula,
    ]),
    el('h3', { textContent: 'Joc: construeix l\'acord' }),
    el('div', { className: 'learn-row' }, [
      el('label', {}, ['Acords ', setSelect]),
      el('label', { className: 'toggle' }, [inversionsToggle, ' Accepta inversions']),
      chordStart,
      hintButton,
    ]),
    el('div', { className: 'learn-game' }, [el('span', { className: 'hint', textContent: 'Toca:' }), chordTarget]),
    chordMessage,
    chordStats,
  ]);

  // ---- Part 3: count semitones -------------------------------------------------------------

  const INTERVALS = [
    { id: 'steps', name: 'Puja semitons (1 a 7)' },
    { id: 'thirds', name: 'Terceres: major (4) i menor (3)' },
    { id: 'fifth', name: 'Quintes (7)' },
    { id: 'build', name: 'Construeix un acord comptant' },
  ];
  const countGame = { mode: INTERVALS[0], root: null, want: [], got: 0, label: '', streak: 0, best: 0, waiting: false };
  const countTarget = el('div', { className: 'learn-target small', textContent: '—' });
  const countMessage = el('p', { className: 'learn-message' });
  const countStats = el('p', { className: 'hint' });
  const modeSelect = el('select', {}, INTERVALS.map((m) => new Option(m.name, m.id)));
  modeSelect.addEventListener('change', () => {
    countGame.mode = INTERVALS.find((m) => m.id === modeSelect.value);
    if (activeGame === 'count') nextCount();
  });
  const countStart = el('button', { type: 'button', textContent: '▶ Compta' });
  countStart.addEventListener('click', () => {
    activeGame = 'count';
    countGame.streak = 0;
    nextCount();
    updateButtons();
  });

  const pick = (items) => items[Math.floor(Math.random() * items.length)];
  function nextCount() {
    const rootPc = pick(WHITE);
    const root = 60 + rootPc;
    const mode = countGame.mode.id;
    let steps;
    let label;
    if (mode === 'steps') {
      const n = 1 + Math.floor(Math.random() * 7);
      steps = [n];
      label = `Des del <b>${SOLFEGE[rootPc]}</b>, puja <b>${n}</b> semiton${n === 1 ? '' : 's'}.`;
    } else if (mode === 'thirds') {
      const major = Math.random() < 0.5;
      steps = [major ? 4 : 3];
      label = `Des del <b>${SOLFEGE[rootPc]}</b>, toca la <b>tercera ${major ? 'major' : 'menor'}</b> (${major ? 4 : 3} semitons).`;
    } else if (mode === 'fifth') {
      steps = [7];
      label = `Des del <b>${SOLFEGE[rootPc]}</b>, toca la <b>quinta</b> (7 semitons).`;
    } else {
      const major = Math.random() < 0.5;
      steps = major ? [4, 7] : [3, 7];
      label = `Construeix <b>${SOLFEGE[rootPc]} ${major ? 'major' : 'menor'}</b>: toca la tercera (${steps[0]}) i després la quinta (${major ? '4 + 3' : '3 + 4'} = 7).`;
    }
    Object.assign(countGame, { root, want: steps, got: 0, label, waiting: false });
    marks = new Map([[root, { fill: true, colour: COLOURS.root, text: SOLFEGE[rootPc] }]]);
    countTarget.innerHTML = label;
    countMessage.textContent = 'Compta cada tecla, blanca o negra: cada una és un semitò.';
    countMessage.className = 'learn-message';
    renderCountStats();
  }

  function renderCountStats() {
    countStats.textContent = `Encerts seguits: ${countGame.streak} · Millor ratxa: ${countGame.best}`;
  }

  function countNoteOn(note) {
    if (countGame.waiting) return;
    const { root, want, got } = countGame;
    const distance = mod(note - root, 12);
    if (distance === 0) return; // the root itself: fine, keep counting
    const target = want[got];
    // Show the count from the root, so the student sees the steps.
    const shown = new Map(marks);
    for (let k = 1; k <= distance; k++) {
      if (!shown.has(root + k) || shown.get(root + k).count) shown.set(root + k, { colour: COLOURS.tone, text: String(k), count: true });
    }
    if (distance === target) {
      feedback.set(note, 'good');
      shown.set(root + distance, { fill: true, colour: COLOURS.good, text: SOLFEGE[pitchClass(note)] });
      marks = shown;
      countGame.got++;
      if (countGame.got < want.length) {
        countMessage.textContent = `Molt bé: ${SOLFEGE[pitchClass(note)]} és a ${distance} semitons. Ara la següent!`;
        countMessage.className = 'learn-message good';
        return;
      }
      countGame.streak++;
      countGame.best = Math.max(countGame.best, countGame.streak);
      countMessage.textContent = `Exacte! ${SOLFEGE[pitchClass(note)]} és a ${distance} semitons del ${SOLFEGE[pitchClass(root)]}.`;
      countMessage.className = 'learn-message good';
      countGame.waiting = true;
      if (want.length > 1) playNotes([root, root + want[0], root + want[1]], { arpeggio: true });
      setTimeout(() => {
        if (activeGame === 'count') nextCount();
      }, 1600);
    } else {
      feedback.set(note, 'bad');
      countGame.streak = 0;
      marks = shown;
      countMessage.textContent = `${SOLFEGE[pitchClass(note)]} és a ${distance} semitons del ${SOLFEGE[pitchClass(root)]}; en calen ${target}. Mira els números i torna-hi.`;
      countMessage.className = 'learn-message bad';
      setTimeout(() => {
        if (activeGame === 'count' && !countGame.waiting) {
          marks = new Map([...marks].filter(([, m]) => !m.count));
        }
      }, 1800);
    }
    renderCountStats();
  }

  const countSection = el('section', { className: 'panel learn-section' }, [
    el('h2', { textContent: '3 · Fes-ho tu: compta semitons' }),
    el('ul', { className: 'learn-text' }, [
      el('li', { innerHTML: 'Un <b>semitò</b> és el pas d\'una tecla a la del costat, sigui blanca o negra. Dos semitons fan un <b>to</b>.' }),
      el('li', { innerHTML: 'Des de la fonamental: <b>tercera menor = 3</b> semitons, <b>tercera major = 4</b>, <b>quinta = 7</b>.' }),
      el('li', { innerHTML: 'Amb això pots construir <b>qualsevol</b> acord major (4 + 3) o menor (3 + 4), encara que no te l\'hagis après.' }),
    ]),
    el('div', { className: 'learn-row' }, [el('label', {}, ['Joc ', modeSelect]), countStart]),
    el('div', { className: 'learn-game' }, [countTarget]),
    countMessage,
    countStats,
  ]);

  function updateButtons() {
    notesSection.classList.toggle('playing', activeGame === 'notes');
    chordSection.classList.toggle('playing', activeGame === 'chord');
    countSection.classList.toggle('playing', activeGame === 'count');
    hintButton.disabled = activeGame !== 'chord';
  }

  root.append(notesSection, chordSection, countSection);
  showExplore();
  marks = new Map();
  renderNotesStats();
  renderChordStats();
  renderCountStats();
  updateButtons();

  return {
    noteOn(note, held) {
      if (activeGame === 'notes') notesNoteOn(note);
      else if (activeGame === 'chord') chordCheck(held);
      else if (activeGame === 'count') countNoteOn(note);
    },
    noteOff(note, held) {
      feedback.delete(note);
      if (activeGame === 'chord' && !chordGame.solved) chordCheck(held);
    },
    draw(held, labels) {
      const pressed = new Map();
      for (const n of held) pressed.set(n, feedback.get(n) ?? 'neutral');
      keyboard.draw({ pressed, labels, marks, names: showNames });
    },
    stop() {
      activeGame = null;
      updateButtons();
    },
  };
}

// Exposed for tests.
export const _internal = { stack, CHORD_SETS, mod };
