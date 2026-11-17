import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';

export const AuthModal: React.FC = () => {
  const { isAuthModalVisible, closeAuthModal, sendOtp, verifyOtp, user, isLoggedIn, logout } = useAuth();

  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [phone, setPhone] = useState<string>('');
  const [otp, setOtp] = useState<string>('');
  const [testOtp, setTestOtp] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const resetState = () => {
    setStep('phone');
    setPhone('');
    setOtp('');
    setTestOtp(null);
    setErrorMsg(null);
    setLoading(false);
  };

  const handleClose = () => {
    resetState();
    closeAuthModal();
  };

  const handleSendOtp = async () => {
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    if (cleanPhone.length < 9 || cleanPhone.length > 12) {
      setErrorMsg('Vui lòng nhập số điện thoại hợp lệ (9 - 11 chữ số)');
      return;
    }

    setErrorMsg(null);
    setLoading(true);

    const res = await sendOtp(cleanPhone);
    setLoading(false);

    if (res.success) {
      if (res.test_otp) {
        setTestOtp(res.test_otp);
      }
      setStep('otp');
    } else {
      setErrorMsg(res.message);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otp || otp.trim().length < 4) {
      setErrorMsg('Vui lòng nhập mã OTP xác thực');
      return;
    }

    setErrorMsg(null);
    setLoading(true);

    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const res = await verifyOtp(cleanPhone, otp.trim());
    setLoading(false);

    if (res.success) {
      resetState();
    } else {
      setErrorMsg(res.message);
    }
  };

  const handleLogout = async () => {
    const confirmLogout = () => {
      logout();
      handleClose();
    };

    if (Platform.OS === 'web') {
      if (window.confirm('Bạn có chắc chắn muốn đăng xuất không?')) {
        confirmLogout();
      }
    } else {
      Alert.alert('Đăng xuất', 'Bạn có chắc chắn muốn đăng xuất không?', [
        { text: 'Hủy', style: 'cancel' },
        { text: 'Đăng xuất', style: 'destructive', onPress: confirmLogout },
      ]);
    }
  };

  if (!isAuthModalVisible) return null;

  return (
    <Modal visible={isAuthModalVisible} transparent animationType="fade" onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <View style={styles.iconCircle}>
                <MaterialCommunityIcons
                  name={isLoggedIn ? 'account-check' : 'cellphone-lock'}
                  size={24}
                  color="#008848"
                />
              </View>
              <Text style={styles.title}>
                {isLoggedIn ? 'Tài Khoản Thành Viên' : 'Đăng Nhập / Đăng Ký'}
              </Text>
            </View>
            <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color="#666" />
            </TouchableOpacity>
          </View>

          {isLoggedIn ? (
            /* Khi đã đăng nhập thành công */
            <View style={styles.body}>
              <View style={styles.profileBox}>
                <Ionicons name="person-circle-outline" size={60} color="#008848" />
                <Text style={styles.profileName}>{user?.name || 'Thành viên'}</Text>
                {user?.phone ? (
                  <Text style={styles.profilePhone}>SĐT: {user.phone}</Text>
                ) : null}
                <View style={styles.badgeSuccess}>
                  <Text style={styles.badgeSuccessText}>🟢 Đã đồng bộ Tủ Lạnh & Thực Đơn</Text>
                </View>
              </View>

              <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
                <Ionicons name="log-out-outline" size={18} color="#d32f2f" />
                <Text style={styles.logoutBtnText}>Đăng xuất khỏi thiết bị này</Text>
              </TouchableOpacity>
            </View>
          ) : step === 'phone' ? (
            /* Bước 1: Nhập Số Điện Thoại */
            <View style={styles.body}>
              <Text style={styles.subText}>
                Nhập số điện thoại để lưu trữ Tủ Lạnh Ảo, lịch sử mâm cơm và đồng bộ giữa máy tính & điện thoại.
              </Text>

              {errorMsg ? <Text style={styles.errorText}>⚠️ {errorMsg}</Text> : null}

              <View style={styles.inputWrapper}>
                <MaterialCommunityIcons name="phone" size={20} color="#888" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Ví dụ: 0912 345 678"
                  placeholderTextColor="#999"
                  keyboardType="phone-pad"
                  value={phone}
                  onChangeText={(text) => {
                    setPhone(text);
                    if (errorMsg) setErrorMsg(null);
                  }}
                  autoFocus
                />
              </View>

              <TouchableOpacity
                style={[styles.primaryBtn, loading && styles.btnDisabled]}
                onPress={handleSendOtp}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Text style={styles.primaryBtnText}>Gửi mã OTP</Text>
                    <Ionicons name="arrow-forward" size={18} color="#fff" />
                  </>
                )}
              </TouchableOpacity>

              <View style={styles.guestNoteBox}>
                <Ionicons name="information-circle-outline" size={16} color="#008848" />
                <Text style={styles.guestNoteText}>
                  Bạn vẫn có thể đóng bảng này để dùng ở <Text style={{ fontWeight: 'bold' }}>Chế độ Khách</Text> mà không bắt buộc phải đăng nhập.
                </Text>
              </View>
            </View>
          ) : (
            /* Bước 2: Nhập Mã OTP */
            <View style={styles.body}>
              <Text style={styles.subText}>
                Mã xác thực đã được gửi đến số <Text style={{ fontWeight: 'bold', color: '#008848' }}>{phone}</Text>
              </Text>

              {testOtp ? (
                <TouchableOpacity
                  style={styles.testOtpBox}
                  onPress={() => setOtp(testOtp)}
                >
                  <Text style={styles.testOtpTitle}>🧪 Mã thử nghiệm (Bấm để điền nhanh):</Text>
                  <Text style={styles.testOtpCode}>{testOtp}</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.testOtpBox}>
                  <Text style={styles.testOtpTitle}>🧪 Mẹo thử nghiệm nhanh:</Text>
                  <Text style={styles.testOtpHint}>Bạn có thể nhập mã test dự phòng: <Text style={{ fontWeight: 'bold', color: '#008848' }}>123456</Text></Text>
                </View>
              )}

              {errorMsg ? <Text style={styles.errorText}>⚠️ {errorMsg}</Text> : null}

              <View style={styles.inputWrapper}>
                <MaterialCommunityIcons name="shield-key" size={20} color="#888" style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, styles.otpInput]}
                  placeholder="Nhập mã 6 chữ số"
                  placeholderTextColor="#999"
                  keyboardType="number-pad"
                  maxLength={6}
                  value={otp}
                  onChangeText={(text) => {
                    setOtp(text);
                    if (errorMsg) setErrorMsg(null);
                  }}
                  autoFocus
                />
              </View>

              <TouchableOpacity
                style={[styles.primaryBtn, loading && styles.btnDisabled]}
                onPress={handleVerifyOtp}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Text style={styles.primaryBtnText}>Xác nhận & Đăng nhập</Text>
                    <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.backBtn}
                onPress={() => {
                  setStep('phone');
                  setOtp('');
                  setErrorMsg(null);
                }}
              >
                <Ionicons name="arrow-back" size={16} color="#666" />
                <Text style={styles.backBtnText}>Đổi số điện thoại khác</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#fff',
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#e8f5e9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: '#222',
  },
  closeBtn: {
    padding: 6,
  },
  body: {
    padding: 20,
  },
  subText: {
    fontSize: 14,
    color: '#555',
    lineHeight: 20,
    marginBottom: 16,
  },
  errorText: {
    color: '#d32f2f',
    fontSize: 13,
    marginBottom: 12,
    backgroundColor: '#ffebee',
    padding: 8,
    borderRadius: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    paddingHorizontal: 14,
    marginBottom: 16,
    backgroundColor: '#fafafa',
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    height: 48,
    fontSize: 16,
    color: '#222',
  },
  otpInput: {
    letterSpacing: 4,
    fontWeight: '700',
    fontSize: 18,
  },
  primaryBtn: {
    backgroundColor: '#008848',
    height: 48,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 4,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  guestNoteBox: {
    flexDirection: 'row',
    backgroundColor: '#f1f8e9',
    padding: 12,
    borderRadius: 10,
    marginTop: 18,
    gap: 8,
    alignItems: 'center',
  },
  guestNoteText: {
    flex: 1,
    fontSize: 12.5,
    color: '#2e7d32',
    lineHeight: 18,
  },
  testOtpBox: {
    backgroundColor: '#fff9c4',
    borderWidth: 1,
    borderColor: '#fbc02d',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    alignItems: 'center',
  },
  testOtpTitle: {
    fontSize: 12,
    color: '#7f6000',
    fontWeight: '600',
  },
  testOtpCode: {
    fontSize: 22,
    fontWeight: '800',
    color: '#b78103',
    letterSpacing: 4,
    marginTop: 4,
  },
  testOtpHint: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 16,
    padding: 8,
  },
  backBtnText: {
    fontSize: 14,
    color: '#666',
  },
  profileBox: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  profileName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#222',
    marginTop: 8,
  },
  profilePhone: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  badgeSuccess: {
    backgroundColor: '#e8f5e9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 12,
  },
  badgeSuccessText: {
    color: '#2e7d32',
    fontSize: 12.5,
    fontWeight: '600',
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 24,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#ffcdd2',
    borderRadius: 10,
    backgroundColor: '#fff5f5',
  },
  logoutBtnText: {
    color: '#d32f2f',
    fontSize: 14,
    fontWeight: '600',
  },
});

