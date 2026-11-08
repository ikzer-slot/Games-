import { router } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { AnchorRow } from '@/components/AnchorRow';
import { notify } from '@/components/confirm';
import { StepHeader } from '@/components/StepHeader';
import { Button, Card, Screen, SectionTitle, ToggleRow } from '@/components/ui';
import { t } from '@/i18n';
import { useApp } from '@/state/AppContext';
import { colors, font, spacing } from '@/theme';

/** Écran 4/5 — Ce que les autres verront (visibilité), puis création du profil. */
export default function Visibility() {
  const { draft, setDraft, setAnchorVisible, completeOnboarding } = useApp();
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      await completeOnboarding();
      router.replace('/onboarding/reveal');
    } catch (e) {
      notify(String((e as Error).message ?? e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen scroll>
      <StepHeader step={4} />
      <Text style={[font.title, font.serif]}>{t('onboarding.visibilityTitle')}</Text>
      <Text style={[font.body, { color: colors.textMuted }]}>{t('onboarding.visibilityBody')}</Text>

      <Card>
        <ToggleRow
          label={t('onboarding.discoverable')}
          hint={t('onboarding.discoverableHint')}
          value={draft.settings.discoverable}
          onChange={(discoverable) => setDraft({ settings: { ...draft.settings, discoverable } })}
        />
      </Card>

      <SectionTitle>{t('profile.anchors')}</SectionTitle>
      <View style={{ gap: spacing(2) }}>
        {draft.anchors.map((a) => (
          <AnchorRow key={a.id} anchor={a} onToggleVisible={(v) => setAnchorVisible('draft', a.id, v)} />
        ))}
      </View>
      <View style={{ flex: 1 }} />
      <Button testID="create" label={t('common.continue')} loading={busy} onPress={submit} />
    </Screen>
  );
}
