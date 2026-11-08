import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';
import { AnchorRow } from '@/components/AnchorRow';
import { inputStyle } from '@/components/Autocomplete';
import { confirmAsync, notify } from '@/components/confirm';
import { Button, Card, Screen, SectionTitle, ToggleRow } from '@/components/ui';
import { t } from '@/i18n';
import { useApp } from '@/state/AppContext';
import { colors, font, spacing } from '@/theme';
import { MAX_ANCHORS } from '../onboarding/anchors';

/** Profil : ancrages, visibilité, blocages, export RGPD, suppression en un geste. */
export default function Profile() {
  const { me, mode, blocked, updateProfile, setAnchorVisible, unblockAll, exportData, deleteAccount } = useApp();
  const [pseudo, setPseudo] = useState(me?.pseudo ?? '');
  const [exported, setExported] = useState<string | null>(null);
  if (!me) return null;

  const pseudoValid = pseudo.trim().length >= 2 && pseudo.trim().length <= 30;

  const onDelete = async () => {
    const ok = await confirmAsync(t('profile.deleteConfirmTitle'), t('profile.deleteConfirmBody'), t('common.delete'), t('common.cancel'), true);
    if (!ok) return;
    await deleteAccount();
    router.replace('/onboarding');
  };

  return (
    <Screen scroll edges={['top']}>
      <Text style={[font.title, font.serif, { fontSize: 26 }]}>{t('profile.title')}</Text>

      <SectionTitle>{t('profile.pseudo')}</SectionTitle>
      <TextInput value={pseudo} onChangeText={setPseudo} maxLength={30} style={inputStyle} autoCapitalize="none" />
      {pseudo.trim() !== me.pseudo ? (
        <Button label={t('common.save')} variant="secondary" disabled={!pseudoValid} onPress={() => updateProfile({ pseudo: pseudo.trim() })} />
      ) : null}

      <SectionTitle>{t('profile.anchors')}</SectionTitle>
      <View style={{ gap: spacing(2) }}>
        {me.anchors.map((a) => (
          <AnchorRow
            key={a.id}
            anchor={a}
            onPress={() => router.push({ pathname: '/anchor-editor', params: { target: 'profile', id: a.id } })}
            onToggleVisible={(v) => setAnchorVisible('profile', a.id, v)}
          />
        ))}
      </View>
      {me.anchors.length < MAX_ANCHORS ? (
        <Button label={`+  ${t('profile.addAnchor')}`} variant="secondary" onPress={() => router.push({ pathname: '/anchor-editor', params: { target: 'profile' } })} />
      ) : (
        <Text style={font.small}>{t('profile.maxAnchors')}</Text>
      )}

      <SectionTitle>{t('profile.privacy')}</SectionTitle>
      <Card>
        <ToggleRow
          label={t('onboarding.discoverable')}
          hint={t('onboarding.discoverableHint')}
          value={me.settings.discoverable}
          onChange={(discoverable) => updateProfile({ settings: { ...me.settings, discoverable } })}
        />
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={font.small}>{t('profile.blockedUsers', { n: blocked.length })}</Text>
          {blocked.length > 0 ? <Button label={t('profile.unblockAll')} variant="ghost" onPress={unblockAll} /> : null}
        </View>
      </Card>

      <Button
        label={t('profile.exportData')}
        variant="secondary"
        onPress={async () => setExported(JSON.stringify(await exportData(), null, 2))}
      />
      {exported ? (
        <Card>
          <Text style={font.small}>{t('profile.exportDone')}</Text>
          <ScrollView style={{ maxHeight: 220 }} nestedScrollEnabled>
            <Text selectable style={{ color: colors.textMuted, fontFamily: 'monospace', fontSize: 11 }}>
              {exported}
            </Text>
          </ScrollView>
        </Card>
      ) : null}

      <Button label={t('profile.legal')} variant="ghost" onPress={() => notify(t('onboarding.consentLegal'))} />
      <Button testID="delete-account" label={t('profile.deleteAccount')} variant="danger" onPress={onDelete} />
      <Text style={[font.small, { textAlign: 'center', color: colors.textFaint }]}>{t('profile.mode', { mode })}</Text>
    </Screen>
  );
}
