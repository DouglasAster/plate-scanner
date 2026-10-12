import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Field, formStyles, NumberField } from '../../components/Field';
import { useAppState, useVehicle } from '../../lib/AppState';
import { newSighting, normalizePlate, plateLabel, type Vehicle } from '../../lib/schema';
import { deleteMedia, mediaUri } from '../../lib/store';

type TextKey = 'make' | 'model' | 'color' | 'agency' | 'notes';

export default function VehicleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const vehicle = useVehicle(id);
  const { vehicles, updateVehicle, deleteVehicle } = useAppState();
  const [plateDraft, setPlateDraft] = useState<string | null>(null);

  if (!vehicle) {
    return (
      <View style={styles.missing}>
        <Text style={formStyles.muted}>This vehicle was deleted.</Text>
      </View>
    );
  }

  const set = (patch: Partial<Vehicle>) => updateVehicle(vehicle.id, (v) => ({ ...v, ...patch }));
  const text = (key: TextKey) => ({ value: vehicle[key], onChangeText: (t: string) => set({ [key]: t }) });

  const commitPlate = () => {
    if (plateDraft == null) return;
    const plate = normalizePlate(plateDraft);
    setPlateDraft(null);
    if (plate === vehicle.plate) return;
    if (plate && vehicles.some((v) => v.plate === plate && v.id !== vehicle.id)) {
      Alert.alert('Plate already listed', `${plate} is already on the list.`);
      return;
    }
    set({ plate });
  };

  const removeImage = (ref: string) =>
    Alert.alert('Delete photo?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteMedia([ref]);
          updateVehicle(vehicle.id, (v) => ({ ...v, images: v.images.filter((r) => r !== ref) }));
        },
      },
    ]);

  const addSighting = () => {
    const s = newSighting();
    updateVehicle(vehicle.id, (v) => ({ ...v, sightings: [...v.sightings, s] }));
    router.push({ pathname: '/sighting/[id]', params: { id: s.id, vehicleId: vehicle.id } });
  };

  const remove = () =>
    Alert.alert(`Delete ${vehicle.plate || 'this vehicle'}?`, 'Its details, sightings, agents, photos and videos will be permanently removed.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          router.back();
          deleteVehicle(vehicle.id);
        },
      },
    ]);

  const sightings = [...vehicle.sightings].sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`));

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
      <Stack.Screen options={{ title: plateLabel(vehicle) }} />

      <Field
        label="License plate"
        value={plateDraft ?? vehicle.plate}
        onChangeText={setPlateDraft}
        onEndEditing={commitPlate}
        autoCapitalize="characters"
        placeholder="No plate. Leave blank if there isn't one"
      />
      <View style={formStyles.row}>
        <View style={formStyles.flex}>
          <Field label="Make" {...text('make')} />
        </View>
        <View style={formStyles.flex}>
          <Field label="Model" {...text('model')} />
        </View>
      </View>
      <View style={formStyles.row}>
        <View style={formStyles.flex}>
          <Field label="Color" {...text('color')} />
        </View>
        <View style={formStyles.flex}>
          <NumberField label="Year" integer value={vehicle.year} onChange={(year) => set({ year })} />
        </View>
      </View>
      <Field label="Agency" {...text('agency')} />
      <Field label="Notes" multiline {...text('notes')} />

      <Text style={formStyles.section}>Photos</Text>
      {vehicle.images.length === 0 ? (
        <Text style={formStyles.muted}>Photos from scanner matches appear here.</Text>
      ) : (
        <>
          <ScrollView horizontal contentContainerStyle={styles.photos}>
            {vehicle.images.map((ref) => (
              <Pressable key={ref} onLongPress={() => removeImage(ref)}>
                <Image source={{ uri: mediaUri(ref) }} style={styles.photo} />
              </Pressable>
            ))}
          </ScrollView>
          <Text style={styles.hint}>Press and hold a photo to delete it.</Text>
        </>
      )}

      {vehicle.videos.length > 0 && (
        <>
          <Text style={formStyles.section}>Videos</Text>
          <Text style={formStyles.muted}>
            {vehicle.videos.length} video{vehicle.videos.length === 1 ? '' : 's'}
          </Text>
        </>
      )}

      <Text style={formStyles.section}>Sightings</Text>
      {sightings.length === 0 && <Text style={formStyles.muted}>No sightings yet.</Text>}
      {sightings.map((s) => (
        <Pressable
          key={s.id}
          style={styles.sighting}
          onPress={() => router.push({ pathname: '/sighting/[id]', params: { id: s.id, vehicleId: vehicle.id } })}
        >
          <View style={formStyles.flex}>
            <Text style={styles.sightingDate}>
              {s.date || 'No date'} {s.time}
            </Text>
            <Text style={formStyles.muted} numberOfLines={1}>
              {s.address || (s.latitude != null ? 'Location saved' : 'No location')}
              {s.agents.length > 0 ? `  ·  ${s.agents.length} agent${s.agents.length === 1 ? '' : 's'}` : ''}
            </Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </Pressable>
      ))}
      <Pressable style={[formStyles.button, formStyles.secondary]} onPress={addSighting}>
        <Text style={formStyles.buttonText}>Add sighting</Text>
      </Pressable>

      <Pressable style={formStyles.dangerButton} onPress={remove}>
        <Text style={formStyles.danger}>Delete vehicle</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 16, paddingBottom: 48 },
  missing: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  photos: { gap: 8 },
  photo: { width: 160, height: 120, borderRadius: 8, backgroundColor: '#eee' },
  hint: { color: '#999', fontSize: 12, marginTop: 6 },
  sighting: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#ddd' },
  sightingDate: { fontSize: 16, fontWeight: '600' },
  chevron: { color: '#bbb', fontSize: 24 },
});
