import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';
import { AnchorRow } from '@/components/AnchorRow';
import { StepHeader } from '@/components/StepHeader';
import { Button, Screen } from '@/components/ui';
import { ANCHOR_KINDS } from '@/core/types';
import { t } from '@/i18n';
import { useApp } from '@/state/AppContext';
import { colors, font, kindColors, kindEmoji, radius, spacing } from '@/theme';

export const MIN_ANCHORS = 3;
export const MAX_ANCHORS = 5;

/** Écran 3/5 — Points d'ancrage guidés (3 à 5). */
export default function Anchors() {
  const { draft } = useApp();
  const n = draft.anchors.length;
  const usedKinds = new Set(draft.anchors.map((a) => a.kind));
  // Suggestion guidée : le prochain type que l'utilisateur n'a pas encore utilisé.
  const nextKind = ANCHOR_KINDS.find((k) => !usedKinds.has(k));

  return (
    <Screen scroll>
      <StepHeader step={3} />
      <Text style={[font.title, font.serif]}>{t('onboarding.anchorsTitle')}</Text>
      <Text style={[font.body, { color: colors.textMuted }]}>{t('onboarding.anchorsBody')}</Text>

      <View style={{ gap: spacing(2) }}>
        {draft.anchors.map((a) => (
          <Animated.View key={a.id} entering={FadeInDown.duration(500)} layout={LinearTransition}>
            <AnchorRow anchor={a} onPress={() => router.push({ pathname: '/anchor-editor', params: { target: 'draft', id: a.id } })} />
          </Animated.View>
        ))}
      </View>

      {n < MAX_ANCHORS ? (
        <View style={styles.grid}>
          {ANCHOR_KINDS.map((k) => (
            <Pressable
              key={k}
              testID={`add-${k}`}
              onPress={() => router.push({ pathname: '/anchor-editor', params: { target: 'draft', kind: k } })}
              style={({ pressed }) => [styles.kind, k === nextKind && { borderColor: kindColors[k] }, pressed && { opacity: 0.7 }]}
            >
              <Text style={{ fontSize: 20 }}>{kindEmoji[k]}</Text>
              <Text style={styles.kindTitle}>{t(`kinds.${k}`)}</Text>
              <Text style={styles.kindHint}>{t(`kindHints.${k}`)}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      <View style={{ flex: 1 }} />
      <Text style={styles.counter}>
        {t('onboarding.anchorsCount', { n })}
        {n < MIN_ANCHORS ? `  ·  ${t('onboarding.anchorsMin', { n: MIN_ANCHORS - n })}` : ''}
      </Text>
      <Button testID="next" label={t('common.continue')} disabled={n < MIN_ANCHORS} onPress={() => router.push('/onboarding/visibility')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing(2) },
  kind: {
    width: '48.5%',
    flexGrow: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing(3),
    gap: 2,
  },
  kindTitle: { color: colors.text, fontWeight: '600', fontSize: 14 },
  kindHint: { color: colors.textMuted, fontSize: 12 },
  counter: { color: colors.textMuted, textAlign: 'center', fontSize: 13 },
});
