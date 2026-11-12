import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Modal,
  Alert,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { api, BhxProduct } from '../../src/services/api';
import { SafeImage } from '../../src/components/SafeImage';
import { OfflineBanner } from '../../src/components/OfflineBanner';

export default function CatalogScreen() {
  const [products, setProducts] = useState<BhxProduct[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('Tất cả');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [page, setPage] = useState<number>(1);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [previewProduct, setPreviewProduct] = useState<BhxProduct | null>(null);
  const [syncingPrice, setSyncingPrice] = useState<boolean>(false);

  // Format tiền tệ VNĐ
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
  };

  // Cập nhật giá theo thời gian thực từ Bách Hóa Xanh
  const handleSyncRealtimePrices = async () => {
    try {
      setSyncingPrice(true);
      const res = await api.syncRealtimePrices();
      if (res && res.success) {
        Alert.alert(
          'Đồng bộ thành công! ⚡',
          `${res.message}\nĐã cập nhật dữ liệu ${res.updated_count} sản phẩm tại Bách Hóa Xanh lúc ${res.synced_at}.`
        );
        loadProducts(1, false);
      }
    } catch (e) {
      Alert.alert('Lỗi', 'Không thể đồng bộ giá thời gian thực lúc này.');
    } finally {
      setSyncingPrice(false);
    }
  };

  const loadProducts = useCallback(
    async (currentPage = 1, append = false, query = searchQuery, category = selectedCategory) => {
      try {
        if (currentPage === 1 && !append) setLoading(true);

        const params: any = {
          page: currentPage,
          per_page: 20,
        };

        if (query.trim()) params.q = query.trim();
        if (category && category !== 'Tất cả') params.category = category;

        const res = await api.getBhxProducts(params);

        if (res && res.success) {
          if (res.categories && res.categories.length > 0) {
            setCategories(['Tất cả', ...res.categories]);
          }

          if (append) {
            setProducts((prev) => [...prev, ...res.data]);
          } else {
            setProducts(res.data);
          }

          setTotalCount(res.pagination.total);
          setHasMore(res.pagination.current_page < res.pagination.last_page);
          setPage(res.pagination.current_page);
        }
      } catch (error) {
        console.error('Error loading products:', error);
      } finally {
        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
      }
    },
    [searchQuery, selectedCategory]
  );

  useEffect(() => {
    loadProducts(1, false);
  }, [loadProducts]);

  const onRefresh = () => {
    setRefreshing(true);
    setPage(1);
    loadProducts(1, false);
  };

  const handleSearchSubmit = () => {
    setPage(1);
    loadProducts(1, false, searchQuery, selectedCategory);
  };

  const handleCategorySelect = (cat: string) => {
    setSelectedCategory(cat);
    setPage(1);
    loadProducts(1, false, searchQuery, cat);
  };

  const handleLoadMore = () => {
    if (!loadingMore && hasMore && !loading) {
      setLoadingMore(true);
      loadProducts(page + 1, true);
    }
  };

  const renderProduct = ({ item }: { item: BhxProduct }) => {
    return (
      <TouchableOpacity
        style={styles.productCard}
        activeOpacity={0.88}
        onPress={() => setPreviewProduct(item)}>
        <SafeImage
          uri={item.image_url}
          name={item.name}
          category={item.category_name}
          style={styles.productImage}
          resizeMode="contain"
        />
        <View style={styles.productInfo}>
          <Text style={styles.productCategory} numberOfLines={1}>
            {item.category_name}
          </Text>
          <Text style={styles.productName} numberOfLines={2}>
            {item.name}
          </Text>

          {/* Quy cách và trọng lượng bóc tách */}
          <View style={styles.weightBadge}>
            <MaterialCommunityIcons name="scale" size={12} color="#008848" />
            <Text style={styles.weightText} numberOfLines={1}>
              {item.net_weight_value
                ? `${item.net_weight_value} ${item.net_weight_unit || item.unit_label}`
                : item.unit_label || 'Gói'}
            </Text>
          </View>

          <View style={styles.priceRow}>
            <Text style={styles.priceText} numberOfLines={1}>
              {formatCurrency(item.price)}
            </Text>
            {item.is_cooking_ingredient && (
              <View style={styles.ingredientBadge}>
                <Text style={styles.ingredientBadgeText}>Nấu</Text>
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
      {/* Thanh Tìm Kiếm */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color="#757575" />
          <TextInput
            style={styles.searchInput}
            placeholder="Tìm thịt, cá, rau, trứng, gia vị..."
            placeholderTextColor="#9E9E9E"
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleSearchSubmit}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => {
                setSearchQuery('');
                loadProducts(1, false, '', selectedCategory);
              }}>
              <Ionicons name="close-circle" size={18} color="#9E9E9E" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Bộ Lọc Danh Mục (Category Chips) */}
      <View style={styles.categoryContainer}>
        <FlatList
          data={categories}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item) => item}
          renderItem={({ item }) => {
            const isSelected = selectedCategory === item;
            return (
              <TouchableOpacity
                style={[styles.categoryChip, isSelected && styles.categoryChipActive]}
                onPress={() => handleCategorySelect(item)}>
                <Text
                  style={[
                    styles.categoryChipText,
                    isSelected && styles.categoryChipTextActive,
                  ]}>
                  {item}
                </Text>
              </TouchableOpacity>
            );
          }}
          contentContainerStyle={styles.categoryList}
        />
      </View>

      {/* Thống kê số lượng & Nút Cập nhật giá thời gian thực */}
      <View style={styles.countBar}>
        <Text style={styles.countText}>
          <Text style={styles.boldText}>{totalCount}</Text> sản phẩm BHX
        </Text>

        <TouchableOpacity
          style={styles.realtimeSyncBtn}
          onPress={handleSyncRealtimePrices}
          disabled={syncingPrice}
          activeOpacity={0.8}>
          {syncingPrice ? (
            <ActivityIndicator size="small" color="#008848" />
          ) : (
            <Ionicons name="flash" size={13} color="#E65100" />
          )}
          <Text style={styles.realtimeSyncBtnText}>
            {syncingPrice ? 'Đang cập nhật...' : 'Cập nhật giá thời gian thực'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Danh Sách Hàng Hóa */}
      {loading && page === 1 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#008848" />
          <Text style={styles.loadingText}>Đang tải sản phẩm Bách Hóa Xanh...</Text>
        </View>
      ) : products.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="search-outline" size={56} color="#BDBDBD" />
          <Text style={styles.emptyTitle}>Không tìm thấy sản phẩm nào</Text>
          <Text style={styles.emptySubtitle}>
            Thử tìm kiếm với từ khóa khác hoặc chuyển sang danh mục "Tất cả".
          </Text>
        </View>
      ) : (
        <FlatList
          key="grid-2-columns"
          data={products}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderProduct}
          numColumns={2}
          columnWrapperStyle={styles.columnWrapper}
          contentContainerStyle={styles.productList}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#008848']} />
          }
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.3}
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.footerLoader}>
                <ActivityIndicator size="small" color="#008848" />
              </View>
            ) : undefined
          }
        />
      )}

      {/* Modal Phóng To Sản Phẩm Siêu Rõ Nét */}
      <Modal
        visible={!!previewProduct}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setPreviewProduct(null)}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalBackgroundDismiss}
            activeOpacity={1}
            onPress={() => setPreviewProduct(null)}
          />
          <View style={styles.modalContent}>
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setPreviewProduct(null)}>
              <Ionicons name="close-circle" size={36} color="#ffffff" />
            </TouchableOpacity>
            {previewProduct && (
              <View style={styles.modalImageCard}>
                <SafeImage
                  uri={previewProduct.image_url}
                  name={previewProduct.name}
                  category={previewProduct.category_name}
                  style={styles.modalFullImage}
                  resizeMode="contain"
                />
                <View style={styles.modalImageInfo}>
                  <Text style={styles.modalProductCategory}>{previewProduct.category_name}</Text>
                  <Text style={styles.modalProductTitle}>{previewProduct.name}</Text>
                  <View style={styles.modalPriceRow}>
                    <Text style={styles.modalProductPrice}>{formatCurrency(previewProduct.price)}</Text>
                    <Text style={styles.modalProductWeight}>
                      Quy cách: {previewProduct.net_weight_value
                        ? `${previewProduct.net_weight_value} ${previewProduct.net_weight_unit || previewProduct.unit_label}`
                        : previewProduct.unit_label || 'Gói'}
                    </Text>
                  </View>
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
  searchContainer: {
    backgroundColor: '#008848',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 42,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#212121',
  },
  categoryContainer: {
    backgroundColor: '#ffffff',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  categoryList: {
    paddingHorizontal: 16,
    gap: 8,
  },
  categoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  categoryChipActive: {
    backgroundColor: '#E8F5E9',
    borderColor: '#008848',
  },
  categoryChipText: {
    fontSize: 13,
    color: '#616161',
  },
  categoryChipTextActive: {
    color: '#008848',
    fontWeight: 'bold',
  },
  countBar: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FAFAFA',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  countText: {
    fontSize: 12,
    color: '#757575',
  },
  boldText: {
    fontWeight: 'bold',
    color: '#008848',
  },
  realtimeSyncBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    gap: 4,
    borderWidth: 1,
    borderColor: '#FFE0B2',
  },
  realtimeSyncBtnText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#E65100',
  },
  productList: {
    padding: 8,
  },
  columnWrapper: {
    justifyContent: 'space-between',
    marginBottom: 10,
    gap: 10,
  },
  productCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#EEEEEE',
  },
  productImage: {
    width: '100%',
    height: 155,
    backgroundColor: '#FFFFFF',
    padding: 4,
  },
  productInfo: {
    padding: 10,
    flex: 1,
    justifyContent: 'space-between',
  },
  productCategory: {
    fontSize: 11,
    color: '#757575',
  },
  productName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#212121',
    marginTop: 4,
    minHeight: 36,
    lineHeight: 18,
  },
  weightBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    gap: 4,
    marginTop: 6,
  },
  weightText: {
    fontSize: 11,
    color: '#008848',
    fontWeight: '600',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    flexWrap: 'wrap',
    gap: 4,
  },
  priceText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#D32F2F',
  },
  ingredientBadge: {
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  ingredientBadgeText: {
    fontSize: 10,
    color: '#E65100',
    fontWeight: 'bold',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: '#757575',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#424242',
    marginTop: 12,
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#757575',
    textAlign: 'center',
    lineHeight: 18,
  },
  footerLoader: {
    paddingVertical: 16,
    alignItems: 'center',
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
  modalProductCategory: {
    fontSize: 12,
    color: '#757575',
    marginBottom: 4,
  },
  modalProductTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#212121',
  },
  modalPriceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  modalProductPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#D32F2F',
  },
  modalProductWeight: {
    fontSize: 13,
    color: '#008848',
    fontWeight: '500',
  },
});
