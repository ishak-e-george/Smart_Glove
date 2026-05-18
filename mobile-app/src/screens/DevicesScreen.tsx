import React, { useState, useEffect } from 'react';
import { ActivityIndicator, FlatList, Modal, Platform, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { deviceApi, DeviceCreate } from '../api/deviceApi';
import { colors, radius, shadow, spacing } from '../styles/theme';

interface DeviceItem {
  id: number;
  device_name: string;
  serial_number: string;
  device_type: string;
}

const DevicesScreen = ({ navigation }: any) => {
  const [devices, setDevices] = useState<DeviceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<DeviceItem | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  const fetchDevices = async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    setErrorMessage('');
    try {
      const data = await deviceApi.getDevices();
      setDevices(data);
    } catch (error) {
      setErrorMessage('Unable to load devices.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDevices();
  }, []);

  const handleAddDevice = async () => {
    const newDevice: DeviceCreate = {
      device_name: `Glove ${devices.length + 1}`,
      serial_number: `SN-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
      device_type: 'smart_glove',
    };

    try {
      await deviceApi.createDevice(newDevice);
      fetchDevices();
    } catch (error) {
      setErrorMessage('Unable to register a new device.');
    }
  };

  const handleDevicePress = (item: DeviceItem) => {
    setSelectedDevice(item);
  };

  const openCapture = (routeName: 'MockCapture' | 'HardwareCapture' | 'SerialGloveDemo') => {
    if (!selectedDevice) return;
    const deviceId = selectedDevice.id;
    setSelectedDevice(null);
    navigation.navigate(routeName, { deviceId });
  };

  const isWeb = Platform.OS === 'web';

  const renderItem = ({ item }: { item: DeviceItem }) => (
    <TouchableOpacity 
      style={styles.deviceItem}
      onPress={() => handleDevicePress(item)}
    >
      <View style={styles.deviceIcon}>
        <Text style={styles.deviceIconText}>G</Text>
      </View>
      <View style={styles.deviceBody}>
        <Text style={styles.deviceName}>{item.device_name}</Text>
        <Text style={styles.deviceSerial}>{item.serial_number}</Text>
      </View>
      <Text style={styles.deviceType}>{item.device_type}</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Smart Glove</Text>
          <Text style={styles.subtitle}>{devices.length} registered device{devices.length === 1 ? '' : 's'}</Text>
        </View>
        <TouchableOpacity style={styles.addButton} onPress={handleAddDevice}>
          <Text style={styles.addButtonText}>Add Device</Text>
        </TouchableOpacity>
      </View>

      {!!errorMessage && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{errorMessage}</Text>
        </View>
      )}

      {loading ? (
        <View style={styles.loadingState}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading devices</Text>
        </View>
      ) : (
        <FlatList
          data={devices}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            <>
              <View style={styles.heroCard}>
                <Text style={styles.heroLabel}>Software pipeline</Text>
                <Text style={styles.heroTitle}>Capture, predict, translate, and improve the model.</Text>
                <Text style={styles.heroText}>
                  Start with a device below, or review model/data status from the quick actions.
                </Text>
              </View>

              <View style={styles.actionGrid}>
                <TouchableOpacity style={[styles.actionCard, styles.demoActionCard]} onPress={() => navigation.navigate('SpeechDemo')}>
                  <Text style={styles.actionTitle}>3D Speech Demo</Text>
                  <Text style={styles.actionText}>Visualize gestures and speak the translated words.</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionCard, styles.liveActionCard]}
                  onPress={() => navigation.navigate('SerialGloveDemo', { deviceId: devices[0]?.id })}
                >
                  <Text style={styles.actionTitle}>Live USB Glove</Text>
                  <Text style={styles.actionText}>Read Arduino Serial, speak detected words, and collect samples.</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionCard} onPress={() => navigation.navigate('History')}>
                  <Text style={styles.actionTitle}>History</Text>
                  <Text style={styles.actionText}>Review predictions and confidence.</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionCard} onPress={() => navigation.navigate('Recordings')}>
                  <Text style={styles.actionTitle}>Data</Text>
                  <Text style={styles.actionText}>View recordings and export training rows.</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionCard} onPress={() => navigation.navigate('ModelStatus')}>
                  <Text style={styles.actionTitle}>Model</Text>
                  <Text style={styles.actionText}>Check labels, evaluation, and pending gestures.</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Devices</Text>
                <Text style={styles.sectionMeta}>Tap a device to capture</Text>
              </View>
            </>
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                fetchDevices(false);
              }}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No Devices</Text>
              <Text style={styles.emptyText}>Register a glove to begin capturing gestures.</Text>
            </View>
          }
        />
      )}

      <Modal
        visible={!!selectedDevice}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedDevice(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modePanel}>
            <Text style={styles.modeTitle}>{selectedDevice?.device_name}</Text>
            <Text style={styles.modeSerial}>{selectedDevice?.serial_number}</Text>
            <TouchableOpacity style={styles.primaryModeButton} onPress={() => openCapture('MockCapture')}>
              <Text style={styles.modeButtonTitle}>Model Smoke Test</Text>
              <Text style={styles.modeButtonMeta}>Run prediction and phrase output with trained sample data</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.primaryModeButton} onPress={() => openCapture('SerialGloveDemo')}>
              <Text style={styles.modeButtonTitle}>Live USB Glove Demo</Text>
              <Text style={styles.modeButtonMeta}>Use Arduino Serial for visualization, speech, and sample collection</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeButton, isWeb && styles.disabledModeButton]}
              onPress={() => openCapture('HardwareCapture')}
            >
              <Text style={styles.modeButtonTitle}>Live BLE Capture</Text>
              <Text style={styles.modeButtonMeta}>{isWeb ? 'Native mobile build only' : 'Use the connected glove'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelButton} onPress={() => setSelectedDevice(null)}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.text,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: spacing.xs,
  },
  addButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
  },
  addButtonText: {
    color: 'white',
    fontWeight: '800',
  },
  errorBox: {
    margin: spacing.md,
    marginBottom: 0,
    backgroundColor: '#FEE4E2',
    borderWidth: 1,
    borderColor: '#FDA29B',
    borderRadius: radius.sm,
    padding: spacing.sm,
  },
  errorText: {
    color: colors.danger,
    fontWeight: '700',
  },
  listContent: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
    width: '100%',
    maxWidth: 980,
    alignSelf: 'center',
  },
  heroCard: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  heroLabel: {
    color: '#D7EEF4',
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '900',
    lineHeight: 30,
  },
  heroText: {
    color: '#EAF4F7',
    fontSize: 14,
    lineHeight: 20,
    marginTop: spacing.sm,
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  actionCard: {
    flexGrow: 1,
    flexBasis: 220,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    ...shadow,
  },
  demoActionCard: {
    borderColor: colors.primary,
    backgroundColor: '#EAF4F7',
  },
  liveActionCard: {
    borderColor: colors.success,
    backgroundColor: '#ECFDF3',
  },
  actionTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '900',
  },
  actionText: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
    marginTop: spacing.xs,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  sectionMeta: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
  },
  deviceItem: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow,
  },
  deviceIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  deviceIconText: {
    color: colors.primary,
    fontWeight: '900',
    fontSize: 18,
  },
  deviceBody: {
    flex: 1,
  },
  deviceName: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.text,
  },
  deviceSerial: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 4,
  },
  deviceType: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  loadingState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: colors.textMuted,
    marginTop: spacing.sm,
    fontWeight: '700',
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: spacing.xl,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  emptyText: {
    textAlign: 'center',
    color: colors.textMuted,
    marginTop: spacing.xs,
    fontSize: 14,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'flex-end',
  },
  modePanel: {
    backgroundColor: colors.surface,
    padding: spacing.lg,
    borderTopLeftRadius: radius.md,
    borderTopRightRadius: radius.md,
  },
  modeTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
  },
  modeSerial: {
    color: colors.textMuted,
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  modeButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    backgroundColor: colors.surface,
  },
  primaryModeButton: {
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    backgroundColor: colors.surfaceMuted,
  },
  disabledModeButton: {
    opacity: 0.65,
  },
  modeButtonTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  modeButtonMeta: {
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  cancelButton: {
    padding: spacing.md,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: colors.danger,
    fontWeight: '800',
  },
});

export default DevicesScreen;
