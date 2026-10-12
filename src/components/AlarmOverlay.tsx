import { useEffect, useState } from 'react';
import { Animated, Modal, Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppState } from '../lib/AppState';
import { describeVehicle } from '../lib/schema';

const HOLD_TO_SILENCE_MS = 2000;

/**
 * Full-screen flashing alert. Can't be dismissed with the back button or a stray tap;
 * the user must press and hold to silence it. The silence button is pinned to the
 * bottom and the details scroll above it, so long notes can't push it off screen.
 */
export function AlarmOverlay() {
  const { alarm, silenceAlarm } = useAppState();
  const insets = useSafeAreaInsets();
  const [flash] = useState(() => new Animated.Value(0));
  const [holding, setHolding] = useState(false);

  useEffect(() => {
    if (!alarm) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(flash, { toValue: 1, duration: 250, useNativeDriver: false }),
        Animated.timing(flash, { toValue: 0, duration: 250, useNativeDriver: false }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [alarm, flash]);

  if (!alarm) return null;

  const bg = flash.interpolate({ inputRange: [0, 1], outputRange: ['#b00000', '#ff2a2a'] });
  const { hit, sighting } = alarm;
  const desc = describeVehicle(hit.vehicle);

  let locationText = 'Getting location…';
  if (sighting) {
    locationText =
      sighting.latitude != null && sighting.longitude != null
        ? `${sighting.latitude.toFixed(6)}, ${sighting.longitude.toFixed(6)}`
        : 'Location unavailable';
  }

  return (
    <Modal visible animationType="none" onRequestClose={() => {}} statusBarTranslucent>
      <Animated.View style={[styles.root, { backgroundColor: bg, paddingTop: insets.top + 24, paddingBottom: insets.bottom + 16 }]}>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
          <Text style={styles.label}>{hit.kind === 'exact' ? 'PLATE MATCH' : 'POSSIBLE MATCH — VERIFY'}</Text>
          <Text style={styles.plate}>{hit.vehicle.plate}</Text>
          {!!desc && <Text style={styles.note}>{desc}</Text>}
          <Text style={styles.detail}>{new Date(alarm.at).toLocaleString()}</Text>
          <Text style={styles.detail}>{locationText}</Text>
          <Text style={styles.detail}>{sighting ? 'Sighting saved' : 'Saving photo and location…'}</Text>
          <Text style={styles.detail}>Read: “{hit.readText}”</Text>
          {!!hit.vehicle.notes && <Text style={styles.notes}>{hit.vehicle.notes}</Text>}
        </ScrollView>

        <Pressable
          delayLongPress={HOLD_TO_SILENCE_MS}
          onPressIn={() => setHolding(true)}
          onPressOut={() => setHolding(false)}
          onLongPress={() => {
            setHolding(false);
            silenceAlarm();
          }}
          style={[styles.button, holding && styles.buttonHolding]}
        >
          <Text style={styles.buttonText}>{holding ? 'Keep holding…' : 'Press and hold to silence'}</Text>
        </Pressable>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 24 },
  scroll: { flex: 1 },
  content: { alignItems: 'center', paddingBottom: 16 },
  label: { color: '#fff', fontSize: 22, fontWeight: '800', letterSpacing: 2 },
  plate: {
    marginVertical: 24,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#fff',
    color: '#000',
    fontSize: 52,
    fontWeight: '900',
    letterSpacing: 4,
    borderRadius: 8,
    overflow: 'hidden',
  },
  note: { color: '#fff', fontSize: 20, fontWeight: '600', marginBottom: 12, textAlign: 'center' },
  detail: { color: '#fff', fontSize: 16, marginTop: 6, textAlign: 'center' },
  notes: { color: '#fff', fontSize: 15, marginTop: 16, alignSelf: 'stretch' },
  button: {
    alignSelf: 'stretch',
    paddingVertical: 28,
    borderRadius: 16,
    backgroundColor: '#000',
    alignItems: 'center',
    marginTop: 12,
  },
  buttonHolding: { backgroundColor: '#333' },
  buttonText: { color: '#fff', fontSize: 20, fontWeight: '700' },
});
