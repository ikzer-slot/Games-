import { useEffect } from 'react';
import Animated, { Easing, useAnimatedProps, useSharedValue, withDelay, withRepeat, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Defs, Path, RadialGradient, Stop } from 'react-native-svg';
import { colors, kindColors } from '@/theme';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const NODES = [
  { x: 40, y: 60, c: kindColors.city },
  { x: 260, y: 40, c: kindColors.school },
  { x: 280, y: 160, c: kindColors.ancestor_job },
  { x: 30, y: 170, c: kindColors.event },
  { x: 150, y: 20, c: kindColors.club },
];

function Strand({ x, y, color, delay }: { x: number; y: number; color: string; delay: number }) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withDelay(delay, withTiming(1, { duration: 1400, easing: Easing.out(Easing.cubic) }));
  }, [p, delay]);
  const len = Math.hypot(x - 160, y - 105) * 1.15;
  const lineProps = useAnimatedProps(() => ({ strokeDashoffset: len * (1 - p.value) }));
  const dotProps = useAnimatedProps(() => ({ r: 5 * p.value, opacity: p.value }));
  return (
    <>
      <AnimatedPath
        d={`M160,105 Q${(160 + x) / 2 + (y - 105) * 0.2},${(105 + y) / 2 - (x - 160) * 0.2} ${x},${y}`}
        stroke={color}
        strokeWidth={1}
        strokeOpacity={0.7}
        fill="none"
        strokeDasharray={[len, len]}
        animatedProps={lineProps}
      />
      <AnimatedCircle cx={x} cy={y} fill={color} animatedProps={dotProps} />
    </>
  );
}

/** Petite scène d'accueil : des fils se tissent depuis un point central. */
export function ThreadsIllustration() {
  const breath = useSharedValue(0);
  useEffect(() => {
    breath.value = withRepeat(withTiming(1, { duration: 2400, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [breath]);
  const haloProps = useAnimatedProps(() => ({ r: 30 + 8 * breath.value }));
  return (
    <Svg width="100%" height={210} viewBox="0 0 320 210">
      <Defs>
        <RadialGradient id="ill-halo" cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={colors.me} stopOpacity={0.7} />
          <Stop offset="1" stopColor={colors.accent} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      {NODES.map((n, i) => (
        <Strand key={i} x={n.x} y={n.y} color={n.c} delay={300 + i * 280} />
      ))}
      <AnimatedCircle cx={160} cy={105} fill="url(#ill-halo)" animatedProps={haloProps} />
      <Circle cx={160} cy={105} r={9} fill={colors.me} />
    </Svg>
  );
}
