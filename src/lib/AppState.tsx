import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState as RNAppState } from 'react-native';
import { startAlarm, stopAlarm } from './alarm';
import { PlateIndex, type PlateHit } from './plates';
import { recordMatch } from './recordMatch';
import { newVehicle, type DataFile, type Sighting, type Vehicle } from './schema';
import { deleteMedia, loadData, saveData } from './store';

const SAVE_DELAY_MS = 400;

export type ActiveAlarm = {
  hit: PlateHit;
  at: number;
  sighting: Sighting | null; // null while the photo and location are still being captured
};

type AppState = {
  vehicles: Vehicle[];
  index: PlateIndex;
  /** Replaces the vehicle list. Saved to disk shortly after. */
  updateVehicles: (fn: (vehicles: Vehicle[]) => Vehicle[]) => void;
  updateVehicle: (id: string, fn: (v: Vehicle) => Vehicle) => void;
  deleteVehicle: (id: string) => void;
  alarm: ActiveAlarm | null;
  reportHit: (hit: PlateHit, frameUri: string, capturePhoto: () => Promise<string | null>) => void;
  silenceAlarm: () => void;
  /** Adds a vehicle with no plate from a photo of what's in view, plus a sighting. */
  captureVehicle: (capturePhoto: () => Promise<string | null>) => void;
};

const Ctx = createContext<AppState | null>(null);

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<DataFile>(loadData);
  const [alarm, setAlarm] = useState<ActiveAlarm | null>(null);
  const latest = useRef(data);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = useCallback(() => {
    if (!saveTimer.current) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = null;
    try {
      saveData(latest.current);
    } catch (e) {
      console.warn('Could not save plate list', e);
    }
  }, []);

  const updateVehicles = useCallback<AppState['updateVehicles']>(
    (fn) => {
      const next = { ...latest.current, vehicles: fn(latest.current.vehicles) };
      latest.current = next;
      setData(next);
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(flush, SAVE_DELAY_MS);
    },
    [flush]
  );

  // Save right away if the app is backgrounded, since it may be killed there.
  useEffect(() => {
    const sub = RNAppState.addEventListener('change', (s) => {
      if (s !== 'active') flush();
    });
    return () => {
      sub.remove();
      flush();
    };
  }, [flush]);

  const updateVehicle = useCallback<AppState['updateVehicle']>(
    (id, fn) => updateVehicles((vs) => vs.map((v) => (v.id === id ? fn(v) : v))),
    [updateVehicles]
  );

  const deleteVehicle = useCallback(
    (id: string) => {
      const v = latest.current.vehicles.find((x) => x.id === id);
      if (v) deleteMedia([...v.images, ...v.videos]);
      updateVehicles((vs) => vs.filter((x) => x.id !== id));
    },
    [updateVehicles]
  );

  const index = useMemo(() => new PlateIndex(data.vehicles), [data.vehicles]);

  const reportHit = useCallback<AppState['reportHit']>(
    (hit, frameUri, capturePhoto) => {
      const at = Date.now();
      setAlarm({ hit, at, sighting: null });
      startAlarm().catch((e) => console.warn('Alarm failed to start', e));
      recordMatch([frameUri], capturePhoto)
        .then(({ sighting, images }) => {
          if (!latest.current.vehicles.some((v) => v.id === hit.vehicle.id)) {
            deleteMedia(images); // vehicle was removed while the match was being saved
            return;
          }
          updateVehicle(hit.vehicle.id, (v) => ({
            ...v,
            images: [...v.images, ...images],
            sightings: [...v.sightings, sighting],
          }));
          setAlarm((a) => (a && a.at === at ? { ...a, sighting } : a));
        })
        .catch((e) => console.warn('Failed to record match', e));
    },
    [updateVehicle]
  );

  const captureVehicle = useCallback<AppState['captureVehicle']>(
    (capturePhoto) => {
      const vehicle = newVehicle('', 'Captured from the scanner.');
      updateVehicles((vs) => [...vs, vehicle]);
      recordMatch([], capturePhoto)
        .then(({ sighting, images }) => {
          if (!latest.current.vehicles.some((v) => v.id === vehicle.id)) {
            deleteMedia(images);
            return;
          }
          updateVehicle(vehicle.id, (v) => ({ ...v, images: [...v.images, ...images], sightings: [...v.sightings, sighting] }));
        })
        .catch((e) => console.warn('Failed to capture vehicle', e));
    },
    [updateVehicles, updateVehicle]
  );

  const silenceAlarm = useCallback(() => {
    stopAlarm();
    setAlarm(null);
  }, []);

  const value = useMemo(
    () => ({
      vehicles: data.vehicles,
      index,
      updateVehicles,
      updateVehicle,
      deleteVehicle,
      alarm,
      reportHit,
      silenceAlarm,
      captureVehicle,
    }),
    [data.vehicles, index, updateVehicles, updateVehicle, deleteVehicle, alarm, reportHit, silenceAlarm, captureVehicle]
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAppState(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAppState must be used inside AppStateProvider');
  return v;
}

export function useVehicle(id: string | undefined): Vehicle | undefined {
  const { vehicles } = useAppState();
  return vehicles.find((v) => v.id === id);
}
