import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Screen, SectionTitle } from '@/components/ui';
import { displayName } from '@/core/anonymize';
import type { Connection } from '@/core/types';
import { t } from '@/i18n';
import { useApp } from '@/state/AppContext';
import { colors, font, kindColors, radius, spacing } from '@/theme';

export default function Messages() {
  const { me, connections, candidates, links, peerOf } = useApp();
  const incoming = connections.filter((c) => c.status === 'pending' && c.addresseeId === me?.id);
  const outgoing = connections.filter((c) => c.status === 'pending' && c.requesterId === me?.id);
  const accepted = connections.filter((c) => c.status === 'accepted');

  const Row = ({ c, onPress }: { c: Connection; onPress: () => void }) => {
    const peer = peerOf(c);
    const link = links.find((l) => l.candidateId === peer);
    const color = link ? kindColors[link.matches[0].mine.kind] : colors.thread;
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && { opacity: 0.75 }]}>
        <View style={[styles.avatar, { borderColor: color, shadowColor: color }]}>
          <View style={[styles.avatarCore, { backgroundColor: color }]} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[font.body, { fontWeight: '600' }]}>{displayName(peer, candidates.find((x) => x.id === peer)?.pseudo)}</Text>
          <Text style={font.small} numberOfLines={1}>
            {link?.why ?? c.introMessage}
          </Text>
        </View>
      </Pressable>
    );
  };

  return (
    <Screen scroll edges={['top']}>
      <Text style={[font.title, font.serif, { fontSize: 26 }]}>{t('messages.title')}</Text>
      {connections.length === 0 ? <Text style={[font.body, { color: colors.textMuted }]}>{t('messages.empty')}</Text> : null}

      {incoming.length > 0 ? <SectionTitle>{t('messages.requests')}</SectionTitle> : null}
      {incoming.map((c) => (
        <Row key={c.id} c={c} onPress={() => router.push({ pathname: '/link/[id]', params: { id: peerOf(c) } })} />
      ))}

      {accepted.length > 0 ? <SectionTitle>{t('messages.conversations')}</SectionTitle> : null}
      {accepted.map((c) => (
        <Row key={c.id} c={c} onPress={() => router.push({ pathname: '/chat/[id]', params: { id: c.id } })} />
      ))}

      {outgoing.length > 0 ? <SectionTitle>{t('messages.sent')}</SectionTitle> : null}
      {outgoing.map((c) => (
        <Row key={c.id} c={c} onPress={() => router.push({ pathname: '/link/[id]', params: { id: peerOf(c) } })} />
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(3),
    padding: spacing(3),
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.7,
    shadowRadius: 10,
  },
  avatarCore: { width: 12, height: 12, borderRadius: 6 },
});
