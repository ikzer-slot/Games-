import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { anchorSubtitle, anchorTitle } from '@/core/anchorText';
import type { Anchor } from '@/core/types';
import { t } from '@/i18n';
import { colors, kindColors, kindEmoji, radius, spacing } from '@/theme';

/** Ligne d'ancrage : pastille lumineuse colorée par type, titre, période. */
export function AnchorRow({
  anchor,
  onPress,
  onToggleVisible,
}: {
  anchor: Anchor;
  onPress?: () => void;
  onToggleVisible?: (v: boolean) => void;
}) {
  const color = kindColors[anchor.kind];
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && { opacity: 0.8 }, !anchor.visible && { opacity: 0.55 }]}>
      <View style={[styles.dot, { backgroundColor: color, shadowColor: color }]}>
        <Text style={styles.emoji}>{kindEmoji[anchor.kind]}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.kind}>{t(`kinds.${anchor.kind}`)}</Text>
        <Text style={styles.title} numberOfLines={1}>
          {anchorTitle(anchor)}
        </Text>
        {anchorSubtitle(anchor) ? <Text style={styles.sub}>{anchorSubtitle(anchor)}</Text> : null}
      </View>
      {onToggleVisible ? (
        <View style={{ alignItems: 'center' }}>
          <Switch
            value={anchor.visible}
            onValueChange={onToggleVisible}
            trackColor={{ true: colors.accentDim, false: colors.border }}
            thumbColor={anchor.visible ? colors.accent : colors.textMuted}
          />
          <Text style={styles.vis}>{anchor.visible ? t('onboarding.anchorVisible') : t('onboarding.anchorHidden')}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(3),
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing(3),
  },
  dot: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.6,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
  },
  emoji: { fontSize: 18 },
  kind: { color: colors.textMuted, fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 },
  title: { color: colors.text, fontSize: 16, fontWeight: '600' },
  sub: { color: colors.textMuted, fontSize: 13 },
  vis: { color: colors.textFaint, fontSize: 10, marginTop: 2 },
});
