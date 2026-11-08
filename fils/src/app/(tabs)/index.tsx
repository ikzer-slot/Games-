import { Redirect, router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp, FadeOut } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GraphView, type GraphViewHandle, type PeerState } from '@/components/graph/GraphView';
import { Button, DemoBadge } from '@/components/ui';
import { displayName } from '@/core/anonymize';
import { layoutGraph } from '@/core/graphLayout';
import { scoreToPercent } from '@/core/scoring';
import { t } from '@/i18n';
import { useApp } from '@/state/AppContext';
import { colors, font, kindColors, radius, spacing } from '@/theme';

/** Écran principal : le graphe des fils, centré sur moi. */
export default function GraphScreen() {
  const { me, links, candidates, newLinkIds, markLinksSeen, connectionWith, mode, refresh } = useApp();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [banner, setBanner] = useState(0);
  const graphRef = useRef<GraphViewHandle>(null);
  const latest = useRef({ newLinkIds, markLinksSeen, refresh });
  latest.current = { newLinkIds, markLinksSeen, refresh };

  const layout = useMemo(() => layoutGraph(me?.anchors ?? [], links), [me?.anchors, links]);
  const selected = links.find((l) => l.candidateId === selectedId);
  const pseudoOf = (id: string) => candidates.find((c) => c.id === id)?.pseudo;

  // À chaque retour sur l'écran : rafraîchir, annoncer les nouveaux fils, puis les marquer vus.
  useFocusEffect(
    useCallback(() => {
      latest.current.refresh();
      setBanner(latest.current.newLinkIds.size);
      const timer = setTimeout(() => {
        latest.current.markLinksSeen();
        setBanner(0);
      }, 7000);
      return () => clearTimeout(timer);
    }, []),
  );

  const peerState = useCallback(
    (id: string): PeerState => {
      const c = connectionWith(id);
      return c?.status === 'accepted' ? 'accepted' : c?.status === 'pending' ? 'pending' : undefined;
    },
    [connectionWith],
  );

  if (!me) return <Redirect href="/onboarding" />;

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={[font.title, font.serif, { fontSize: 26 }]}>{t('graph.title')}</Text>
          <Text style={font.small}>{t('graph.subtitle', { n: links.length })}</Text>
        </View>
        <Pressable onPress={() => graphRef.current?.resetView()} style={styles.reset} hitSlop={8}>
          <Text style={styles.resetText}>{t('graph.resetView')}</Text>
        </Pressable>
      </View>
      {mode === 'demo' ? (
        <View style={{ paddingHorizontal: spacing(5) }}>
          <DemoBadge label={t('common.demoBadge')} />
        </View>
      ) : null}

      <View style={{ flex: 1 }}>
        {links.length === 0 ? (
          <View style={styles.empty}>
            <Text style={[font.body, { color: colors.textMuted, textAlign: 'center' }]}>{t('graph.empty')}</Text>
          </View>
        ) : (
          <GraphView
            ref={graphRef}
            layout={layout}
            selectedId={selectedId}
            onSelect={setSelectedId}
            newIds={newLinkIds}
            peerState={peerState}
          />
        )}

        {banner > 0 ? (
          <Animated.View entering={FadeInDown.delay(1200).duration(700)} exiting={FadeOut} style={styles.banner} pointerEvents="none">
            <Text style={styles.bannerText}>✦ {t('graph.newLinks', { n: banner })}</Text>
          </Animated.View>
        ) : null}

        {selected ? (
          <Animated.View key={selected.candidateId} entering={FadeInUp.duration(350)} style={styles.sheet}>
            <View style={styles.sheetHead}>
              <View style={[styles.sheetDot, { backgroundColor: kindColors[selected.matches[0].mine.kind] }]} />
              <Text style={[font.h2, { flex: 1 }]} numberOfLines={1}>
                {displayName(selected.candidateId, pseudoOf(selected.candidateId))}
              </Text>
              <Text style={styles.percent}>{scoreToPercent(selected.score)} %</Text>
            </View>
            <Text style={[font.body, { fontSize: 15 }]}>{selected.why}</Text>
            {selected.whyMore ? <Text style={font.small}>{selected.whyMore}</Text> : null}
            <Button
              testID="see-link"
              label={t('graph.seeLink')}
              onPress={() => router.push({ pathname: '/link/[id]', params: { id: selected.candidateId } })}
              style={{ marginTop: spacing(2) }}
            />
          </Animated.View>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: spacing(5), paddingTop: spacing(3), gap: spacing(3) },
  reset: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingHorizontal: spacing(3), paddingVertical: spacing(1.5) },
  resetText: { color: colors.textMuted, fontSize: 12 },
  empty: { flex: 1, justifyContent: 'center', padding: spacing(8) },
  banner: {
    position: 'absolute',
    top: spacing(3),
    alignSelf: 'center',
    backgroundColor: 'rgba(244,184,96,0.12)',
    borderColor: colors.accentDim,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(2),
  },
  bannerText: { color: colors.accent, fontSize: 13, fontWeight: '600' },
  sheet: {
    position: 'absolute',
    left: spacing(3),
    right: spacing(3),
    bottom: spacing(3),
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing(4),
    gap: spacing(1.5),
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 20,
  },
  sheetHead: { flexDirection: 'row', alignItems: 'center', gap: spacing(2) },
  sheetDot: { width: 10, height: 10, borderRadius: 5 },
  percent: { color: colors.accent, fontWeight: '700', fontSize: 15 },
});
