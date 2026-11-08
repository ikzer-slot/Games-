import { useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { registerDialogHost, type DialogRequest } from './confirm';
import { Button } from './ui';
import { colors, font, radius, spacing } from '@/theme';

/** Boîte de dialogue web (voir confirm.ts). Rien n'est rendu sur mobile. */
export function DialogHost() {
  const [req, setReq] = useState<DialogRequest | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    registerDialogHost(setReq);
    return () => registerDialogHost(null);
  }, []);

  if (!req) return null;
  const close = (ok: boolean) => {
    req.resolve(ok);
    setReq(null);
  };
  const isConfirm = !!req.cancelLabel;

  return (
    <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(150)} style={styles.backdrop}>
      <View style={styles.box} accessibilityRole="alert">
        {req.title ? <Text style={font.h2}>{req.title}</Text> : null}
        {req.message ? <Text style={[font.body, { fontSize: 15, color: colors.textMuted }]}>{req.message}</Text> : null}
        <View style={styles.row}>
          {isConfirm ? <Button label={req.cancelLabel!} variant="secondary" style={{ flex: 1 }} onPress={() => close(false)} /> : null}
          <Button
            testID="dialog-confirm"
            label={req.confirmLabel ?? 'OK'}
            variant={req.destructive ? 'danger' : 'primary'}
            style={{ flex: 1 }}
            onPress={() => close(true)}
          />
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(8,7,11,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing(6),
    zIndex: 100,
  },
  box: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing(5),
    gap: spacing(3),
  },
  row: { flexDirection: 'row', gap: spacing(2), marginTop: spacing(2) },
});
