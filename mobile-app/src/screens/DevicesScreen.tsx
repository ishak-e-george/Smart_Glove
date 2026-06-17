import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius, shadow, spacing } from '../styles/theme';

const DevicesScreen = ({ navigation }: any) => {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.title}>Smart Glove</Text>
          <Text style={styles.subtitle}>ASL recognition and speech output</Text>
        </View>
        <TouchableOpacity style={styles.logoutButton} onPress={() => navigation.replace('Login')}>
          <Text style={styles.logoutButtonText}>Logout</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.heroCard}>
          <Text style={styles.heroLabel}>Live mode</Text>
          <Text style={styles.heroTitle}>Selected ASL signs with multilingual speech output.</Text>
          <Text style={styles.heroText}>
            Select a live input below. Enable Bluetooth for on-device BLE labels, or connect to the Python WebSocket bridge.
          </Text>
        </View>

        <View style={styles.actionGrid}>
          <TouchableOpacity style={[styles.actionCard, styles.bleActionCard]} onPress={() => navigation.navigate('BleLabel')}>
            <Text style={styles.actionTitle}>📡 BLE Label Mode</Text>
            <Text style={styles.actionText}>Arduino sends predictions over BLE. Phone displays and speaks instantly.</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionCard, styles.wsActionCard]} onPress={() => navigation.navigate('WebSocketLabel')}>
            <Text style={styles.actionTitle}>WebSocket Live Mode</Text>
            <Text style={styles.actionText}>Python AI to WebSocket to phone, with default ASL and custom spoken phrase profiles.</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
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
  headerTitleContainer: {
    flex: 1,
  },
  logoutButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.danger,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
  },
  logoutButtonText: {
    color: colors.danger,
    fontWeight: '800',
  },
  scroll: {
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
    flexDirection: 'column',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  actionCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    ...shadow,
  },
  bleActionCard: {
    borderColor: colors.accent,
    backgroundColor: 'rgba(244, 63, 94, 0.08)',
  },
  wsActionCard: {
    borderColor: colors.success,
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
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
});

export default DevicesScreen;
