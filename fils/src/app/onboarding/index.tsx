import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { ThreadsIllustration } from '@/components/ThreadsIllustration';
import { StepHeader } from '@/components/StepHeader';
import { Button, Card, Checkbox, DemoBadge, Screen } from '@/components/ui';
import { t } from '@/i18n';
import { useApp } from '@/state/AppContext';
import { colors, font, spacing } from '@/theme';

/** Écran 1/5 — Bienvenue + consentement RGPD explicite. */
export default function Welcome() {
  const { draft, setDraft, mode } = useApp();
  const [age, setAge] = useState(false);

  return (
    <Screen scroll>
      <StepHeader step={1} canGoBack={false} />
      {mode === 'demo' ? <DemoBadge label={t('common.demoBadge')} /> : null}
      <ThreadsIllustration />
      <Animated.View entering={FadeInDown.delay(200).duration(700)} style={{ gap: spacing(2) }}>
        <Text style={[font.title, font.serif, styles.title]}>{t('onboarding.welcomeTitle')}</Text>
        <Text style={styles.tagline}>{t('onboarding.welcomeTagline')}</Text>
        <Text style={[font.body, { color: colors.textMuted }]}>{t('onboarding.welcomeBody')}</Text>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(500).duration(700)}>
        <Card>
          <Text style={font.h2}>{t('onboarding.consentTitle')}</Text>
          <Text style={[font.body, { fontSize: 15 }]}>{t('onboarding.consentPoints')}</Text>
          <Text style={font.small}>{t('onboarding.consentLegal')}</Text>
          <View style={{ gap: spacing(2), marginTop: spacing(2) }}>
            <Checkbox testID="consent" checked={draft.consent} onChange={(v) => setDraft({ consent: v })} label={t('onboarding.consentCheck')} />
            <Checkbox testID="age" checked={age} onChange={setAge} label={t('onboarding.ageCheck')} />
          </View>
        </Card>
      </Animated.View>

      <Button testID="start" label={t('onboarding.start')} disabled={!draft.consent || !age} onPress={() => router.push('/onboarding/pseudo')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 44, color: colors.me, letterSpacing: 1 },
  tagline: { color: colors.text, fontSize: 19, lineHeight: 27, fontWeight: '500' },
});
