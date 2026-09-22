// Chord progression editor: the student builds the progression bar by bar by
// clicking a root, a chord type and (optionally) a bass note, or loads a
// ready-made progression in any key. The text box under "Edita com a text"
// stays in sync, so a teacher can still type or paste a progression.

import { mod, parseProgression, splitChord } from './theory.js';

const SHARP_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLAT_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
const SOLFEGE = ['Do', 'Do#', 'Re', 'Mib', 'Mi', 'Fa', 'Fa#', 'Sol', 'Lab', 'La', 'Sib', 'Si'];
const PITCH = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const pitchOf = (name) => mod(PITCH[name[0]] + (name[1] === '#' ? 1 : name[1] === 'b' ? -1 : 0), 12);

// Chord types offered as buttons: [suffix written in the symbol, button label, tooltip].
const TYPES = [
  ['Tríades', [
    ['', 'Major', 'Acord major (C)'],
    ['m', 'm', 'Acord menor (Cm)'],
    ['dim', 'dim', 'Disminuït (Cdim)'],
    ['aug', 'aug', 'Augmentat (Caug)'],
    ['sus2', 'sus2', 'Suspès de 2a'],
    ['sus4', 'sus4', 'Suspès de 4a'],
  ]],
  ['Amb 7a i més', [
    ['7', '7', 'Sèptima de dominant (C7)'],
    ['maj7', 'maj7', 'Sèptima major (Cmaj7)'],
    ['m7', 'm7', 'Menor amb 7a (Cm7)'],
    ['m7b5', 'm7♭5', 'Semidisminuït (Cm7b5)'],
    ['dim7', 'dim7', 'Disminuït amb 7a'],
    ['7sus4', '7sus4', '7a amb 4a suspesa'],
    ['6', '6', 'Major amb 6a'],
    ['m6', 'm6', 'Menor amb 6a'],
    ['add9', 'add9', 'Major amb 9a afegida'],
    ['9', '9', 'Novena de dominant'],
    ['m9', 'm9', 'Menor amb 9a'],
  ]],
];

// Progressions as [semitones above the key, chord suffix] per bar.
export const PRESETS = [
  { name: 'I – V – vi – IV (pop)', bars: [[0, ''], [7, ''], [9, 'm'], [5, '']] },
  { name: 'I – vi – IV – V (anys 50)', bars: [[0, ''], [9, 'm'], [5, ''], [7, '']] },
  { name: 'I – IV – V – I', bars: [[0, ''], [5, ''], [7, ''], [0, '']] },
  { name: 'vi – IV – I – V', bars: [[9, 'm'], [5, ''], [0, ''], [7, '']] },
  { name: 'Cànon (I – V – vi – iii – IV – I – IV – V)', bars: [[0, ''], [7, ''], [9, 'm'], [4, 'm'], [5, ''], [0, ''], [5, ''], [7, '']] },
  { name: 'Cadència andalusa (i – VII – VI – V)', bars: [[0, 'm'], [10, ''], [8, ''], [7, '']] },
  { name: 'ii – V – I (jazz)', bars: [[2, 'm7'], [7, '7'], [0, 'maj7'], [0, 'maj7']] },
  { name: 'I – vi – ii – V (turnaround)', bars: [[0, 'maj7'], [9, 'm7'], [2, 'm7'], [7, '7']] },
  { name: 'Blues de 12 compassos', bars: [[0, '7'], [0, '7'], [0, '7'], [0, '7'], [5, '7'], [5, '7'], [0, '7'], [0, '7'], [7, '7'], [5, '7'], [0, '7'], [7, '7']] },
  { name: 'Blues menor de 12 compassos', bars: [[0, 'm7'], [0, 'm7'], [0, 'm7'], [0, 'm7'], [5, 'm7'], [5, 'm7'], [0, 'm7'], [0, 'm7'], [8, '7'], [7, '7'], [0, 'm7'], [7, '7']] },
];

// Progressions of well-known songs, written in C major / A minor as in Jaime
// Altozano's "Guía de acordes para componer". The key selector transposes them.
// `style` and `tempo` are a suggestion for the backing.
export const SONGS = [
  { chords: 'Am F C G', songs: 'Despacito · Hello (Adele) · Súbeme la radio', style: 'reggaeton', tempo: 90 },
  { chords: 'C G Am F', songs: 'Poker Face (Lady Gaga) · Ave María (Bisbal)', style: 'rock', tempo: 110 },
  { chords: 'C Am F G', songs: 'Stand By Me · Perfect (Ed Sheeran)', style: 'ballad', tempo: 64 },
  { chords: 'F C G Am', songs: 'Umbrella (Rihanna)', style: 'rock', tempo: 88 },
  { chords: 'F G C Am', songs: 'Viva la Vida (Coldplay)', style: 'rock', tempo: 69 },
  { chords: 'F Am C G', songs: 'Tusa (Karol G)', style: 'reggaeton', tempo: 100 },
  { chords: 'Am C G F', songs: 'Wrecking Ball, estrofa (Miley Cyrus)', style: 'ballad', tempo: 60 },
  { chords: 'Am G F G', songs: 'My Heart Will Go On (Titanic)', style: 'ballad', tempo: 66 },
  { chords: 'F G Am Am', songs: 'Ocean Eyes (Billie Eilish)', style: 'ballad', tempo: 72 },
  { chords: 'C Em Am G', songs: 'Fix You, estrofa (Coldplay)', style: 'ballad', tempo: 69 },
  { chords: 'Am Dm F G', songs: 'Shape of You (Ed Sheeran)', style: 'reggaeton', tempo: 96 },
  { chords: 'C G Dm F', songs: 'Hot n Cold (Katy Perry)', style: 'rock', tempo: 120 },
  { chords: 'C G F C', songs: 'Let It Be, tornada (The Beatles)', style: 'ballad', tempo: 72 },
  { chords: 'C G F G', songs: 'Call Me Maybe (Carly Rae Jepsen)', style: 'rock', tempo: 120 },
  { chords: 'C F C G', songs: 'American Pie, tornada', style: 'rock', tempo: 138 },
  { chords: 'C C F G', songs: 'La Bamba', style: 'rock', tempo: 150 },
  { chords: 'F G C F', songs: 'Chandelier (Sia)', style: 'ballad', tempo: 86 },
  { chords: 'C F C F', songs: 'Imagine, estrofa (John Lennon)', style: 'ballad', tempo: 76 },
  { chords: 'C G C G', songs: 'Yellow Submarine, tornada (The Beatles)', style: 'rock', tempo: 110 },
  { chords: 'C Dm C Dm', songs: 'Wake Me Up Before You Go-Go, tornada (Wham!)', style: 'rock', tempo: 81 },
  { chords: 'Am F Dm E', songs: 'The Show Must Go On (Queen)', style: 'ballad', tempo: 84 },
  { chords: 'Am Dm F E', songs: 'Back to Black (Amy Winehouse)', style: 'shuffle', tempo: 62 },
  { chords: 'Am G F E', songs: 'Cadència andalusa: Entre dos aguas (Paco de Lucía)', style: 'rock', tempo: 100 },
  { chords: 'Am Am Dm E7', songs: 'Bad Guy (Billie Eilish)', style: 'funk', tempo: 135 },
  { chords: 'C G/B Am C/G F G F G', songs: 'Cànon de Pachelbel · I Dreamed a Dream', style: 'ballad', tempo: 70 },
  { chords: 'C C C C F F C C G F C C', songs: 'Blues de 12 compassos: Blue Suede Shoes (Elvis)', style: 'shuffle', tempo: 120 },
];

const FLAT_KEYS = new Set([5, 10, 3, 8, 1, 6]); // F Bb Eb Ab Db Gb

const el = (tag, props = {}, children = []) => {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
};

export function createProgressionEditor({ container, textInput, onError, onSong, initial = 'C | Am | F | G' }) {
  let bars = [];
  let selected = 0;
  let useFlats = false;

  // ---- Toolbar: presets -------------------------------------------------
  const presetSelect = el('select', { id: 'preset', title: 'Progressions preparades' }, [
    el('option', { value: '', textContent: 'Tria una progressió o una cançó…' }),
    el('optgroup', { label: 'Cançons conegudes (amb base i tempo)' },
      SONGS.map((song, i) => el('option', { value: `s${i}`, textContent: `${song.chords.split(' ').join(' – ')} · ${song.songs}` }))),
    el('optgroup', { label: 'Progressions' }, PRESETS.map((preset, i) => el('option', { value: `p${i}`, textContent: preset.name }))),
  ]);
  const keySelect = el('select', { id: 'preset-key', title: 'Tonalitat de la progressió' },
    FLAT_NAMES.map((name, pc) => el('option', { value: String(pc), textContent: `${name} (${SOLFEGE[pc]})` })));
  const loadButton = el('button', { type: 'button', className: 'secondary', textContent: 'Carrega' });
  loadButton.addEventListener('click', () => {
    if (presetSelect.value === '') return;
    const key = Number(keySelect.value);
    const names = FLAT_KEYS.has(key) ? FLAT_NAMES : SHARP_NAMES;
    const index = Number(presetSelect.value.slice(1));
    if (presetSelect.value.startsWith('s')) {
      const song = SONGS[index];
      const move = (name) => names[mod(pitchOf(name) + key, 12)];
      bars = song.chords.split(' ').map((symbol) => {
        const chord = splitChord(symbol);
        return { root: move(chord.root), suffix: chord.suffix, bass: chord.bass ? move(chord.bass) : null };
      });
      selected = 0;
      changed();
      onSong?.(song);
      return;
    }
    const preset = PRESETS[index];
    // Minor-key presets (andalusa, minor blues) read better with flats.
    const spell = preset.bars[0][1].startsWith('m') ? FLAT_NAMES : names;
    bars = preset.bars.map(([interval, suffix]) => ({ root: spell[mod(key + interval, 12)], suffix, bass: null }));
    selected = 0;
    changed();
  });
  presetSelect.addEventListener('change', () => loadButton.click());
  keySelect.addEventListener('change', () => loadButton.click());

  const toolbar = el('div', { className: 'prog-toolbar' }, [
    el('label', {}, ['Progressió preparada', presetSelect]),
    el('label', {}, ['Tonalitat', keySelect]),
    loadButton,
  ]);

  // ---- Bars ---------------------------------------------------------------
  const barList = el('ol', { className: 'bars', ariaLabel: 'Compassos' });

  // ---- Chord picker -------------------------------------------------------
  const picker = el('div', { className: 'picker' });
  const rootRow = el('div', { className: 'picker-buttons' });
  const typeRows = TYPES.map(([title, types]) => ({ title, types, row: el('div', { className: 'picker-buttons' }) }));
  const bassRow = el('div', { className: 'picker-buttons' });
  const accidentalButton = el('button', { type: 'button', className: 'chip small', title: 'Canvia entre sostinguts i bemolls' });
  accidentalButton.addEventListener('click', () => {
    useFlats = !useFlats;
    render();
  });
  const pickerTitle = el('div', { className: 'picker-title' });
  picker.append(
    pickerTitle,
    el('div', { className: 'picker-row with-extra' }, [el('span', { textContent: 'Fonamental' }), rootRow, accidentalButton]),
    ...typeRows.map(({ title, row }) => el('div', { className: 'picker-row' }, [el('span', { textContent: title }), row])),
    el('div', { className: 'picker-row' }, [el('span', { textContent: 'Baix (opcional)' }), bassRow]),
  );

  container.append(toolbar, barList, picker);

  textInput.addEventListener('change', () => {
    try {
      setFromText(textInput.value);
      onError?.(null);
    } catch (error) {
      onError?.(error.message);
    }
  });


  function setFromText(text) {
    parseProgression(text); // validates
    const next = [];
    for (const token of text.split('|').map((s) => s.trim()).filter(Boolean)) {
      next.push(token === '%' ? { ...next.at(-1) } : splitChord(token));
    }
    bars = next;
    selected = Math.min(selected, bars.length - 1);
    changed();
  }

  const symbol = ({ root, suffix, bass }) => `${root}${suffix}${bass ? `/${bass}` : ''}`;
  const names = () => (useFlats ? FLAT_NAMES : SHARP_NAMES);

  function changed() {
    textInput.value = bars.map(symbol).join(' | ');
    render();
  }

  function update(patch) {
    if (!bars[selected]) return;
    bars[selected] = { ...bars[selected], ...patch };
    changed();
  }

  function chip(label, { active = false, title = '', onClick }) {
    const button = el('button', { type: 'button', className: `chip${active ? ' active' : ''}`, textContent: label, title });
    button.setAttribute('aria-pressed', String(active));
    button.addEventListener('click', onClick);
    return button;
  }

  function render() {
    const current = bars[selected];

    barList.replaceChildren(
      ...bars.map((bar, i) => {
        const select = el('button', { type: 'button', className: 'bar-chord', title: `Edita el compàs ${i + 1}` }, [
          el('small', { textContent: String(i + 1) }),
          el('span', { textContent: symbol(bar) }),
        ]);
        select.addEventListener('click', () => {
          selected = i;
          render();
        });
        const remove = el('button', { type: 'button', className: 'bar-remove', textContent: '×', title: 'Esborra aquest compàs', disabled: bars.length === 1 });
        remove.addEventListener('click', () => {
          bars.splice(i, 1);
          selected = Math.min(selected >= i ? Math.max(0, selected - 1) : selected, bars.length - 1);
          changed();
        });
        return el('li', { className: i === selected ? 'selected' : '' }, [select, remove]);
      }),
      el('li', { className: 'bar-actions' }, [
        chip('+ Compàs', {
          title: 'Afegeix un compàs amb el mateix acord',
          onClick: () => {
            bars.splice(selected + 1, 0, { ...(bars[selected] ?? { root: 'C', suffix: '', bass: null }) });
            selected += 1;
            changed();
          },
        }),
        chip('Buida', {
          title: 'Deixa només un compàs',
          onClick: () => {
            bars = [{ root: 'C', suffix: '', bass: null }];
            selected = 0;
            changed();
          },
        }),
      ]),
    );

    pickerTitle.textContent = current ? `Compàs ${selected + 1}: ${symbol(current)}` : '';
    accidentalButton.textContent = useFlats ? '♭ → ♯' : '♯ → ♭';

    const rootPc = current ? pitchOf(current.root) : -1;
    rootRow.replaceChildren(
      ...names().map((name, pc) =>
        chip(name, { active: pc === rootPc, title: SOLFEGE[pc], onClick: () => update({ root: name }) }),
      ),
    );
    for (const { types, row } of typeRows) {
      row.replaceChildren(
        ...types.map(([suffix, label, title]) =>
          chip(label, { active: current?.suffix === suffix, title, onClick: () => update({ suffix }) }),
        ),
      );
    }
    const bassPc = current?.bass ? pitchOf(current.bass) : -1;
    bassRow.replaceChildren(
      chip('—', { active: !current?.bass, title: 'Sense baix diferent', onClick: () => update({ bass: null }) }),
      ...names().map((name, pc) =>
        chip(`/${name}`, { active: pc === bassPc, title: `Baix a ${SOLFEGE[pc]}`, onClick: () => update({ bass: pc === pitchOf(current.root) ? null : name }) }),
      ),
    );
  }

  setFromText(initial);

  return { get text() { return textInput.value; } };
}
