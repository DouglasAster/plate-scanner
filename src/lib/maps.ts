import { Linking, Platform } from 'react-native';

// Only the coordinates go to the maps app. Nothing else (plate, notes) is included,
// so it isn't sent to Apple or Google along with the search.
export function openInMaps(lat: number, lon: number) {
  const url = Platform.OS === 'ios' ? `http://maps.apple.com/?ll=${lat},${lon}` : `geo:${lat},${lon}?q=${lat},${lon}`;
  Linking.openURL(url).catch((e) => console.warn('Could not open maps', e));
}

export function formatCoords(lat: number, lon: number) {
  return `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
}
