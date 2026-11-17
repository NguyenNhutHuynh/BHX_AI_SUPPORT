import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  api,
  setAuthToken,
  setGuestUuid,
  GUEST_UUID_STORAGE_KEY,
  AUTH_TOKEN_STORAGE_KEY,
  USER_INFO_STORAGE_KEY,
} from '../services/api';

export interface UserProfile {
  id: number;
  name: string;
  phone?: string;
  is_guest: boolean;
}

interface AuthContextType {
  guestUuid: string | null;
  user: UserProfile | null;
  isLoggedIn: boolean;
  isLoading: boolean;
  isAuthModalVisible: boolean;
  openAuthModal: () => void;
  closeAuthModal: () => void;
  sendOtp: (phone: string) => Promise<{ success: boolean; message: string; test_otp?: string }>;
  verifyOtp: (phone: string, otp: string) => Promise<{ success: boolean; message: string }>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Hàm tạo UUID ngẫu nhiên chuẩn cho Guest
const generateUUID = () => {
  return 'guest_' + Math.random().toString(36).substring(2, 10) + '_' + Date.now().toString(36);
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [guestUuid, setGuestUuidState] = useState<string | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isAuthModalVisible, setIsAuthModalVisible] = useState<boolean>(false);

  // Khởi tạo Auth & Guest State
  useEffect(() => {
    initAuth();
  }, []);

  const initAuth = async () => {
    try {
      setIsLoading(true);

      // 1. Kiểm tra hoặc khởi tạo Guest UUID
      let savedGuestUuid = await AsyncStorage.getItem(GUEST_UUID_STORAGE_KEY);
      if (!savedGuestUuid) {
        savedGuestUuid = generateUUID();
        await AsyncStorage.setItem(GUEST_UUID_STORAGE_KEY, savedGuestUuid);
      }
      setGuestUuidState(savedGuestUuid);
      setGuestUuid(savedGuestUuid);

      // 2. Kiểm tra token đăng nhập trước đó
      const savedToken = await AsyncStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
      const savedUserStr = await AsyncStorage.getItem(USER_INFO_STORAGE_KEY);

      if (savedToken) {
        setAuthToken(savedToken);
        if (savedUserStr) {
          try {
            setUser(JSON.parse(savedUserStr));
          } catch (e) {
            // bỏ qua lỗi parse json
          }
        }
      }

      // 3. Đồng bộ phiên từ máy chủ backend (nếu có mạng)
      try {
        const session = await api.auth.getSession();
        if (session.user) {
          setUser(session.user);
          await AsyncStorage.setItem(USER_INFO_STORAGE_KEY, JSON.stringify(session.user));
        }
      } catch (networkErr) {
        // Có thể server đang offline, giữ state offline từ cache
      }
    } catch (e) {
      console.warn('Lỗi khởi tạo Auth:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshSession = async () => {
    try {
      const session = await api.auth.getSession();
      if (session.user) {
        setUser(session.user);
        await AsyncStorage.setItem(USER_INFO_STORAGE_KEY, JSON.stringify(session.user));
      }
    } catch (e) {
      console.warn('Lỗi refreshSession:', e);
    }
  };

  const sendOtp = async (phone: string) => {
    try {
      const res = await api.auth.sendOtp(phone);
      return res;
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Không thể gửi mã OTP. Vui lòng thử lại!';
      return { success: false, message: msg };
    }
  };

  const verifyOtp = async (phone: string, otp: string) => {
    try {
      const res = await api.auth.verifyOtp(phone, otp, guestUuid || undefined);
      if (res.token && res.user) {
        setAuthToken(res.token);
        setUser(res.user);
        await AsyncStorage.setItem(AUTH_TOKEN_STORAGE_KEY, res.token);
        await AsyncStorage.setItem(USER_INFO_STORAGE_KEY, JSON.stringify(res.user));
        setIsAuthModalVisible(false);
        return { success: true, message: 'Đăng nhập thành công!' };
      }
      return { success: false, message: res.message || 'Xác thực thất bại' };
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Mã OTP không đúng hoặc đã hết hạn!';
      return { success: false, message: msg };
    }
  };

  const logout = async () => {
    try {
      await api.auth.logout().catch(() => {});
    } finally {
      setAuthToken(null);
      setUser(null);
      await AsyncStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
      await AsyncStorage.removeItem(USER_INFO_STORAGE_KEY);
      // Tạo lại guest UUID mới khi đăng xuất
      const newGuestUuid = generateUUID();
      setGuestUuidState(newGuestUuid);
      setGuestUuid(newGuestUuid);
      await AsyncStorage.setItem(GUEST_UUID_STORAGE_KEY, newGuestUuid);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        guestUuid,
        user,
        isLoggedIn: !!user && !user.is_guest,
        isLoading,
        isAuthModalVisible,
        openAuthModal: () => setIsAuthModalVisible(true),
        closeAuthModal: () => setIsAuthModalVisible(false),
        sendOtp,
        verifyOtp,
        logout,
        refreshSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

