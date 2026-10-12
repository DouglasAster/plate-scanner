// Generates assets/sounds/alarm.wav: three long, loud car-horn honks, then a short
// pause. The alarm loops the file, so the pattern repeats until it's silenced.
//
// A car horn is two tones a few notes apart (here about 415 Hz and 520 Hz), each a
// buzzy, harmonic-rich wave from the vibrating diaphragm. Each tone is built from its
// harmonics (a band-limited sawtooth), the two are mixed, and the mix is soft-clipped
// so it's as loud as possible without harsh digital clipping.
// Usage: node scripts/make-horn.js
const fs = require('fs');
const path = require('path');

const rate = 22050;
const TONES = [415, 520]; // Hz
const HONK = 1.3; // seconds per honk
const GAP = 0.22; // silence between honks
const HONKS = 3;
const PAUSE = 0.9; // silence after the third honk, before the loop repeats
const ATTACK = 0.012;
const RELEASE = 0.045;

const total = HONKS * HONK + (HONKS - 1) * GAP + PAUSE;
const n = Math.round(rate * total);
const samples = new Float32Array(n);

// Band-limited sawtooth: harmonics up to just under Nyquist, amplitude 1/k.
function sawtooth(freq, t) {
  let s = 0;
  for (let k = 1; k * freq < rate / 2 - 500; k++) s += Math.sin(2 * Math.PI * k * freq * t) / k;
  return s;
}

for (let h = 0; h < HONKS; h++) {
  const start = h * (HONK + GAP);
  const first = Math.round(start * rate);
  const len = Math.round(HONK * rate);
  for (let i = 0; i < len; i++) {
    const t = i / rate;
    const env = Math.min(1, t / ATTACK, (HONK - t) / RELEASE);
    // Real horns sag slightly in pitch as they start; a few cents over the first 60 ms.
    const sag = 1 - 0.006 * Math.max(0, 1 - t / 0.06);
    let s = 0;
    for (const f of TONES) s += sawtooth(f * sag, t);
    samples[first + i] = s * env;
  }
}

// Soft-clip for loudness, then normalize to just under full scale.
let peak = 0;
for (let i = 0; i < n; i++) {
  samples[i] = Math.tanh(1.8 * samples[i]);
  peak = Math.max(peak, Math.abs(samples[i]));
}
const data = Buffer.alloc(n * 2);
for (let i = 0; i < n; i++) data.writeInt16LE(Math.round((samples[i] / peak) * 0.98 * 32767), i * 2);

const h = Buffer.alloc(44);
h.write('RIFF', 0);
h.writeUInt32LE(36 + data.length, 4);
h.write('WAVE', 8);
h.write('fmt ', 12);
h.writeUInt32LE(16, 16);
h.writeUInt16LE(1, 20); // PCM
h.writeUInt16LE(1, 22); // mono
h.writeUInt32LE(rate, 24);
h.writeUInt32LE(rate * 2, 28);
h.writeUInt16LE(2, 32);
h.writeUInt16LE(16, 34);
h.write('data', 36);
h.writeUInt32LE(data.length, 40);

const out = path.join(__dirname, '..', 'assets', 'sounds', 'alarm.wav');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, Buffer.concat([h, data]));
console.log('wrote', out, `(${total.toFixed(2)} s loop)`);
