import { router } from 'expo-router';
import { useMemo } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useAppState } from '../../lib/AppState';
import { formatCoords, openInMaps } from '../../lib/maps';
import { describeVehicle, plateLabel } from '../../lib/schema';

export default function SightingsScreen() {
  const { vehicles, updateVehicles } = useAppState();

  const rows = useMemo(
    () =>
      vehicles
        .flatMap((v) => v.sightings.map((s) => ({ v, s })))
        .sort((a, b) => `${b.s.date} ${b.s.time}`.localeCompare(`${a.s.date} ${a.s.time}`)),
    [vehicles]
  );

  const removeAll = () =>
    Alert.alert('Delete all sightings?', 'Every sighting and the agents recorded with it will be permanently removed. Vehicles and their photos are kept.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete all',
        style: 'destructive',
        onPress: () => updateVehicles((vs) => vs.map((v) => ({ ...v, sightings: [] }))),
      },
    ]);

  return (
    <FlatList
      style={styles.root}
      data={rows}
      keyExtractor={({ v, s }) => `${v.id}/${s.id}`}
      ListEmptyComponent={<Text style={styles.empty}>No sightings yet.</Text>}
      ListHeaderComponent={
        rows.length > 0 ? (
          <Pressable onPress={removeAll} hitSlop={8} style={styles.header}>
            <Text style={styles.danger}>Delete all sightings</Text>
          </Pressable>
        ) : null
      }
      renderItem={({ item: { v, s } }) => {
        const hasLoc = s.latitude != null && s.longitude != null;
        const desc = describeVehicle(v);
        return (
          <Pressable
            style={styles.item}
            onPress={() => router.push({ pathname: '/sighting/[id]', params: { id: s.id, vehicleId: v.id } })}
          >
            <View style={styles.body}>
              <Text style={styles.plate}>{plateLabel(v)}</Text>
              {!!desc && <Text style={styles.desc}>{desc}</Text>}
              <Text style={styles.meta}>
                {s.date || 'No date'} {s.time}
                {s.agents.length > 0 ? `  ·  ${s.agents.length} agent${s.agents.length === 1 ? '' : 's'}` : ''}
              </Text>
              {!!s.address && <Text style={styles.meta}>{s.address}</Text>}
              {hasLoc ? (
                <Pressable onPress={() => openInMaps(s.latitude!, s.longitude!)} hitSlop={6}>
                  <Text style={styles.link}>{formatCoords(s.latitude!, s.longitude!)}</Text>
                </Pressable>
              ) : (
                !s.address && <Text style={styles.meta}>No location</Text>
              )}
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },
  header: { alignItems: 'flex-end', paddingHorizontal: 12, paddingTop: 8 },
  item: { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#ddd' },
  body: { flex: 1, gap: 3 },
  plate: { fontSize: 18, fontWeight: '800', letterSpacing: 1.5, fontFamily: 'monospace' },
  desc: { color: '#333' },
  meta: { color: '#777', fontSize: 13 },
  link: { color: '#0056b3', fontSize: 13 },
  chevron: { color: '#bbb', fontSize: 24 },
  danger: { color: '#b00000', fontWeight: '600' },
  empty: { color: '#888', textAlign: 'center', marginTop: 48 },
});
