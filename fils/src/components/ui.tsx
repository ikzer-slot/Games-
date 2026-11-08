import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { colors, font, radius, spacing } from '@/theme';

export function Screen({
  children,
  scroll = false,
  edges = ['top', 'bottom'],
  style,
}: {
  children: ReactNode;
  scroll?: boolean;
  edges?: Edge[];
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <SafeAreaView style={styles.screen} edges={edges}>
      {scroll ? (
        <ScrollView contentContainerStyle={[styles.content, style]} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.content, { flex: 1 }, style]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  style,
  testID,
}: {
  label: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const inactive = disabled || loading;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!inactive }}
      onPress={onPress}
      disabled={inactive}
      style={({ pressed }) => [
        styles.btn,
        styles[`btn_${variant}`],
        inactive && { opacity: 0.4 },
        pressed && { opacity: 0.75, transform: [{ scale: 0.98 }] },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? colors.bg : colors.text} />
      ) : (
        <Text style={[styles.btnText, styles[`btnText_${variant}`]]}>{label}</Text>
      )}
    </Pressable>
  );
}

export function Checkbox({ checked, onChange, label, testID }: { checked: boolean; onChange: (v: boolean) => void; label: string; testID?: string }) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      onPress={() => onChange(!checked)}
      style={styles.checkRow}
    >
      <View style={[styles.checkBox, checked && styles.checkBoxOn]}>{checked && <Text style={styles.checkMark}>✓</Text>}</View>
      <Text style={[font.body, { flex: 1, fontSize: 15 }]}>{label}</Text>
    </Pressable>
  );
}

export function ToggleRow({ label, hint, value, onChange }: { label: string; hint?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={styles.toggleRow}>
      <View style={{ flex: 1 }}>
        <Text style={[font.body, { fontSize: 15 }]}>{label}</Text>
        {hint ? <Text style={font.small}>{hint}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ true: colors.accentDim, false: colors.border }}
        thumbColor={value ? colors.accent : colors.textMuted}
      />
    </View>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <Text style={styles.section}>{children}</Text>;
}

export function DemoBadge({ label }: { label: string }) {
  return (
    <View style={styles.badge}>
      <Text style={styles.badgeText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing(5), gap: spacing(4), flexGrow: 1 },
  btn: {
    minHeight: 52,
    borderRadius: radius.pill,
    paddingHorizontal: spacing(6),
    alignItems: 'center',
    justifyContent: 'center',
  },
  btn_primary: { backgroundColor: colors.accent, shadowColor: colors.accent, shadowOpacity: 0.35, shadowRadius: 16 },
  btn_secondary: { backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border },
  btn_ghost: { backgroundColor: 'transparent', minHeight: 44 },
  btn_danger: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.danger },
  btnText: { fontSize: 16, fontWeight: '600' },
  btnText_primary: { color: colors.bg },
  btnText_secondary: { color: colors.text },
  btnText_ghost: { color: colors.textMuted },
  btnText_danger: { color: colors.danger },
  checkRow: { flexDirection: 'row', gap: spacing(3), alignItems: 'flex-start', paddingVertical: spacing(1) },
  checkBox: {
    width: 24,
    height: 24,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: colors.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkBoxOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  checkMark: { color: colors.bg, fontWeight: '800', fontSize: 14 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing(3), paddingVertical: spacing(2) },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing(4),
    gap: spacing(2),
  },
  section: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginTop: spacing(2),
  },
  badge: {
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.accentDim,
    paddingHorizontal: spacing(3),
    paddingVertical: 3,
  },
  badgeText: { color: colors.accent, fontSize: 11, fontWeight: '600', letterSpacing: 0.3 },
});
