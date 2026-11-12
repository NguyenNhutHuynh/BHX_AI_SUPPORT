import React, { useState } from 'react';
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useMealPlan } from '../context/MealPlanContext';
import { ServerSettingsModal } from './ServerSettingsModal';

export const ServerHeaderButton: React.FC = () => {
  const { serverStatus } = useMealPlan();
  const [modalVisible, setModalVisible] = useState(false);

  const isConnected = serverStatus === 'connected';
  const isChecking = serverStatus === 'checking';

  return (
    <>
      <TouchableOpacity
        style={styles.container}
        onPress={() => setModalVisible(true)}
        activeOpacity={0.8}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
        <View
          style={[
            styles.dot,
            isConnected ? styles.dotGreen : isChecking ? styles.dotYellow : styles.dotRed,
          ]}
        />
        <Ionicons
          name={isConnected ? 'server-outline' : 'cloud-offline-outline'}
          size={16}
          color="#ffffff"
        />
        <Text style={styles.label}>
          {isConnected ? 'Online' : isChecking ? '...' : 'Offline'}
        </Text>
      </TouchableOpacity>

      <ServerSettingsModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
      />
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    marginRight: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  dotGreen: {
    backgroundColor: '#00e676',
  },
  dotYellow: {
    backgroundColor: '#ffeb3b',
  },
  dotRed: {
    backgroundColor: '#ff5252',
  },
  label: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});

