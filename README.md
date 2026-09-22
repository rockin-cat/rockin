# Rockin · Accompaniment Trainer

A browser game for music students learning keyboard accompaniment. It mixes the backing tracks of iReal Pro with the real-time feedback of Synthesia. The student builds a chord progression by clicking chords (or loads a ready-made one in any key), picks a time signature, a tempo and a backing style. While the backing plays, the game shows one of the physical **ROCKIN pattern cards** (the scans in `DORS/`). The student has to play the active chord with that card's rhythmic or melodic pattern, and every note is judged as a hit or a miss.

**Status:** the foundations are in place and have been checked in headless Chrome: transport, backing track, MIDI input, card data, the three levels, the bouncing-ball playhead and a basic UI. There is no scoring summary, level progression or polish yet.

## Two ways in

The page opens on a home screen with three doors: **Juga** (the ROCKIN path and the chord workshop), **Cançons** (a path for each song or chord wheel) and **Sessió** (for teachers; formerly "Estudi"). Playing with the computer letters is an option in the top bar (**Tocar amb l'ordinador**, off by default, remembered in `rockin.computerKeys`): only then do the letters show on the keys and play notes.

- **Juga** (`js/play.js`, content in `js/missions.js`, look in `css/play.css`): the guided game for students of about 12. The Juga map has three tabs: the ROCKIN path (🎸 El camí), the adaptive path (🧭 Camí intel·ligent, see below) and the chord workshop (🎹 Taller d'acords). Students first pick their name ("Qui juga?"); several can share a computer. The first time, five short welcome slides explain the card (when), the keyboard (which notes), listen-then-play and stars ("❓ Com es juga?" shows them again). After the welcome, new students choose **Comença pel principi** or **🎯 Prova de nivell** (also on the map footer): four short tests that stop at the first one not passed: (1) the Do with a card and the backing, (2) build Do, Sol, La m and Fa alone (3 of 4 without mistakes), (3) the wheel Do–Sol–La m–Fa–Do step by step without help (at most one mistake), (4) the wheel with two cards and the backing (75% clean bars). The student starts at *Llegeix les cartes*, *Aprèn la roda* (from the first chord or from the first change), *La roda amb ritme* or *Cançons i estructura*; missions before that point stay open (`students[id].start.rockin`), and the result is logged for the teacher view. The student map only shows a greeting, a big **▶ Juga** button for the next mission and the worlds: the current one open, finished ones ticked, later ones locked and closed. Everything else (**🔓 mode professor**: a "Professor/a" profile with every mission of every path open and nothing saved or logged, left with "Surt del mode professor"; speed, metronome, note names, open all missions, the printable sheet of the ROCKIN path, progress of the students in every path) is in **⚙ Professorat** at the bottom of the map. Mission intros are one sentence and one **▶ Comença** button (which listens first); "Sense escoltar" appears after a first try. Student texts avoid the word "semitò": chords are built by "jumping 4 keys and then 3 (counting black and white)". The map has six worlds; each world has a **goal** (a chord wheel) shown on the map and at the top of every mission. The path goes from the whole to the parts: rhythm on one note, then the **whole wheel with long notes**, and only then rhythm cards, songs and inversions.
  1. *Llegeix les cartes*: lesson and cards on one note (Do).
  2. *Aprèn la roda*: each chord built from its root (*Acord nou*: look, **count semitones** from the root, play it painted and from memory; the root must be at the bottom), each **change** as soon as both chords are known, *La roda pas a pas*, the wheel with a long-note card and music, and the goal from memory.
  3. *La roda amb ritme*: cards over the whole wheel, the goal (three cards) and *Toca amb la banda*.
  4. *Cançons i estructura*: known songs and *Estrofa i tornada* (two wheels in song order, each row of the score labelled).
  5. *Temps partits*.
  6. *Inversions*: build the inversions of a chord (move the bottom note up an octave), the changes with the closest position, the wheel step by step and with music, and the band.
  **Taller d'acords** (second tab on the student map, every game always open; `WORKSHOP_PATH` in `missions.js`): short games with one big question and little text: *Troba la nota* (white keys with names, without names, black keys; after two misses the keys are painted), *Salta tecles* (from a yellow key jump 1–4 keys; the numbers appear one by one with a soft note), *Construeix* (majors, minors, mixed: guided = root → count the first jump → count the second → the three together; alone = the three together, with an "ajuda pas a pas" button), and *Contra rellotge* (as many chords as possible in 60 s).
  Mission types:
  - *Canvi* (change): a **diagram** first (`changeDiagram()` in `js/play-extra.js`, also on the printable sheet): a small keyboard with the fingers of chord A (low dots, colour of A) and of chord B (higher dots, colour of B), an arrow from each finger to where it goes, a green dot with a 📌 for a finger that stays, green keys for keys in both chords and a big ✋ arrow when the whole hand moves the same way; the words are folded under "Explica-m'ho amb paraules". Plus an **animation** on the keyboard, in a loop: dots with finger numbers on chord A (it sounds), the dots jump along dotted arcs to chord B (it sounds); a dot that stays on the same key pulses green. One or two plain sentences (`describeChange()` in `js/voicing.js`: "the whole hand jumps to the left", or finger by finger, and shared keys). Then practice A–B–A–B–A–B where **the game waits** until the chord is right; after each right chord of the painted pass the dots jump to the next chord.
  - *Pas a pas* (steps): the whole wheel twice on the score, first painted, then from memory; the ball waits on each card until the chord is played; wrong notes are marked on the card.
  - *Ritme / Objectiu / Cançó / Estructura / Banda*: played over the backing on the **score of cards** (`js/score.js`): every bar as a card in rows (one card = one row = one whole wheel), the chord written above each card like a lead sheet, and a ball bouncing from circle to circle and from card to card (drawn on a layer above all the cards, so the last beat of a card flies straight to the first circle of the next one at the same pace). The card of a coming change glows orange. **Escolta i toca**: for one chord the piano plays one bar; for a wheel it plays the whole wheel once (both parts for a song structure), with an open hand and "Escolta" on those cards (notes played then are ignored and the hand shakes), then an "Ara tu!" card with clicks and numbers, then the student plays. The band mission has no example. The backing ends on a held chord; the ball stops at the end.
  - **Marks on the cards** (from the evaluator's `kind`/`fraction` details): a green dot where a right attack was played (left of the circle = early, right = late), a red X for a wrong or extra note (with its name), a red ring for a circle not played, an orange ring for an incomplete chord ("falta Mi"), a red "~" for a note ringing into a silence. They stay after the try, with a legend under the score. The result lists counts and tendencies (early/late).
  Stars by clean bars: all = 3, 85% = 2, 75% = 1 (so 2 of 4 does not pass); for *Banda* 90/75/60%. **Adaptive tempo:** under half the bars clean makes the next try 8 bpm slower (up to −24); a perfect try brings it back up; a slowed try gives at most 2 stars. After the goal missions (objective, song, structure, band) a **self-assessment** asks where the student got lost (changes, rhythm, notes, lost the place, no problem). No mood words: chord facts are counted semitones.
  **One hand or two** (`js/twohands.js`, `handsPath()` in `play.js`): after the welcome slides (and on the map for students who never chose), the student picks **✋ Una mà**, **🙌 Dues mans, el mateix acord** or **🙌 Dues mans, l'esquerra fa el baix** (`students[id].hands`: 1 | 'chord' | 'bass'; "Toques amb … · Canvia" on every map). With two hands the path is the same (reading cards, the wheel, rhythm, songs, band…): every scanned card is replaced by a copy drawn by the program with **two rows** (blue = right hand, orange = left hand, same pattern), the first lesson gets a slide about the two rows, the keyboard shows C2–C6 with the right hand's keys in blue and the left hand's in orange (fingers 1-3-5 and 5-3-1), and stars are kept apart (mission ids end in `@2` or `@2b`). In *Llegeix les cartes* both hands play the root. Building a chord, changes and inversions are still taught with the right hand. The left hand plays from C3 (bass) or just below middle C (chord), and two-hand screens show F2–C6 (`TWO_HANDS_RANGE`). With the left hand on the bass, *Dues mans: ritmes difícils* (cards 11–20) follows, and the band uses cards 8–20 at its medium and hard levels. A last world *Cadascuna el seu ritme* adds cards where each hand has its own rhythm (alternating, bass first, rock, reggae, ballad). Notes below middle C are the left hand. In timed missions each hand has its own judge (`createEvaluator` per hand with its row of the card), marks of the right hand go above its row and those of the left hand below; a bar is clean only if both hands are. *Pas a pas* waits until both hands are right. The adaptive path has its own model for each way of playing (`rockin@2`, `rockin@2b`). The placement test is played with one hand.
  In *Pas a pas* only the chord to play now is painted (no preview of the next one), and the keys go blank while the ball hops.
  **⭐ Level 2: arpeggios and melodic contour** (`levelTwoWorlds()` in `missions.js`, after the ROCKIN path and after every song path; one-handed even when the student chose two hands): *Arpegis* (lesson on the line cards, `arpeggio` mission: each chord of the wheel as root–third–fifth, painted then from memory, the game waits; cards with two different notes, then the first with three; goal) and *Contorn melòdic* (cards with three notes, then four; goal, band). The cards go from fewer different heights to more (2 → 3 → 4). Played at evaluator level 3 (any chord tones following the contour); the keyboard paints the chord's notes without numbers (numbers are kept for fingers and degrees; in the arpeggio mission the key to play is yellow, played ones green); marks on each point of the card (`kind: 'contour'` = wrong direction, shown as "X ↕"). `score.js` has a geometry for melodic cards (a landing on each point).
  **🎤 Toca amb la banda** (home door, `section = 'banda'`, `startJam()` in `play.js`): the student picks a song (ROCKIN wheel, the songbook or their paths) and plays without stopping in sets of four random cards of the current level; ≥85% clean bars → level up, <60% → level down. Eight levels (`JAM_LEVELS`: easy slow/normal, medium slow/normal/fast, hard normal/fast/"mestre"); base tempo from the song, clamped to 60–126. 4 s between sets. Remembers the level and the record per song and per way of playing (`students[id].jam[key] = { level, best, sets }`) and logs `{ m: 'jam', p: song, s: best level }`.
  **Camí intel·ligent** (`js/adaptive.js`; second tab on the Juga map and on every song map): the same skills as the path, but not in a fixed order. Skills of a wheel, in stages: notes of the wheel and reading a card · each chord · each change · the wheel at tempo (long notes) · a card with a chord on every beat · silences and long notes · several cards in a row · the band · medium rhythm cards · hard rhythm cards · arpeggios · melodic contour. Each time a skill comes back it uses other cards of its tier; three failed tries in a row at the same skill make it rest for a while; melodic results do not infer the hard rhythm skills. The model keeps a mastery (0–1) per skill; 0.8 counts as known. It starts at the bottom and jumps fast: two perfect results in a row skip a stage; a result of 0.8 or more at a stage counts the untested skills below as known ("deduït", dashed green); a result under 0.5 makes the deduced skills of the two stages below testable again. Probes: stage 1 builds every unknown chord alone (buildRound; each chord scored on its own), stage 2 plays the whole wheel step by step without help (each change scored by the mistakes on its card). Timed tries (score = share of clean bars) also lower the chord or change of every bar with wrong or missing notes (a bar right after a change counts against the change). Next step: the weakest skill of the lowest stage, else an untested skill at or below the highest tested stage, else the next stage up; when everything is known, a review. The screen shows the next challenge with its reason, a skill map by stage (click a skill to practise it) and "Torna a començar"; after each challenge, "Següent repte →" and a line with what changed. Missions of the adaptive path give no stars. State: `students[id].adaptive[pathKey]` (`{ skills: { id: { m, n, t, inferred } }, streak, skipped, history }`); ⚙ Professorat shows what each student knows and has to practise.
  **Chord colours** (`js/degrees.js`), as in the ROCKIN songbook (the Hooktheory system): every chord gets the colour of its root in the major scale of the key (I red, ii orange, iii yellow, IV green, V blue, vi purple, vii° pink; a minor key uses the colours of its relative major, so its i is purple; a root outside the scale, such as ♭VII, is light pink) and its degree (I, IV, vi… or i, III, iv…). Used on every chord chip, above the cards of the score and on the printable sheet. Each map has a folded "🎨 Els colors dels acords" strip with the seven chords of the key grouped by function (tònica I vi iii · predominant IV ii · dominant V vii°). Paths have a `key`: C for ROCKIN, the book's key for the songbook, and the first chord for other songs.
  **Cançons** (home door): first the **songs of the ROCKIN songbook** (`js/songbook.js`: Corren, De Bonesh, Diamonds, En la tormenta, Flor de primavera, Me gustas tú, Sense tu, Som ocells, Urras; key, style, tempo, every part and the order, from the structure grids of the book; no lyrics). Their map shows the **structure grid** (one row per part, coloured cells) and their path ends with any new chord or change of the other parts, "La part X pas a pas" and **La cançó sencera** (every part in order, one labelled row per part, rows of four bars for long parts). *Sense tu*: the chorus changes chord every two beats in the book; here each chord takes a bar. Then the song paths as cards (with the student's stars and a ✕ to delete), one-click paths for 12 known songs, **🔓 Desbloqueja-ho tot** (enters the teacher mode from the song list or a song map: every path open, nothing saved) and **+ Crea un camí**: a wheel (typed, or a known song, transposable), an optional chorus, a meter (4/4, 3/4, 6/8, 12/8), a style, a tempo and whether to start by reading cards (off by default). `buildPath()` builds the same sequence. Each song map has "← Totes les cançons" and its own printable sheet; specs are kept in `rockin.play.paths`.
  **Teacher view** (map footer): every student on this computer with stars for the current path, a bar per world, tries, last day, missions that are hard (3+ tries, ≤1 star), what they said in the self-assessment, the last 20 tries of one student, rename/delete and a CSV download. **🖨 Fitxa del camí**: a one-page landscape A4 sheet of the path in three columns, with the ROCKIN logo (scaled down automatically if it would not fit) (the wheel and structure, each chord on a small keyboard with fingers, the changes in words, the inversions, the cards and a checklist before playing with the group).
  Settings on the map: speed (60/76/96; song tempos scale with it), metronome clicks while playing, note names on the keys. One star opens the next mission ("Mode professor" opens everything). Progress: `rockin.play.v1` (`{ unlockAll, current, students: { id: { name, stars, log } } }`; older single-student saves are migrated).
- **Sessió** (formerly Estudi): everything described below (free play, challenge path, all settings), plus *Notes i acords*. "Què toques" 5–7 are the two-hand ways of Juga (`twoHandJudge()` in `twohands.js`: one judge per hand, notes below middle C = left hand, left-hand notes orange in the lane): 5 both hands the same chord and 6 left hand on the bass, both with the two-row copies of the scanned cards; 7 each hand its own rhythm with the two-hand cards (4/4 only). Long notes (a bar on the card) must be held to the end (`kind: 'short'`, "mantén!"; 180 ms or 12% of the note of slack). In Juga a mission with a single round plays it twice on the same cards (row marked "×2 · 1a/2a volta"; `repeatOf` in `score.setBars`). **Experimental:** "Ajuda al teclat → Cartes al piano roll" draws each bar's card in the keyboard lane, at the height of its chord's keys, with its circles along time (each reaches the keys when it must be played; held notes are bars, silences white). Best with the vertical keyboard. The progression menu includes **known songs** (from Jaime Altozano's *Guía de acordes para componer*, written in C and transposed by the key menu); choosing one also sets a fitting backing style and tempo. Only the chords are included, not the recordings.

## Run

```sh
npm start               # python3 tools/serve.py, then open http://localhost:8080
npm run build:cards     # regenerate assets/ and data/cards.json from DORS/
npm run build:web       # light JPEG copies in assets/web/ (needs Pillow); run after build:cards
```

- No build step and no npm dependencies. Plain ES modules, with Tone.js 15.1.22 loaded from cdnjs (so it needs internet).
- It must be served over http; opening `index.html` as a file breaks module and `fetch` loading.
- `tools/serve.py` sends `Cache-Control: no-store`. With `python3 -m http.server` a browser (Chrome especially) can keep old copies of the modules after an update, which can break the page; the no-cache server avoids that. Any JavaScript error is also shown in a red box at the bottom of the page.
- The piano sound (demonstrations and the student's notes) uses the Salamander Grand Piano samples (CC BY 3.0) from tonejs.github.io, with a synthesised fallback while they load or if there is no connection (`js/piano-sound.js`).
- Use Chrome, Edge or Firefox. Safari has no Web MIDI.
- Without a MIDI keyboard, the computer keys play notes: `A W S E D F T G Y H U J K O L P ;`, where A = C4; `Z`/`X` shift the octave. The on-screen piano can also be played with the mouse or a finger.
- The interface is in Catalan. Console logs stay in English.

## Layout

| Path | What it is |
|---|---|
| `assets/brand/` | ROCKIN logos (www.rockin.cat): wordmark for the top bar (dark copy for the game), logo with the tagline for the home page and the printable sheet, guitar icon for the Juga button and the favicon. |
| `DORS/` | Original card fronts (1109×1558 PNG). **Source of truth.** Catalan filenames stored NFD-decomposed by macOS: `dors mètrica binària N`, `dors mètrica ternària N`, `dors patró melòdic N`. |
| `REVERS/` | Card backs and instruction cards. Not used by the app. |
| `assets/web/` | 840 px JPEG copies of the cards (~45 KB each) that the page actually loads. Made by `tools/make-web-assets.py`; the page falls back to the PNG if one is missing. |
| `assets/` | Generated copies of the cards with URL-safe names (`rhythm_binary_01.png`, `rhythm_ternary_01.png`, `melodic_01.png`). |
| `data/cards.json` | Generated card dictionary. **Don't hand-edit it**: `build:cards` overwrites it. Fix the analyzer instead. |
| `tools/build-cards.mjs` | Dependency-free Node script that reads each card's pattern from its pixels. `--sheets <dir>` writes contact sheets with the detected pattern drawn on top, for checking by eye. |
| `js/main.js` | Wires the page together: settings form, animation loop, card display, on-screen piano, feedback. |
| `js/progression-editor.js` | Chord picker: bar tiles, root / chord type / bass buttons, preset progressions transposed to any key. Keeps the hidden text box (`Edita com a text`) in sync. |
| `js/play.js` | "Juga": students, map, path creator, mission screens (lesson, chord, change, steps, invert, cards), its own music session, stars, tips and self-assessment. |
| `js/score.js` | "Juga": the score of cards with the bouncing ball and the marks of how each card was played. |
| `js/voicing.js` | Where the hand plays each chord (root position around middle C, or the closest inversion), fingering and how the hand moves between chords. |
| `js/play-extra.js` | "Juga": teacher view and printable sheet. |
| `js/missions.js` | Worlds and missions of "Juga" (texts, chords, cards). Edit this to change the path. `buildPath()` makes the path of a song (with `parts`/`order`, a whole-song structure). |
| `js/adaptive.js` | The model of the adaptive path: skills of a wheel, results, what to do next. |
| `js/degrees.js` | Chord colours and degrees by key (songbook / Hooktheory). |
| `js/guide.js` | The teacher's guide (📘 Guia del professorat): every part and option of the game, shown from ⚙ Professorat and from a small button on the home page, printable (A4 portrait). Update it when the game changes. |
| `js/twohands.js` | Two-hand cards (drawn on a canvas) and the two-hands path. |
| `js/songbook.js` | The songs of the ROCKIN songbook (chords, parts, order, key, style, tempo). |
| `js/learn.js` | "Notes i acords": how the keys are named, what a chord is, and counting semitones, with three mini-games (find the note, build the chord, count semitones: go up N, thirds, fifths, build a major/minor chord by counting) on its own keyboard. |
| `js/piano-sound.js` | Shared piano: sampled, with a synth fallback. |
| `css/play.css` | The dark, game-like look of "Juga". |
| `js/challenge.js` | Challenge mode: difficulty path per level and meter, pass rules, exam scoring, progress in `localStorage`, the path's UI (cards drawn as small pattern glyphs). |
| `js/keyboard.js` | Canvas piano, horizontal (Synthesia) or vertical (piano roll, keys on the left). Keys light up when due, held keys turn green or red. Clickable. Shows C2–C7 (fewer octaves on narrow screens). |
| `js/transport.js` | Tone.js clock and scheduling. `positionAt(perfTime)` gives the musical position of the sound *being heard* at that moment (via `getOutputTimestamp`). The playhead and the evaluator both use it. |
| `js/backing.js` | Backing styles (rock/pop, blues shuffle, ballad, swing, bossa nova, funk, reggaeton, reggae, Catalan rumba, metronome): synthesised drums, bass, optional piano/pad on the chords, count-in click. Style, volume and piano can change while playing. |
| `js/evaluator.js` | Level rules and hit/miss judging. Tolerances are constants at the top. |
| `js/cards.js` | Loads the JSON and deals cards that fit the time signature. |
| `js/playhead.js` | Canvas overlay: ball bouncing once per pulse on rhythm cards (on each point on melodic cards), plus hit/miss markers under every attack. |
| `js/midi.js` | Web MIDI input and the computer-keyboard fallback. |
| `js/instrument.js` | Synth that sounds the student's own notes at any time (toggle: "Hear my notes"). |
| `js/theory.js` | Parses chords (`C \| Am \| % \| G7`, one chord per bar), time signatures and note names; suggested keys for the on-screen piano. |

## How the cards are read

**Rhythmic cards** have one circle per beat, cut into equal vertical slices. Blue = sound, white = silence, a strip of bare paper = divider only, and a teal rounded bar across several beats = one held note. In the JSON:
- `pattern` has one array per beat. `1` = attack, `2` = the previous sound keeps ringing, `0` = silence.
- `subdivisions_per_beat` gives the slice count of each beat.
- `layout` gives image-relative positions for the playhead.

The two folders don't map one-to-one onto meters:

| Cards | Meter |
|---|---|
| binary 1–30 | 4 beats (4/4) |
| ternary 1–25 | 3/4 |
| ternary 26–28 | 12/8 |
| ternary 29–32 | 9/8 |
| ternary 33–36 | 6/8 |

`cards.js` therefore deals cards whose beat count equals the meter's felt pulses and whose subdivisions suit it (2/4 slices for simple meters, 3 for compound ones).

**Melodic cards** are ring-shaped points joined by lines. `contour` is the relative pitch of each note in play order (0 = lowest, equal = same note). Separate strokes are played left to right, points along each stroke left to right. Melodic cards have no fixed rhythm, so their notes are spread evenly over the bar.

## Learn ("Aprèn")

Follows section 5.2 of the project document. *Les notes del teclat*: names of the white and black keys, with a find-the-note game (optionally black keys too; note names can be written on the keys). *Què és un acord?*: triads (1-3-5, major 4+3, minor 3+4, inversions), an explorer that marks and plays any chord (major, minor, dim, aug, sus, 7, maj7, m7), and a build-the-chord game (C F G; the C G Am F Dm Em wheel; or every major and minor) that accepts inversions unless told not to, with a hint button.

## Ideas from the project document not built yet

- Interpretation levels 1–2: an automatic example of each chord plus a waiting bar (now the example is on demand).
- Rhythm levels by note values (crotchets/minims … semiquavers, ternary) and the score line above the card.
- Melodic levels by contour shape (2 or 3 notes, up / up-down …), and combining a rhythm card with a melodic card.
- Generated progressions and saved songs; song melodies from MIDI files, with a wait-for-the-right-note mode.
- A suggested path across all parameters based on results.

## Timing and performance

The backing is scheduled by Tone.js 100 ms ahead (`lookAhead`). If the page's main thread stalls for longer than that, backing notes come out late while the ball and the judging keep following the real clock, so the student seems late. Things that caused stalls and how they are avoided:
- **Big images:** preloading every 1.9 MB PNG caused 30–100 ms memory clean-up pauses. The page now loads the small JPEGs in `assets/web/` and only preloads the next two cards.
- **Piano drawing:** the keyboard is three layers: a base canvas drawn only on resize, a notes strip redrawn only when a note is judged or the bars in view change (otherwise just moved with a CSS transform), and a top canvas for lit keys drawn only when they change.
- **Synths:** cymbals are filtered noise and the piano uses one oscillator per voice (Tone's MetalSynth and FMSynth are much heavier).

The piano bar shows the browser's reported output delay and, if it happens, how late the backing was scheduled in the last second. The **Sincronia** slider adds a delay the browser doesn't know about (Bluetooth headphones add 100–250 ms): it shifts the ball, the piano and the judging to match what is heard. It is stored in `localStorage` (`rockin.latency`).

## Game modes

- **Joc lliure:** cards dealt at random from one difficulty (or all).
**Fewer clicks, more flow (Juga):** every mission's first screen starts by itself after a few seconds (`startPanel` / `autoGo`, "Comença en N s…"; a button or Space goes now, any button stops the count; playing the keyboard does not, so the student can try the chord while waiting). After a result the game moves on by itself: passed → next mission, missed → the same one again (`AUTO_RETRY_SECONDS`). Help follows the result: a missed try drops the tempo (`tempoDrop`) and lights the keys again (`helpBoost` → `help: 'shape'`), a passed one takes the help away. Between challenges the band keeps playing (`startLounge` / `stopLounge`, a quiet backing at the tempo just played; the `♫ Banda entre reptes` button in the mission bar toggles it, stored in `rockin.play.groove`). The mission bar always offers `↩ Anterior` / `⏭ Salta`; the adaptive path offers `↩ Més fàcil` / `⏭ Salta` / `🧭 El meu camí` (`adaptiveJump`), and the placement test `↩ Prova anterior` / `⏭ Salta la prova` / `▶ Comença aquí`, so nobody is stuck in the loop. Listening no longer adds a bar: the last bar of the example is the count-in (`bar.lead`: metronome clicks and "Ara tu!"). The placement test's first test (one card, one note) is two bars.

**Hard cards are two-hand only.** The finest subdivision (the pulse in four) is judged to be more subdivision than music for one hand, so `hardCards()` returns nothing when the student plays with one hand (the adaptive path then has no `hard` skill) and the two-hand hard cards (`dues_mans_17…20`, `alternate: true`) are **alternating**: one single row, drawn by `drawAlternating`, where each slice is coloured by the hand that plays it (blue right, orange left), like a merengue pattern. Both hands' rows share the middle layout (`ROW_Y.mid`), so marks and pulse dots stay above (right) and below (left). Judging is unchanged: each hand still has its own pattern.

**Full screen in Juga:** `⛶ Pantalla completa` in the mission bar (or the `F` key) puts the mission screen in fullscreen with a compact layout (`.play-mission.is-fullscreen`): no goal chips, no legend, bigger cards, keyboard at the bottom; Space and Escape keep working and pages don't scroll-jump (`toTop()`).

**Styles (`backing.js`):** thirteen plus the metronome — rock, shuffle, ballad, swing, bossa, funk, reggaeton, rumba, reggae and the new **ska**, **cumbia**, **hiphop** and **vals** (written for 3/4 but safe in any meter; every style is smoke-tested in 4/4, 3/4 and 6/8). Each one varies every two bars (open hats, ghost snares, the bass lifting to the fifth, a different funk cell, a swing push, a bossa answer, the reggae organ bubble) and every velocity goes through `hum()`, a deterministic wobble, so the band doesn't sound like a drum machine.

**Band levels:** `BAND_LEVELS` / `bandLevelOf(mission)` / `raiseBandLevel()` in `play.js` turn progress into what the student could do with a real group (0 finding notes → 1 chords if the others wait → 2 fluent changes → 3 patterns reading the cards → 4 from memory → 5 a whole song without stopping → 6 choosing and combining patterns). It shows as a card on the Juga map (`bandCard()`) and as a line in the result panel when it goes up; it is stored per student in `students[id].band`. Cards on a single note don't raise it (that is still reading, not accompanying); a jam set raises it to 5, or 6 from jam level 3 on.

**Count-in harmony:** listening to a single card adds one bar on the **dominant** (`dominantOf`, `bar.dominant`), so the entry resolves; listening to the whole wheel keeps using its last bar as the count-in. At level 1 the pedal harmony is aligned with the first played bar (`setHarmony(list, fromBar)`), which puts the V right before the entry.

**Pedal harmony:** at level 1 on a single chord the student holds one note, so the band plays `pedalHarmony(symbol)` instead — I–vi–IV–V of that key (i–VI–III–VII for a minor chord), set with `backing.setHarmony()`; every chord still fits the held note and the loop stops being tiring. The drum fill every fourth bar now carries a **bass walk-up** to the next chord, and every eighth bar the guitar adds a short lick.

**The band (`backing.js`):** drums, bass, guitar and piano. The piano sits back (volume -24, and in most styles it only marks the chord on the strong beats) and a plucked **guitar** (`strum` / `pluck`, its own voicing an octave above the piano's when needed) carries the off-beat chops, the rumba ventilador, the reggae skank, the funk 16ths and the ballad arpeggio. Every fourth bar the drums play a small **fill** on the last beat (`fill()`, snare + toms) and the next phrase opens with a **crash** (`phraseStart`). The per-beat click while playing is off in Juga unless the teacher turns it on (new key `rockin.play.click`, so older settings don't bring it back); only the count-in and the lead bar click. The countdown between missions is audible (`sfx.tick`, the last three seconds). Missions with one single note (level 1 or a single chord) are no longer played ×2.

**Adaptive path pacing:** the staircase in `adaptive.js`. A good result (≥ 0.8) is one step of the streak and a perfect one (≥ 0.95) two; `jumpSize(streak)` then moves the student up one, two or three stages at a time, marking what is jumped over as `skipped` (it comes back only if something above fails). Below the stage already reached, only a clearly weak skill (< `REVISIT` = 0.6) is asked again, so the path stops re-asking what the student can already do; a near miss (≥ 0.6) still counts everything two stages below as known. Anything failed three times in the last four activities is **parked**: the game changes the scenery instead of insisting (and does not push up to something harder while something is parked). `levelOf(state, skills, stage)` gives "Nivell N/12 · <stage>", shown in the mission bar, in "El meu camí" and in the result panel when it goes up.

**Timing window per attack:** an onset's window is the full `TIMING_WINDOW_MS` unless another attack is close, in which case it is 45% of the gap to the nearest neighbour (floor 60 ms). Before it was 45% of the *slice*, which gave an isolated off-beat on a subdivided card a 108 ms window — that is why the left hand playing off-beats had notes read as "fora del ritme". Dense cards keep the same tight windows as before.

**Chord changes on the wheel:** three rules keep a real change from reading as a wrong chord. A key played up to `EARLY_CHORD_MS` (320 ms) before a beat, at a **chord change**, waits for the chord that is coming instead of being swallowed as a doubling of the beat before (this was the "Do → La m: falta Do" bug, and the "it doesn't take the first note of the chord" one). A chord spread over up to `LATE_CHORD_MS` (460 ms) still completes the beat it started on, judged "tecles massa separades" rather than incomplete; the clean-hit window is `CHORD_SPREAD_MS` = 220 ms. And `withSustained` counts any key still down from **before** this beat's window, so playing legato (keeping the Do and the Mi from Do into La m) is not an incomplete chord. With two hands, the "only this hand is expecting an attack" rule (`expectsNow`) only overrides the register rule when the note is not clearly in the other hand's range (`dR <= dL + 7`), so an off-beat left hand played a little early still counts for the left.

**Which octave, which finger:** at level 4 (bass + chord) the root may be played anywhere up to F4 and a right-hand note that falls below the left hand's root no longer spoils the chord (`chordComplete`); two-hand missions always paint the first chord on the start screen as a reference for the octave. A note still held from the bar before completes a chord (`withSustained`): common notes kept under the fingers (Si♭ m → Mi♭ m share the Si♭) no longer read as "incomplete", as long as at least two notes of the chord were really attacked now. Finger numbers on the painted keys are **off** by default (`rockin.play.fingers`); ⚙ Professorat turns them on and shows a table (`fingeringTable`, `rockin.play.fingering`) where each chord can get its own fingering, low to high and for the right hand (Si♭ = 1-2-4, say); the left hand mirrors it. Empty = automatic (`fingers()`).

**The call in "pregunta i resposta":** `callPhrase` builds a real question — a pentatonic ladder in the key, a rhythm cell from `CALL_RHYTHMS`, a shape of small steps with one leap, and a last note moved to the second or the fifth so the phrase asks instead of closing. It sounds on the piano and lights the keys as it goes.

**Improvisa never ends by itself:** "Prou, ja he acabat" closes it. Challenge mode keeps a per-challenge counter set (`challengeStats`); "🎲 Un altre repte" checks the current one, says how it went and picks another. Call and response uses half the wheel for the question (`barsPerBlock = max(2, ceil(wheel/2))`) and `callPhrase` fills every bar of it, ending on a shorter cell. "✏️ Inventa la teva roda" (`customWheelBox`, `readWheel` accepts Catalan or English chord names) stores `improvCfg.custom` and shows it first in the list.

**Improvisa (`improvise.js` + `showImprov` / `startImprov` in `play.js`):** a fourth door. The band loops a wheel (ROCKIN's or any song's, with its style and tempo) and nothing is judged. Three modes: `lliure` (open, until "Prou"), `dialeg` (two bars of a generated call phrase — `callPhrase`, built from the chord and the scale — then two bars for the student) and `reptes` (one of `CHALLENGES` for two turns of the wheel, checked against the counters). The keyboard offers `guideNotes(chord, key, guide)`: chord tones, pentatonic, whole scale or nothing; chord tones are filled, the rest outlined. `countNote` / `closeStats` keep counters (notes, distinct pitch classes, share in the chord, places used in the bar, empty bars, first/last note) and `readStats` turns them into plain sentences — no stars, no marks. Settings are stored in `rockin.play.improv`.

**The screen fits the window:** the score sizes its cards from how much room there is (`--score-h`), how many rows there are (`--score-rows`, set by `setBars`) and a cap per context (`--score-cap`), always keeping the card's proportion — nothing is cropped or squashed. Rows made of one single card (a compacted wheel) are laid out side by side (`.play-score.side`, each row as wide as its card), so a whole try is on screen at once. Full screen now goes on the whole play view, not just the mission screen, so the map and every menu stay usable with the mouse (`root.requestFullscreen`, `.play-view:fullscreen`).

**The example comes back when it is going badly:** a card mission that ends with no star, or with fewer than half the bars clean, counts as a rough try (`badTries` per mission id). The next try then starts with the demonstration again — the piano plays the card or the wheel while the ball shows where every note falls — and the main button says so ("♪ T'ho ensenyo i tornem-hi"), with "Torna-hi sense escoltar" beside it for whoever does not want it. Two rough tries in a row also light the keys (`helpBoost`), on top of the tempo that was already dropping (`tempoDrop`). There is no mission that only waits for the note: reading a card always comes with the rhythm being heard first.

**The keyboard fades in steps with the band level:** smaller at level 2 (`.small-keys`), hidden from 3 when the mission paints no keys; the level-up line says so.

**Level always on screen:** the mission bar carries a pill with the band level (`refreshLevelPill`: "El teu nivell · 2 de 6 · Canvis fluids" and the dots); clicking it opens the whole ladder — what each level means with your group, which ones are done and what is still missing for the next. The placement test now also sets the band level from the missions it lets you skip (capped at 4), so the level is right from the first minute.

**Supports that go away:** `keysWanted()` / `compactCards()` in `play.js` use the student's band level. From level 3 (playing from memory) card missions hide the picture of the keyboard (`showKeyboard`, `.play-mission.no-keys`, bigger cards); from level 4, a row whose bars all use the same card collapses to one tile (`row.perChord`, the other bars get `repeatOf`). The row then shows the whole wheel beside the card as chips (`row.chordBars` → `.score-wheel`), with the chord being played lit, and the badge counts "una carta · acord 2 de 4 · 2a volta", so it stays obvious how much is left to play; `setCurrent` also writes the current chord on the tile. The `🎹` button in the mission bar overrides both for the session (`keysManual`).

**Study one card:** every world on the map ends with a strip of its cards (`cardStrip`); clicking one opens a free practice of that card alone (`study: true`, keys painted, no stars saved). It is the way to work a single melodic contour.

**×2 passes:** a repeated row shares its card tiles, so a new pass now clears the previous one's marks and its green / red border (`startPass` in `score.js`).

**Two hands:** notes are assigned to a hand by middle C, unless the note is clearly nearer (≤ 7 semitones) the other hand's expected chord — so a chord played an octave higher or lower is still judged for the right hand. Chords may be spread over 170 ms (180 with two hands), and a long note may be released 350 ms (or 30% of its length) early before it counts as "mantén!".

- **Repte:** one card on loop. It is passed after **2 clean rounds in a row** (a round = one pass through the progression; a round with no notes doesn't count). Passing moves to the next card from the round after next. When every card of a difficulty is passed, its **exam** opens: `ceil(8 / bars)` rounds with a different card per bar. Stars: ≥90% hits = 3, ≥75% = 2, ≥50% = 1; 2 stars open the next difficulty. **⏭ Salta aquesta carta** (challenge mode, card targets, also while playing) marks the card as skipped (`tracks[key].skipped`): it opens the next card like a pass, shows dashed with ⏭, stays pending (passing it later removes the mark), and the exam opens when every card of the difficulty is passed or skipped. While playing, Sessió draws Juga's correction marks on the card (`session.marks`, `playhead.draw({ marks })`: red X + note name for wrong/extra/off-beat, red ring for missed, orange ring + missing notes for incomplete, ~ for rests, "mantén!" for short; two-hand cards put the right hand's labels above and the left's below). Progress is stored per level and meter (level 3 has one track) under `rockin.progress.v1`. "Mode professor" unlocks everything.
- **Escolta la carta:** the program plays the card on screen (the keys the piano shows) for the whole next round, on its own synth, and the round after it asks for that same card. Those example bars are not judged and don't count for or against the streak. Not available in exams.
- **End of each round:** a banner says whether the round was clean and, in a challenge, whether the card is unlocked (and how many clean rounds are still needed). A card only changes after it is passed.
- **Carta nova (free play):** "quan fas una volta sense errors" (default) keeps the card until a clean round; "a cada volta" and "a cada compàs" change it regardless. A "Següent carta" preview shows the next different card and when it arrives.
- **Ajuda al teclat:** *Notes que arriben* (falling notes), *Només les tecles* (dots on the chord's keys, no timing: the rhythm has to be read from the card) or *Només la carta* (nothing). Exams are always played with *Només la carta*. The challenge path marks each passed card with the least help used in its two passing rounds: ✓, ✓✓ or ★.
- **Pantalla completa:** the chords, card, feedback and keyboard fill the screen (Esc leaves full screen).
- **Shortcuts:** Space starts / pauses / resumes, Esc stops (both ignored while typing in a text box).

Difficulty (`tierOf` in `cards.js`):

| | Rhythm cards | Melodic cards |
|---|---|---|
| Fàcil | whole beats only (sounds, held notes, silences) | 4 notes |
| Intermedi | first subdivision (2 per beat, 3 in compound meters) | 5–6 notes |
| Difícil | finer subdivisions | 7–8 notes |

Available now: 4/4 has 10 / 14 / 6 cards; 3/4 has 11 / 15 / 0; 6/8 has 1 / 3 / 0; 9/8 and 12/8 have whole-beat cards (from the 3/4 and 4/4 sets) plus 3 compound cards each. Empty difficulties are skipped in the challenge path.

## Backing grid

The transport ticks 12 steps per pulse in simple meters (sixteenths and triplets both fit) and 6 per pulse in compound meters. Each style in `backing.js` is a function that receives the step and decides what to play. The time signature control offers only meters that have cards: 4/4, 3/4, 6/8, 9/8, 12/8.

## On-screen piano

`evaluator.guideForBar(bar)` gives the keys to show for every expected attack, with the attack's length (held slices included):
- Level 1: the root at or above C4.
- Level 2: the triad in root position, root at or above C4. With **Inversions** on, each chord takes the position (root, 1st or 2nd inversion, between G3 and G5) closest to the previous bar's, e.g. C | G | Am | F → C-E-G | B-D-G | C-E-A | C-F-A. Any position is accepted either way.
- Level 4: the root at or above G2 plus the level 2 chord.
- Level 3: one possible way to play the contour (rank 0 = root at or above C4, each higher rank the next triad note). Any chord tones that follow the contour are still accepted; once a note is played the piano shows the key actually played.

Playing exactly what the piano shows scores every note as a hit in all levels and meters (checked with a Node simulation).

## Levels ("Què toques")

Constants are in `js/evaluator.js`.

1. **Rhythm + root:** the chord's root on every attack, within ±120 ms (capped at 45% of the slice length).
2. **Rhythm + triad:** root, third and fifth on every attack, with first to last key within 90 ms.
4. **Bass + chord (two hands):** like level 2, plus the root as a bass below middle C (C4), lower than every other note. First to last key within 150 ms.
3. **Melodic contour:** notes must be chord tones (7ths etc. allowed). Each note must be higher, lower or the same as every earlier correct note, as the contour says. Timing is logged, not judged.

In levels 1–2, a note still sounding more than 100 ms into a silence is a miss. There is a one-bar count-in. Tempo counts felt pulses (dotted quarters in 6/8). Every bar's expectations and every verdict are logged to the browser console with the prefixes `[Transport]`, `[MIDI]`, `[Eval L1..3]` and `[Cards]`.

## Testing notes

There is no test suite in the repo. So far:
- `node --check js/*.js` for syntax.
- A Node simulation of the evaluator with a fake transport.
- A headless-Chrome run (`playwright-core` driving the installed Chrome) that fed correctly timed computer-keyboard notes. It got all hits in 4/4, 3/4 and 6/8, landing 0–22 ms late.

Headless Chrome denies Web MIDI, so a real MIDI keyboard and real speaker latency are still untested.
- The challenge flow (passing a card, card switch, finishing a difficulty, exam and stars), pause/resume and the example were checked in headless Chromium with an automatic player that plays what the piano shows.
- The chord picker, backing styles and on-screen piano were checked in headless Chromium with a stand-in for Tone.js (cdnjs was unreachable from the test machine): no page errors, every style triggers drums, bass and piano in every meter, no horizontal scroll at 390 px. **The actual sound of the new styles has not been heard yet.**

## Open questions

- **Melodic timing:** even spacing and loose timing are assumptions. Horizontal line segments (melodic 5, 6, 26, 27) are read as a repeated note; they might mean one held note.
- **Duplicates:** binary cards 7 and 10 are identical.
- **Image size:** ~1.9 MB per image (228 MB in `assets/`). Compress before hosting online.
- **Chords per bar:** only one chord per bar is supported.
- **Licence:** the card artwork is © ROCKIN.CAT, SCCL, under CC BY-NC-SA 4.0 (see the instruction cards in `DORS/`).
