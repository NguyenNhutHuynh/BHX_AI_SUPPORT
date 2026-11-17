import React from 'react';
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { AuthModal } from './AuthModal';

export const UserHeaderButton: React.FC = () => {
  const { user, isLoggedIn, openAuthModal } = useAuth();

  const displayName = isLoggedIn
    ? (user?.name || user?.phone || 'Thành viên')
    : 'Khách';

  return (
    <>
      <TouchableOpacity
        style={styles.container}
        onPress={openAuthModal}
        activeOpacity={0.8}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Ionicons
          name={isLoggedIn ? 'person-circle' : 'person-outline'}
          size={16}
          color="#ffffff"
        />
        <Text style={styles.label} numberOfLines={1}>
          {displayName}
        </Text>
      </TouchableOpacity>
      <AuthModal />
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    marginRight: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    maxWidth: 130,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ffffff',
  },
});

