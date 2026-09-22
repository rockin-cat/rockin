// Transport: owns the Tone.js clock. It schedules the backing track on a fixed
// grid and answers "where in the music is the sound the student is hearing at
// this moment?". The playhead and the MIDI evaluator both ask that same
// question, so what is drawn and what is judged run off one clock.

import { mod } from './theory.js';
import { stepsPerPulse } from './backing.js';

// Delay (ms) between the sound leaving the browser and reaching the ear that the
// browser doesn't know about (e.g. Bluetooth headphones). Set by the user.
let extraLatencyMs = 0;
export const setExtraLatency = (ms) => {
  extraLatencyMs = Number(ms) || 0;
};

// How late the backing steps have been scheduled lately (ms), for diagnostics.
export const scheduling = { worstLateMs: 0 };

export function createTransport({ progression, meter, tempo, countInBars, backing }) {
  const transport = Tone.getTransport();
  transport.cancel();
  transport.stop();

  const ppq = transport.PPQ;
  const pulseTicks = ((ppq * 4) / meter.beatUnit) * meter.unitsPerPulse;
  const barTicks = pulseTicks * meter.pulses;
  const subsPerPulse = stepsPerPulse(meter);
  const stepTicks = pulseTicks / subsPerPulse;
  const stepsPerBar = meter.pulses * subsPerPulse;

  transport.timeSignature = [meter.beats, meter.beatUnit];
  // `tempo` counts felt pulses per minute (dotted quarters in 6/8); Tone's bpm counts quarter notes.
  transport.bpm.value = tempo * (pulseTicks / ppq);
  const ticksPerSecond = (ppq * transport.bpm.value) / 60;
  const pulseSeconds = pulseTicks / ticksPerSecond;

  const chordForBar = (bar) => progression[mod(bar, progression.length)];
  let startTime = Infinity; // when the latest start or resume becomes audible
  let pausedTicks = 0; // position shown until then
  const scheduled = new Set();

  const eventId = transport.scheduleRepeat(
    (time) => {
      const late = (Tone.getContext().rawContext.currentTime - time) * 1000;
      if (late > scheduling.worstLateMs) scheduling.worstLateMs = late;
      const step = Math.round(transport.getTicksAtTime(time) / stepTicks);
      const rawBar = Math.floor(step / stepsPerBar);
      const stepInBar = step - rawBar * stepsPerBar;
      const bar = rawBar - countInBars;
      backing.playStep({
        time,
        countIn: bar < 0,
        chord: bar < 0 ? null : chordForBar(bar),
        nextChord: bar < 0 ? null : chordForBar(bar + 1),
        bar,
        subsPerPulse,
        compound: meter.compound,
        pulse: Math.floor(stepInBar / subsPerPulse),
        sub: stepInBar % subsPerPulse,
        pulses: meter.pulses,
        pulseSeconds,
      });
    },
    `${stepTicks}i`,
    0,
  );

  /** Musical position of what is coming out of the speakers at `perfTimeMs` (performance.now clock). */
  function positionAt(perfTimeMs = performance.now()) {
    const heard = heardContextTime(perfTimeMs);
    // Tone's transport is shared: until this run's start is audible it can still
    // report the position of a run that was stopped a moment ago.
    const ticks = heard < startTime ? pausedTicks : transport.getTicksAtTime(heard);
    const rawBar = Math.floor(ticks / barTicks);
    const bar = rawBar - countInBars;
    const barFraction = (ticks - rawBar * barTicks) / barTicks;
    return {
      ticks,
      bar,
      barFraction,
      countIn: bar < 0,
      pulse: Math.floor(barFraction * meter.pulses),
      pulseFraction: (barFraction * meter.pulses) % 1,
      loop: Math.floor(bar / progression.length),
      chordIndex: mod(bar, progression.length),
      chord: chordForBar(bar),
    };
  }

  return {
    meter,
    progression,
    barTicks,
    ticksPerSecond,
    get running() {
      return transport.state === 'started';
    },
    get paused() {
      return transport.state === 'paused';
    },
    /** Runs `callback(audioTime)` when the music reaches `tick`. */
    scheduleAt(tick, callback) {
      const id = transport.schedule(callback, `${Math.round(tick)}i`);
      scheduled.add(id);
      return id;
    },
    pause() {
      const at = Tone.now() + 0.02;
      transport.pause(at);
      pausedTicks = transport.getTicksAtTime(at);
      console.log('[Transport] paused');
    },
    resume() {
      startTime = Tone.now() + 0.05;
      transport.start(startTime);
      console.log('[Transport] resumed');
    },
    positionAt,
    chordForBar,
    barStartTicks: (bar) => (bar + countInBars) * barTicks,
    start() {
      startTime = Tone.now() + 0.05;
      transport.start(startTime);
      console.log(
        `[Transport] start: ${progression.map((c) => c.symbol).join(' | ')} in ${meter.label} at ${tempo} pulses/min, ${countInBars} count-in bar(s)`,
      );
    },
    dispose() {
      for (const id of scheduled) transport.clear(id);
      transport.clear(eventId);
      transport.stop();
    },
  };
}

// getOutputTimestamp() pairs the audio-clock time of the sample leaving the
// speakers with the performance.now() time it does so, which accounts for
// output latency. Older engines fall back to currentTime minus reported latency.
function heardContextTime(perfTimeMs) {
  const context = Tone.getContext().rawContext;
  const extra = extraLatencyMs / 1000;
  const stamp = context.getOutputTimestamp?.();
  if (stamp?.contextTime > 0) {
    return stamp.contextTime + (perfTimeMs - stamp.performanceTime) / 1000 - extra;
  }
  const latency = context.outputLatency || context.baseLatency || 0;
  return context.currentTime - latency - extra + (perfTimeMs - performance.now()) / 1000;
}

/** What the browser reports as its own output delay, in ms. */
export function outputLatencyMs() {
  const context = Tone.getContext().rawContext;
  return Math.round(((context.outputLatency || 0) + (context.baseLatency || 0)) * 1000);
}
