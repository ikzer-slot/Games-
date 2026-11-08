import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { inputStyle } from '@/components/Autocomplete';
import { confirmAsync, notify } from '@/components/confirm';
import { Button, Card, Screen, SectionTitle } from '@/components/ui';
import { anchorSubtitle, anchorTitle } from '@/core/anchorText';
import { displayName } from '@/core/anonymize';
import { explainMatch, scoreToPercent } from '@/core/scoring';
import type { ReportReason } from '@/core/types';
import { t } from '@/i18n';
import { useApp } from '@/state/AppContext';
import { colors, font, kindColors, kindEmoji, radius, spacing } from '@/theme';

const REASONS: ReportReason[] = ['spam', 'harassment', 'fake', 'inappropriate', 'other'];
const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

/** Fiche de lien : le pourquoi, puis « Dire bonjour » / accepter / discuter. */
export default function LinkScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { me, links, candidates, connectionWith, sayHello, respond, block, report } = useApp();
  const link = links.find((l) => l.candidateId === id);
  const connection = connectionWith(id);
  const pseudo = candidates.find((c) => c.id === id)?.pseudo;
  const name = displayName(id, pseudo);

  const [composing, setComposing] = useState(false);
  const [intro, setIntro] = useState(link ? t('link.defaultIntro', { reason_lower: lowerFirst(link.why) }) : '');
  const [busy, setBusy] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [reason, setReason] = useState<ReportReason>('spam');
  const [details, setDetails] = useState('');

  const bar = useSharedValue(0);
  const score = link?.score ?? 0;
  useEffect(() => {
    bar.value = withDelay(300, withTiming(score, { duration: 1200 }));
  }, [bar, score]);
  const barStyle = useAnimatedStyle(() => ({ width: `${bar.value * 100}%` }));

  const back = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)'));
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      notify(String((e as Error).message ?? e));
    } finally {
      setBusy(false);
    }
  };

  const onBlock = async () => {
    const ok = await confirmAsync(t('link.block'), t('link.blockConfirm'), t('link.block'), t('common.cancel'), true);
    if (!ok) return;
    await run(() => block(id));
    notify(t('link.blocked'));
    back();
  };

  const onReport = () =>
    run(async () => {
      await report(id, reason, details.trim());
      setReporting(false);
      notify(t('link.reportSent'));
    });

  const incoming = connection?.status === 'pending' && connection.addresseeId === me?.id;
  const outgoing = connection?.status === 'pending' && connection.requesterId === me?.id;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen scroll>
        <Pressable onPress={back} hitSlop={12} accessibilityRole="button" accessibilityLabel={t('common.back')}>
          <Text style={{ color: colors.textMuted, fontSize: 30 }}>‹</Text>
        </Pressable>

        <Animated.View entering={FadeIn.duration(600)} style={{ gap: spacing(2) }}>
          <Text style={styles.eyebrow}>{t('link.title')}</Text>
          <Text style={[font.title, font.serif]}>{name}</Text>
          {!pseudo ? <Text style={font.small}>🔒 {t('link.anonymous')}</Text> : null}
        </Animated.View>

        {link ? (
          <>
            <Animated.View entering={FadeInDown.delay(150).duration(700)}>
              <Card>
                <Text style={[font.body, font.serif, { fontSize: 19, lineHeight: 27 }]}>« {link.why} »</Text>
                <View style={styles.proxRow}>
                  <Text style={font.small}>{t('link.proximity')}</Text>
                  <Text style={styles.percent}>{scoreToPercent(link.score)} %</Text>
                </View>
                <View style={styles.track}>
                  <Animated.View style={[styles.fill, barStyle]} />
                </View>
              </Card>
            </Animated.View>

            <SectionTitle>{t('link.commonPoints')}</SectionTitle>
            {link.matches.map((m, i) => (
              <Animated.View key={m.mine.id} entering={FadeInDown.delay(300 + i * 150).duration(600)}>
                <View style={[styles.match, { borderLeftColor: kindColors[m.mine.kind] }]}>
                  <Text style={styles.matchKind}>
                    {kindEmoji[m.mine.kind]}  {t(`precision.${m.precision}`)}
                  </Text>
                  <Text style={[font.body, { fontSize: 15 }]}>{explainMatch(m)}</Text>
                  <Text style={font.small}>
                    {t('messages.you')} : {anchorTitle(m.mine)} {anchorSubtitle(m.mine) ? `· ${anchorSubtitle(m.mine)}` : ''}
                  </Text>
                  <Text style={font.small}>
                    {name} : {anchorTitle(m.theirs)} {anchorSubtitle(m.theirs) ? `· ${anchorSubtitle(m.theirs)}` : ''}
                  </Text>
                </View>
              </Animated.View>
            ))}
          </>
        ) : null}

        <View style={{ flex: 1, minHeight: spacing(4) }} />

        {/* ── Machine à états de la relation ── */}
        {!connection ? (
          composing ? (
            <Animated.View entering={FadeInDown.duration(400)} style={{ gap: spacing(2) }}>
              <Text style={font.h2}>{t('link.helloTitle')}</Text>
              <Text style={font.small}>{t('link.helloHint')}</Text>
              <TextInput
                testID="intro"
                value={intro}
                onChangeText={setIntro}
                multiline
                maxLength={600}
                style={[inputStyle, { minHeight: 120, textAlignVertical: 'top' }]}
              />
              <Button
                testID="send-hello"
                label={t('common.send')}
                loading={busy}
                disabled={!intro.trim()}
                onPress={() =>
                  run(async () => {
                    await sayHello(id, intro.trim());
                    setComposing(false);
                  })
                }
              />
            </Animated.View>
          ) : (
            <Button testID="say-hello" label={`👋  ${t('link.sayHello')}`} onPress={() => setComposing(true)} disabled={!link} />
          )
        ) : incoming ? (
          <Card>
            <Text style={font.small}>{t('link.incoming')}</Text>
            <Text style={[font.body, { fontStyle: 'italic' }]}>« {connection.introMessage} »</Text>
            <View style={{ flexDirection: 'row', gap: spacing(2), marginTop: spacing(2) }}>
              <Button label={t('link.decline')} variant="secondary" style={{ flex: 1 }} onPress={() => run(() => respond(connection.id, false))} />
              <Button testID="accept" label={t('link.accept')} style={{ flex: 1 }} loading={busy} onPress={() => run(() => respond(connection.id, true))} />
            </View>
          </Card>
        ) : outgoing ? (
          <Card>
            <Text style={{ color: colors.accent, fontWeight: '600' }}>⏳ {t('link.pending')}</Text>
            <Text style={font.small}>{t('link.helloSent')}</Text>
          </Card>
        ) : connection.status === 'accepted' ? (
          <Button testID="open-chat" label={t('link.openChat')} onPress={() => router.push({ pathname: '/chat/[id]', params: { id: connection.id } })} />
        ) : (
          <Text style={font.small}>{t('link.declined')}</Text>
        )}

        {/* ── Sécurité ── */}
        {reporting ? (
          <Card>
            <Text style={font.h2}>{t('link.reportTitle')}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing(2) }}>
              {REASONS.map((r) => (
                <Pressable key={r} onPress={() => setReason(r)} style={[styles.chip, reason === r && styles.chipOn]}>
                  <Text style={{ color: reason === r ? colors.bg : colors.text, fontSize: 13 }}>{t(`reportReasons.${r}`)}</Text>
                </Pressable>
              ))}
            </View>
            <TextInput
              value={details}
              onChangeText={setDetails}
              placeholder={t('link.reportDetails')}
              placeholderTextColor={colors.textFaint}
              multiline
              maxLength={1000}
              style={[inputStyle, { minHeight: 70 }]}
            />
            <View style={{ flexDirection: 'row', gap: spacing(2) }}>
              <Button label={t('common.cancel')} variant="secondary" style={{ flex: 1 }} onPress={() => setReporting(false)} />
              <Button label={t('common.send')} variant="danger" style={{ flex: 1 }} loading={busy} onPress={onReport} />
            </View>
          </Card>
        ) : (
          <View style={styles.safety}>
            <Pressable onPress={() => setReporting(true)} hitSlop={8}>
              <Text style={styles.safetyText}>⚑ {t('link.report')}</Text>
            </Pressable>
            <Pressable onPress={onBlock} hitSlop={8}>
              <Text style={[styles.safetyText, { color: colors.danger }]}>⦸ {t('link.block')}</Text>
            </Pressable>
          </View>
        )}
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  eyebrow: { color: colors.accent, fontSize: 12, fontWeight: '700', letterSpacing: 1.4, textTransform: 'uppercase' },
  proxRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing(3) },
  percent: { color: colors.accent, fontWeight: '700' },
  track: { height: 4, borderRadius: 2, backgroundColor: colors.border, overflow: 'hidden' },
  fill: { height: 4, borderRadius: 2, backgroundColor: colors.accent },
  match: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderLeftWidth: 3,
    padding: spacing(3),
    gap: 4,
  },
  matchKind: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
  chip: { paddingHorizontal: spacing(3), paddingVertical: spacing(1.5), borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border },
  chipOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  safety: { flexDirection: 'row', justifyContent: 'center', gap: spacing(8), paddingVertical: spacing(2) },
  safetyText: { color: colors.textMuted, fontSize: 13 },
});
