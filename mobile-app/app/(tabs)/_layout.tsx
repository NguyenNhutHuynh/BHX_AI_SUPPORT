import { Tabs } from 'expo-router';
import React from 'react';
import { Platform, View } from 'react-native';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { ServerHeaderButton } from '../../src/components/ServerHeaderButton';
import { UserHeaderButton } from '../../src/components/UserHeaderButton';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: {
          backgroundColor: '#008848',
        },
        headerTintColor: '#ffffff',
        headerTitleStyle: {
          fontWeight: 'bold',
          fontSize: 18,
        },
        headerRight: () => (
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <UserHeaderButton />
            <ServerHeaderButton />
          </View>
        ),
        tabBarActiveTintColor: '#008848',
        tabBarInactiveTintColor: '#757575',
        tabBarStyle: {
          backgroundColor: '#ffffff',
          borderTopWidth: 1,
          borderTopColor: '#e0e0e0',
          height: Platform.OS === 'ios' ? 88 : 64,
          paddingBottom: Platform.OS === 'ios' ? 28 : 10,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Tạo Thực Đơn',
          headerTitle: 'Đi Chợ Khéo - Thực Đơn AI',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="chef-hat" size={size} color={color as any} />
          ),
        }}
      />
      <Tabs.Screen
        name="meal-plan"
        options={{
          title: 'Thực Đơn & Giỏ',
          headerTitle: 'Thực Đơn & Mua Sắm',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="cart-outline" size={size} color={color as any} />
          ),
        }}
      />
      <Tabs.Screen
        name="pantry"
        options={{
          title: 'Tủ Lạnh Ảo',
          headerTitle: 'Tủ Lạnh Ảo',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="fridge-outline" size={size} color={color as any} />
          ),
        }}
      />
      <Tabs.Screen
        name="catalog"
        options={{
          title: 'Kho Hàng BHX',
          headerTitle: 'Kho Hàng Siêu Thị',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="storefront-outline" size={size} color={color as any} />
          ),
        }}
      />
    </Tabs>
  );
}
