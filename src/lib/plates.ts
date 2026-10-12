import { normalizePlate, type Vehicle } from './schema';

export type PlateHit = {
  vehicle: Vehicle;
  kind: 'exact' | 'fuzzy';
  readText: string; // the OCR line that produced the hit; shown in the alert, never saved
};

// Characters OCR commonly confuses on plates collapse to a single canonical symbol,
// so "8OB123" on the list still matches a read of "BO8I23".
const CONFUSABLE: Record<string, string> = {
  O: '0', Q: '0', D: '0',
  I: '1', L: '1',
  Z: '2',
  S: '5',
  B: '8',
  G: '6',
};

function fuzzyKey(normalized: string): string {
  let out = '';
  for (const ch of normalized) out += CONFUSABLE[ch] ?? ch;
  return out;
}

// Plates shorter than this must match a whole OCR token; longer ones may be found
// inside a longer line (e.g. "CALIFORNIA 7ABC123"). Short substrings false-positive too often.
const MIN_SUBSTRING_LEN = 5;

export class PlateIndex {
  private exact = new Map<string, Vehicle>();
  private fuzzy = new Map<string, Vehicle>();
  private long: { vehicle: Vehicle; fuzzy: string }[] = [];

  constructor(vehicles: Vehicle[]) {
    for (const p of vehicles) {
      if (!p.plate) continue;
      const fk = fuzzyKey(p.plate);
      this.exact.set(p.plate, p);
      this.fuzzy.set(fk, p);
      if (p.plate.length >= MIN_SUBSTRING_LEN) this.long.push({ vehicle: p, fuzzy: fk });
    }
  }

  get size() {
    return this.exact.size;
  }

  /** Returns the first listed vehicle whose plate is found in the OCR lines, preferring exact matches. */
  match(lines: string[]): PlateHit | null {
    let fuzzyHit: PlateHit | null = null;

    for (const line of lines) {
      const tokens = line.split(/\s+/).map(normalizePlate).filter(Boolean);
      const candidates = new Set<string>(tokens);
      // Plates are often printed with a space or dash: "ABC 1234".
      for (let i = 0; i + 1 < tokens.length; i++) candidates.add(tokens[i] + tokens[i + 1]);
      candidates.add(normalizePlate(line));

      for (const c of candidates) {
        const hit = this.exact.get(c);
        if (hit) return { vehicle: hit, kind: 'exact', readText: line };
        if (!fuzzyHit) {
          const f = this.fuzzy.get(fuzzyKey(c));
          if (f) fuzzyHit = { vehicle: f, kind: 'fuzzy', readText: line };
        }
      }

      const whole = normalizePlate(line);
      const wholeFuzzy = fuzzyKey(whole);
      for (const entry of this.long) {
        if (whole.includes(entry.vehicle.plate)) {
          return { vehicle: entry.vehicle, kind: 'exact', readText: line };
        }
        if (!fuzzyHit && wholeFuzzy.includes(entry.fuzzy)) {
          fuzzyHit = { vehicle: entry.vehicle, kind: 'fuzzy', readText: line };
        }
      }
    }

    return fuzzyHit;
  }
}
