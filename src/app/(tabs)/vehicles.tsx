import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAppState } from '../../lib/AppState';
import { BUILTIN_DATE, BUILTIN_SOURCE, builtinVehicles } from '../../lib/builtinRegistry';
import { describeVehicle, mergeVehicles, newVehicle, normalizePlate, parseDataFile, parsePlateList, plateLabel, type Vehicle } from '../../lib/schema';
import { deleteMedia } from '../../lib/store';

/** Reads a Plate Scanner JSON file, or falls back to a plain list of plates. */
function parseImport(text: string): Vehicle[] {
  if (text.trimStart().startsWith('{')) return parseDataFile(JSON.parse(text)).vehicles;
  return parsePlateList(text);
}

export default function VehiclesScreen() {
  const { vehicles, updateVehicles } = useAppState();
  const [input, setInput] = useState('');
  const [filter, setFilter] = useState('');

  const add = () => {
    const parsed = parsePlateList(input);
    if (parsed.length === 0) return;
    updateVehicles((vs) => mergeVehicles(vs, parsed).vehicles);
    setInput('');
  };

  const importFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/json', 'text/*', 'text/csv', 'text/comma-separated-values', 'application/csv'],
      copyToCacheDirectory: true,
    });
    if (result.canceled) return;
    const file = new File(result.assets[0].uri);
    try {
      mergeIn(parseImport(await file.text()), 'Imported');
    } catch (e) {
      Alert.alert('Import failed', e instanceof Error ? e.message : String(e));
    } finally {
      try {
        file.delete();
      } catch {}
    }
  };

  const mergeIn = (incoming: Vehicle[], title: string) => {
    let added = 0;
    let updated = 0;
    updateVehicles((vs) => {
      const r = mergeVehicles(vs, incoming);
      added = r.added;
      updated = r.updated;
      return r.vehicles;
    });
    Alert.alert(title, `${added} vehicle${added === 1 ? '' : 's'} added, ${updated} updated.`);
  };

  const loadBuiltin = () =>
    Alert.alert(
      'Load the built-in list?',
      `Adds the ${BUILTIN_SOURCE}${BUILTIN_DATE ? ` (${BUILTIN_DATE})` : ''}, which is built into the app. Details you've entered are kept; only blank fields are filled in.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Load', onPress: () => mergeIn(builtinVehicles(), 'Built-in list loaded') },
      ]
    );

  const addWithoutPlate = () => {
    const v = newVehicle('');
    updateVehicles((vs) => [...vs, v]);
    router.push({ pathname: '/vehicle/[id]', params: { id: v.id } });
  };

  const clearAll = () =>
    Alert.alert('Erase everything?', 'This permanently deletes every vehicle, sighting, agent, photo and video.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Erase everything',
        style: 'destructive',
        onPress: () => {
          deleteMedia(vehicles.flatMap((v) => [...v.images, ...v.videos]));
          updateVehicles(() => []);
        },
      },
    ]);

  // Matches the plate, or for typed words, the description and notes too.
  const f = normalizePlate(filter);
  const words = filter.trim().toLowerCase();
  const shown = [...vehicles]
    .filter((v) => !words || (f && v.plate.includes(f)) || `${describeVehicle(v)} ${v.notes}`.toLowerCase().includes(words))
    .sort((a, b) => (!a.plate === !b.plate ? a.plate.localeCompare(b.plate) : a.plate ? -1 : 1));

  return (
    <View style={styles.root}>
      <TextInput
        style={styles.input}
        value={input}
        onChangeText={setInput}
        placeholder={'ABC1234, optional note\nOne plate per line'}
        placeholderTextColor="#999"
        autoCapitalize="characters"
        autoCorrect={false}
        multiline
      />
      <View style={styles.row}>
        <Pressable style={[styles.button, styles.flex]} onPress={add}>
          <Text style={styles.buttonText}>Add</Text>
        </Pressable>
        <Pressable style={[styles.button, styles.secondary, styles.flex]} onPress={importFile}>
          <Text style={styles.buttonText}>Import file</Text>
        </Pressable>
      </View>
      <View style={[styles.row, styles.linkRow]}>
        <Pressable onPress={addWithoutPlate} hitSlop={8}>
          <Text style={styles.link}>+ Vehicle without a plate</Text>
        </Pressable>
        <Pressable onPress={loadBuiltin} hitSlop={8}>
          <Text style={styles.link}>Load built-in list</Text>
        </Pressable>
      </View>

      <View style={[styles.row, styles.listHeader]}>
        <TextInput
          style={[styles.search, styles.flex]}
          value={filter}
          onChangeText={setFilter}
          placeholder={`Search ${vehicles.length} vehicles by plate or description`}
          placeholderTextColor="#999"
          autoCapitalize="characters"
          autoCorrect={false}
        />
        {vehicles.length > 0 && (
          <Pressable onPress={clearAll} hitSlop={8}>
            <Text style={styles.danger}>Erase all</Text>
          </Pressable>
        )}
      </View>

      <FlatList
        data={shown}
        keyExtractor={(v) => v.id}
        ListEmptyComponent={<Text style={styles.empty}>No vehicles on the list yet.</Text>}
        renderItem={({ item }) => {
          const desc = describeVehicle(item);
          return (
            <Pressable
              style={styles.item}
              onPress={() => router.push({ pathname: '/vehicle/[id]', params: { id: item.id } })}
            >
              <View style={styles.flex}>
                <Text style={[styles.plate, !item.plate && styles.noPlate]}>{plateLabel(item)}</Text>
                {!!desc && <Text style={styles.desc}>{desc}</Text>}
                {!!item.notes && (
                  <Text style={styles.note} numberOfLines={1}>
                    {item.notes}
                  </Text>
                )}
              </View>
              {item.sightings.length > 0 && (
                <Text style={styles.count}>
                  {item.sightings.length} sighting{item.sightings.length === 1 ? '' : 's'}
                </Text>
              )}
              <Text style={styles.chevron}>›</Text>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, padding: 16, backgroundColor: '#fff' },
  flex: { flex: 1 },
  row: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 10, padding: 12, minHeight: 80, fontSize: 16, marginBottom: 10, textAlignVertical: 'top', color: '#000' },
  button: { backgroundColor: '#0a7a2f', paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
  secondary: { backgroundColor: '#335' },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  listHeader: { marginTop: 18, marginBottom: 6 },
  search: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, fontSize: 15, color: '#000' },
  item: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#ddd' },
  plate: { fontSize: 18, fontWeight: '700', letterSpacing: 1.5, fontFamily: 'monospace' },
  desc: { color: '#333', marginTop: 2 },
  note: { color: '#777', marginTop: 2 },
  count: { color: '#b00000', fontSize: 13, fontWeight: '600' },
  chevron: { color: '#bbb', fontSize: 24 },
  noPlate: { color: '#888', fontFamily: undefined, letterSpacing: 0, fontStyle: 'italic' },
  linkRow: { marginTop: 12, justifyContent: 'space-between' },
  link: { color: '#0056b3', fontWeight: '600' },
  danger: { color: '#b00000', fontWeight: '600' },
  empty: { color: '#888', textAlign: 'center', marginTop: 32 },
});
