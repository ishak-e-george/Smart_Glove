import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { predictionApi } from '../api/predictionApi';
import { PredictionResponse } from '../types/recording';
import { colors, radius, shadow, spacing } from '../styles/theme';

const HistoryScreen = ({ navigation }: any) => {
  const [predictions, setPredictions] = useState<PredictionResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const fetchHistory = async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    setErrorMessage('');

    try {
      const data = await predictionApi.getPredictions();
      const sortedData = data.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      setPredictions(sortedData);
    } catch {
      setErrorMessage('Unable to load prediction history.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const renderItem = ({ item }: { item: PredictionResponse }) => (
    <View style={styles.historyItem}>
      <View style={styles.itemHeader}>
        <Text style={styles.gestureId}>Gesture #{item.predicted_gesture_id}</Text>
        <View style={[styles.confidenceBadge, { backgroundColor: item.confidence > 0.8 ? colors.success : colors.warning }]}>
          <Text style={styles.confidenceText}>{(item.confidence * 100).toFixed(1)}%</Text>
        </View>
      </View>
      <View style={styles.itemFooter}>
        <Text style={styles.dateText}>{formatDate(item.created_at)}</Text>
        <Text style={styles.sourceText}>{item.source_type || 'prediction'}</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>Predictions</Text>
          <Text style={styles.title}>History</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={() => navigation.navigate('Main')} style={styles.homeButton}>
            <Text style={styles.homeButtonText}>Home</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => fetchHistory()} style={styles.refreshButton}>
            <Text style={styles.refreshButtonText}>Refresh</Text>
          </TouchableOpacity>
        </View>
      </View>

      {!!errorMessage && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{errorMessage}</Text>
        </View>
      )}

      {loading ? (
        <View style={styles.loadingState}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading history</Text>
        </View>
      ) : (
        <FlatList
          data={predictions}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                fetchHistory(false);
              }}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No Predictions</Text>
              <Text style={styles.emptyText}>Completed captures will appear here.</Text>
            </View>
          }
        />
      )}
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
  refreshButton: {
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
  },
  refreshButtonText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '800',
  },
  headerActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  homeButton: {
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
  },
  homeButtonText: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '800',
  },
  errorBox: {
    margin: spacing.md,
    marginBottom: 0,
    backgroundColor: '#FEE4E2',
    borderColor: '#FDA29B',
    borderWidth: 1,
    borderRadius: radius.sm,
    padding: spacing.sm,
  },
  errorText: {
    color: colors.danger,
    fontWeight: '700',
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
  listContent: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  historyItem: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  gestureId: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
  },
  confidenceBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.sm,
  },
  confidenceText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '800',
  },
  itemFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dateText: {
    fontSize: 14,
    color: colors.textMuted,
  },
  sourceText: {
    fontSize: 14,
    color: colors.textMuted,
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
});

export default HistoryScreen;
