import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut } from 'react-native-reanimated';
import { ThreadsIllustration } from '@/components/ThreadsIllustration';
import { StepHeader } from '@/components/StepHeader';
import { Button, Screen } from '@/components/ui';
import { t } from '@/i18n';
import { useApp } from '@/state/AppContext';
import { colors, font, kindColors, spacing } from '@/theme';

/**
 * Écran 5/5 — La « découverte ». On laisse un temps de suspense, puis le
 * compteur monte et la première coïncidence apparaît : c'est l'effet clé.
 */
export default function Reveal() {
  const { links } = useApp();
  const [phase, setPhase] = useState<'search' | 'found'>('search');
  const [count, setCount] = useState(0);
  const total = links.length;
  const first = links[0];

  useEffect(() => {
    const timer = setTimeout(() => setPhase('found'), 2200);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (phase !== 'found' || total === 0) return;
    let n = 0;
    const step = Math.max(1, Math.ceil(total / 25));
    const id = setInterval(() => {
      n = Math.min(total, n + step);
      setCount(n);
      if (n >= total) clearInterval(id);
    }, 45);
    return () => clearInterval(id);
  }, [phase, total]);

  return (
    <Screen>
      <StepHeader step={5} canGoBack={false} />
      <ThreadsIllustration />
      <View style={styles.center}>
        {phase === 'search' ? (
          <Animated.Text exiting={FadeOut} entering={FadeIn.duration(800)} style={[styles.searching, font.serif]}>
            {t('onboarding.revealSearching')}
          </Animated.Text>
        ) : (
          <Animated.View entering={FadeIn.duration(900)} style={{ alignItems: 'center', gap: spacing(3) }}>
            {total > 0 ? <Text style={[styles.count, font.serif]}>{count}</Text> : null}
            <Text style={styles.found}>
              {total === 0
                ? t('onboarding.revealNone')
                : total === 1
                  ? t('onboarding.revealFoundOne')
                  : t('onboarding.revealFound', { n: total })}
            </Text>
            {first ? (
              <Animated.View entering={FadeInDown.delay(1300).duration(900)} style={[styles.quote, { borderColor: kindColors[first.matches[0].mine.kind] }]}>
                <Text style={styles.quoteText}>« {first.why} »</Text>
              </Animated.View>
            ) : null}
          </Animated.View>
        )}
      </View>
      {phase === 'found' ? (
        <Animated.View entering={FadeInDown.delay(1800).duration(700)}>
          <Button testID="see-threads" label={t('onboarding.revealCta')} onPress={() => router.replace('/(tabs)')} />
        </Animated.View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing(2) },
  searching: { color: colors.textMuted, fontSize: 22, fontStyle: 'italic' },
  count: { color: colors.me, fontSize: 76, fontWeight: '300', textShadowColor: colors.accent, textShadowRadius: 24 },
  found: { color: colors.text, fontSize: 19, textAlign: 'center', lineHeight: 27 },
  quote: { borderLeftWidth: 2, paddingLeft: spacing(3), marginTop: spacing(4) },
  quoteText: { color: colors.textMuted, fontSize: 16, fontStyle: 'italic', lineHeight: 23 },
});
