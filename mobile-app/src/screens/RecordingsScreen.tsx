import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { datasetExportApi, TrainingExport } from '../api/datasetExportApi';
import { predictionApi } from '../api/predictionApi';
import { recordingApi } from '../api/recordingApi';
import { PredictionResponse, Recording } from '../types/recording';
import { colors, radius, shadow, spacing } from '../styles/theme';

type RecordingFilter = 'all' | 'hardware' | 'software';

const RecordingsScreen = ({ navigation }: any) => {
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [predictions, setPredictions] = useState<PredictionResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [exportData, setExportData] = useState<TrainingExport | null>(null);
  const [exporting, setExporting] = useState(false);
  const [filter, setFilter] = useState<RecordingFilter>('hardware');

  const fetchData = async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    setErrorMessage('');

    try {
      const [recordingData, predictionData, trainingExport] = await Promise.all([
        recordingApi.getRecordings(),
        predictionApi.getPredictions(),
        datasetExportApi.exportRecordings(),
      ]);

      setRecordings(
        recordingData.sort(
          (a: Recording, b: Recording) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )
      );
      setPredictions(predictionData);
      setExportData(trainingExport);
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

  const exportByRecording = useMemo(() => {
    const lookup = new Map<number, TrainingExport['manifest']['samples'][number]>();
    exportData?.manifest.samples.forEach((sample) => {
      lookup.set(sample.recording_id, sample);
    });
    return lookup;
  }, [exportData]);

  const isHardwareRecording = (recording: Recording) => {
    const sample = exportByRecording.get(recording.id);
    return recording.sample_rate === 8 && recording.sensor_count === 6 && !!sample?.gesture_code;
  };

  const visibleRecordings = useMemo(() => {
    return recordings
      .filter((recording) => {
        const isHardware = isHardwareRecording(recording);
        if (filter === 'hardware') return isHardware;
        if (filter === 'software') return !isHardware;
        return true;
      })
      .sort((a, b) => {
        const hardwareDelta = Number(isHardwareRecording(b)) - Number(isHardwareRecording(a));
        if (hardwareDelta !== 0) return hardwareDelta;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
  }, [exportByRecording, filter, recordings]);

  const hardwareCount = useMemo(
    () => recordings.filter((recording) => isHardwareRecording(recording)).length,
    [exportByRecording, recordings]
  );

  const softwareCount = recordings.length - hardwareCount;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const renderItem = ({ item }: { item: Recording }) => {
    const prediction = predictionByRecording.get(item.id);
    const exportSample = exportByRecording.get(item.id);
    const label = exportSample?.gesture_code;
    const rowsExported = exportSample?.rows_exported;
    const isHardwareImport = isHardwareRecording(item);

    return (
      <View style={styles.recordingCard}>
        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.recordingTitle}>Recording #{item.id}</Text>
            <Text style={styles.recordingDate}>{formatDate(item.created_at)}</Text>
          </View>
          <View style={[styles.statusBadge, label ? styles.labeledBadge : prediction ? styles.predictedBadge : styles.rawBadge]}>
            <Text style={styles.statusBadgeText}>{label || (prediction ? 'Predicted' : item.status || 'Raw')}</Text>
          </View>
        </View>

        {label && (
          <View style={styles.labelPanel}>
            <View>
              <Text style={styles.metaLabel}>Training Label</Text>
              <Text style={styles.labelValue}>{label}</Text>
            </View>
            <View style={styles.labelSide}>
              <Text style={styles.metaLabel}>Rows</Text>
              <Text style={styles.labelValue}>{rowsExported ?? '-'}</Text>
            </View>
          </View>
        )}

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
            <Text style={styles.metaLabel}>{isHardwareImport ? 'Source' : 'Rate'}</Text>
            <Text style={styles.metaValue}>{isHardwareImport ? 'Hardware serial' : item.sample_rate ? `${item.sample_rate}Hz` : '-'}</Text>
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

  const handleExport = async () => {
    setExporting(true);
    setErrorMessage('');
    try {
      const data = await datasetExportApi.exportRecordings();
      setExportData(data);
    } catch {
      setErrorMessage('Unable to export recordings.');
    } finally {
      setExporting(false);
    }
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
          data={visibleRecordings}
          style={styles.list}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderItem}
          contentContainerStyle={styles.content}
          ListHeaderComponent={
            <>
              <View style={styles.exportPanel}>
                <View style={styles.exportHeader}>
                  <View>
                    <Text style={styles.exportTitle}>Training Export</Text>
                    <Text style={styles.exportSubtitle}>Build a CSV-ready dataset from uploaded recordings.</Text>
                  </View>
                  <TouchableOpacity style={styles.exportButton} onPress={handleExport} disabled={exporting}>
                    <Text style={styles.exportButtonText}>{exporting ? 'Exporting' : 'Export'}</Text>
                  </TouchableOpacity>
                </View>
                {exportData && (
                  <View style={styles.exportSummary}>
                    <View style={styles.exportMetric}>
                      <Text style={styles.exportMetricValue}>{exportData.recording_count}</Text>
                      <Text style={styles.exportMetricLabel}>recordings</Text>
                    </View>
                    <View style={styles.exportMetric}>
                      <Text style={styles.exportMetricValue}>{exportData.row_count}</Text>
                      <Text style={styles.exportMetricLabel}>rows</Text>
                    </View>
                    <View style={styles.labelCounts}>
                      {Object.entries(exportData.label_counts).map(([label, count]) => (
                        <Text key={label} style={styles.labelCountText}>
                          {label}: {count}
                        </Text>
                      ))}
                    </View>
                  </View>
                )}
              </View>
              <View style={styles.filterPanel}>
                <Text style={styles.sectionTitle}>Uploaded Recordings</Text>
                <View style={styles.filterRow}>
                  {[
                    { key: 'hardware' as const, label: `Hardware (${hardwareCount})` },
                    { key: 'software' as const, label: `Software (${softwareCount})` },
                    { key: 'all' as const, label: `All (${recordings.length})` },
                  ].map((item) => (
                    <TouchableOpacity
                      key={item.key}
                      style={[styles.filterButton, filter === item.key && styles.filterButtonActive]}
                      onPress={() => setFilter(item.key)}
                    >
                      <Text style={[styles.filterButtonText, filter === item.key && styles.filterButtonTextActive]}>
                        {item.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </>
          }
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
              <Text style={styles.emptyText}>No recordings match the selected filter.</Text>
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
    width: '100%',
    maxWidth: 980,
    alignSelf: 'center',
  },
  list: {
    flex: 1,
  },
  exportPanel: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.lg,
    ...shadow,
  },
  exportHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
  },
  exportTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '900',
  },
  exportSubtitle: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: spacing.xs,
    maxWidth: 210,
  },
  exportButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
  },
  exportButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  exportSummary: {
    marginTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
  },
  exportMetric: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  exportMetricValue: {
    color: colors.text,
    fontWeight: '900',
    fontSize: 18,
  },
  exportMetricLabel: {
    color: colors.textMuted,
    fontWeight: '700',
  },
  labelCounts: {
    marginTop: spacing.sm,
    gap: 3,
  },
  labelCountText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '900',
    marginBottom: spacing.sm,
  },
  filterPanel: {
    marginBottom: spacing.md,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  filterButton: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  filterButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterButtonText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
  },
  filterButtonTextActive: {
    color: '#FFFFFF',
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
  labeledBadge: {
    backgroundColor: colors.primary,
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
  labelPanel: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    marginBottom: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  labelValue: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '900',
    marginTop: 2,
  },
  labelSide: {
    alignItems: 'flex-end',
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
