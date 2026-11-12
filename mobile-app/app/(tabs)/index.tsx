import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons, Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { api } from '../../src/services/api';
import { useMealPlan } from '../../src/context/MealPlanContext';
import { OfflineBanner } from '../../src/components/OfflineBanner';

const BUDGET_PRESETS = [
  { label: '50.000đ', value: 50000 },
  { label: '70.000đ', value: 70000 },
  { label: '100.000đ', value: 100000 },
  { label: '150.000đ', value: 150000 },
];

export const DAY_OPTIONS = [
  { value: 1, label: '1 Ngày (Nấu hôm nay)', description: 'Thực đơn nhanh gọn, mua vừa đủ dùng trong ngày' },
  { value: 2, label: '2 Ngày (Kế hoạch 2 ngày)', description: 'Lên thực đơn linh hoạt cho 2 ngày kế tiếp' },
  { value: 3, label: '3 Ngày (Tiết kiệm nguyên liệu)', description: 'Tối ưu chi phí, tận dụng chéo nguyên liệu tốt nhất' },
  { value: 4, label: '4 Ngày (Giữa tuần)', description: 'Kế hoạch 4 ngày cân bằng dinh dưỡng gia đình' },
  { value: 5, label: '5 Ngày (Thứ 2 - Thứ 6)', description: 'Phù hợp người đi làm, chuẩn bị sẵn nguyên liệu tuần' },
  { value: 7, label: '7 Ngày (Trọn tuần)', description: 'Tiết kiệm thời gian đi chợ nhất, chi phí mua sắm rẻ nhất' },
];

const COOKWARE_OPTIONS = [
  { name: 'Nồi cơm điện', icon: 'rice' },
  { name: 'Chảo chống dính', icon: 'pan' },
  { name: 'Nồi chiên không dầu', icon: 'pot-steam' },
  { name: 'Lò vi sóng', icon: 'microwave' },
  { name: 'Bếp từ', icon: 'stove' },
];

// 1. Mục tiêu dinh dưỡng
const GOAL_OPTIONS = [
  { label: '🥗 Giảm cân / Eat Clean', value: 'Giảm cân / Eat Clean' },
  { label: '💪 Tăng cơ / High-Protein', value: 'Tăng cơ / High-Protein' },
  { label: '🍚 Cơm gia đình (Mặn + Canh)', value: 'Cơm gia đình' },
  { label: '💰 Tiết kiệm sinh viên', value: 'Tiết kiệm sinh viên' },
  { label: '🍃 Ăn thanh đạm / Ít dầu', value: 'Ăn thanh đạm' },
];

// 2. Sở thích nguyên liệu chính
const PROTEIN_OPTIONS = [
  { label: '🥩 Thích thịt bò', value: 'Thích thịt bò' },
  { label: '🍗 Thích thịt gà', value: 'Thích thịt gà' },
  { label: '🥓 Thích thịt heo', value: 'Thích thịt heo' },
  { label: '🥚 Thích trứng & đậu hũ', value: 'Thích trứng & đậu hũ' },
  { label: '🥦 Nhiều rau xanh', value: 'Nhiều rau xanh' },
];

// 3. Kiêng cữ & Dị ứng
const RESTRICTION_OPTIONS = [
  { label: '🚫 Không hành lá', value: 'Không hành lá' },
  { label: '🌶️ Không cay', value: 'Không cay' },
  { label: '🦐 Dị ứng hải sản', value: 'Dị ứng hải sản' },
  { label: '🥩 Không thịt heo', value: 'Không thịt heo' },
  { label: '🍗 Không thịt gà', value: 'Không thịt gà' },
  { label: '🧂 Không bột ngọt', value: 'Không bột ngọt' },
];

export default function PlannerScreen() {
  const router = useRouter();
  const { setCurrentPlan } = useMealPlan();

  const [selectedBudget, setSelectedBudget] = useState<number>(70000);
  const [customBudget, setCustomBudget] = useState<string>('');
  const [isCustomBudget, setIsCustomBudget] = useState<boolean>(false);

  const [mealsPerDay, setMealsPerDay] = useState<number>(2);
  const [daysCount, setDaysCount] = useState<number>(1);
  const [showDaysModal, setShowDaysModal] = useState<boolean>(false);
  const [syncingPrice, setSyncingPrice] = useState<boolean>(false);
  const [lastSyncedTime, setLastSyncedTime] = useState<string>('Trực tuyến');

  const [selectedCookware, setSelectedCookware] = useState<string[]>([
    'Nồi cơm điện',
    'Chảo chống dính',
  ]);

  const [selectedDietary, setSelectedDietary] = useState<string[]>([
    'Cơm gia đình',
  ]);
  const [loading, setLoading] = useState<boolean>(false);

  // Cập nhật giá theo thời gian thực từ Bách Hóa Xanh
  const handleSyncRealtimePrices = async () => {
    try {
      setSyncingPrice(true);
      const res = await api.syncRealtimePrices();
      if (res && res.success) {
        setLastSyncedTime(res.synced_at || 'Vừa xong');
        Alert.alert(
          'Đồng bộ thành công! ⚡',
          `Đã cập nhật giá thời gian thực từ Bách Hóa Xanh cho ${res.updated_count} mặt hàng lúc ${res.synced_at}.`
        );
      }
    } catch (e) {
      Alert.alert('Lỗi kết nối', 'Không thể đồng bộ giá thời gian thực lúc này. Vui lòng thử lại.');
    } finally {
      setSyncingPrice(false);
    }
  };

  // Toggle cookware selection
  const toggleCookware = (tool: string) => {
    if (selectedCookware.includes(tool)) {
      if (selectedCookware.length === 1) {
        Alert.alert('Lưu ý', 'Bạn nên giữ ít nhất một dụng cụ nấu ăn.');
        return;
      }
      setSelectedCookware(selectedCookware.filter((t) => t !== tool));
    } else {
      setSelectedCookware([...selectedCookware, tool]);
    }
  };

  // Toggle dietary options
  const toggleDietary = (item: string) => {
    if (selectedDietary.includes(item)) {
      setSelectedDietary(selectedDietary.filter((d) => d !== item));
    } else {
      setSelectedDietary([...selectedDietary, item]);
    }
  };

  // Thực hiện gọi API lập kế hoạch thực đơn
  const handleGenerateMealPlan = async () => {
    const finalBudget = isCustomBudget
      ? parseInt(customBudget.replace(/[^0-9]/g, ''), 10) || 70000
      : selectedBudget;

    if (finalBudget < 20000) {
      Alert.alert('Ngân sách quá thấp', 'Vui lòng đặt ngân sách tối thiểu từ 20.000đ/ngày.');
      return;
    }

    setLoading(true);
    try {
      const response = await api.generateMealPlan({
        daily_budget: finalBudget,
        days_count: daysCount,
        meals_per_day: mealsPerDay,
        cookware: selectedCookware,
        disliked_foods: selectedDietary,
      });

      if (response && response.success) {
        setCurrentPlan(response.data);
        // Chuyển sang Tab 2 xem kết quả
        router.push('/(tabs)/meal-plan');
      } else {
        Alert.alert('Thông báo', response.message || 'Không thể tạo thực đơn. Hãy thử lại.');
      }
    } catch (error: any) {
      console.error('Error generating meal plan:', error);
      Alert.alert(
        'Lỗi kết nối',
        'Không thể kết nối đến Backend API. Vui lòng đảm bảo server đang chạy.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <OfflineBanner />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.contentContainer}>
      {/* Banner Giới thiệu & Cập nhật giá thời gian thực */}
      <View style={styles.bannerCard}>
        <View style={styles.bannerTopRow}>
          <View style={styles.bannerBadge}>
            <MaterialCommunityIcons name="lightning-bolt" size={16} color="#FFD700" />
            <Text style={styles.bannerBadgeText}>AI BHX Smart Planner</Text>
          </View>

          {/* Nút Cập Nhật Giá Thời Gian Thực */}
          <TouchableOpacity
            style={styles.realtimeSyncBtn}
            onPress={handleSyncRealtimePrices}
            disabled={syncingPrice}
            activeOpacity={0.8}>
            {syncingPrice ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Ionicons name="flash" size={14} color="#FFD700" />
            )}
            <Text style={styles.realtimeSyncBtnText}>
              {syncingPrice ? 'Đang cập nhật...' : 'Cập nhật giá thời gian thực'}
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.bannerTitle}>Lập Thực Đơn Thông Minh</Text>
        <Text style={styles.bannerSubtitle}>
          Mâm cơm chuẩn Việt (Món Mặn + Món Canh), cân đối theo mục tiêu Giảm cân, Tăng cơ, Thích ăn thịt bò/gà/heo và tận dụng Tủ lạnh ảo!
        </Text>

        <View style={styles.syncStatusFooter}>
          <View style={styles.pulseDot} />
          <Text style={styles.syncStatusFooterText}>Dữ liệu giá BHX trực tiếp: {lastSyncedTime}</Text>
        </View>
      </View>

      {/* 1. Chọn Ngân sách */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <FontAwesome5 name="wallet" size={18} color="#008848" />
          <Text style={styles.sectionTitle}>1. Ngân sách / ngày</Text>
        </View>

        <View style={styles.chipRow}>
          {BUDGET_PRESETS.map((preset) => {
            const isSelected = !isCustomBudget && selectedBudget === preset.value;
            return (
              <TouchableOpacity
                key={preset.value}
                style={[styles.budgetChip, isSelected && styles.budgetChipActive]}
                onPress={() => {
                  setIsCustomBudget(false);
                  setSelectedBudget(preset.value);
                }}>
                <Text style={[styles.budgetChipText, isSelected && styles.budgetChipTextActive]}>
                  {preset.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Nhập tay ngân sách */}
        <TouchableOpacity
          style={[styles.customBudgetToggle, isCustomBudget && styles.customBudgetToggleActive]}
          onPress={() => setIsCustomBudget(!isCustomBudget)}>
          <Ionicons
            name={isCustomBudget ? 'checkbox' : 'square-outline'}
            size={20}
            color={isCustomBudget ? '#008848' : '#757575'}
          />
          <Text style={styles.customBudgetText}>Hoặc tự nhập ngân sách khác</Text>
        </TouchableOpacity>

        {isCustomBudget && (
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.textInput}
              keyboardType="numeric"
              placeholder="Ví dụ: 85000"
              placeholderTextColor="#999"
              value={customBudget}
              onChangeText={setCustomBudget}
            />
            <Text style={styles.inputSuffix}>VNĐ / ngày</Text>
          </View>
        )}
      </View>

      {/* 2. Số bữa và Số ngày */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <MaterialCommunityIcons name="calendar-clock" size={20} color="#008848" />
          <Text style={styles.sectionTitle}>2. Kế hoạch ăn uống</Text>
        </View>

        <Text style={styles.subLabel}>Số bữa ăn mỗi ngày:</Text>
        <View style={styles.pillRow}>
          {[1, 2, 3].map((num) => (
            <TouchableOpacity
              key={num}
              style={[styles.pillButton, mealsPerDay === num && styles.pillButtonActive]}
              onPress={() => setMealsPerDay(num)}>
              <Text
                style={[styles.pillButtonText, mealsPerDay === num && styles.pillButtonTextActive]}>
                {num} Bữa {num === 1 ? '(Tối)' : num === 2 ? '(Trưa & Tối)' : '(Sáng, Trưa, Tối)'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={[styles.subLabel, { marginTop: 16 }]}>Thời gian lập thực đơn (Số ngày):</Text>
        <TouchableOpacity
          style={styles.selectDropdown}
          activeOpacity={0.8}
          onPress={() => setShowDaysModal(true)}>
          <View style={styles.selectDropdownLeft}>
            <View style={styles.selectIconWrap}>
              <MaterialCommunityIcons name="calendar-range" size={20} color="#008848" />
            </View>
            <View style={{ marginLeft: 10, flex: 1 }}>
              <Text style={styles.selectDropdownTitle}>
                {DAY_OPTIONS.find((o) => o.value === daysCount)?.label || `${daysCount} Ngày`}
              </Text>
              <Text style={styles.selectDropdownDesc} numberOfLines={1}>
                {DAY_OPTIONS.find((o) => o.value === daysCount)?.description || 'Nhấn để chọn số ngày'}
              </Text>
            </View>
          </View>
          <View style={styles.selectDropdownRight}>
            <Text style={styles.selectDropdownActionText}>Chọn</Text>
            <Ionicons name="chevron-down-circle" size={20} color="#008848" />
          </View>
        </TouchableOpacity>
      </View>

      {/* 3. Dụng cụ bếp */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <MaterialCommunityIcons name="chef-hat" size={20} color="#008848" />
          <Text style={styles.sectionTitle}>3. Dụng cụ bếp đang có</Text>
        </View>
        <Text style={styles.subHint}>AI sẽ phối hợp dụng cụ để nấu đồng thời món mặn và canh:</Text>

        <View style={styles.cookwareGrid}>
          {COOKWARE_OPTIONS.map((tool) => {
            const isSelected = selectedCookware.includes(tool.name);
            return (
              <TouchableOpacity
                key={tool.name}
                style={[styles.cookwareCard, isSelected && styles.cookwareCardActive]}
                onPress={() => toggleCookware(tool.name)}>
                <MaterialCommunityIcons
                  name={tool.icon as any}
                  size={24}
                  color={isSelected ? '#008848' : '#757575'}
                />
                <Text
                  style={[styles.cookwareText, isSelected && styles.cookwareTextActive]}>
                  {tool.name}
                </Text>
                {isSelected && (
                  <View style={styles.checkBadge}>
                    <Ionicons name="checkmark-circle" size={16} color="#008848" />
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* 4. Mục tiêu & Sở thích ăn uống phong phú */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <MaterialCommunityIcons name="heart-pulse" size={22} color="#008848" />
          <Text style={styles.sectionTitle}>4. Mục tiêu & Sở thích ẩm thực</Text>
        </View>

        {/* Mục tiêu dinh dưỡng */}
        <Text style={styles.groupSubTitle}>🎯 Mục tiêu dinh dưỡng & Chế độ ăn:</Text>
        <View style={styles.dietaryRow}>
          {GOAL_OPTIONS.map((item) => {
            const isSelected = selectedDietary.includes(item.value);
            return (
              <TouchableOpacity
                key={item.value}
                style={[styles.goalChip, isSelected && styles.goalChipActive]}
                onPress={() => toggleDietary(item.value)}>
                <Text style={[styles.goalChipText, isSelected && styles.goalChipTextActive]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Sở thích đạm chính */}
        <Text style={[styles.groupSubTitle, { marginTop: 14 }]}>🥩 Sở thích món đạm chính:</Text>
        <View style={styles.dietaryRow}>
          {PROTEIN_OPTIONS.map((item) => {
            const isSelected = selectedDietary.includes(item.value);
            return (
              <TouchableOpacity
                key={item.value}
                style={[styles.proteinChip, isSelected && styles.proteinChipActive]}
                onPress={() => toggleDietary(item.value)}>
                <Text style={[styles.proteinChipText, isSelected && styles.proteinChipTextActive]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Kiêng cữ & Dị ứng */}
        <Text style={[styles.groupSubTitle, { marginTop: 14 }]}>🚫 Kiêng cữ & Dị ứng:</Text>
        <View style={styles.dietaryRow}>
          {RESTRICTION_OPTIONS.map((item) => {
            const isSelected = selectedDietary.includes(item.value);
            return (
              <TouchableOpacity
                key={item.value}
                style={[styles.restrictionChip, isSelected && styles.restrictionChipActive]}
                onPress={() => toggleDietary(item.value)}>
                <Text style={[styles.restrictionChipText, isSelected && styles.restrictionChipTextActive]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Nút bấm Tạo Thực Đơn Lớn */}
      <TouchableOpacity
        style={[styles.generateButton, loading && styles.generateButtonDisabled]}
        onPress={handleGenerateMealPlan}
        disabled={loading}>
        {loading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color="#ffffff" />
            <Text style={styles.generateButtonText}>AI đang phối mâm cơm Việt & báo giá BHX...</Text>
          </View>
        ) : (
          <View style={styles.buttonInner}>
            <Ionicons name="sparkles" size={24} color="#FFD700" />
            <Text style={styles.generateButtonText}>Gợi Ý Mâm Cơm & Báo Giá BHX</Text>
            <Ionicons name="arrow-forward" size={20} color="#ffffff" />
          </View>
        )}
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </ScrollView>

    {/* Modal Chọn Số Ngày (Select Options Picker) */}
    <Modal
      visible={showDaysModal}
      transparent={true}
      animationType="fade"
      onRequestClose={() => setShowDaysModal(false)}>
      <View style={styles.modalBackdrop}>
        <TouchableOpacity
          style={styles.modalDismissArea}
          activeOpacity={1}
          onPress={() => setShowDaysModal(false)}
        />
        <View style={styles.modalSheet}>
          <View style={styles.modalHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <MaterialCommunityIcons name="calendar-multiselect" size={24} color="#008848" />
              <Text style={styles.modalTitle}>Chọn số ngày thực đơn</Text>
            </View>
            <TouchableOpacity onPress={() => setShowDaysModal(false)}>
              <Ionicons name="close-circle" size={26} color="#9E9E9E" />
            </TouchableOpacity>
          </View>

          <Text style={styles.modalSub}>
            Lựa chọn thời gian bạn muốn AI lên mâm cơm và mua sắm tiết kiệm tại Bách Hóa Xanh:
          </Text>

          <ScrollView style={styles.optionsList} bounces={false}>
            {DAY_OPTIONS.map((opt) => {
              const isSelected = daysCount === opt.value;
              return (
                <TouchableOpacity
                  key={opt.value}
                  style={[styles.optionItem, isSelected && styles.optionItemActive]}
                  activeOpacity={0.7}
                  onPress={() => {
                    setDaysCount(opt.value);
                    setShowDaysModal(false);
                  }}>
                  <View style={styles.optionRadio}>
                    <Ionicons
                      name={isSelected ? 'radio-button-on' : 'radio-button-off'}
                      size={22}
                      color={isSelected ? '#008848' : '#BDBDBD'}
                    />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={[styles.optionLabel, isSelected && styles.optionLabelActive]}>
                      {opt.label}
                    </Text>
                    <Text style={styles.optionDesc}>{opt.description}</Text>
                  </View>
                  {isSelected && (
                    <Ionicons name="checkmark-circle" size={22} color="#008848" />
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
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
  contentContainer: {
    padding: 16,
  },
  bannerCard: {
    backgroundColor: '#008848',
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    shadowColor: '#008848',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  bannerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    marginBottom: 8,
    gap: 4,
  },
  bannerBadgeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  bannerTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  bannerSubtitle: {
    color: '#E8F5E9',
    fontSize: 13,
    lineHeight: 18,
  },
  sectionCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#212121',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  budgetChip: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#F5F5F5',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#EEEEEE',
  },
  budgetChipActive: {
    backgroundColor: '#E8F5E9',
    borderColor: '#008848',
  },
  budgetChipText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#424242',
  },
  budgetChipTextActive: {
    color: '#008848',
    fontWeight: 'bold',
  },
  customBudgetToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 8,
  },
  customBudgetToggleActive: {},
  customBudgetText: {
    fontSize: 14,
    color: '#424242',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
    borderWidth: 1.5,
    borderColor: '#008848',
    borderRadius: 10,
    marginTop: 10,
    paddingHorizontal: 12,
  },
  textInput: {
    flex: 1,
    height: 44,
    fontSize: 16,
    color: '#212121',
  },
  inputSuffix: {
    fontSize: 14,
    fontWeight: '600',
    color: '#757575',
  },
  subLabel: {
    fontSize: 13,
    color: '#616161',
    fontWeight: '600',
    marginBottom: 8,
  },
  subHint: {
    fontSize: 12,
    color: '#757575',
    marginBottom: 10,
  },
  pillRow: {
    flexDirection: 'column',
    gap: 8,
  },
  pillButton: {
    backgroundColor: '#F5F5F5',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  pillButtonActive: {
    backgroundColor: '#E8F5E9',
    borderColor: '#008848',
  },
  pillButtonText: {
    fontSize: 13,
    color: '#424242',
    fontWeight: '500',
  },
  pillButtonTextActive: {
    color: '#008848',
    fontWeight: 'bold',
  },
  cookwareGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  cookwareCard: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9F9F9',
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#EEEEEE',
    gap: 8,
    position: 'relative',
  },
  cookwareCardActive: {
    backgroundColor: '#E8F5E9',
    borderColor: '#008848',
  },
  cookwareText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#616161',
    flex: 1,
  },
  cookwareTextActive: {
    color: '#008848',
    fontWeight: 'bold',
  },
  checkBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
  },
  groupSubTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#374151',
    marginBottom: 8,
  },
  dietaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  goalChip: {
    backgroundColor: '#F0FDF4',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#DCFCE7',
  },
  goalChipActive: {
    backgroundColor: '#008848',
    borderColor: '#008848',
  },
  goalChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#166534',
  },
  goalChipTextActive: {
    color: '#ffffff',
  },
  proteinChip: {
    backgroundColor: '#EFF6FF',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#DBEAFE',
  },
  proteinChipActive: {
    backgroundColor: '#1D4ED8',
    borderColor: '#1D4ED8',
  },
  proteinChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1E40AF',
  },
  proteinChipTextActive: {
    color: '#ffffff',
  },
  restrictionChip: {
    backgroundColor: '#FFF1F2',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#FFE4E6',
  },
  restrictionChipActive: {
    backgroundColor: '#E11D48',
    borderColor: '#E11D48',
  },
  restrictionChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9F1239',
  },
  restrictionChipTextActive: {
    color: '#ffffff',
  },
  generateButton: {
    backgroundColor: '#008848',
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    shadowColor: '#008848',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  generateButtonDisabled: {
    backgroundColor: '#81C784',
  },
  buttonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  generateButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  bannerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  realtimeSyncBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    gap: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  realtimeSyncBtnText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  syncStatusFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    gap: 6,
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#69F0AE',
  },
  syncStatusFooterText: {
    color: '#E8F5E9',
    fontSize: 11,
    fontWeight: '500',
  },
  selectDropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#008848',
    padding: 12,
    marginTop: 6,
  },
  selectDropdownLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  selectIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#E8F5E9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectDropdownTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#212121',
  },
  selectDropdownDesc: {
    fontSize: 11,
    color: '#757575',
    marginTop: 2,
  },
  selectDropdownRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  selectDropdownActionText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#008848',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  modalDismissArea: {
    flex: 1,
  },
  modalSheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 32,
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#212121',
  },
  modalSub: {
    fontSize: 13,
    color: '#757575',
    marginTop: 6,
    marginBottom: 14,
    lineHeight: 18,
  },
  optionsList: {
    maxHeight: 380,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#EEEEEE',
    marginBottom: 10,
    backgroundColor: '#FAFAFA',
  },
  optionItemActive: {
    borderColor: '#008848',
    backgroundColor: '#E8F5E9',
  },
  optionRadio: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#424242',
  },
  optionLabelActive: {
    color: '#008848',
    fontWeight: 'bold',
  },
  optionDesc: {
    fontSize: 12,
    color: '#757575',
    marginTop: 2,
  },
});
