import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { notify } from '@/components/confirm';
import { displayName } from '@/core/anonymize';
import type { Message } from '@/core/types';
import { t } from '@/i18n';
import { repository } from '@/services';
import { useApp } from '@/state/AppContext';
import { colors, font, radius, spacing } from '@/theme';

/** Messagerie 1-à-1 : uniquement sur une connexion acceptée par les deux. */
export default function Chat() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { me, connections, candidates, links, peerOf, lastMessage } = useApp();
  const connection = connections.find((c) => c.id === id);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const listRef = useRef<FlatList<Message>>(null);

  const peer = connection ? peerOf(connection) : '';
  const name = displayName(peer, candidates.find((c) => c.id === peer)?.pseudo);
  const link = links.find((l) => l.candidateId === peer);
  const open = connection?.status === 'accepted';

  useEffect(() => {
    if (open) repository.listMessages(id).then(setMessages);
  }, [id, open]);

  // Temps réel (Supabase Realtime ou simulation démo).
  useEffect(() => {
    if (lastMessage?.connectionId === id) {
      setMessages((prev) => (prev.some((m) => m.id === lastMessage.id) ? prev : [...prev, lastMessage]));
    }
  }, [lastMessage, id]);

  useEffect(() => {
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
  }, [messages.length]);

  const send = async () => {
    const body = text.trim();
    if (!body) return;
    setText('');
    try {
      const m = await repository.sendMessage(id, body);
      setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
    } catch (e) {
      setText(body);
      notify(String((e as Error).message ?? e));
    }
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/messages'))} hitSlop={12}>
            <Text style={{ color: colors.textMuted, fontSize: 30 }}>‹</Text>
          </Pressable>
          <Pressable style={{ flex: 1 }} onPress={() => router.push({ pathname: '/link/[id]', params: { id: peer } })}>
            <Text style={font.h2}>{name}</Text>
            {link ? (
              <Text style={font.small} numberOfLines={1}>
                {link.why}
              </Text>
            ) : null}
          </Pressable>
        </View>

        {!open ? (
          <View style={styles.locked}>
            <Text style={[font.body, { color: colors.textMuted, textAlign: 'center' }]}>🔒 {t('messages.locked')}</Text>
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(m) => m.id}
            contentContainerStyle={{ padding: spacing(4), gap: spacing(2) }}
            ListHeaderComponent={
              connection ? (
                <View style={styles.intro}>
                  <Text style={styles.introText}>« {connection.introMessage} »</Text>
                </View>
              ) : undefined
            }
            renderItem={({ item }) => {
              const mine = item.senderId === me?.id;
              return (
                <Animated.View entering={FadeInUp.duration(300)} style={[styles.bubble, mine ? styles.mine : styles.theirs]}>
                  <Text style={{ color: mine ? colors.bg : colors.text, fontSize: 15, lineHeight: 21 }}>{item.body}</Text>
                </Animated.View>
              );
            }}
          />
        )}

        {open ? (
          <View style={styles.composer}>
            <TextInput
              testID="chat-input"
              value={text}
              onChangeText={setText}
              placeholder={t('messages.placeholder')}
              placeholderTextColor={colors.textFaint}
              style={styles.input}
              multiline
              maxLength={2000}
              onSubmitEditing={send}
              blurOnSubmit={Platform.OS === 'web'}
            />
            <Pressable testID="chat-send" onPress={send} style={[styles.send, !text.trim() && { opacity: 0.4 }]} disabled={!text.trim()}>
              <Text style={{ color: colors.bg, fontWeight: '700' }}>↑</Text>
            </Pressable>
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(3),
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(2),
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  locked: { flex: 1, justifyContent: 'center', padding: spacing(8) },
  intro: { alignSelf: 'center', maxWidth: '90%', marginBottom: spacing(3) },
  introText: { color: colors.textMuted, fontStyle: 'italic', textAlign: 'center', fontSize: 13 },
  bubble: { maxWidth: '80%', paddingHorizontal: spacing(4), paddingVertical: spacing(2.5), borderRadius: radius.lg },
  mine: { alignSelf: 'flex-end', backgroundColor: colors.accent, borderBottomRightRadius: 6 },
  theirs: { alignSelf: 'flex-start', backgroundColor: colors.surfaceAlt, borderBottomLeftRadius: 6 },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing(2),
    padding: spacing(3),
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  input: {
    flex: 1,
    maxHeight: 120,
    backgroundColor: colors.surface,
    color: colors.text,
    borderRadius: radius.lg,
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(2.5),
    fontSize: 15,
  },
  send: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
});
