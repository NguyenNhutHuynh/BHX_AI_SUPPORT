import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons, Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { useMealPlan } from '../../src/context/MealPlanContext';
import { api } from '../../src/services/api';
import { SafeImage, getCookedDishImage } from '../../src/components/SafeImage';
import { OfflineBanner } from '../../src/components/OfflineBanner';

export default function MealPlanScreen() {
  const router = useRouter();
  const { currentPlan, setCurrentPlan, triggerPantryRefresh } = useMealPlan();

  const [activeSegment, setActiveSegment] = useState<'meals' | 'cart'>('meals');
  const [completing, setCompleting] = useState<boolean>(false);
  const [expandedMeal, setExpandedMeal] = useState<number | null>(0);
  const [previewImage, setPreviewImage] = useState<{ uri?: string; title: string; subtitle?: string } | null>(null);
  const [syncingPrice, setSyncingPrice] = useState<boolean>(false);

  // Format tiền tệ VNĐ
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
  };

  // Cập nhật giá theo thời gian thực từ Bách Hóa Xanh
  const handleSyncRealtimePrices = async () => {
    if (!currentPlan) return;
    try {
      setSyncingPrice(true);
      const productIds = currentPlan.shopping_list.map((item) => item.bhx_product_id);
      const res = await api.syncRealtimePrices(productIds);
      if (res && res.success) {
        Alert.alert(
          'Đồng bộ giá BHX thành công! ⚡',
          `Đã cập nhật giá thời gian thực mới nhất cho các sản phẩm trong giỏ hàng lúc ${res.synced_at}.`
        );
      }
    } catch (e) {
      Alert.alert('Lỗi', 'Không thể đồng bộ giá thời gian thực lúc này.');
    } finally {
      setSyncingPrice(false);
    }
  };

  // Hoàn tất nấu ăn & chuyển nguyên liệu thừa vào Tủ lạnh ảo
  const handleCompletePlan = async () => {
    if (!currentPlan) return;

    setCompleting(true);
    try {
      const res = await api.completeMealPlan(currentPlan.plan_id);
      if (res && res.success) {
        // Cập nhật trạng thái
        setCurrentPlan({
          ...currentPlan,
          is_completed: true,
        });
        triggerPantryRefresh();

        Alert.alert(
          '🎉 Hoàn tất nấu ăn!',
          'Các nguyên liệu còn dư đã được tự động lưu vào Tủ lạnh ảo của bạn để dùng cho các bữa sau.',
          [
            {
              text: 'Ở lại trang',
              style: 'cancel',
            },
            {
              text: 'Xem Tủ Lạnh Ảo',
              onPress: () => router.push('/(tabs)/pantry'),
            },
          ]
        );
      } else {
        Alert.alert('Thông báo', res.message || 'Đã có lỗi xảy ra.');
      }
    } catch (error: any) {
      console.error('Error completing meal plan:', error);
      Alert.alert('Lỗi', 'Không thể hoàn tất thực đơn. Vui lòng kiểm tra kết nối API.');
    } finally {
      setCompleting(false);
    }
  };

  // Empty state khi chưa tạo thực đơn nào
  if (!currentPlan) {
    return (
      <View style={{ flex: 1, backgroundColor: '#f5f5f5' }}>
        <OfflineBanner />
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconCircle}>
            <MaterialCommunityIcons name="silverware-fork-knife" size={48} color="#008848" />
          </View>
          <Text style={styles.emptyTitle}>Chưa có thực đơn nào</Text>
          <Text style={styles.emptySubtitle}>
            Hãy thiết lập ngân sách và sở thích tại Tab "Tạo Thực Đơn" để AI lên kế hoạch bữa ăn & giỏ
            hàng Bách Hóa Xanh cho bạn nhé!
          </Text>
          <TouchableOpacity
            style={styles.emptyButton}
            onPress={() => router.push('/(tabs)')}>
            <MaterialCommunityIcons name="chef-hat" size={20} color="#ffffff" />
            <Text style={styles.emptyButtonText}>Tạo Thực Đơn Ngay</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <OfflineBanner />
      {/* Header Tóm tắt Chi phí */}
      <View style={styles.summaryBar}>
        <View>
          <Text style={styles.summaryLabel}>Tổng tiền hàng BHX:</Text>
          <Text style={styles.summaryValue}>{formatCurrency(currentPlan.total_cost)}</Text>
        </View>
        <View style={styles.budgetStatusBadge}>
          <Ionicons
            name={currentPlan.is_within_budget ? 'checkmark-circle' : 'alert-circle'}
            size={16}
            color={currentPlan.is_within_budget ? '#2E7D32' : '#C62828'}
          />
          <Text
            style={[
              styles.budgetStatusText,
              { color: currentPlan.is_within_budget ? '#2E7D32' : '#C62828' },
            ]}>
            {currentPlan.is_within_budget ? 'Đạt ngân sách' : 'Vượt ngân sách'}
          </Text>
        </View>
      </View>

      {/* Segment Switcher: Thực đơn vs Giỏ hàng */}
      <View style={styles.segmentContainer}>
        <TouchableOpacity
          style={[styles.segmentButton, activeSegment === 'meals' && styles.segmentButtonActive]}
          onPress={() => setActiveSegment('meals')}>
          <MaterialCommunityIcons
            name="book-open-outline"
            size={18}
            color={activeSegment === 'meals' ? '#008848' : '#757575'}
          />
          <Text
            style={[
              styles.segmentButtonText,
              activeSegment === 'meals' && styles.segmentButtonTextActive,
            ]}>
            Món Ăn & Công Thức ({currentPlan.meals.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.segmentButton, activeSegment === 'cart' && styles.segmentButtonActive]}
          onPress={() => setActiveSegment('cart')}>
          <MaterialCommunityIcons
            name="cart-outline"
            size={18}
            color={activeSegment === 'cart' ? '#008848' : '#757575'}
          />
          <Text
            style={[
              styles.segmentButtonText,
              activeSegment === 'cart' && styles.segmentButtonTextActive,
            ]}>
            Giỏ Hàng BHX ({currentPlan.shopping_list.length})
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {activeSegment === 'meals' ? (
          /* Danh sách các bữa ăn và công thức */
          <View>
            <Text style={styles.sectionHeaderTitle}>Chi tiết các bữa ăn trong kế hoạch:</Text>
            {currentPlan.meals.map((meal, index) => {
              const isExpanded = expandedMeal === index;
              return (
                <View key={index} style={styles.mealCard}>
                  <TouchableOpacity
                    style={styles.mealCardHeader}
                    onPress={() => setExpandedMeal(isExpanded ? null : index)}>
                    <View style={styles.mealBadge}>
                      <Text style={styles.mealBadgeText}>Ngày {meal.day}</Text>
                    </View>
                    {meal.image_url ? (
                      <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() =>
                          setPreviewImage({
                            uri: getCookedDishImage(meal.main_dish || meal.dish_name),
                            title: meal.dish_name,
                            subtitle: meal.main_dish ? `Món mặn: ${meal.main_dish}` : undefined,
                          })
                        }>
                        <SafeImage
                          uri={getCookedDishImage(meal.main_dish || meal.dish_name)}
                          name={meal.main_dish}
                          style={styles.mealHeaderThumb}
                          resizeMode="cover"
                        />
                      </TouchableOpacity>
                    ) : null}
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={styles.mealDishTitle}>{meal.dish_name}</Text>
                      {meal.main_dish ? (
                        <View style={styles.courseRow}>
                          <View style={styles.mainDishBadge}>
                            <Text style={styles.mainDishBadgeText}>🍲 Mặn: {meal.main_dish}</Text>
                          </View>
                          {meal.soup_dish ? (
                            <View style={styles.soupDishBadge}>
                              <Text style={styles.soupDishBadgeText}>🥣 Canh: {meal.soup_dish}</Text>
                            </View>
                          ) : null}
                        </View>
                      ) : null}
                      <View style={styles.cookwareTag}>
                        <MaterialCommunityIcons name="chef-hat" size={13} color="#008848" />
                        <Text style={styles.cookwareTagText}>Dụng cụ: {meal.cookware_used}</Text>
                      </View>
                    </View>
                    <Ionicons
                      name={isExpanded ? 'chevron-up' : 'chevron-down'}
                      size={20}
                      color="#757575"
                    />
                  </TouchableOpacity>

                  {isExpanded && (
                    <View style={styles.mealDetails}>
                      {/* Trực quan 4 món ăn trong mâm cơm: Tên món & Hình món 100% chuẩn xác, kích thước lớn rõ nét */}
                      <View style={styles.dishShowcaseGrid}>
                        {/* 1. Món mặn */}
                        <TouchableOpacity
                          style={styles.dishShowcaseCard}
                          activeOpacity={0.85}
                          onPress={() =>
                            setPreviewImage({
                              uri: getCookedDishImage(meal.main_dish),
                              title: meal.main_dish || 'Món mặn',
                              subtitle: `Bữa ăn: ${meal.dish_name}`,
                            })
                          }>
                          <SafeImage
                            uri={getCookedDishImage(meal.main_dish)}
                            name={meal.main_dish}
                            style={styles.dishShowcaseImage}
                            resizeMode="cover"
                          />
                          <View style={styles.dishShowcaseBadgeMặn}>
                            <Text style={styles.dishShowcaseBadgeTextMặn} numberOfLines={2}>
                              🍲 {meal.main_dish || 'Món mặn'}
                            </Text>
                          </View>
                        </TouchableOpacity>

                        {/* 2. Món canh */}
                        <TouchableOpacity
                          style={styles.dishShowcaseCard}
                          activeOpacity={0.85}
                          onPress={() =>
                            setPreviewImage({
                              uri: getCookedDishImage(meal.soup_dish || 'canh'),
                              title: meal.soup_dish || 'Món canh thanh mát',
                              subtitle: `Bữa ăn: ${meal.dish_name}`,
                            })
                          }>
                          <SafeImage
                            uri={getCookedDishImage(meal.soup_dish || 'canh')}
                            name={meal.soup_dish}
                            style={styles.dishShowcaseImage}
                            resizeMode="cover"
                          />
                          <View style={styles.dishShowcaseBadgeCanh}>
                            <Text style={styles.dishShowcaseBadgeTextCanh} numberOfLines={2}>
                              🥣 {meal.soup_dish || 'Món canh'}
                            </Text>
                          </View>
                        </TouchableOpacity>

                        {/* 3. Món rau tươi xanh / xào tỏi */}
                        <TouchableOpacity
                          style={styles.dishShowcaseCard}
                          activeOpacity={0.85}
                          onPress={() =>
                            setPreviewImage({
                              uri: getCookedDishImage('rau xào'),
                              title: meal.ingredients[1] ? meal.ingredients[1].name.replace(/\s+(?:khay|túi|gói|hộp|chai|vỉ|\d+\s*(?:g|gr|kg|ml|quả)).*$/iu, '') : 'Rau xanh xào tỏi',
                              subtitle: 'Rau xanh tươi sạch xào tỏi / luộc',
                            })
                          }>
                          <SafeImage
                            uri={getCookedDishImage('rau xào')}
                            name="Rau xanh xào tỏi"
                            style={styles.dishShowcaseImage}
                            resizeMode="cover"
                          />
                          <View style={styles.dishShowcaseBadgeExtra}>
                            <Text style={styles.dishShowcaseBadgeTextExtra} numberOfLines={2}>
                              🥗 {meal.ingredients[1] ? meal.ingredients[1].name.replace(/\s+(?:khay|túi|gói|hộp|chai|vỉ|\d+\s*(?:g|gr|kg|ml|quả)).*$/iu, '') : 'Rau củ xào'}
                            </Text>
                          </View>
                        </TouchableOpacity>

                        {/* 4. Cơm nóng dẻo */}
                        <TouchableOpacity
                          style={styles.dishShowcaseCard}
                          activeOpacity={0.85}
                          onPress={() =>
                            setPreviewImage({
                              uri: getCookedDishImage('cơm'),
                              title: 'Cơm trắng dẻo nóng hổi',
                              subtitle: 'Gạo thơm dẻo chuẩn vị cơm nhà',
                            })
                          }>
                          <SafeImage
                            uri={getCookedDishImage('cơm')}
                            name="Cơm trắng dẻo"
                            style={styles.dishShowcaseImage}
                            resizeMode="cover"
                          />
                          <View style={styles.dishShowcaseBadgeRice}>
                            <Text style={styles.dishShowcaseBadgeTextRice} numberOfLines={2}>
                              🍚 Cơm nóng dẻo
                            </Text>
                          </View>
                        </TouchableOpacity>
                      </View>

                      {/* Định lượng nguyên liệu */}
                      <Text style={styles.detailSubhead}>Nguyên liệu cần dùng (Bấm vào ảnh để phóng to):</Text>
                      <View style={styles.ingredientsList}>
                        {meal.ingredients.map((ing, iIdx) => (
                          <View key={iIdx} style={styles.ingredientRow}>
                            <TouchableOpacity
                              activeOpacity={0.8}
                              onPress={() =>
                                setPreviewImage({
                                  uri: ing.image_url,
                                  title: ing.name,
                                  subtitle: `Định lượng cần dùng: ${ing.amount_used} ${ing.unit}`,
                                })
                              }>
                              <SafeImage
                                uri={ing.image_url}
                                name={ing.name}
                                category={ing.category_name}
                                style={styles.ingredientThumb}
                                resizeMode="contain"
                              />
                            </TouchableOpacity>
                            <View style={{ flex: 1, marginLeft: 12 }}>
                              <Text style={styles.ingredientName} numberOfLines={2}>
                                {ing.name}
                              </Text>
                              <Text style={styles.ingredientAmount}>
                                Định lượng: {ing.amount_used} {ing.unit}
                              </Text>
                            </View>
                          </View>
                        ))}
                      </View>

                      {/* Các bước nấu chi tiết */}
                      <Text style={[styles.detailSubhead, { marginTop: 12 }]}>Các bước nấu:</Text>
                      <View style={styles.instructionsBox}>
                        <Text style={styles.instructionsText}>{meal.instructions}</Text>
                      </View>
                    </View>
                  )}
                </View>
              );
            })}

            {/* Thông báo nguyên liệu dư sẽ vào Tủ lạnh */}
            {currentPlan.leftover_to_pantry.length > 0 && (
              <View style={styles.leftoverBox}>
                <View style={styles.leftoverHeader}>
                  <MaterialCommunityIcons name="fridge" size={20} color="#0277BD" />
                  <Text style={styles.leftoverTitle}>Phần dư dự kiến cất vào Tủ Lạnh Ảo:</Text>
                </View>
                {currentPlan.leftover_to_pantry.map((item, idx) => (
                  <Text key={idx} style={styles.leftoverItemText}>
                    • Còn dư <Text style={{ fontWeight: 'bold' }}>{item.remaining_value} {item.unit}</Text> {item.name}
                  </Text>
                ))}
              </View>
            )}
          </View>
        ) : (
          /* Danh sách giỏ hàng BHX */
          <View>
            <View style={styles.cartHeaderRow}>
              <Text style={styles.sectionHeaderTitle}>Các gói nguyên liệu cần mua tại BHX:</Text>
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
            {currentPlan.shopping_list.map((item, idx) => (
              <View key={idx} style={styles.cartItemCard}>
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() =>
                    setPreviewImage({
                      uri: item.image_url,
                      title: item.name,
                      subtitle: `${item.category_name || ''} • Quy cách: ${item.net_weight_value || ''} ${item.net_weight_unit || item.unit_label || ''} • ${formatCurrency(item.unit_price)}`,
                    })
                  }>
                  <SafeImage
                    uri={item.image_url}
                    name={item.name}
                    category={item.category_name}
                    style={styles.cartItemImage}
                    resizeMode="contain"
                  />
                </TouchableOpacity>
                <View style={styles.cartItemInfo}>
                  <Text style={styles.cartItemName} numberOfLines={2}>
                    {item.name}
                  </Text>
                  {item.category_name && (
                    <Text style={styles.cartItemCategory}>{item.category_name}</Text>
                  )}
                  {item.net_weight_value ? (
                    <Text style={styles.cartItemWeight}>
                      Quy cách: {item.net_weight_value} {item.net_weight_unit || item.unit_label}
                    </Text>
                  ) : null}
                  <View style={styles.cartItemPriceRow}>
                    <Text style={styles.cartItemPrice}>{formatCurrency(item.unit_price)}</Text>
                    <Text style={styles.cartItemQty}>x {item.quantity}</Text>
                  </View>
                </View>
                <View style={styles.cartItemTotal}>
                  <Text style={styles.cartItemTotalText}>
                    {formatCurrency(item.total_price || item.unit_price * item.quantity)}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Thanh hành động chân trang: Nút Đã Nấu Xong */}
      <View style={styles.bottomActionBar}>
        <TouchableOpacity
          style={[
            styles.completeButton,
            currentPlan.is_completed && styles.completeButtonDone,
            completing && styles.completeButtonDisabled,
          ]}
          onPress={handleCompletePlan}
          disabled={completing || currentPlan.is_completed}>
          {completing ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <View style={styles.completeButtonContent}>
              <MaterialCommunityIcons
                name={currentPlan.is_completed ? 'check-decagram' : 'silverware-clean'}
                size={22}
                color="#ffffff"
              />
              <Text style={styles.completeButtonText}>
                {currentPlan.is_completed
                  ? 'Đã Hoàn Tất Nấu Ăn (Đã Cất Tủ Lạnh)'
                  : 'Đã Nấu Xong - Cất Phần Dư Vào Tủ Lạnh'}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
      {/* Modal Phóng To Hình Ảnh Siêu Rõ Nét */}
      <Modal
        visible={!!previewImage}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setPreviewImage(null)}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalBackgroundDismiss}
            activeOpacity={1}
            onPress={() => setPreviewImage(null)}
          />
          <View style={styles.modalContent}>
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setPreviewImage(null)}>
              <Ionicons name="close-circle" size={36} color="#ffffff" />
            </TouchableOpacity>
            {previewImage && (
              <View style={styles.modalImageCard}>
                <SafeImage
                  uri={previewImage.uri}
                  name={previewImage.title}
                  style={styles.modalFullImage}
                  resizeMode="contain"
                />
                <View style={styles.modalImageInfo}>
                  <Text style={styles.modalImageTitle}>{previewImage.title}</Text>
                  {previewImage.subtitle ? (
                    <Text style={styles.modalImageSubtitle}>{previewImage.subtitle}</Text>
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
  scrollContent: {
    padding: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    backgroundColor: '#ffffff',
  },
  emptyIconCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#E8F5E9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#212121',
    marginBottom: 10,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#757575',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#008848',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 8,
  },
  emptyButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: 'bold',
  },
  summaryBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  summaryLabel: {
    fontSize: 12,
    color: '#757575',
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#008848',
  },
  budgetStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F8E9',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 4,
  },
  budgetStatusText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  segmentContainer: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 8,
  },
  segmentButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
    gap: 6,
  },
  segmentButtonActive: {
    backgroundColor: '#E8F5E9',
    borderWidth: 1,
    borderColor: '#008848',
  },
  segmentButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#616161',
  },
  segmentButtonTextActive: {
    color: '#008848',
    fontWeight: 'bold',
  },
  sectionHeaderTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#212121',
    flex: 1,
  },
  cartHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  realtimeSyncBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 10,
    paddingVertical: 6,
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
  mealCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
    overflow: 'hidden',
  },
  mealCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
  },
  mealBadge: {
    backgroundColor: '#008848',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  mealBadgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  mealDishTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#212121',
  },
  cookwareTag: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 4,
  },
  cookwareTagText: {
    fontSize: 12,
    color: '#008848',
  },
  courseRow: {
    marginTop: 6,
    gap: 4,
  },
  mainDishBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  mainDishBadgeText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#92400E',
  },
  soupDishBadge: {
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  soupDishBadgeText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#0369A1',
  },
  mealDetails: {
    padding: 14,
    backgroundColor: '#FAFAFA',
    borderTopWidth: 1,
    borderTopColor: '#EEEEEE',
  },
  detailSubhead: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#424242',
    marginBottom: 6,
  },
  mealHeaderThumb: {
    width: 92,
    height: 92,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EEEEEE',
  },
  dishShowcaseGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
    justifyContent: 'space-between',
  },
  dishShowcaseCard: {
    width: '48.5%',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E8E8E8',
    overflow: 'hidden',
    padding: 6,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  dishShowcaseImage: {
    width: '100%',
    height: 165,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
  },
  dishShowcaseBadgeMặn: {
    backgroundColor: '#FEF3C7',
    marginTop: 6,
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 6,
    width: '100%',
    alignItems: 'center',
  },
  dishShowcaseBadgeTextMặn: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#92400E',
    textAlign: 'center',
  },
  dishShowcaseBadgeCanh: {
    backgroundColor: '#E0F2FE',
    marginTop: 6,
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 6,
    width: '100%',
    alignItems: 'center',
  },
  dishShowcaseBadgeTextCanh: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#0369A1',
    textAlign: 'center',
  },
  dishShowcaseBadgeExtra: {
    backgroundColor: '#E8F5E9',
    marginTop: 6,
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 6,
    width: '100%',
    alignItems: 'center',
  },
  dishShowcaseBadgeTextExtra: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#2E7D32',
    textAlign: 'center',
  },
  dishShowcaseBadgeRice: {
    backgroundColor: '#FFF7ED',
    marginTop: 6,
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 6,
    width: '100%',
    alignItems: 'center',
  },
  dishShowcaseBadgeTextRice: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#C2410C',
    textAlign: 'center',
  },
  ingredientThumb: {
    width: 76,
    height: 76,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EEEEEE',
  },
  ingredientsList: {
    gap: 6,
  },
  ingredientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#EEEEEE',
  },
  ingredientName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333333',
  },
  ingredientAmount: {
    fontSize: 12,
    color: '#008848',
    marginTop: 2,
  },
  instructionsBox: {
    backgroundColor: '#ffffff',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  instructionsText: {
    fontSize: 13,
    lineHeight: 20,
    color: '#333',
  },
  leftoverBox: {
    backgroundColor: '#E1F5FE',
    borderRadius: 12,
    padding: 14,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#B3E5FC',
  },
  leftoverHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  leftoverTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#0277BD',
  },
  leftoverItemText: {
    fontSize: 13,
    color: '#01579B',
    lineHeight: 20,
  },
  cartItemCard: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 10,
    marginBottom: 10,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  cartItemImage: {
    width: 96,
    height: 96,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EEEEEE',
  },
  cartItemInfo: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  cartItemName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#212121',
  },
  cartItemCategory: {
    fontSize: 11,
    color: '#757575',
    marginTop: 2,
  },
  cartItemWeight: {
    fontSize: 11,
    color: '#008848',
    fontWeight: '500',
    marginTop: 2,
  },
  cartItemPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  cartItemPrice: {
    fontSize: 13,
    fontWeight: '600',
    color: '#E53935',
  },
  cartItemQty: {
    fontSize: 12,
    color: '#616161',
  },
  cartItemTotal: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingLeft: 8,
  },
  cartItemTotalText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#008848',
  },
  bottomActionBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#EEEEEE',
  },
  completeButton: {
    backgroundColor: '#008848',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#008848',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 3,
  },
  completeButtonDone: {
    backgroundColor: '#43A047',
  },
  completeButtonDisabled: {
    backgroundColor: '#A5D6A7',
  },
  completeButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  completeButtonText: {
    color: '#ffffff',
    fontSize: 15,
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
  modalImageTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#212121',
  },
  modalImageSubtitle: {
    fontSize: 13,
    color: '#008848',
    marginTop: 4,
    fontWeight: '500',
  },
});

