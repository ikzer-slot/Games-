import { router } from 'expo-router';
import { Text, TextInput, View } from 'react-native';
import { inputStyle } from '@/components/Autocomplete';
import { StepHeader } from '@/components/StepHeader';
import { Button, Screen } from '@/components/ui';
import { t } from '@/i18n';
import { useApp } from '@/state/AppContext';
import { colors, font, spacing } from '@/theme';

/** Écran 2/5 — Pseudo. */
export default function Pseudo() {
  const { draft, setDraft } = useApp();
  const len = draft.pseudo.trim().length;
  const valid = len >= 2 && len <= 30;

  return (
    <Screen>
      <StepHeader step={2} />
      <View style={{ gap: spacing(3), flex: 1 }}>
        <Text style={[font.title, font.serif]}>{t('onboarding.pseudoTitle')}</Text>
        <Text style={[font.body, { color: colors.textMuted }]}>{t('onboarding.pseudoBody')}</Text>
        <TextInput
          testID="pseudo"
          value={draft.pseudo}
          onChangeText={(pseudo) => setDraft({ pseudo })}
          placeholder={t('onboarding.pseudoPlaceholder')}
          placeholderTextColor={colors.textFaint}
          maxLength={30}
          autoFocus
          autoCapitalize="none"
          autoCorrect={false}
          style={[inputStyle, { fontSize: 20, marginTop: spacing(4) }]}
          onSubmitEditing={() => valid && router.push('/onboarding/anchors')}
        />
        {len > 0 && !valid ? <Text style={{ color: colors.danger }}>{t('onboarding.pseudoError')}</Text> : null}
      </View>
      <Button testID="next" label={t('common.continue')} disabled={!valid} onPress={() => router.push('/onboarding/anchors')} />
    </Screen>
  );
}
