import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MealPlanData, initApiUrl, testConnection, getEffectiveApiUrl } from '../services/api';

const MEAL_PLAN_STORAGE_KEY = '@bhx_current_meal_plan';

interface MealPlanContextType {
  currentPlan: MealPlanData | null;
  setCurrentPlan: (plan: MealPlanData | null) => Promise<void>;
  pantryRefreshKey: number;
  triggerPantryRefresh: () => void;
  serverStatus: 'connected' | 'disconnected' | 'checking';
  serverLatency: number;
  currentServerUrl: string;
  refreshServerStatus: () => Promise<boolean>;
}

const MealPlanContext = createContext<MealPlanContextType | undefined>(undefined);

export const MealPlanProvider = ({ children }: { children: ReactNode }) => {
  const [currentPlan, setCurrentPlanState] = useState<MealPlanData | null>(null);
  const [pantryRefreshKey, setPantryRefreshKey] = useState<number>(0);
  const [serverStatus, setServerStatus] = useState<'connected' | 'disconnected' | 'checking'>('checking');
  const [serverLatency, setServerLatency] = useState<number>(0);
  const [currentServerUrl, setCurrentServerUrl] = useState<string>(getEffectiveApiUrl());

  // Khởi động: Tải cài đặt URL máy chủ và thực đơn đã lưu
  useEffect(() => {
    const initialize = async () => {
      try {
        const url = await initApiUrl();
        setCurrentServerUrl(url);

        // Đọc thực đơn đã lưu trước đó nếu có
        const savedPlanJson = await AsyncStorage.getItem(MEAL_PLAN_STORAGE_KEY);
        if (savedPlanJson) {
          try {
            const parsed = JSON.parse(savedPlanJson);
            setCurrentPlanState(parsed);
          } catch (e) {
            console.warn('Lỗi phân tích cú pháp thực đơn đã lưu:', e);
          }
        }

        // Kiểm tra kết nối ban đầu
        await checkConnectionStatus(url);
      } catch (err) {
        console.warn('Lỗi khởi tạo MealPlanProvider:', err);
      }
    };

    initialize();
  }, []);

  const checkConnectionStatus = async (targetUrl?: string): Promise<boolean> => {
    setServerStatus('checking');
    try {
      const res = await testConnection(targetUrl);
      if (res.ok) {
        setServerStatus('connected');
        setServerLatency(res.latencyMs);
        return true;
      } else {
        setServerStatus('disconnected');
        setServerLatency(0);
        return false;
      }
    } catch {
      setServerStatus('disconnected');
      setServerLatency(0);
      return false;
    }
  };

  const refreshServerStatus = async (): Promise<boolean> => {
    const url = getEffectiveApiUrl();
    setCurrentServerUrl(url);
    return await checkConnectionStatus(url);
  };

  const setCurrentPlan = async (plan: MealPlanData | null) => {
    setCurrentPlanState(plan);
    try {
      if (plan) {
        await AsyncStorage.setItem(MEAL_PLAN_STORAGE_KEY, JSON.stringify(plan));
      } else {
        await AsyncStorage.removeItem(MEAL_PLAN_STORAGE_KEY);
      }
    } catch (e) {
      console.warn('Lỗi khi lưu thực đơn vào AsyncStorage:', e);
    }
  };

  const triggerPantryRefresh = () => {
    setPantryRefreshKey((prev) => prev + 1);
  };

  return (
    <MealPlanContext.Provider
      value={{
        currentPlan,
        setCurrentPlan,
        pantryRefreshKey,
        triggerPantryRefresh,
        serverStatus,
        serverLatency,
        currentServerUrl,
        refreshServerStatus,
      }}>
      {children}
    </MealPlanContext.Provider>
  );
};

export const useMealPlan = () => {
  const context = useContext(MealPlanContext);
  if (!context) {
    throw new Error('useMealPlan must be used within a MealPlanProvider');
  }
  return context;
};
