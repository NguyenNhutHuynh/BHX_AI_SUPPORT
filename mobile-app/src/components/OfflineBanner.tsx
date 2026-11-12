import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useMealPlan } from '../context/MealPlanContext';
import { ServerSettingsModal } from './ServerSettingsModal';

export const OfflineBanner: React.FC = () => {
  const { serverStatus, refreshServerStatus } = useMealPlan();
  const [modalVisible, setModalVisible] = useState(false);
  const [checking, setChecking] = useState(false);

  if (serverStatus !== 'disconnected') {
    return null;
  }

  const handleRetry = async () => {
    setChecking(true);
    await refreshServerStatus();
    setChecking(false);
  };

  return (
    <>
      <View style={styles.banner}>
        <Ionicons name="cloud-offline-outline" size={18} color="#ffffff" />
        <Text style={styles.text} numberOfLines={1}>
          Chưa kết nối Backend API. Vui lòng kiểm tra IP máy chủ.
        </Text>
        <TouchableOpacity
          style={styles.btnConfig}
          onPress={() => setModalVisible(true)}
          activeOpacity={0.8}>
          <Text style={styles.btnConfigText}>Cấu hình</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.btnRetry}
          onPress={handleRetry}
          disabled={checking}
          activeOpacity={0.8}>
          <Ionicons name="refresh" size={14} color="#d32f2f" />
        </TouchableOpacity>
      </View>

      <ServerSettingsModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
      />
    </>
  );
};

const styles = StyleSheet.create({
  banner: {
    backgroundColor: '#d32f2f',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    gap: 8,
  },
  text: {
    color: '#ffffff',
    fontSize: 12,
    flex: 1,
    fontWeight: '500',
  },
  btnConfig: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  btnConfigText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  btnRetry: {
    backgroundColor: '#ffffff',
    padding: 4,
    borderRadius: 12,
  },
});

