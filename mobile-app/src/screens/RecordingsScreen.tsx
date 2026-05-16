import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { predictionApi } from '../api/predictionApi';
import { recordingApi } from '../api/recordingApi';
import { PredictionResponse, Recording } from '../types/recording';
import { colors, radius, shadow, spacing } from '../styles/theme';

const RecordingsScreen = ({ navigation }: any) => {
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [predictions, setPredictions] = useState<PredictionResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const fetchData = async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    setErrorMessage('');

    try {
      const [recordingData, predictionData] = await Promise.all([
        recordingApi.getRecordings(),
        predictionApi.getPredictions(),
      ]);

      setRecordings(
        recordingData.sort(
          (a: Recording, b: Recording) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )
      );
      setPredictions(predictionData);
    } catch {
      setErrorMessage('Unable to load recordings.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const predictionByRecording = useMemo(() => {
    const lookup = new Map<number, PredictionResponse>();
    predictions.forEach((prediction) => {
      const match = prediction.raw_input_ref?.match(/^recording_id:(\d+)$/);
      if (match) {
        lookup.set(Number(match[1]), prediction);
      }
    });
    return lookup;
  }, [predictions]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const renderItem = ({ item }: { item: Recording }) => {
    const prediction = predictionByRecording.get(item.id);
    return (
      <View style={styles.recordingCard}>
        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.recordingTitle}>Recording #{item.id}</Text>
            <Text style={styles.recordingDate}>{formatDate(item.created_at)}</Text>
          </View>
          <View style={[styles.statusBadge, prediction ? styles.predictedBadge : styles.rawBadge]}>
            <Text style={styles.statusBadgeText}>{prediction ? 'Predicted' : item.status || 'Raw'}</Text>
          </View>
        </View>

        <View style={styles.metaGrid}>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Device</Text>
            <Text style={styles.metaValue}>#{item.device_id}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Sensors</Text>
            <Text style={styles.metaValue}>{item.sensor_count || '-'}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Rate</Text>
            <Text style={styles.metaValue}>{item.sample_rate ? `${item.sample_rate}Hz` : '-'}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Duration</Text>
            <Text style={styles.metaValue}>{item.duration_ms ? `${item.duration_ms}ms` : '-'}</Text>
          </View>
        </View>

        {prediction && (
          <View style={styles.predictionRow}>
            <Text style={styles.predictionText}>Gesture #{prediction.predicted_gesture_id}</Text>
            <Text style={styles.predictionConfidence}>{Math.round(prediction.confidence * 100)}%</Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>Dataset</Text>
          <Text style={styles.title}>Recordings</Text>
        </View>
        <TouchableOpacity style={styles.homeButton} onPress={() => navigation.navigate('Main')}>
          <Text style={styles.homeButtonText}>Home</Text>
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
          <Text style={styles.loadingText}>Loading recordings</Text>
        </View>
      ) : (
        <FlatList
          data={recordings}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderItem}
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                fetchData(false);
              }}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No Recordings</Text>
              <Text style={styles.emptyText}>Software or hardware captures will appear here.</Text>
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
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  recordingCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
    ...shadow,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  recordingTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  recordingDate: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: spacing.xs,
  },
  statusBadge: {
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  predictedBadge: {
    backgroundColor: colors.success,
  },
  rawBadge: {
    backgroundColor: colors.warning,
  },
  statusBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'capitalize',
  },
  metaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: spacing.sm,
  },
  metaItem: {
    width: '50%',
  },
  metaLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  metaValue: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
    marginTop: 2,
  },
  predictionRow: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  predictionText: {
    color: colors.text,
    fontWeight: '800',
  },
  predictionConfidence: {
    color: colors.success,
    fontWeight: '900',
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
    color: colors.textMuted,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
});

export default RecordingsScreen;
