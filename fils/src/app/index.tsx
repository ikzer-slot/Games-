import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useApp } from '@/state/AppContext';
import { colors } from '@/theme';

export default function Index() {
  const { ready, me } = useApp();
  if (!ready) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }
  return <Redirect href={me ? '/(tabs)' : '/onboarding'} />;
}
