import * as Location from 'expo-location';
import { newSighting, type Sighting } from './schema';
import { adoptMedia } from './store';

const LOCATION_TIMEOUT_MS = 15_000;

async function currentLocation(): Promise<Location.LocationObject | null> {
  try {
    const { granted } = await Location.getForegroundPermissionsAsync();
    if (!granted) return null;
    const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), LOCATION_TIMEOUT_MS));
    const fix = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
      timeout,
    ]);
    return fix ?? (await Location.getLastKnownPositionAsync({ maxAge: 5 * 60_000 }));
  } catch (e) {
    console.warn('Location unavailable', e);
    return null;
  }
}

export type MatchResult = {
  sighting: Sighting;
  images: string[]; // media refs to add to the vehicle
};

/**
 * Records a sighting: a full-quality photo, any already-taken images (such as the OCR
 * frame that triggered a match), and the phone's location. The photo is taken in
 * parallel with the location fix so the vehicle is still in view. The address is left
 * for the user to fill in; looking it up from coordinates would send the location to
 * Apple or Google.
 */
export async function recordMatch(existing: string[], capturePhoto: () => Promise<string | null>): Promise<MatchResult> {
  const sighting = newSighting();
  const [location, photoUri] = await Promise.all([currentLocation(), capturePhoto().catch(() => null)]);
  sighting.latitude = location?.coords.latitude ?? null;
  sighting.longitude = location?.coords.longitude ?? null;
  const images = [photoUri, ...existing]
    .map((uri) => (uri ? adoptMedia(uri) : null))
    .filter((r): r is string => r != null);
  return { sighting, images };
}
