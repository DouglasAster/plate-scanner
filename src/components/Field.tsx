import { useState } from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

type FieldProps = Omit<TextInputProps, 'style'> & { label: string };

export function Field({ label, multiline, ...input }: FieldProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && styles.multiline]}
        multiline={multiline}
        autoCorrect={false}
        placeholderTextColor="#999"
        {...input}
      />
    </View>
  );
}

type NumberFieldProps = {
  label: string;
  value: number | null;
  onChange: (n: number | null) => void;
  integer?: boolean;
  placeholder?: string;
};

/**
 * A numeric field that keeps the raw text while typing (so "-37." isn't lost) and
 * commits a number, or null when empty, when editing ends.
 */
export function NumberField({ label, value, onChange, integer, placeholder }: NumberFieldProps) {
  const shown = value == null ? '' : String(value);
  const [text, setText] = useState(shown);
  const [synced, setSynced] = useState(shown);
  // Pick up changes made elsewhere (e.g. location filled in after a match).
  if (shown !== synced) {
    setSynced(shown);
    setText(shown);
  }

  const commit = () => {
    const t = text.trim();
    const n = t === '' ? null : Number(t);
    if (n != null && (!Number.isFinite(n) || (integer && !Number.isInteger(n)))) {
      setText(shown);
      return;
    }
    if (n !== value) onChange(n);
  };

  return (
    <Field
      label={label}
      value={text}
      onChangeText={setText}
      onEndEditing={commit}
      keyboardType={integer ? 'number-pad' : 'numbers-and-punctuation'}
      placeholder={placeholder}
    />
  );
}

export const formStyles = StyleSheet.create({
  section: { fontSize: 13, fontWeight: '700', color: '#666', textTransform: 'uppercase', letterSpacing: 1, marginTop: 24, marginBottom: 8 },
  button: { backgroundColor: '#0a7a2f', paddingVertical: 14, borderRadius: 10, alignItems: 'center', marginTop: 8 },
  secondary: { backgroundColor: '#335' },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  danger: { color: '#b00000', fontWeight: '600' },
  dangerButton: { paddingVertical: 14, alignItems: 'center', marginTop: 24 },
  row: { flexDirection: 'row', gap: 10 },
  flex: { flex: 1 },
  muted: { color: '#888' },
});

const styles = StyleSheet.create({
  field: { marginBottom: 10 },
  label: { fontSize: 13, color: '#555', marginBottom: 4 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 16, color: '#000' },
  multiline: { minHeight: 70, textAlignVertical: 'top' },
});
