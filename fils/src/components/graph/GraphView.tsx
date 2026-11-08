/**
 * Graphe interactif centré sur moi.
 *  - SVG (react-native-svg) : fils courbes fins, nœuds lumineux (halo radial).
 *  - Gestes (Gesture Handler 3) : glisser pour déplacer, pincer pour zoomer,
 *    toucher un nœud pour le sélectionner (hit-test manuel, plus fiable que
 *    les onPress SVG sous un détecteur de gestes).
 *  - Animations (Reanimated 4) : les fils se « tissent » un à un depuis le
 *    centre, les nœuds éclosent, les nouveaux liens pulsent.
 */
import { memo, useEffect, useImperativeHandle, useMemo, useState, type Ref } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { GestureDetector, usePanGesture, usePinchGesture, useSimultaneousGestures, useTapGesture } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, G, Path, RadialGradient, Stop, Text as SvgText } from 'react-native-svg';
import { anchorTitle } from '@/core/anchorText';
import { ANCHOR_RING, type Edge, type GraphLayout, type PersonNode } from '@/core/graphLayout';
import { hashString } from '@/core/anonymize';
import { ANCHOR_KINDS, type AnchorKind } from '@/core/types';
import { t } from '@/i18n';
import { colors, kindColors } from '@/theme';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const MIN_SCALE = 0.6;
const MAX_SCALE = 3.5;
const STAGGER = 70;

export type PeerState = 'accepted' | 'pending' | undefined;

export interface GraphViewHandle {
  resetView: () => void;
}

interface Props {
  layout: GraphLayout;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  newIds: Set<string>;
  peerState: (id: string) => PeerState;
  ref?: Ref<GraphViewHandle>;
}

/** Courbe légère entre deux points : un fil, pas un trait de règle. */
function threadPath(e: Edge): string {
  const mx = (e.x1 + e.x2) / 2;
  const my = (e.y1 + e.y2) / 2;
  const dx = e.x2 - e.x1;
  const dy = e.y2 - e.y1;
  const bend = ((hashString(e.key) % 100) / 100 - 0.5) * 0.35;
  return `M${e.x1},${e.y1} Q${mx - dy * bend},${my + dx * bend} ${e.x2},${e.y2}`;
}

const Thread = memo(function Thread({ edge, dim, bright }: { edge: Edge; dim: boolean; bright: boolean }) {
  const length = Math.hypot(edge.x2 - edge.x1, edge.y2 - edge.y1) * 1.12 + 2;
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withDelay(edge.order * STAGGER, withTiming(1, { duration: 1100, easing: Easing.out(Easing.cubic) }));
  }, [edge.order, progress]);
  const animatedProps = useAnimatedProps(() => ({ strokeDashoffset: length * (1 - progress.value) }));
  const color = kindColors[edge.kind];
  const baseOpacity = 0.18 + 0.55 * edge.weight;
  return (
    <AnimatedPath
      d={threadPath(edge)}
      stroke={color}
      strokeWidth={bright ? 1.8 : 0.6 + edge.weight * 1.1}
      strokeOpacity={dim ? 0.07 : bright ? 0.95 : baseOpacity}
      fill="none"
      strokeLinecap="round"
      strokeDasharray={[length, length]}
      animatedProps={animatedProps}
    />
  );
});

const Person = memo(function Person({
  node,
  order,
  selected,
  dim,
  isNew,
  state,
}: {
  node: PersonNode;
  order: number;
  selected: boolean;
  dim: boolean;
  isNew: boolean;
  state: PeerState;
}) {
  const bloom = useSharedValue(0);
  const pulse = useSharedValue(0);
  useEffect(() => {
    bloom.value = withDelay(order * STAGGER + 500, withTiming(1, { duration: 700, easing: Easing.out(Easing.back(2)) }));
    if (isNew) {
      pulse.value = withDelay(
        order * STAGGER + 900,
        withRepeat(withSequence(withTiming(1, { duration: 1400 }), withTiming(0, { duration: 0 })), 4),
      );
    }
  }, [bloom, pulse, order, isNew]);

  const color = kindColors[node.kind];
  const coreProps = useAnimatedProps(() => ({ r: node.r * bloom.value, opacity: bloom.value }));
  const haloProps = useAnimatedProps(() => ({ r: node.r * 3.2 * bloom.value }));
  const pulseProps = useAnimatedProps(() => ({ r: node.r + pulse.value * 22, strokeOpacity: 0.7 * (1 - pulse.value) }));

  return (
    <G opacity={dim ? 0.3 : 1}>
      <AnimatedCircle cx={node.x} cy={node.y} fill={`url(#halo-${node.kind})`} animatedProps={haloProps} />
      {isNew ? (
        <AnimatedCircle cx={node.x} cy={node.y} fill="none" stroke={color} strokeWidth={1.2} animatedProps={pulseProps} />
      ) : null}
      <AnimatedCircle cx={node.x} cy={node.y} fill={color} animatedProps={coreProps} />
      {state === 'accepted' ? <Circle cx={node.x} cy={node.y} r={node.r + 4} fill="none" stroke={colors.me} strokeWidth={1.4} /> : null}
      {state === 'pending' ? (
        <Circle cx={node.x} cy={node.y} r={node.r + 4} fill="none" stroke={colors.me} strokeWidth={1} strokeDasharray={[3, 3]} strokeOpacity={0.7} />
      ) : null}
      {selected ? (
        <>
          <Circle cx={node.x} cy={node.y} r={node.r + 9} fill="none" stroke={color} strokeWidth={1.5} />
          <SvgText x={node.x} y={node.y - node.r - 14} fill={colors.text} fontSize={13} fontWeight="600" textAnchor="middle">
            {node.label}
          </SvgText>
        </>
      ) : null}
    </G>
  );
});

function Me() {
  const breath = useSharedValue(0);
  useEffect(() => {
    breath.value = withRepeat(withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [breath]);
  const haloProps = useAnimatedProps(() => ({ r: 46 + breath.value * 10, opacity: 0.75 + breath.value * 0.25 }));
  return (
    <G>
      <AnimatedCircle cx={0} cy={0} fill="url(#halo-me)" animatedProps={haloProps} />
      <Circle cx={0} cy={0} r={13} fill={colors.me} />
      <SvgText x={0} y={34} fill={colors.text} fontSize={12} fontWeight="700" textAnchor="middle">
        {t('graph.me')}
      </SvgText>
    </G>
  );
}

/** Poussière d'étoiles fixe pour l'ambiance. */
function Stars({ extent }: { extent: number }) {
  const stars = useMemo(
    () =>
      Array.from({ length: 70 }, (_, i) => {
        const h = hashString(`star-${i}`);
        return {
          x: ((h % 2000) / 1000 - 1) * extent * 1.4,
          y: (((h >>> 11) % 2000) / 1000 - 1) * extent * 1.4,
          r: 0.4 + ((h >>> 22) % 10) / 10,
          o: 0.1 + ((h >>> 5) % 30) / 100,
        };
      }),
    [extent],
  );
  return (
    <G>
      {stars.map((s, i) => (
        <Circle key={i} cx={s.x} cy={s.y} r={s.r} fill={colors.text} opacity={s.o} />
      ))}
    </G>
  );
}

export function GraphView({ layout, selectedId, onSelect, newIds, peerState, ref }: Props) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const scale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);

  useImperativeHandle(ref, () => ({
    resetView: () => {
      scale.value = withTiming(1, { duration: 450 });
      tx.value = withTiming(0, { duration: 450 });
      ty.value = withTiming(0, { duration: 450 });
    },
  }));

  const pan = usePanGesture({
    minDistance: 6,
    onUpdate: (e) => {
      'worklet';
      tx.value += e.changeX;
      ty.value += e.changeY;
    },
  });

  const pinch = usePinchGesture({
    onUpdate: (e) => {
      'worklet';
      scale.value = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale.value * e.scaleChange));
    },
  });

  // Hit-test : écran → coordonnées du graphe (inverse de la transformation de vue).
  const handleTap = (x: number, y: number) => {
    if (!size.w) return;
    const cx = size.w / 2;
    const cy = size.h / 2;
    const vx = cx + (x - cx - tx.value) / scale.value;
    const vy = cy + (y - cy - ty.value) / scale.value;
    const unit = (layout.extent * 2) / Math.min(size.w, size.h);
    const gx = (vx - cx) * unit;
    const gy = (vy - cy) * unit;
    let best: { id: string; d: number } | null = null;
    for (const p of layout.people) {
      const d = Math.hypot(p.x - gx, p.y - gy);
      const tolerance = Math.max(p.r * 1.8, (22 * unit) / scale.value);
      if (d < tolerance && (!best || d < best.d)) best = { id: p.id, d };
    }
    onSelect(best?.id ?? null);
  };

  const tap = useTapGesture({
    runOnJS: true,
    onActivate: (e) => handleTap(e.x, e.y),
  });

  const gesture = useSimultaneousGestures(pan, pinch, tap);

  const transformStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }],
  }));

  const onLayout = (e: LayoutChangeEvent) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height });

  const ext = layout.extent;
  const selectedEdges = useMemo(
    () => new Set(selectedId ? layout.edges.filter((e) => e.key.endsWith(`-${selectedId}`)).map((e) => e.key) : []),
    [layout.edges, selectedId],
  );

  return (
    <GestureDetector gesture={gesture}>
      <View style={styles.fill} onLayout={onLayout} collapsable={false}>
        {size.w > 0 ? (
          <Animated.View style={[styles.fill, transformStyle]}>
            <Svg width={size.w} height={size.h} viewBox={`${-ext} ${-ext} ${ext * 2} ${ext * 2}`} preserveAspectRatio="xMidYMid meet">
              <Defs>
                {ANCHOR_KINDS.map((k: AnchorKind) => (
                  <RadialGradient key={k} id={`halo-${k}`} cx="50%" cy="50%" r="50%">
                    <Stop offset="0" stopColor={kindColors[k]} stopOpacity={0.55} />
                    <Stop offset="0.35" stopColor={kindColors[k]} stopOpacity={0.18} />
                    <Stop offset="1" stopColor={kindColors[k]} stopOpacity={0} />
                  </RadialGradient>
                ))}
                <RadialGradient id="halo-me" cx="50%" cy="50%" r="50%">
                  <Stop offset="0" stopColor={colors.me} stopOpacity={0.7} />
                  <Stop offset="0.4" stopColor={colors.accent} stopOpacity={0.2} />
                  <Stop offset="1" stopColor={colors.accent} stopOpacity={0} />
                </RadialGradient>
              </Defs>

              <Stars extent={ext} />
              {[ANCHOR_RING, 200, 290, 380].map((r) => (
                <Circle key={r} cx={0} cy={0} r={r} fill="none" stroke={colors.thread} strokeOpacity={0.05} strokeWidth={1} />
              ))}

              {layout.edges.map((e) => (
                <Thread key={e.key} edge={e} bright={selectedEdges.has(e.key)} dim={!!selectedId && !selectedEdges.has(e.key) && !e.key.startsWith('me-')} />
              ))}

              {layout.anchors.map((a) => (
                <G key={a.id} opacity={a.linked ? 1 : 0.4}>
                  <Circle cx={a.x} cy={a.y} r={22} fill={`url(#halo-${a.anchor.kind})`} />
                  <Circle cx={a.x} cy={a.y} r={6.5} fill={colors.bg} stroke={kindColors[a.anchor.kind]} strokeWidth={2} />
                  <SvgText
                    x={a.x}
                    y={a.y + (a.y >= -1 ? 21 : -13)}
                    fill={kindColors[a.anchor.kind]}
                    fontSize={10}
                    fontWeight="600"
                    textAnchor="middle"
                  >
                    {truncate(anchorTitle(a.anchor), 18)}
                  </SvgText>
                </G>
              ))}

              {layout.people.map((p, i) => (
                <Person
                  key={p.id}
                  node={p}
                  order={layout.anchors.length + i}
                  selected={p.id === selectedId}
                  dim={!!selectedId && p.id !== selectedId}
                  isNew={newIds.has(p.id)}
                  state={peerState(p.id)}
                />
              ))}

              <Me />
            </Svg>
          </Animated.View>
        ) : null}
      </View>
    </GestureDetector>
  );
}

const truncate = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

const styles = StyleSheet.create({
  fill: { flex: 1, overflow: 'hidden' },
});
