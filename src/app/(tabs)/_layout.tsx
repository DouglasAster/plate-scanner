import { Tabs } from 'expo-router';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import type { ColorValue } from 'react-native';

// SF Symbols on iOS, Material Symbols on Android.
function tabIcon(name: SymbolViewProps['name']) {
  return function TabIcon({ color, size }: { color: ColorValue; size: number }) {
    return <SymbolView name={name} tintColor={color} size={size} />;
  };
}

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: '#b00000' }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Scan',
          headerShown: false,
          tabBarIcon: tabIcon({ ios: 'camera.viewfinder', android: 'center_focus_strong' }),
        }}
      />
      <Tabs.Screen
        name="vehicles"
        options={{ title: 'Vehicles', tabBarIcon: tabIcon({ ios: 'car.fill', android: 'directions_car' }) }}
      />
      <Tabs.Screen
        name="sightings"
        options={{ title: 'Sightings', tabBarIcon: tabIcon({ ios: 'mappin.and.ellipse', android: 'location_on' }) }}
      />
    </Tabs>
  );
}
