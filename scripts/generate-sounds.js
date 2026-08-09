/**
 * Synthesizes the game's sound effects as 16-bit PCM WAV files.
 *
 * Everything the game plays is generated here rather than downloaded, so the
 * repo stays self-contained, the licensing is unambiguous, and the sounds can
 * be retuned by editing numbers instead of hunting for new assets.
 *
 * What makes these read as "produced" rather than as bare test tones:
 *   - every pitched sound is a stack of harmonics with their own decay rates,
 *     because a single sine wave always sounds like a beep
 *   - a short reverb tail on the musical cues, so they sit in a space
 *   - slight detuning between layers, which thickens a tone the way a chorus
 *     pedal does
 *   - all of it tuned to one scale (C major pentatonic) so no two sounds that
 *     can overlap ever clash
 *
 * Run with:  node scripts/generate-sounds.js
 */

const fs = require('fs');
const path = require('path');

const SAMPLE_RATE = 44100;
const OUT_DIR = path.join(__dirname, '..', 'assets', 'sounds');

/** Wrap raw mono float samples (-1..1) in a WAV container. */
function toWav(samples) {
  const bytesPerSample = 2;
  const dataSize = samples.length * bytesPerSample;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // PCM header size
  buffer.writeUInt16LE(1, 20); // format = PCM
  buffer.writeUInt16LE(1, 22); // mono
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(SAMPLE_RATE * bytesPerSample, 28); // byte rate
  buffer.writeUInt16LE(bytesPerSample, 32); // block align
  buffer.writeUInt16LE(16, 34); // bits per sample
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  for (let i = 0; i < samples.length; i++) {
    // Clamp before scaling so overdriven mixes distort gracefully rather than
    // wrapping around into noise.
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    buffer.writeInt16LE(Math.round(clamped * 32767), 44 + i * bytesPerSample);
  }

  return buffer;
}

const seconds = (n) => Math.floor(SAMPLE_RATE * n);

/** Exponential decay envelope - the natural shape for struck and plucked sounds. */
const decay = (t, rate) => Math.exp(-t * rate);

/** Short fade at both ends so a clip never starts or stops on a click. */
function deClick(samples) {
  const fade = Math.min(seconds(0.006), Math.floor(samples.length / 2));
  for (let i = 0; i < fade; i++) {
    const gain = i / fade;
    samples[i] *= gain;
    samples[samples.length - 1 - i] *= gain;
  }
  return samples;
}

/** Deterministic noise so regenerating the assets produces identical files. */
function makeNoise(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return (state / 4294967296) * 2 - 1;
  };
}

/** Light one-pole lowpass, used to take the fizz off raw noise. */
function lowpass(samples, cutoff) {
  const dt = 1 / SAMPLE_RATE;
  const rc = 1 / (2 * Math.PI * cutoff);
  const alpha = dt / (rc + dt);
  let previous = 0;
  return samples.map((s) => {
    previous += alpha * (s - previous);
    return previous;
  });
}

/** One-pole highpass, for thinning out sounds that would otherwise be muddy. */
function highpass(samples, cutoff) {
  const dt = 1 / SAMPLE_RATE;
  const rc = 1 / (2 * Math.PI * cutoff);
  const alpha = rc / (rc + dt);
  const out = new Array(samples.length);
  let previousIn = 0;
  let previousOut = 0;
  for (let i = 0; i < samples.length; i++) {
    previousOut = alpha * (previousOut + samples[i] - previousIn);
    previousIn = samples[i];
    out[i] = previousOut;
  }
  return out;
}

/**
 * Cheap reverb: a handful of decaying delay taps at prime-ish spacings.
 *
 * Not a real room simulation, but enough to stop a sound ending abruptly, which
 * is most of what separates a polished cue from a raw synth tone.
 */
function reverb(samples, { mix = 0.3, decayRate = 3.2, taps = 9, spread = 0.037 } = {}) {
  const tail = seconds(spread * taps + 0.35);
  const out = new Array(samples.length + tail).fill(0);

  for (let i = 0; i < samples.length; i++) out[i] = samples[i];

  for (let tap = 1; tap <= taps; tap++) {
    // Irregular spacing avoids the metallic ring that even taps produce.
    const delay = seconds(spread * tap * (1 + (tap % 3) * 0.11));
    const gain = mix * Math.exp(-tap / decayRate) * (tap % 2 === 0 ? 0.82 : 1);
    for (let i = 0; i < samples.length; i++) {
      const target = i + delay;
      if (target < out.length) out[target] += samples[i] * gain;
    }
  }

  return out;
}

/**
 * A struck-bell voice: a stack of partials, each decaying at its own rate.
 *
 * Higher partials fading faster than the fundamental is what the ear reads as
 * a physical object being struck.
 */
function bell(length, freq, { gain = 0.3, decayRate = 5, partials = [1, 2, 2.76, 5.4] } = {}) {
  const out = new Array(length).fill(0);
  for (let p = 0; p < partials.length; p++) {
    const ratio = partials[p];
    const partialGain = gain / (p + 1.35);
    const partialDecay = decayRate * (1 + p * 0.55);
    for (let i = 0; i < length; i++) {
      const t = i / SAMPLE_RATE;
      out[i] += Math.sin(2 * Math.PI * freq * ratio * t) * decay(t, partialDecay) * partialGain;
    }
  }
  return out;
}

/** Mix `source` into `target` starting at `startSeconds`. */
function mixInto(target, source, startSeconds, gain = 1) {
  const offset = seconds(startSeconds);
  for (let i = 0; i < source.length; i++) {
    const index = offset + i;
    if (index >= 0 && index < target.length) target[index] += source[i] * gain;
  }
  return target;
}

/** C major pentatonic, the scale everything here is tuned to. */
const NOTE = {
  C4: 261.63,
  D4: 293.66,
  E4: 329.63,
  G4: 392.0,
  A4: 440.0,
  C5: 523.25,
  D5: 587.33,
  E5: 659.25,
  G5: 783.99,
  A5: 880.0,
  C6: 1046.5,
  E6: 1318.51,
  G6: 1567.98,
};

/** A soft, short click for generic button presses. */
function buildTap() {
  const length = seconds(0.09);
  const body = bell(length, NOTE.G5, { gain: 0.16, decayRate: 26, partials: [1, 2.4] });
  return deClick(reverb(body, { mix: 0.16, taps: 5, spread: 0.021 }));
}

/** Picking up a tube: a soft marimba-like pluck that rises. */
function buildSelect() {
  const length = seconds(0.26);
  const out = new Array(length).fill(0);
  const noise = makeNoise(4242);

  for (let i = 0; i < length; i++) {
    const t = i / SAMPLE_RATE;
    // A small upward pitch bend reads as lifting something.
    const bend = 1 + 0.045 * (1 - decay(t, 30));
    const envelope = decay(t, 13);
    out[i] =
      Math.sin(2 * Math.PI * NOTE.C5 * bend * t) * envelope * 0.26 +
      // Detuned twin, which thickens the tone without changing the pitch.
      Math.sin(2 * Math.PI * NOTE.C5 * 1.004 * bend * t) * envelope * 0.16 +
      Math.sin(2 * Math.PI * NOTE.G5 * bend * t) * decay(t, 19) * 0.1 +
      // Breath of air on the attack, to give the pluck an edge.
      noise() * decay(t, 90) * 0.07;
  }

  return deClick(reverb(out, { mix: 0.24, taps: 7, spread: 0.026 }));
}

/** Liquid pouring: layered glugs, a stream hiss, and a wet tail. */
function buildPour() {
  const length = seconds(0.62);
  const noise = makeNoise(20240816);
  const out = new Array(length).fill(0);

  for (let i = 0; i < length; i++) {
    const t = i / SAMPLE_RATE;
    // Swell in, hold, then taper - the shape of a stream, not an impact.
    const envelope = Math.min(1, t / 0.055) * decay(Math.max(0, t - 0.16), 4.4);

    // Two glug oscillators at different rates, which stops the wobble sounding
    // like a single mechanical LFO.
    const glugA = Math.sin(2 * Math.PI * 9.5 * t) * 46;
    const glugB = Math.sin(2 * Math.PI * 14.3 * t + 1.1) * 22;
    const freq = 250 + glugA + glugB - 70 * t;

    out[i] =
      Math.sin(2 * Math.PI * freq * t) * envelope * 0.3 +
      Math.sin(2 * Math.PI * freq * 1.5 * t) * envelope * 0.09 +
      noise() * envelope * 0.42;
  }

  // Band-limit the noise so it reads as water rather than static.
  const streamNoise = highpass(lowpass(out, 1700), 180);
  return deClick(reverb(streamNoise, { mix: 0.22, taps: 8, spread: 0.029 }));
}

/** Droplet plink layered under the pour landing. */
function buildDrop() {
  const length = seconds(0.3);
  const out = new Array(length).fill(0);
  for (let i = 0; i < length; i++) {
    const t = i / SAMPLE_RATE;
    // A fast downward bend is the classic water-drop cue.
    const freq = 1500 * Math.exp(-t * 26) + 420;
    out[i] = Math.sin(2 * Math.PI * freq * t) * decay(t, 17) * 0.3;
  }
  return deClick(reverb(out, { mix: 0.3, taps: 8, spread: 0.024 }));
}

/** A tube just completed: a bright rising bell figure with a shimmer tail. */
function buildComplete() {
  const length = seconds(1.0);
  const out = new Array(length).fill(0);

  // Rising thirds, so the cue always feels like an upward resolution.
  mixInto(out, bell(seconds(0.7), NOTE.E5, { gain: 0.3, decayRate: 5.5 }), 0);
  mixInto(out, bell(seconds(0.7), NOTE.G5, { gain: 0.26, decayRate: 5.5 }), 0.055);
  mixInto(out, bell(seconds(0.66), NOTE.C6, { gain: 0.3, decayRate: 5 }), 0.11);
  // High sparkle an octave up, quiet and quick.
  mixInto(out, bell(seconds(0.4), NOTE.E6, { gain: 0.11, decayRate: 11 }), 0.16);

  return deClick(reverb(out, { mix: 0.34, decayRate: 3.6, taps: 10, spread: 0.041 }));
}

/** Level cleared: a full arpeggio resolving up two octaves. */
function buildWin() {
  const length = seconds(2.0);
  const out = new Array(length).fill(0);

  const figure = [
    { note: NOTE.C4, at: 0, gain: 0.22 },
    { note: NOTE.E4, at: 0.085, gain: 0.22 },
    { note: NOTE.G4, at: 0.17, gain: 0.23 },
    { note: NOTE.C5, at: 0.255, gain: 0.25 },
    { note: NOTE.E5, at: 0.34, gain: 0.25 },
    { note: NOTE.G5, at: 0.425, gain: 0.26 },
    { note: NOTE.C6, at: 0.51, gain: 0.3 },
  ];

  for (const step of figure) {
    mixInto(out, bell(seconds(1.1), step.note, { gain: step.gain, decayRate: 3.4 }), step.at);
  }

  // Sustained chord underneath, which turns a run of notes into a fanfare.
  for (const note of [NOTE.C5, NOTE.E5, NOTE.G5]) {
    mixInto(out, bell(seconds(1.4), note, { gain: 0.1, decayRate: 2.2, partials: [1, 2] }), 0.52);
  }
  // Final sparkle on top of the landing chord.
  mixInto(out, bell(seconds(0.7), NOTE.G6, { gain: 0.1, decayRate: 7 }), 0.6);

  return deClick(reverb(out, { mix: 0.4, decayRate: 4, taps: 12, spread: 0.045 }));
}

/**
 * Rejected tap: a soft muted thud.
 *
 * Deliberately dull and short - an error sound the player hears often must read
 * as "not that" without ever being unpleasant.
 */
function buildInvalid() {
  const length = seconds(0.2);
  const noise = makeNoise(777);
  const out = new Array(length);
  for (let i = 0; i < length; i++) {
    const t = i / SAMPLE_RATE;
    const envelope = decay(t, 22);
    // Falling pitch reads as negative; the noise supplies the body.
    out[i] = (Math.sin(2 * Math.PI * (165 - 190 * t) * t) * 0.34 + noise() * 0.1) * envelope;
  }
  return deClick(reverb(lowpass(out, 780), { mix: 0.14, taps: 5, spread: 0.023 }));
}

/** Starting a level: a short airy swell that resolves onto the tonic. */
function buildLevelStart() {
  const length = seconds(0.9);
  const noise = makeNoise(31337);
  const out = new Array(length).fill(0);

  for (let i = 0; i < length; i++) {
    const t = i / SAMPLE_RATE;
    // Rising filtered noise: a whoosh into the level.
    const swell = Math.min(1, t / 0.34) * decay(Math.max(0, t - 0.34), 7);
    out[i] = noise() * swell * 0.16;
  }

  const air = lowpass(highpass(out, 400), 2600);
  mixInto(air, bell(seconds(0.8), NOTE.C5, { gain: 0.17, decayRate: 4 }), 0.3);
  mixInto(air, bell(seconds(0.8), NOTE.G5, { gain: 0.11, decayRate: 4.4 }), 0.36);

  return deClick(reverb(air, { mix: 0.3, taps: 9, spread: 0.038 }));
}

const SOUNDS = {
  tap: buildTap,
  select: buildSelect,
  pour: buildPour,
  drop: buildDrop,
  complete: buildComplete,
  win: buildWin,
  invalid: buildInvalid,
  levelStart: buildLevelStart,
};

fs.mkdirSync(OUT_DIR, { recursive: true });
for (const [name, build] of Object.entries(SOUNDS)) {
  const file = path.join(OUT_DIR, `${name}.wav`);
  fs.writeFileSync(file, toWav(build()));
  console.log(`wrote ${path.relative(path.join(__dirname, '..'), file)}`);
}
