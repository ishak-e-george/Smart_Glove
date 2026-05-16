import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { modelEvaluationApi, ModelEvaluation } from '../api/modelEvaluationApi';
import { modelStatusApi, ModelStatus, ReadyLabel } from '../api/modelStatusApi';
import { colors, radius, shadow, spacing } from '../styles/theme';

const ModelStatusScreen = ({ navigation }: any) => {
  const [status, setStatus] = useState<ModelStatus | null>(null);
  const [evaluation, setEvaluation] = useState<ModelEvaluation | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  const fetchStatus = async () => {
    setLoading(true);
    setErrorMessage('');
    try {
      const [data, evaluationData] = await Promise.all([
        modelStatusApi.getStatus(),
        modelEvaluationApi.getEvaluation(),
      ]);
      setStatus(data);
      setEvaluation(evaluationData);
    } catch {
      setErrorMessage('Unable to load model status from the backend.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const readyLabels = status?.ready_labels ?? [];
  const pendingLabels = status?.pending_labels ?? [];

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

      {loading ? (
        <View style={styles.loadingState}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading model status</Text>
        </View>
      ) : (
        <FlatList
          data={readyLabels}
          keyExtractor={(item) => item.code}
          contentContainerStyle={styles.content}
          ListHeaderComponent={
            <>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryLabel}>Current model scope</Text>
                <Text style={styles.summaryTitle}>
                  {status?.trained_model.feature_set ? `${status.trained_model.feature_set}-finger supervised classifier` : 'Supervised gesture classifier'}
                </Text>
                <Text style={styles.summaryText}>
                  The app can run the complete upload, prediction, phrase, and history workflow with the trained classes below.
                </Text>
                {status?.trained_model.load_error && (
                  <Text style={styles.warningText}>
                    Model metadata is unavailable until backend ML dependencies are installed.
                  </Text>
                )}
                {!!errorMessage && <Text style={styles.errorText}>{errorMessage}</Text>}
              </View>
              <View style={styles.evaluationCard}>
                <View>
                  <Text style={styles.summaryLabel}>Model evaluation</Text>
                  <Text style={styles.evaluationTitle}>
                    {evaluation?.status === 'ready' && typeof evaluation.accuracy === 'number'
                      ? `${Math.round(evaluation.accuracy * 100)}% accuracy`
                      : 'Unavailable'}
                  </Text>
                </View>
                {evaluation?.status === 'ready' ? (
                  <>
                    <View style={styles.metaRow}>
                      <Text style={styles.metaLabel}>Test rows</Text>
                      <Text style={styles.metaValue}>{evaluation.test_rows}</Text>
                    </View>
                    <View style={styles.metaRow}>
                      <Text style={styles.metaLabel}>Labels</Text>
                      <Text style={styles.metaValue}>{evaluation.labels?.length || 0}</Text>
                    </View>
                    {!!evaluation.confusion_matrix?.length && (
                      <View style={styles.matrix}>
                        {evaluation.confusion_matrix.map((row, rowIndex) => (
                          <View key={`row-${rowIndex}`} style={styles.matrixRow}>
                            {row.map((value, colIndex) => (
                              <Text key={`${rowIndex}-${colIndex}`} style={styles.matrixCell}>
                                {value}
                              </Text>
                            ))}
                          </View>
                        ))}
                      </View>
                    )}
                  </>
                ) : (
                  <Text style={styles.warningText}>{evaluation?.reason || 'Evaluation metrics are not ready.'}</Text>
                )}
              </View>
              <Text style={styles.sectionTitle}>Ready Gestures</Text>
            </>
          }
          renderItem={({ item }: { item: ReadyLabel }) => (
            <View style={styles.gestureCard}>
              <View style={styles.gestureHeader}>
                <Text style={styles.gestureCode}>{item.code}</Text>
                <View style={styles.readyBadge}>
                  <Text style={styles.readyBadgeText}>Ready</Text>
                </View>
              </View>
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Output</Text>
                <Text style={styles.metaValue}>{item.output || 'Silent baseline'}</Text>
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
              {pendingLabels.map((item) => (
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
                  <Text style={styles.pendingAction}>{item.required_action}</Text>
                </View>
              ))}
            </>
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No Trained Labels</Text>
              <Text style={styles.summaryText}>The backend did not return trained gesture labels.</Text>
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
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
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
  evaluationCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.lg,
    ...shadow,
  },
  evaluationTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '900',
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
  },
  matrix: {
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  matrixRow: {
    flexDirection: 'row',
  },
  matrixCell: {
    flex: 1,
    textAlign: 'center',
    paddingVertical: spacing.sm,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    fontWeight: '800',
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: '700',
    marginTop: spacing.sm,
  },
  warningText: {
    color: colors.warning,
    fontSize: 13,
    fontWeight: '700',
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
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: spacing.xs,
  },
});

export default ModelStatusScreen;
