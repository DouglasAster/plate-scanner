import { Directory, Paths } from 'expo-file-system';
import { enableAppSwitcherProtectionAsync, preventScreenCaptureAsync } from 'expo-screen-capture';
import { Platform } from 'react-native';

/**
 * Deletes any scan frames left in the camera cache. Frames are normally deleted as
 * soon as they're read, but one can be left behind if the app is killed mid-read.
 */
export function sweepCameraCache() {
  try {
    const dir = new Directory(Paths.cache, 'Camera');
    if (dir.exists) dir.delete();
  } catch (e) {
    console.warn('Could not clear camera cache', e);
  }
}

/**
 * Blocks screenshots and screen recording, and hides the app's contents in the
 * app switcher (FLAG_SECURE on Android, a full blur on iOS).
 */
export async function protectScreen() {
  try {
    await preventScreenCaptureAsync();
    if (Platform.OS === 'ios') await enableAppSwitcherProtectionAsync(1);
  } catch (e) {
    console.warn('Could not enable screen protection', e);
  }
}
