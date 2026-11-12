import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Platform,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import {
  getEffectiveApiUrl,
  setCustomApiUrl,
  resetToDefaultApiUrl,
  testConnection,
  DEFAULT_LAN_IP,
} from '../services/api';
import { useMealPlan } from '../context/MealPlanContext';

interface ServerSettingsModalProps {
  visible: boolean;
  onClose: () => void;
}

export const ServerSettingsModal: React.FC<ServerSettingsModalProps> = ({ visible, onClose }) => {
  const { serverStatus, serverLatency, refreshServerStatus } = useMealPlan();

  const [inputUrl, setInputUrl] = useState<string>('');
  const [testing, setTesting] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string; latencyMs?: number } | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  useEffect(() => {
    if (visible) {
      setInputUrl(getEffectiveApiUrl());
      setTestResult(null);
      setSaveSuccess(false);
    }
  }, [visible]);

  const handleTest = async (urlToTest?: string) => {
    const target = urlToTest || inputUrl;
    if (!target.trim()) return;
    setTesting(true);
    setTestResult(null);
    setSaveSuccess(false);

    const res = await testConnection(target);
    setTestResult(res);
    setTesting(false);
  };

  const handleSave = async () => {
    if (!inputUrl.trim()) return;
    try {
      const finalUrl = await setCustomApiUrl(inputUrl);
      setInputUrl(finalUrl);
      setSaveSuccess(true);
      await refreshServerStatus();
      setTimeout(() => {
        onClose();
      }, 700);
    } catch (err: any) {
      setTestResult({ ok: false, message: 'Lỗi khi lưu: ' + (err.message || 'Lỗi không xác định') });
    }
  };

  const handleReset = async () => {
    const defUrl = await resetToDefaultApiUrl();
    setInputUrl(defUrl);
    setTestResult(null);
    setSaveSuccess(true);
    await refreshServerStatus();
  };

  const selectPreset = (presetUrl: string) => {
    setInputUrl(presetUrl);
    handleTest(presetUrl);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <MaterialCommunityIcons name="server-network" size={24} color="#008848" />
              <Text style={styles.headerTitle}>Cấu Hình Máy Chủ API</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={24} color="#555" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
            {/* Status Card */}
            <View style={[
              styles.statusCard,
              serverStatus === 'connected' ? styles.statusCardConnected : styles.statusCardDisconnected
            ]}>
              <View style={styles.statusDotRow}>
                <View style={[
                  styles.dot,
                  serverStatus === 'connected' ? styles.dotGreen : styles.dotRed
                ]} />
                <Text style={styles.statusText}>
                  {serverStatus === 'connected'
                    ? `Đang kết nối (${serverLatency}ms)`
                    : serverStatus === 'checking'
                    ? 'Đang kiểm tra kết nối...'
                    : 'Chưa kết nối máy chủ'}
                </Text>
              </View>
              <Text style={styles.currentUrlLabel} numberOfLines={1}>
                {getEffectiveApiUrl()}
              </Text>
            </View>

            {/* Input URL */}
            <Text style={styles.sectionLabel}>Địa chỉ API Backend (Laravel):</Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                value={inputUrl}
                onChangeText={(text) => {
                  setInputUrl(text);
                  setSaveSuccess(false);
                }}
                placeholder="VD: http://172.16.10.2:8000/api"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
              />
              {inputUrl.length > 0 && (
                <TouchableOpacity onPress={() => setInputUrl('')} style={styles.clearBtn}>
                  <Ionicons name="close-circle" size={18} color="#999" />
                </TouchableOpacity>
              )}
            </View>

            {/* Quick Presets */}
            <Text style={styles.presetLabel}>Gợi ý nhanh:</Text>
            <View style={styles.presetRow}>
              <TouchableOpacity
                style={styles.presetChip}
                onPress={() => selectPreset(`http://${DEFAULT_LAN_IP}:8000/api`)}>
                <Ionicons name="wifi-outline" size={14} color="#008848" />
                <Text style={styles.presetChipText}>LAN Wi-Fi ({DEFAULT_LAN_IP})</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.presetChip}
                onPress={() => selectPreset('http://10.0.2.2:8000/api')}>
                <Ionicons name="phone-portrait-outline" size={14} color="#008848" />
                <Text style={styles.presetChipText}>Android Emulator (10.0.2.2)</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.presetChip}
                onPress={() => selectPreset('http://localhost:8000/api')}>
                <Ionicons name="globe-outline" size={14} color="#008848" />
                <Text style={styles.presetChipText}>Localhost (Web)</Text>
              </TouchableOpacity>
            </View>

            {/* Test connection report */}
            {testResult && (
              <View style={[styles.resultBox, testResult.ok ? styles.resultBoxSuccess : styles.resultBoxError]}>
                <Ionicons
                  name={testResult.ok ? 'checkmark-circle' : 'alert-circle'}
                  size={20}
                  color={testResult.ok ? '#2e7d32' : '#c62828'}
                />
                <Text style={[styles.resultText, testResult.ok ? styles.resultTextSuccess : styles.resultTextError]}>
                  {testResult.message}
                </Text>
              </View>
            )}

            {saveSuccess && (
              <View style={[styles.resultBox, styles.resultBoxSuccess]}>
                <Ionicons name="checkmark-circle" size={20} color="#2e7d32" />
                <Text style={[styles.resultText, styles.resultTextSuccess]}>
                  Đã lưu cấu hình máy chủ thành công!
                </Text>
              </View>
            )}

            {/* Action buttons */}
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[styles.btn, styles.btnTest]}
                onPress={() => handleTest()}
                disabled={testing}>
                {testing ? (
                  <ActivityIndicator size="small" color="#008848" />
                ) : (
                  <>
                    <Ionicons name="flash-outline" size={18} color="#008848" />
                    <Text style={styles.btnTestText}>Kiểm tra</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.btn, styles.btnSave]}
                onPress={handleSave}
                disabled={testing}>
                <Ionicons name="save-outline" size={18} color="#ffffff" />
                <Text style={styles.btnSaveText}>Lưu Cài Đặt</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.btnReset} onPress={handleReset}>
              <Text style={styles.btnResetText}>Khôi phục mặc định</Text>
            </TouchableOpacity>

            {/* Hint Notice */}
            <View style={styles.tipCard}>
              <Ionicons name="information-circle-outline" size={18} color="#0288d1" />
              <Text style={styles.tipText}>
                Mẹo khi dùng app trên điện thoại thật: Hãy đảm bảo điện thoại và máy tính kết nối cùng mạng Wi-Fi và backend Laravel đang chạy lệnh:
                {"\n"}
                <Text style={{ fontWeight: '700', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' }}>
                  php artisan serve --host=0.0.0.0 --port=8000
                </Text>
              </Text>
            </View>
          </ScrollView>
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
    backgroundColor: '#ffffff',
    borderRadius: 18,
    width: '100%',
    maxWidth: 480,
    maxHeight: '90%',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    backgroundColor: '#fafafa',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#212121',
  },
  closeBtn: {
    padding: 4,
  },
  content: {
    padding: 20,
  },
  statusCard: {
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
  },
  statusCardConnected: {
    backgroundColor: '#e8f5e9',
    borderColor: '#c8e6c9',
  },
  statusCardDisconnected: {
    backgroundColor: '#ffebee',
    borderColor: '#ffcdd2',
  },
  statusDotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  dotGreen: {
    backgroundColor: '#2e7d32',
  },
  dotRed: {
    backgroundColor: '#c62828',
  },
  statusText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#333',
  },
  currentUrlLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#424242',
    marginBottom: 6,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d0d0d0',
    borderRadius: 10,
    backgroundColor: '#f9f9f9',
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  input: {
    flex: 1,
    height: 44,
    fontSize: 14,
    color: '#212121',
  },
  clearBtn: {
    padding: 4,
  },
  presetLabel: {
    fontSize: 12,
    color: '#757575',
    marginBottom: 6,
  },
  presetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  presetChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#eef8f2',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#c2e6d2',
  },
  presetChipText: {
    fontSize: 12,
    color: '#008848',
    fontWeight: '500',
  },
  resultBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 8,
    marginBottom: 14,
  },
  resultBoxSuccess: {
    backgroundColor: '#e8f5e9',
  },
  resultBoxError: {
    backgroundColor: '#ffebee',
  },
  resultText: {
    fontSize: 13,
    flex: 1,
  },
  resultTextSuccess: {
    color: '#2e7d32',
  },
  resultTextError: {
    color: '#c62828',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
    marginBottom: 12,
  },
  btn: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  btnTest: {
    backgroundColor: '#eef8f2',
    borderWidth: 1,
    borderColor: '#008848',
  },
  btnTestText: {
    color: '#008848',
    fontWeight: '600',
    fontSize: 14,
  },
  btnSave: {
    backgroundColor: '#008848',
  },
  btnSaveText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 14,
  },
  btnReset: {
    alignItems: 'center',
    paddingVertical: 8,
    marginBottom: 12,
  },
  btnResetText: {
    fontSize: 13,
    color: '#757575',
    textDecorationLine: 'underline',
  },
  tipCard: {
    flexDirection: 'row',
    backgroundColor: '#e1f5fe',
    borderRadius: 10,
    padding: 12,
    gap: 10,
    marginBottom: 16,
  },
  tipText: {
    flex: 1,
    fontSize: 12,
    color: '#01579b',
    lineHeight: 18,
  },
});

