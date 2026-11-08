import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { t } from '@/i18n';
import { colors, spacing } from '@/theme';

export const ONBOARDING_STEPS = 5;

export function StepHeader({ step, canGoBack = true }: { step: number; canGoBack?: boolean }) {
  return (
    <View style={styles.row}>
      {canGoBack ? (
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel={t('common.back')}>
          <Text style={styles.back}>‹</Text>
        </Pressable>
      ) : (
        <View style={{ width: 16 }} />
      )}
      <View style={styles.dots} accessibilityLabel={t('onboarding.step', { n: step, total: ONBOARDING_STEPS })}>
        {Array.from({ length: ONBOARDING_STEPS }, (_, i) => (
          <View key={i} style={[styles.dot, i < step && styles.dotOn, i === step - 1 && styles.dotCurrent]} />
        ))}
      </View>
      <View style={{ width: 16 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing(2) },
  back: { color: colors.textMuted, fontSize: 34, lineHeight: 34, width: 16 },
  dots: { flexDirection: 'row', gap: 6 },
  dot: { width: 22, height: 3, borderRadius: 2, backgroundColor: colors.border },
  dotOn: { backgroundColor: colors.accentDim },
  dotCurrent: { backgroundColor: colors.accent },
});
