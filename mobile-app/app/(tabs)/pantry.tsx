import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { api, PantryItem } from '../../src/services/api';
import { useMealPlan } from '../../src/context/MealPlanContext';
import { SafeImage } from '../../src/components/SafeImage';
import { OfflineBanner } from '../../src/components/OfflineBanner';

export default function PantryScreen() {
  const router = useRouter();
  const { pantryRefreshKey } = useMealPlan();

  const [items, setItems] = useState<PantryItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [previewItem, setPreviewItem] = useState<PantryItem | null>(null);

  const fetchPantry = useCallback(async () => {
    try {
      const res = await api.getPantry();
      if (res && res.success) {
        setItems(res.data);
      }
    } catch (error) {
      console.error('Error fetching pantry:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchPantry();
  }, [fetchPantry, pantryRefreshKey]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchPantry();
  };

  const renderItem = ({ item }: { item: PantryItem }) => {
    return (
      <TouchableOpacity
        style={styles.pantryCard}
        activeOpacity={0.88}
        onPress={() => setPreviewItem(item)}>
        <SafeImage
          uri={item.image_url}
          name={item.product_name}
          category={item.category_name}
          style={styles.productImage}
          resizeMode="contain"
        />
        <View style={styles.cardContent}>
          <Text style={styles.productName} numberOfLines={2}>
            {item.product_name}
          </Text>
          {item.category_name && (
            <Text style={styles.categoryName}>{item.category_name}</Text>
          )}

          <View style={styles.statusRow}>
            <View style={styles.remainingBadge}>
              <MaterialCommunityIcons name="scale" size={14} color="#008848" />
              <Text style={styles.remainingText}>
                Còn lại: <Text style={styles.boldText}>{item.remaining_value} {item.unit}</Text>
              </Text>
            </View>

            {item.expires_at && (
              <View style={styles.expiryBadge}>
                <Ionicons name="time-outline" size={12} color="#757575" />
                <Text style={styles.expiryText}>Hạn: {item.expires_at}</Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <OfflineBanner />
      {/* Header tổng quan */}
      <View style={styles.headerBanner}>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>Tủ Lạnh Ảo Thông Minh</Text>
          <Text style={styles.headerSubtitle}>
            Nguyên liệu thừa sau các lần nấu ăn được lưu trữ tại đây để AI tự động ưu tiên tận dụng
            cho lần lên thực đơn kế tiếp!
          </Text>
        </View>
        <View style={styles.statsBadge}>
          <Text style={styles.statsNumber}>{items.length}</Text>
          <Text style={styles.statsLabel}>món đồ</Text>
        </View>
      </View>

      {/* Danh sách nguyên liệu */}
      {loading ? (
        <View style={styles.loadingCenter}>
          <ActivityIndicator size="large" color="#008848" />
          <Text style={styles.loadingText}>Đang kiểm tra Tủ lạnh ảo...</Text>
        </View>
      ) : items.length === 0 ? (
        <View style={styles.emptyContainer}>
          <MaterialCommunityIcons name="fridge-outline" size={64} color="#BDBDBD" />
          <Text style={styles.emptyTitle}>Tủ lạnh của bạn đang trống</Text>
          <Text style={styles.emptySubtitle}>
            Khi bạn tạo thực đơn và bấm "Đã Nấu Xong", các phần nguyên liệu chưa dùng hết sẽ tự động
            xuất hiện ở đây.
          </Text>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => router.push('/(tabs)')}>
            <MaterialCommunityIcons name="chef-hat" size={18} color="#ffffff" />
            <Text style={styles.actionBtnText}>Lập Thực Đơn Mới</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#008848']} />
          }
          ListFooterComponent={
            <View style={styles.footerNote}>
              <TouchableOpacity
                style={styles.planWithPantryButton}
                onPress={() => router.push('/(tabs)')}>
                <Ionicons name="sparkles" size={20} color="#FFD700" />
                <Text style={styles.planWithPantryText}>
                  Tạo Thực Đơn Tận Dụng {items.length} Món Này
                </Text>
              </TouchableOpacity>
              <View style={{ height: 30 }} />
            </View>
          }
        />
      )}
      {/* Modal Phóng To Nguyên Liệu Tủ Lạnh */}
      <Modal
        visible={!!previewItem}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setPreviewItem(null)}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalBackgroundDismiss}
            activeOpacity={1}
            onPress={() => setPreviewItem(null)}
          />
          <View style={styles.modalContent}>
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setPreviewItem(null)}>
              <Ionicons name="close-circle" size={36} color="#ffffff" />
            </TouchableOpacity>
            {previewItem && (
              <View style={styles.modalImageCard}>
                <SafeImage
                  uri={previewItem.image_url}
                  name={previewItem.product_name}
                  category={previewItem.category_name}
                  style={styles.modalFullImage}
                  resizeMode="contain"
                />
                <View style={styles.modalImageInfo}>
                  <Text style={styles.modalCategory}>{previewItem.category_name}</Text>
                  <Text style={styles.modalTitle}>{previewItem.product_name}</Text>
                  <Text style={styles.modalRemaining}>
                    Còn lại trong tủ lạnh: {previewItem.remaining_value} {previewItem.unit}
                  </Text>
                  {previewItem.expires_at ? (
                    <Text style={styles.modalExpiry}>Hạn dùng: {previewItem.expires_at}</Text>
                  ) : null}
                </View>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F6F8',
  },
  headerBanner: {
    flexDirection: 'row',
    backgroundColor: '#008848',
    padding: 16,
    alignItems: 'center',
    gap: 12,
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#E8F5E9',
    lineHeight: 16,
  },
  statsBadge: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 60,
  },
  statsNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#008848',
  },
  statsLabel: {
    fontSize: 11,
    color: '#616161',
  },
  listContent: {
    padding: 16,
  },
  pantryCard: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  productImage: {
    width: 90,
    height: 90,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EEEEEE',
  },
  cardContent: {
    flex: 1,
    marginLeft: 12,
  },
  productName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#212121',
  },
  categoryName: {
    fontSize: 11,
    color: '#757575',
    marginTop: 2,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  remainingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 4,
  },
  remainingText: {
    fontSize: 12,
    color: '#008848',
  },
  boldText: {
    fontWeight: 'bold',
  },
  expiryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  expiryText: {
    fontSize: 11,
    color: '#757575',
  },
  loadingCenter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    color: '#757575',
    fontSize: 14,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#424242',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#757575',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#008848',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    gap: 8,
  },
  actionBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  footerNote: {
    marginTop: 16,
  },
  planWithPantryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#008848',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
    shadowColor: '#008848',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  planWithPantryText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalBackgroundDismiss: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  modalContent: {
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
  },
  modalCloseButton: {
    alignSelf: 'flex-end',
    marginBottom: 10,
    zIndex: 10,
  },
  modalImageCard: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  modalFullImage: {
    width: '100%',
    height: 300,
    backgroundColor: '#FFFFFF',
  },
  modalImageInfo: {
    padding: 16,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#EEEEEE',
  },
  modalCategory: {
    fontSize: 12,
    color: '#757575',
    marginBottom: 4,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#212121',
  },
  modalRemaining: {
    fontSize: 13,
    color: '#008848',
    marginTop: 6,
    fontWeight: '600',
  },
  modalExpiry: {
    fontSize: 12,
    color: '#E53935',
    marginTop: 4,
  },
});
