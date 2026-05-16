import React from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius, shadow, spacing } from '../styles/theme';

const trainedGestures = [
  {
    code: 'INDEX_BENT',
    output: 'Yes',
    samples: 100,
    status: 'Ready',
  },
  {
    code: 'MIDDLE_BENT',
    output: 'No',
    samples: 300,
    status: 'Ready',
  },
  {
    code: 'REST',
    output: 'Silent baseline',
    samples: 100,
    status: 'Ready',
  },
];

const pendingGestures = [
  {
    code: 'BOTH_BENT',
    output: 'Help',
    action: 'Collect real samples and retrain.',
  },
  {
    code: 'INDEX_HALF',
    output: 'Water',
    action: 'Collect real samples and retrain.',
  },
];

const ModelStatusScreen = ({ navigation }: any) => {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>AI Model</Text>
          <Text style={styles.title}>Training Status</Text>
        </View>
        <TouchableOpacity style={styles.homeButton} onPress={() => navigation.navigate('Main')}>
          <Text style={styles.homeButtonText}>Home</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={trainedGestures}
        keyExtractor={(item) => item.code}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Current model scope</Text>
              <Text style={styles.summaryTitle}>2-finger supervised classifier</Text>
              <Text style={styles.summaryText}>
                The app can run the complete upload, prediction, phrase, and history workflow with the trained classes below.
              </Text>
            </View>
            <Text style={styles.sectionTitle}>Ready Gestures</Text>
          </>
        }
        renderItem={({ item }) => (
          <View style={styles.gestureCard}>
            <View style={styles.gestureHeader}>
              <Text style={styles.gestureCode}>{item.code}</Text>
              <View style={styles.readyBadge}>
                <Text style={styles.readyBadgeText}>{item.status}</Text>
              </View>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Output</Text>
              <Text style={styles.metaValue}>{item.output}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Dataset rows</Text>
              <Text style={styles.metaValue}>{item.samples}</Text>
            </View>
          </View>
        )}
        ListFooterComponent={
          <>
            <Text style={styles.sectionTitle}>Pending Gestures</Text>
            {pendingGestures.map((item) => (
              <View style={styles.pendingCard} key={item.code}>
                <View style={styles.gestureHeader}>
                  <Text style={styles.gestureCode}>{item.code}</Text>
                  <View style={styles.pendingBadge}>
                    <Text style={styles.pendingBadgeText}>Pending</Text>
                  </View>
                </View>
                <View style={styles.metaRow}>
                  <Text style={styles.metaLabel}>Target output</Text>
                  <Text style={styles.metaValue}>{item.output}</Text>
                </View>
                <Text style={styles.pendingAction}>{item.action}</Text>
              </View>
            ))}
          </>
        }
      />
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
  eyebrow: {
    color: colors.primary,
    fontWeight: '800',
    fontSize: 12,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.text,
  },
  homeButton: {
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
  },
  homeButtonText: {
    color: colors.primary,
    fontWeight: '800',
  },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  summaryCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.lg,
    ...shadow,
  },
  summaryLabel: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
  },
  summaryTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '900',
    marginTop: spacing.xs,
  },
  summaryText: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    marginTop: spacing.sm,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '900',
    marginBottom: spacing.sm,
  },
  gestureCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  pendingCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  gestureHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  gestureCode: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '900',
  },
  readyBadge: {
    backgroundColor: colors.success,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  readyBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  pendingBadge: {
    backgroundColor: colors.warning,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  pendingBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  metaLabel: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
  },
  metaValue: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
  },
  pendingAction: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
    marginTop: spacing.sm,
  },
});

export default ModelStatusScreen;
