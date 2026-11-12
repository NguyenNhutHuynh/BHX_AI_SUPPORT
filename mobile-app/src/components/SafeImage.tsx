import React, { useState } from 'react';
import { Image, ImageProps, View, StyleSheet, ActivityIndicator } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface SafeImageProps extends Omit<ImageProps, 'source'> {
  uri?: string | null;
  fallbackUri?: string;
  category?: string;
  name?: string;
}

// Hàm ánh xạ hình ảnh món ăn đã nấu chín (Cooked Dish Images) thật 100% chuẩn với tên món ăn
export const getCookedDishImage = (dishName?: string): string => {
  const name = (dishName || '').toLowerCase().trim();

  // 1. Cơm / Tinh bột
  if (name.includes('cơm') || name.includes('xôi')) {
    return 'https://images.unsplash.com/photo-1512058564366-18510be2db19?w=600&auto=format&fit=crop&q=80';
  }

  // 2. Món nấm (Ưu tiên kiểm tra trước gà để tránh nhầm "nấm đùi gà" thành thịt gà)
  if (name.includes('nấm')) {
    return 'https://images.unsplash.com/photo-1504544750208-dc0358e63f7f?w=600&auto=format&fit=crop&q=80';
  }

  // 3. Món trứng
  if (name.includes('trứng') || name.includes('ốp la')) {
    return 'https://images.unsplash.com/photo-1525351484163-7529414344d8?w=600&auto=format&fit=crop&q=80';
  }

  // 4. Món thịt bò (ba chỉ bò, bắp bò, thăn bò, bò viên, bò xào, bò áp chảo, bò kho)
  if (name.includes('bò')) {
    return 'https://images.unsplash.com/photo-1544025162-d76694265947?w=600&auto=format&fit=crop&q=80';
  }

  // 5. Món gà (ức gà, thịt gà, gà dai, cánh gà, đùi gà - loại trừ nấm đùi gà)
  if ((name.includes('gà') || name.includes('thịt gà')) && !name.includes('nấm')) {
    return 'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=600&auto=format&fit=crop&q=80';
  }

  // 6. Món heo (sườn, ba chỉ, ba rọi, chân giò, thịt xay, cốt lết, thịt heo)
  if (name.includes('heo') || name.includes('sườn') || name.includes('ba rọi') || name.includes('ba chỉ') || name.includes('cốt lết') || name.includes('thịt')) {
    return 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600&auto=format&fit=crop&q=80';
  }

  // 7. Món đậu hũ / Tofu
  if (name.includes('đậu') || name.includes('tofu')) {
    return 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600&auto=format&fit=crop&q=80';
  }

  // 8. Cá / Hải sản / Tôm
  if (name.includes('cá') || name.includes('tôm') || name.includes('mực') || name.includes('hải sản')) {
    return 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=600&auto=format&fit=crop&q=80';
  }

  // 9. Canh / Súp
  if (name.includes('canh') || name.includes('súp') || name.includes('soup') || name.includes('riêu')) {
    return 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=600&auto=format&fit=crop&q=80';
  }

  // 10. Rau củ xào / luộc
  if (name.includes('rau') || name.includes('cải') || name.includes('muống') || name.includes('bông cải') || name.includes('cà chua') || name.includes('xào') || name.includes('luộc')) {
    return 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=600&auto=format&fit=crop&q=80';
  }

  // Default: Mâm cơm ngon lành
  return 'https://images.unsplash.com/photo-1512058564366-18510be2db19?w=600&auto=format&fit=crop&q=80';
};

export const getCategoryFallback = (category?: string, name?: string): string => {
  const text = `${category || ''} ${name || ''}`.toLowerCase();
  if (text.includes('bò')) {
    return 'https://images.unsplash.com/photo-1588168333986-5078d3ae3976?w=500&auto=format&fit=crop&q=80';
  }
  if (text.includes('gà')) {
    return 'https://cdn.tgdd.vn/Products/Images/8790/222942/bhx/uc-ga-phi-le-co-da-202403011639007208.jpg';
  }
  if (text.includes('heo') || text.includes('ba rọi') || text.includes('sườn')) {
    return 'https://cdnv2.tgdd.vn/bhx-static/bhx/production/2026/7/image/production/2026/7/image/Products/8781/333450/thit-heo-xay-cp-100g_202607300938128442.jpg';
  }
  if (text.includes('trứng')) {
    return 'https://cdnv2.tgdd.vn/bhx-static/bhx/production/2026/9/image/production/2026/9/image/Products/8783/5368659/trung-ga-nam-huong-hop-4-qua_202609181133196903.jpg';
  }
  if (text.includes('đậu') || text.includes('tofu')) {
    return 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&auto=format&fit=crop&q=80';
  }
  if (text.includes('nấm')) {
    return 'https://images.unsplash.com/photo-1504544750208-dc0358e63f7f?w=500&auto=format&fit=crop&q=80';
  }
  if (text.includes('bông cải')) {
    return 'https://images.unsplash.com/photo-1459411621453-7b03977f4bfc?w=500&auto=format&fit=crop&q=80';
  }
  if (text.includes('cà chua')) {
    return 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=500&auto=format&fit=crop&q=80';
  }
  if (text.includes('mắm') || text.includes('dầu') || text.includes('nước chấm') || text.includes('nước tương')) {
    return 'https://cdnv2.tgdd.vn/bhx-static/bhx/production/2026/8/image/production/2026/8/image/Products/2289/338708/nuoc-cham-nam-ngu-sieu-tiet-kiem-chai-800ml_202608271350332301.jpg';
  }
  return 'https://cdnv2.tgdd.vn/bhx-static/bhx/production/2026/4/image/production/2026/4/image/Products/8820/335195/cai-ngot-tui-400gr_202604170939251833.jpg';
};

export const SafeImage: React.FC<SafeImageProps> = ({
  uri,
  fallbackUri,
  category,
  name,
  style,
  resizeMode = 'contain',
  ...rest
}) => {
  const [hasError, setHasError] = useState(false);
  const [loading, setLoading] = useState(false);

  const effectiveFallback = fallbackUri || getCategoryFallback(category, name);
  const imageSource = {
    uri: !hasError && uri && uri.trim() ? uri : effectiveFallback,
  };

  return (
    <View style={[styles.container, style]}>
      <Image
        {...rest}
        source={imageSource}
        style={[styles.imageStyle, style]}
        resizeMode={resizeMode}
        onLoadStart={() => setLoading(true)}
        onLoadEnd={() => setLoading(false)}
        onError={() => setHasError(true)}
      />
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="small" color="#008848" />
        </View>
      )}
      {hasError && !effectiveFallback && (
        <View style={styles.errorContainer}>
          <MaterialCommunityIcons name="food-apple-outline" size={28} color="#BDBDBD" />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageStyle: {
    width: '100%',
    height: '100%',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 245, 245, 0.4)',
  },
  errorContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#EEEEEE',
  },
});
