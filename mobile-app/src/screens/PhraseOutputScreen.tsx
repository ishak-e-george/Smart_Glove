import React, { useState, useEffect } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { phraseApi, Phrase } from '../api/phraseApi';
import { colors, radius, shadow, spacing } from '../styles/theme';

const PhraseOutputScreen = ({ route, navigation }: any) => {
  const { gestureId, modelLabel, confidence } = route.params;
  const [phrases, setPhrases] = useState<Phrase[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const fetchPhrases = async () => {
      try {
        const data = await phraseApi.getPhrasesByGesture(gestureId);
        setPhrases(data);
      } catch (error) {
        setErrorMessage('Unable to load phrase translations.');
      } finally {
        setLoading(false);
      }
    };

    fetchPhrases();
  }, [gestureId]);

  const renderItem = ({ item }: { item: Phrase }) => (
    <View style={styles.phraseItem}>
      <View style={styles.langBadge}>
        <Text style={styles.langText}>{item.language_code.toUpperCase()}</Text>
      </View>
      <Text style={styles.phraseText}>{item.text_value}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>Translation</Text>
        <Text style={styles.title}>Phrase Output</Text>
      </View>

      <View style={styles.content}>
        {loading ? (
          <View style={styles.loadingState}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Loading result</Text>
          </View>
        ) : (
          <>
            <View style={styles.resultCard}>
              <Text style={styles.resultLabel}>Recognized Gesture</Text>
              <Text style={styles.resultValue}>{modelLabel || `Gesture #${gestureId}`}</Text>
              {typeof confidence === 'number' && (
                <View style={styles.confidenceTrack}>
                  <View style={[styles.confidenceFill, { width: `${Math.round(confidence * 100)}%` }]} />
                </View>
              )}
              {typeof confidence === 'number' && (
                <Text style={styles.confidenceText}>{Math.round(confidence * 100)}% confidence</Text>
              )}
            </View>

            {!!errorMessage && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            )}

            <Text style={styles.sectionTitle}>Available Phrases</Text>
            <FlatList
              data={phrases}
              keyExtractor={(item) => item.id.toString()}
              renderItem={renderItem}
              contentContainerStyle={styles.listContent}
              ListEmptyComponent={
                <Text style={styles.emptyText}>No translations found for this gesture.</Text>
              }
            />
          </>
        )}
      </View>

      <TouchableOpacity 
        style={styles.doneButton}
        onPress={() => navigation.navigate('Main')}
      >
        <Text style={styles.doneButtonText}>Done</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
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
  content: {
    flex: 1,
    padding: spacing.lg,
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
  resultCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.lg,
    ...shadow,
  },
  resultLabel: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
  },
  resultValue: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '900',
    marginTop: spacing.xs,
  },
  confidenceTrack: {
    backgroundColor: colors.surfaceMuted,
    height: 8,
    borderRadius: radius.sm,
    overflow: 'hidden',
    marginTop: spacing.md,
  },
  confidenceFill: {
    backgroundColor: colors.success,
    height: 8,
  },
  confidenceText: {
    fontSize: 14,
    color: colors.textMuted,
    marginTop: spacing.sm,
    fontWeight: '700',
  },
  errorBox: {
    backgroundColor: '#FEE4E2',
    borderColor: '#FDA29B',
    borderWidth: 1,
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  errorText: {
    color: colors.danger,
    fontWeight: '700',
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
    marginBottom: spacing.sm,
  },
  listContent: {
    paddingBottom: spacing.lg,
  },
  phraseItem: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  langBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.sm,
    marginRight: spacing.md,
    width: 45,
    alignItems: 'center',
  },
  langText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  phraseText: {
    fontSize: 18,
    color: colors.text,
    flex: 1,
    fontWeight: '700',
  },
  emptyText: {
    textAlign: 'center',
    color: colors.textMuted,
    marginTop: spacing.lg,
    fontSize: 16,
  },
  doneButton: {
    margin: spacing.lg,
    padding: spacing.md,
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    alignItems: 'center',
  },
  doneButtonText: {
    color: 'white',
    fontWeight: '800',
    fontSize: 16,
  },
});

export default PhraseOutputScreen;
