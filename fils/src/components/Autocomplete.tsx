import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { search, type CatalogItem } from '@/data/catalog';
import { t } from '@/i18n';
import { colors, radius, spacing } from '@/theme';

/**
 * Champ avec autocomplétion sur un catalogue. La saisie libre reste possible
 * (« Utiliser “…” »), car aucun catalogue n'est exhaustif.
 */
export function Autocomplete({
  label,
  placeholder,
  items,
  value,
  onSelect,
  allowFree = true,
  testID,
}: {
  label: string;
  placeholder: string;
  items: CatalogItem[];
  value?: string;
  onSelect: (item: CatalogItem | { key: undefined; label: string }) => void;
  allowFree?: boolean;
  testID?: string;
}) {
  const [text, setText] = useState(value ?? '');
  const [focused, setFocused] = useState(false);
  const results = useMemo(() => search(items, text), [items, text]);
  const exact = results.some((r) => r.label.toLowerCase() === text.trim().toLowerCase());
  const open = focused && (results.length > 0 || (!!text.trim() && allowFree));

  const choose = (item: CatalogItem | { key: undefined; label: string }) => {
    setText(item.label);
    setFocused(false);
    onSelect(item);
  };

  return (
    <View style={{ gap: spacing(1.5) }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        testID={testID}
        value={text}
        onChangeText={(v) => {
          setText(v);
          setFocused(true);
          if (!v.trim()) onSelect({ key: undefined, label: '' });
        }}
        onFocus={() => setFocused(true)}
        placeholder={placeholder}
        placeholderTextColor={colors.textFaint}
        style={styles.input}
        autoCorrect={false}
      />
      {open ? (
        <View style={styles.list}>
          {results.map((r) => (
            <Pressable key={r.key} onPress={() => choose(r)} style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}>
              <Text style={styles.itemText}>{r.label}</Text>
            </Pressable>
          ))}
          {allowFree && text.trim() && !exact ? (
            <Pressable onPress={() => choose({ key: undefined, label: text.trim() })} style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}>
              <Text style={[styles.itemText, { color: colors.accent }]}>{t('anchorEditor.useTyped', { text: text.trim() })}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

export const inputStyle = {
  backgroundColor: colors.surface,
  borderWidth: 1,
  borderColor: colors.border,
  borderRadius: radius.md,
  color: colors.text,
  fontSize: 16,
  paddingHorizontal: spacing(4),
  paddingVertical: spacing(3),
};

const styles = StyleSheet.create({
  label: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  input: inputStyle,
  list: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  item: { paddingHorizontal: spacing(4), paddingVertical: spacing(3), borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  itemPressed: { backgroundColor: colors.border },
  itemText: { color: colors.text, fontSize: 15 },
});
