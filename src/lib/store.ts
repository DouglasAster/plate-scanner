import { Directory, File, Paths } from 'expo-file-system';
import * as SQLite from 'expo-sqlite';
import { excludeFromBackup } from '../../modules/backup-exclusion';
import { builtinVehicles } from './builtinRegistry';
import { emptyDataFile, localDate, localTime, newId, newVehicle, parseDataFile, type DataFile, type Vehicle } from './schema';

// Everything the app keeps lives in one directory, excluded from backups:
//   data/plates.json   the plate list (see schema.ts)
//   data/media/        photos and videos referenced from it as "media/<name>"

const dataDir = new Directory(Paths.document, 'data');
const mediaDir = new Directory(dataDir, 'media');
const dataFile = new File(dataDir, 'plates.json');
const tmpFile = new File(dataDir, 'plates.json.tmp');

function ensureDirs() {
  mediaDir.create({ idempotent: true, intermediates: true });
  excludeFromBackup(dataDir.uri);
}

export function mediaUri(ref: string): string {
  return new File(dataDir, ref).uri;
}

/** Moves a file (e.g. a fresh camera capture) into the media directory. Returns its ref. */
export function adoptMedia(uri: string): string | null {
  try {
    ensureDirs();
    const src = new File(uri);
    const name = `${newId()}.${src.extension.replace('.', '') || 'jpg'}`;
    src.moveSync(new File(mediaDir, name));
    return `media/${name}`;
  } catch (e) {
    console.warn('Could not save media', e);
    return null;
  }
}

export function deleteMedia(refs: string[]) {
  for (const ref of refs) {
    try {
      const f = new File(dataDir, ref);
      if (f.exists) f.delete();
    } catch {}
  }
}

export function loadData(): DataFile {
  ensureDirs();
  const migrated = migrateLegacyDatabase();
  if (migrated) return migrated;
  // A new install starts with the built-in registry. Once the file exists (even if the
  // user has since erased everything), it's never re-seeded automatically.
  if (!dataFile.exists) {
    const seeded = { ...emptyDataFile(), vehicles: builtinVehicles() };
    saveData(seeded);
    return seeded;
  }
  try {
    return parseDataFile(JSON.parse(dataFile.textSync()));
  } catch (e) {
    // Keep the unreadable file for recovery rather than overwriting it.
    console.warn('Could not read plate list', e);
    dataFile.moveSync(new File(dataDir, `plates.unreadable-${Date.now()}.json`));
    return emptyDataFile();
  }
}

/** Writes to a temp file and swaps it in, so a crash mid-write can't corrupt the list. */
export function saveData(data: DataFile) {
  ensureDirs();
  tmpFile.write(JSON.stringify(data, null, 2));
  tmpFile.moveSync(dataFile, { overwrite: true });
}

// ---- One-time migration from the old SQLite database ----

type LegacyPlate = { plate: string; note: string };
type LegacyMatch = {
  plate: string;
  latitude: number | null;
  longitude: number | null;
  photo_uri: string | null;
  frame_uri: string | null;
  created_at: number;
};

function migrateLegacyDatabase(): DataFile | null {
  const dir = SQLite.defaultDatabaseDirectory as string;
  const dbFile = new File(dir.startsWith('file://') ? dir : `file://${dir}`, 'plates.db');
  if (!dbFile.exists) return null;

  const data = dataFile.exists ? parseDataFile(JSON.parse(dataFile.textSync())) : emptyDataFile();
  const byPlate = new Map<string, Vehicle>(data.vehicles.map((v) => [v.plate, v]));
  const vehicleFor = (plate: string, note = '') => {
    let v = byPlate.get(plate);
    if (!v) byPlate.set(plate, (v = newVehicle(plate, note)));
    return v;
  };

  const db = SQLite.openDatabaseSync('plates.db');
  try {
    for (const p of db.getAllSync<LegacyPlate>('SELECT plate, note FROM plates')) vehicleFor(p.plate, p.note);
    for (const m of db.getAllSync<LegacyMatch>('SELECT * FROM matches ORDER BY created_at')) {
      const v = vehicleFor(m.plate);
      const at = new Date(m.created_at);
      v.sightings.push({
        id: newId(),
        date: localDate(at),
        time: localTime(at),
        address: '',
        latitude: m.latitude,
        longitude: m.longitude,
        agents: [],
      });
      for (const uri of [m.photo_uri, m.frame_uri]) {
        const ref = uri && new File(uri).exists ? adoptMedia(uri) : null;
        if (ref) v.images.push(ref);
      }
    }
  } finally {
    db.closeSync();
  }

  const migrated: DataFile = { ...data, vehicles: [...byPlate.values()] };
  saveData(migrated);
  SQLite.deleteDatabaseSync('plates.db');
  try {
    const oldMatches = new Directory(Paths.document, 'matches');
    if (oldMatches.exists) oldMatches.delete();
  } catch {}
  return migrated;
}
