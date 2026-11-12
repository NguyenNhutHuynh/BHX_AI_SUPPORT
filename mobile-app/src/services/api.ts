import axios from 'axios';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const SERVER_STORAGE_KEY = '@bhx_server_api_url';
export const DEFAULT_LAN_IP = '172.16.10.2';

// Tự động nhận diện host mặc định
export const getDefaultBaseUrl = () => {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location) {
    const hostname = window.location.hostname || 'localhost';
    return `http://${hostname}:8000/api`;
  }
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL.replace(/\/+$/, '');
  }
  // Mặc định kết nối tới máy chủ backend trên LAN
  return `http://${DEFAULT_LAN_IP}:8000/api`;
};

let currentBaseUrl = getDefaultBaseUrl();

export const API_BASE_URL = currentBaseUrl;

const apiClient = axios.create({
  baseURL: currentBaseUrl,
  timeout: 45000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

// Khởi tạo URL từ bộ nhớ cục bộ khi app khởi động
export const initApiUrl = async (): Promise<string> => {
  try {
    const saved = await AsyncStorage.getItem(SERVER_STORAGE_KEY);
    if (saved && saved.trim()) {
      currentBaseUrl = saved.trim().replace(/\/+$/, '');
      apiClient.defaults.baseURL = currentBaseUrl;
      return currentBaseUrl;
    }
  } catch (e) {
    console.warn('Không thể đọc cấu hình URL máy chủ từ bộ nhớ:', e);
  }
  return currentBaseUrl;
};

export const getEffectiveApiUrl = (): string => {
  return currentBaseUrl;
};

export const setCustomApiUrl = async (newUrl: string): Promise<string> => {
  let formatted = newUrl.trim().replace(/\/+$/, '');
  if (!formatted.startsWith('http://') && !formatted.startsWith('https://')) {
    formatted = `http://${formatted}`;
  }
  const finalUrl = formatted.endsWith('/api') ? formatted : `${formatted}/api`;
  currentBaseUrl = finalUrl;
  apiClient.defaults.baseURL = finalUrl;
  await AsyncStorage.setItem(SERVER_STORAGE_KEY, finalUrl);
  return finalUrl;
};

export const resetToDefaultApiUrl = async (): Promise<string> => {
  await AsyncStorage.removeItem(SERVER_STORAGE_KEY);
  currentBaseUrl = getDefaultBaseUrl();
  apiClient.defaults.baseURL = currentBaseUrl;
  return currentBaseUrl;
};

export const testConnection = async (
  targetUrl?: string
): Promise<{ ok: boolean; message: string; latencyMs: number }> => {
  let testUrl = (targetUrl || currentBaseUrl).trim().replace(/\/+$/, '');
  if (!testUrl.startsWith('http://') && !testUrl.startsWith('https://')) {
    testUrl = `http://${testUrl}`;
  }
  const finalUrl = testUrl.endsWith('/api') ? testUrl : `${testUrl}/api`;
  const startTime = Date.now();
  try {
    const res = await axios.get(`${finalUrl}/health`, {
      timeout: 5000,
      headers: { Accept: 'application/json' },
    }).catch(async () => {
      return await axios.get(`${finalUrl}/bhx-products?per_page=1`, {
        timeout: 5000,
        headers: { Accept: 'application/json' },
      });
    });
    const latency = Date.now() - startTime;
    if (res.status === 200) {
      return { ok: true, message: `Kết nối thành công (${latency}ms)`, latencyMs: latency };
    }
    return { ok: false, message: `Máy chủ trả về mã ${res.status}`, latencyMs: latency };
  } catch (error: any) {
    const latency = Date.now() - startTime;
    let msg = 'Không thể kết nối tới máy chủ';
    if (error.code === 'ECONNABORTED') {
      msg = 'Hết thời gian chờ (Timeout 5s). Vui lòng kiểm tra lại IP/mạng.';
    } else if (error.message) {
      msg = error.message;
    }
    return { ok: false, message: msg, latencyMs: latency };
  }
};

// Đảm bảo baseURL luôn chính xác trước mỗi request
apiClient.interceptors.request.use((config) => {
  config.baseURL = currentBaseUrl;
  return config;
});

export interface BhxProduct {
  id: number;
  name: string;
  category_name: string;
  price: number;
  unit_label: string | null;
  net_weight_value: number | null;
  net_weight_unit: string | null;
  image_url: string | null;
  in_stock?: boolean;
  is_cooking_ingredient?: boolean;
}

export interface ShoppingItem {
  bhx_product_id: number;
  name: string;
  category_name?: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  unit_label?: string;
  net_weight_value?: number;
  net_weight_unit?: string;
  image_url?: string;
}

export interface MealIngredient {
  bhx_product_id?: number;
  name: string;
  amount_used: number;
  unit: string;
  image_url?: string;
  category_name?: string;
}

export interface MealItem {
  day: number;
  meal_number: number;
  dish_name: string;
  main_dish?: string;
  soup_dish?: string;
  instructions: string;
  cookware_used: string;
  ingredients: MealIngredient[];
  image_url?: string;
}

export interface LeftoverItem {
  bhx_product_id: number;
  name: string;
  remaining_value: number;
  unit: string;
}

export interface MealPlanData {
  plan_id: number;
  plan_date: string;
  total_cost: number;
  budget_limit: number;
  is_within_budget: boolean;
  shopping_list: ShoppingItem[];
  meals: MealItem[];
  leftover_to_pantry: LeftoverItem[];
  is_completed?: boolean;
}

export interface PantryItem {
  id: number;
  bhx_product_id: number;
  product_name: string;
  category_name: string;
  image_url: string;
  remaining_value: number;
  unit: string;
  expires_at: string;
  updated_at: string;
}

export const api = {
  // Lấy danh sách sản phẩm BHX
  async getBhxProducts(params?: {
    q?: string;
    category?: string;
    page?: number;
    per_page?: number;
  }) {
    const res = await apiClient.get('/bhx-products', { params });
    return res.data;
  },

  // Tạo kế hoạch thực đơn thông minh
  async generateMealPlan(params: {
    daily_budget: number;
    days_count: number;
    meals_per_day: number;
    cookware: string[];
    disliked_foods: string[];
  }): Promise<{ success: boolean; message: string; data: MealPlanData }> {
    const res = await apiClient.post('/meal-plans/generate', params);
    return res.data;
  },

  // Đánh dấu hoàn tất và chuyển nguyên liệu thừa sang Tủ lạnh ảo
  async completeMealPlan(planId: number): Promise<{ success: boolean; message: string; data: any }> {
    const res = await apiClient.post(`/meal-plans/${planId}/complete`);
    return res.data;
  },

  // Lấy danh sách trong Tủ lạnh ảo
  async getPantry(): Promise<{ success: boolean; total_items: number; data: PantryItem[] }> {
    const res = await apiClient.get('/pantry');
    return res.data;
  },

  // Cập nhật giá thời gian thực từ Bách Hóa Xanh
  async syncRealtimePrices(productIds?: number[]): Promise<{
    success: boolean;
    message: string;
    synced_at: string;
    timestamp: string;
    updated_count: number;
    products: BhxProduct[];
  }> {
    const res = await apiClient.post('/bhx-products/sync-realtime-prices', {
      product_ids: productIds || [],
    });
    return res.data;
  },

  // Lưu thiết lập người dùng
  async savePreferences(data: any) {
    const res = await apiClient.post('/preferences', data);
    return res.data;
  },
};
