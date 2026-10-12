import { CameraView, useCameraPermissions } from 'expo-camera';
import { File } from 'expo-file-system';
import { useKeepAwake } from 'expo-keep-awake';
import * as Location from 'expo-location';
import { useIsFocused } from 'expo-router';
import { extractTextFromImage, isSupported as ocrSupported } from 'expo-text-extractor';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, Vibration, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppState } from '../../lib/AppState';

const FRAME_QUALITY = 0.6;
const FRAME_GAP_MS = 150;
// After a plate alarms, ignore it for a while so silencing doesn't re-trigger on the same car.
const REALARM_COOLDOWN_MS = 3 * 60_000;
const CAPTURE_NOTICE_MS = 3000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function discard(uri: string) {
  try {
    const f = new File(uri);
    if (f.exists) f.delete();
  } catch {}
}

function KeepAwake() {
  useKeepAwake();
  return null;
}

export default function ScanScreen() {
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const [permission, requestPermission] = useCameraPermissions();
  const { index, alarm, reportHit, captureVehicle } = useAppState();
  const cameraRef = useRef<CameraView>(null);
  const cooldown = useRef(new Map<string, number>());
  const [ready, setReady] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [framesRead, setFramesRead] = useState(0);
  // Only whether text is in view is shown, never the text itself.
  const [textInView, setTextInView] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // Scan frames, match photos and manual captures all use the camera; this queue keeps
  // two takePictureAsync calls from running at once.
  const cameraQueue = useRef<Promise<unknown>>(Promise.resolve());

  const alarmActive = alarm != null;

  // The camera unmounts when the tab loses focus; wait for onCameraReady again on return.
  if (!isFocused && ready) setReady(false);

  const takePicture = useCallback((quality: number) => {
    const next = cameraQueue.current.then(async () => {
      const cam = cameraRef.current;
      if (!cam) throw new Error('Camera is not available');
      return (await cam.takePictureAsync({ quality, shutterSound: false })).uri;
    });
    cameraQueue.current = next.catch(() => {});
    return next;
  }, []);

  const capturePhoto = useCallback(() => takePicture(1).catch(() => null), [takePicture]);

  // Saves whatever is in view as a new vehicle without a plate, with a photo and location.
  const capture = async () => {
    Vibration.vibrate(50);
    await Location.requestForegroundPermissionsAsync(); // only prompts the first time
    captureVehicle(capturePhoto);
    setNotice('Saved as a vehicle with no plate. Add details in Vehicles.');
    setTimeout(() => setNotice(null), CAPTURE_NOTICE_MS);
  };

  useEffect(() => {
    if (!scanning || !isFocused || !ready || alarmActive) return;
    let stopped = false;

    (async () => {
      while (!stopped) {
        if (!cameraRef.current) break;
        let frameUri: string | null = null;
        try {
          frameUri = await takePicture(FRAME_QUALITY);
          if (stopped) break;
          const lines = await extractTextFromImage(frameUri);
          if (stopped) break;
          setFramesRead((n) => n + 1);
          setTextInView(lines.length > 0);
          setError(null);

          const hit = index.match(lines);
          if (hit) {
            const last = cooldown.current.get(hit.vehicle.plate) ?? 0;
            if (Date.now() - last > REALARM_COOLDOWN_MS) {
              cooldown.current.set(hit.vehicle.plate, Date.now());
              const kept = frameUri;
              frameUri = null; // ownership passes to the match record
              reportHit(hit, kept, capturePhoto);
              break;
            }
          }
        } catch (e) {
          setError(e instanceof Error ? e.message : String(e));
          await sleep(1000);
        } finally {
          // Non-matching frames are deleted immediately.
          if (frameUri) discard(frameUri);
        }
        await sleep(FRAME_GAP_MS);
      }
    })();

    return () => {
      stopped = true;
    };
  }, [scanning, isFocused, ready, alarmActive, index, reportHit, capturePhoto, takePicture]);

  const toggleScanning = async () => {
    if (scanning) {
      setScanning(false);
      setTextInView(false);
      setError(null);
      return;
    }
    // Ask for location up front so the fix is fast when a match happens.
    await Location.requestForegroundPermissionsAsync();
    setFramesRead(0);
    setTextInView(false);
    setScanning(true);
  };

  if (!permission) return <View style={styles.center} />;

  if (!permission.granted) {
    return (
      <View style={[styles.center, { padding: 24 }]}>
        <Text style={styles.message}>Camera access is needed to read plates.</Text>
        <Pressable style={styles.primary} onPress={requestPermission}>
          <Text style={styles.primaryText}>Allow camera</Text>
        </Pressable>
      </View>
    );
  }

  if (!ocrSupported) {
    return (
      <View style={[styles.center, { padding: 24 }]}>
        <Text style={styles.message}>{"Text recognition isn't supported on this device."}</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {scanning && <KeepAwake />}
      {isFocused && (
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          facing="back"
          animateShutter={false}
          autofocus="on"
          onCameraReady={() => setReady(true)}
          onMountError={(e) => setError(e.message)}
        />
      )}

      <View style={[styles.hud, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.hudText}>
          {index.size} vehicle{index.size === 1 ? '' : 's'} on list
          {scanning ? `  ·  ${framesRead} frames` : ''}
        </Text>
        {scanning && <Text style={styles.hudRead}>{textInView ? 'Text in view' : 'No text in view'}</Text>}
        {!!error && <Text style={styles.hudError} numberOfLines={2}>{error}</Text>}
        {!!notice && <Text style={styles.hudNotice}>{notice}</Text>}
      </View>

      <View style={styles.footer}>
        <Pressable
          disabled={index.size === 0}
          onPress={toggleScanning}
          style={[styles.primary, styles.flex, scanning && styles.stop, index.size === 0 && styles.disabled]}
        >
          <Text style={styles.primaryText}>
            {index.size === 0 ? 'Add plates first' : scanning ? 'Stop scanning' : 'Start scanning'}
          </Text>
        </Pressable>
        <Pressable
          disabled={!ready}
          onPress={capture}
          accessibilityLabel="Capture a vehicle without a plate"
          style={[styles.primary, styles.capture, !ready && styles.disabled]}
        >
          <Text style={styles.primaryText}>Capture</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  message: { fontSize: 16, textAlign: 'center', marginBottom: 16 },
  hud: { position: 'absolute', left: 0, right: 0, top: 0, paddingHorizontal: 16, paddingBottom: 10, backgroundColor: 'rgba(0,0,0,0.55)' },
  hudText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  hudRead: { color: '#cfcfcf', fontSize: 13, marginTop: 4 },
  hudError: { color: '#ff8080', fontSize: 13, marginTop: 4 },
  hudNotice: { color: '#8fe3a8', fontSize: 14, fontWeight: '600', marginTop: 4 },
  footer: { position: 'absolute', left: 16, right: 16, bottom: 24, flexDirection: 'row', gap: 10 },
  flex: { flex: 1 },
  capture: { backgroundColor: '#335' },
  primary: { backgroundColor: '#0a7a2f', paddingVertical: 18, paddingHorizontal: 24, borderRadius: 14, alignItems: 'center' },
  stop: { backgroundColor: '#444' },
  disabled: { backgroundColor: '#777' },
  primaryText: { color: '#fff', fontSize: 18, fontWeight: '700' },
});
