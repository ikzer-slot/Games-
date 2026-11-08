import { Tabs } from 'expo-router/tabs';
import { Icon } from '@/components/Icon';
import { t } from '@/i18n';
import { useApp } from '@/state/AppContext';
import { colors } from '@/theme';

export default function TabsLayout() {
  const { connections, me } = useApp();
  const incoming = connections.filter((c) => c.status === 'pending' && c.addresseeId === me?.id).length;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.bg },
        tabBarStyle: { backgroundColor: colors.bgDeep, borderTopColor: colors.border },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textFaint,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: t('tabs.graph'), tabBarIcon: ({ color }) => <Icon name="threads" color={color} /> }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: t('tabs.messages'),
          tabBarIcon: ({ color }) => <Icon name="chat" color={color} />,
          tabBarBadge: incoming > 0 ? incoming : undefined,
          tabBarBadgeStyle: { backgroundColor: colors.accent, color: colors.bg },
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: t('tabs.profile'), tabBarIcon: ({ color }) => <Icon name="person" color={color} /> }}
      />
    </Tabs>
  );
}
