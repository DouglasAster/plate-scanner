import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Field, formStyles, NumberField } from '../../components/Field';
import { useAppState, useVehicle } from '../../lib/AppState';
import { formatCoords, openInMaps } from '../../lib/maps';
import { AGENT_FIELDS, newAgent, plateLabel, type Agent, type Sighting } from '../../lib/schema';

export default function SightingScreen() {
  const { id, vehicleId } = useLocalSearchParams<{ id: string; vehicleId: string }>();
  const vehicle = useVehicle(vehicleId);
  const { updateVehicle } = useAppState();
  const sighting = vehicle?.sightings.find((s) => s.id === id);

  if (!vehicle || !sighting) {
    return (
      <View style={styles.missing}>
        <Text style={formStyles.muted}>This sighting was deleted.</Text>
      </View>
    );
  }

  const update = (fn: (s: Sighting) => Sighting) =>
    updateVehicle(vehicle.id, (v) => ({ ...v, sightings: v.sightings.map((s) => (s.id === id ? fn(s) : s)) }));
  const set = (patch: Partial<Sighting>) => update((s) => ({ ...s, ...patch }));
  const setAgent = (agentId: string, patch: Partial<Agent>) =>
    update((s) => ({ ...s, agents: s.agents.map((a) => (a.id === agentId ? { ...a, ...patch } : a)) }));

  const removeAgent = (agent: Agent) =>
    Alert.alert(`Remove ${agent.name || 'this agent'}?`, undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => update((s) => ({ ...s, agents: s.agents.filter((a) => a.id !== agent.id) })) },
    ]);

  const remove = () =>
    Alert.alert('Delete sighting?', 'This sighting and the agents recorded with it will be permanently removed.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          router.back();
          updateVehicle(vehicle.id, (v) => ({ ...v, sightings: v.sightings.filter((s) => s.id !== id) }));
        },
      },
    ]);

  const hasLoc = sighting.latitude != null && sighting.longitude != null;

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
      <Stack.Screen options={{ title: plateLabel(vehicle) }} />

      <View style={formStyles.row}>
        <View style={formStyles.flex}>
          <Field label="Date" value={sighting.date} onChangeText={(date) => set({ date })} placeholder="YYYY-MM-DD" keyboardType="numbers-and-punctuation" />
        </View>
        <View style={formStyles.flex}>
          <Field label="Time" value={sighting.time} onChangeText={(time) => set({ time })} placeholder="HH:MM" keyboardType="numbers-and-punctuation" />
        </View>
      </View>
      <Field label="Address" multiline value={sighting.address} onChangeText={(address) => set({ address })} />
      <View style={formStyles.row}>
        <View style={formStyles.flex}>
          <NumberField label="Latitude" value={sighting.latitude} onChange={(latitude) => set({ latitude })} />
        </View>
        <View style={formStyles.flex}>
          <NumberField label="Longitude" value={sighting.longitude} onChange={(longitude) => set({ longitude })} />
        </View>
      </View>
      {hasLoc && (
        <Pressable onPress={() => openInMaps(sighting.latitude!, sighting.longitude!)} hitSlop={6}>
          <Text style={styles.link}>Open {formatCoords(sighting.latitude!, sighting.longitude!)} in maps</Text>
        </Pressable>
      )}

      <Text style={formStyles.section}>Agents</Text>
      {sighting.agents.length === 0 && <Text style={formStyles.muted}>No agents recorded.</Text>}
      {sighting.agents.map((agent, i) => (
        <View key={agent.id} style={styles.agent}>
          <View style={styles.agentHeader}>
            <Text style={styles.agentTitle}>{agent.name || `Agent ${i + 1}`}</Text>
            <Pressable onPress={() => removeAgent(agent)} hitSlop={8}>
              <Text style={formStyles.danger}>Remove</Text>
            </Pressable>
          </View>
          {AGENT_FIELDS.map(([key, label]) => (
            <Field key={key} label={label} value={agent[key]} onChangeText={(t) => setAgent(agent.id, { [key]: t })} />
          ))}
        </View>
      ))}
      <Pressable style={[formStyles.button, formStyles.secondary]} onPress={() => update((s) => ({ ...s, agents: [...s.agents, newAgent()] }))}>
        <Text style={formStyles.buttonText}>Add agent</Text>
      </Pressable>

      <Pressable style={formStyles.dangerButton} onPress={remove}>
        <Text style={formStyles.danger}>Delete sighting</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 16, paddingBottom: 48 },
  missing: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  link: { color: '#0056b3', marginBottom: 8 },
  agent: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 12, marginBottom: 12 },
  agentHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  agentTitle: { fontSize: 16, fontWeight: '700' },
});
