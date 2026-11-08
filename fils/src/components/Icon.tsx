import type { ColorValue } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

/** Icônes minimalistes dessinées en SVG (pas de police d'icônes à charger). */
export function Icon({ name, color, size = 24 }: { name: 'threads' | 'chat' | 'person'; color: ColorValue; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.6} strokeLinecap="round">
      {name === 'threads' && (
        <>
          <Circle cx={12} cy={12} r={2.6} fill={color} />
          <Circle cx={4.5} cy={6} r={1.6} />
          <Circle cx={19.5} cy={5} r={1.6} />
          <Circle cx={18} cy={19} r={1.6} />
          <Circle cx={5} cy={18.5} r={1.6} />
          <Path d="M10 10.5 Q7 8 5.8 7 M14 10.4 Q17 7.5 18.4 6 M13.8 13.8 Q16 16.5 17 17.8 M10.2 13.9 Q7.5 16.5 6.2 17.6" />
        </>
      )}
      {name === 'chat' && <Path d="M4 5.5h16v10H9l-5 3.5z" strokeLinejoin="round" />}
      {name === 'person' && (
        <>
          <Circle cx={12} cy={8} r={3.6} />
          <Path d="M4.5 20c1.2-4 4.2-5.6 7.5-5.6s6.3 1.6 7.5 5.6" />
        </>
      )}
    </Svg>
  );
}
