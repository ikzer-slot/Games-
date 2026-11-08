import { Alert, Platform } from 'react-native';

/**
 * Confirmations et messages multiplateformes.
 * - iOS / Android : Alert natif.
 * - Web : boîte de dialogue intégrée (<DialogHost />), car window.confirm /
 *   alert sont bloqués dans certains contextes (iframes, webviews).
 */
export interface DialogRequest {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  resolve: (ok: boolean) => void;
}

type Listener = (req: DialogRequest) => void;
let listener: Listener | null = null;

export function registerDialogHost(l: Listener | null) {
  listener = l;
}

export function confirmAsync(title: string, message: string, confirmLabel: string, cancelLabel: string, destructive = false): Promise<boolean> {
  if (Platform.OS === 'web') {
    return new Promise((resolve) => {
      if (listener) listener({ title, message, confirmLabel, cancelLabel, destructive, resolve });
      else resolve(typeof window !== 'undefined' && window.confirm(`${title}\n\n${message}`));
    });
  }
  return new Promise((resolve) =>
    Alert.alert(title, message, [
      { text: cancelLabel, style: 'cancel', onPress: () => resolve(false) },
      { text: confirmLabel, style: destructive ? 'destructive' : 'default', onPress: () => resolve(true) },
    ]),
  );
}

export function notify(message: string) {
  if (Platform.OS === 'web') {
    if (listener) listener({ title: '', message, confirmLabel: 'OK', resolve: () => {} });
    else if (typeof window !== 'undefined') window.alert(message);
  } else {
    Alert.alert('', message);
  }
}
