// The plate list file format. This is what's stored on the phone and what will be
// shared, so anything read from a file is untrusted and goes through parseDataFile().

export const FORMAT = 'plate-scanner';
export const VERSION = 1;

export type Agent = {
  id: string;
  name: string;
  agency: string;
  mask: string;
  vest: string;
  pants: string;
  shirt: string;
  coat: string;
  shoes: string;
  eyeColor: string;
  hairColor: string;
  skinColor: string;
};

export type Sighting = {
  id: string;
  date: string; // YYYY-MM-DD, local time
  time: string; // HH:MM, local time
  address: string;
  latitude: number | null;
  longitude: number | null;
  agents: Agent[];
};

export type Vehicle = {
  id: string;
  plate: string; // normalized: A-Z and 0-9 only. "" for a vehicle with no plate
  make: string;
  model: string;
  color: string;
  year: number | null;
  agency: string;
  notes: string;
  images: string[]; // paths relative to the data directory, e.g. "media/abc.jpg"
  videos: string[];
  sightings: Sighting[];
};

export type DataFile = {
  format: typeof FORMAT;
  version: typeof VERSION;
  vehicles: Vehicle[];
};

export const AGENT_FIELDS = [
  ['name', 'Name'],
  ['agency', 'Agency'],
  ['mask', 'Mask'],
  ['vest', 'Vest'],
  ['shirt', 'Shirt'],
  ['coat', 'Coat'],
  ['pants', 'Pants'],
  ['shoes', 'Shoes'],
  ['eyeColor', 'Eye color'],
  ['hairColor', 'Hair color'],
  ['skinColor', 'Skin color'],
] as const satisfies readonly (readonly [keyof Omit<Agent, 'id'>, string])[];

/** Uppercases and strips everything that isn't A-Z / 0-9 ("abc-1 23" -> "ABC123"). */
export function normalizePlate(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function newId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

const pad = (n: number) => String(n).padStart(2, '0');

export function localDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function localTime(d: Date): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function emptyDataFile(): DataFile {
  return { format: FORMAT, version: VERSION, vehicles: [] };
}

export function newVehicle(plate: string, notes = ''): Vehicle {
  return {
    id: newId(),
    plate,
    make: '',
    model: '',
    color: '',
    year: null,
    agency: '',
    notes,
    images: [],
    videos: [],
    sightings: [],
  };
}

export function newSighting(at = new Date()): Sighting {
  return { id: newId(), date: localDate(at), time: localTime(at), address: '', latitude: null, longitude: null, agents: [] };
}

export function newAgent(): Agent {
  return {
    id: newId(),
    name: '',
    agency: '',
    mask: '',
    vest: '',
    pants: '',
    shirt: '',
    coat: '',
    shoes: '',
    eyeColor: '',
    hairColor: '',
    skinColor: '',
  };
}

export const NO_PLATE = 'No plate';

/** The plate, or a stand-in for a vehicle without one. */
export function plateLabel(v: Vehicle): string {
  return v.plate || NO_PLATE;
}

/** One-line description, e.g. "2019 white Ford Explorer · ICE". */
export function describeVehicle(v: Vehicle): string {
  const car = [v.year ?? '', v.color, v.make, v.model].filter(Boolean).join(' ');
  return [car, v.agency].filter(Boolean).join(' · ');
}

// ---- Parsing untrusted input ----

const MAX_TEXT = 2000;

function str(v: unknown): string {
  return typeof v === 'string' ? v.slice(0, MAX_TEXT) : typeof v === 'number' ? String(v) : '';
}

function num(v: unknown): number | null {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
}

function arr(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

function obj(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

// Media references must stay inside the media directory. A shared file could
// otherwise point at "../anything" and get it deleted along with a vehicle.
const MEDIA_REF = /^media\/[A-Za-z0-9._-]+$/;
function mediaRefs(v: unknown): string[] {
  return arr(v).filter((r): r is string => typeof r === 'string' && MEDIA_REF.test(r) && !r.includes('..'));
}

function matchesPattern(v: string, re: RegExp) {
  return re.test(v) ? v : '';
}

function parseAgent(raw: unknown): Agent {
  const o = obj(raw);
  const a = newAgent();
  for (const [key] of AGENT_FIELDS) a[key] = str(o[key]);
  if (typeof o.id === 'string' && o.id) a.id = o.id.slice(0, 64);
  return a;
}

function parseSighting(raw: unknown): Sighting {
  const o = obj(raw);
  const lat = num(o.latitude);
  const lon = num(o.longitude);
  return {
    id: typeof o.id === 'string' && o.id ? o.id.slice(0, 64) : newId(),
    date: matchesPattern(str(o.date), /^\d{4}-\d{2}-\d{2}$/),
    time: matchesPattern(str(o.time), /^\d{2}:\d{2}$/),
    address: str(o.address),
    latitude: lat != null && Math.abs(lat) <= 90 ? lat : null,
    longitude: lon != null && Math.abs(lon) <= 180 ? lon : null,
    agents: arr(o.agents).map(parseAgent),
  };
}

function parseVehicle(raw: unknown): Vehicle | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = obj(raw);
  const plate = normalizePlate(str(o.plate));
  const year = num(o.year);
  return {
    id: typeof o.id === 'string' && o.id ? o.id.slice(0, 64) : newId(),
    plate,
    make: str(o.make),
    model: str(o.model),
    color: str(o.color),
    year: year != null && Number.isInteger(year) ? year : null,
    agency: str(o.agency),
    notes: str(o.notes),
    images: mediaRefs(o.images),
    videos: mediaRefs(o.videos),
    sightings: arr(o.sightings).map(parseSighting),
  };
}

/** Validates and normalizes a parsed JSON value. Throws if it isn't a plate list. */
export function parseDataFile(raw: unknown): DataFile {
  const o = obj(raw);
  if (o.format !== FORMAT) throw new Error('This is not a Plate Scanner file.');
  if (typeof o.version !== 'number' || o.version > VERSION) {
    throw new Error('This file was made by a newer version of Plate Scanner. Update the app to open it.');
  }
  const vehicles = arr(o.vehicles)
    .map(parseVehicle)
    .filter((v): v is Vehicle => v != null);
  return { format: FORMAT, version: VERSION, vehicles };
}

/**
 * Parses a pasted or imported text list. One plate per line; an optional note may
 * follow after a comma, tab or semicolon ("ABC1234, blue sedan"). A header row is skipped.
 */
export function parsePlateList(text: string): Vehicle[] {
  const out = new Map<string, Vehicle>();
  for (const rawLine of text.split(/\r?\n/)) {
    const [first, ...rest] = rawLine.split(/[,;\t]/);
    const plate = normalizePlate(first ?? '');
    if (!plate || plate === 'PLATE' || plate === 'LICENSEPLATE') continue;
    out.set(plate, newVehicle(plate, rest.join(',').trim().replace(/^"|"$/g, '')));
  }
  return [...out.values()];
}

/**
 * Merges incoming vehicles into the list, matching on plate, or on id for vehicles
 * without a plate. Fields already filled in
 * locally are kept; blank ones are filled from the incoming copy. Sightings, agents,
 * images and videos are combined without duplicates.
 */
export function mergeVehicles(existing: Vehicle[], incoming: Vehicle[]): { vehicles: Vehicle[]; added: number; updated: number } {
  const keyOf = (v: Vehicle) => (v.plate ? `plate:${v.plate}` : `id:${v.id}`);
  const byKey = new Map(existing.map((v) => [keyOf(v), v]));
  const ids = new Set(existing.map((v) => v.id));
  let added = 0;
  let updated = 0;
  for (const inc of incoming) {
    const key = keyOf(inc);
    const cur = byKey.get(key);
    if (!cur) {
      // An id already used by a different vehicle gets replaced.
      const v = ids.has(inc.id) ? { ...inc, id: newId() } : inc;
      ids.add(v.id);
      byKey.set(key, v);
      added++;
      continue;
    }
    const sightingIds = new Set(cur.sightings.map((s) => s.id));
    byKey.set(key, {
      ...cur,
      make: cur.make || inc.make,
      model: cur.model || inc.model,
      color: cur.color || inc.color,
      year: cur.year ?? inc.year,
      agency: cur.agency || inc.agency,
      notes: cur.notes || inc.notes,
      images: [...new Set([...cur.images, ...inc.images])],
      videos: [...new Set([...cur.videos, ...inc.videos])],
      sightings: [...cur.sightings, ...inc.sightings.filter((s) => !sightingIds.has(s.id))],
    });
    updated++;
  }
  return { vehicles: [...byKey.values()], added, updated };
}
