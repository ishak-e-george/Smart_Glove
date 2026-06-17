import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  AppHeader,
  AppScreen,
  EmptyState,
  InfoCard,
  LanguageBadge,
  SecondaryButton,
  SectionTitle,
  StatusBadge,
} from '../components/aslUi';
import { aslHistoryService } from '../services/aslHistoryService';
import { colors, spacing, typography } from '../styles/theme';
import { DetectionEvent } from '../types/gesture';

type NavigationLike = {
  goBack: () => void;
  addListener?: (event: 'focus', callback: () => void) => () => void;
};

type Props = {
  navigation: NavigationLike;
};

function formatTime(timestamp: string): string {
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDate(timestamp: string): string {
  return new Date(timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function formatConfidence(confidence?: number): string {
  if (typeof confidence !== 'number') return '--';
  return `${Math.round(confidence * 100)}%`;
}

const AslHistoryScreen = ({ navigation }: Props) => {
  const [events, setEvents] = useState<DetectionEvent[]>([]);

  const load = useCallback(async () => {
    setEvents(await aslHistoryService.getRecent());
  }, []);

  useEffect(() => {
    const unsubscribe = navigation.addListener?.('focus', load);
    load();
    return unsubscribe;
  }, [load, navigation]);

  const clear = async () => {
    await aslHistoryService.clear();
    setEvents([]);
  };

  return (
    <AppScreen>
      <AppHeader
        title="Gesture History"
        subtitle="Review accepted gestures, spoken phrases, languages, and confidence scores."
        actionLabel="Back"
        onAction={navigation.goBack}
      />

      <InfoCard tone="info">
        <View style={styles.summaryRow}>
          <View>
            <Text style={styles.summaryNumber}>{events.length}</Text>
            <Text style={styles.summaryLabel}>Saved outputs</Text>
          </View>
          <StatusBadge label="Activity Log" tone="info" />
        </View>
      </InfoCard>

      {events.length === 0 ? (
        <EmptyState title="No gesture history yet" message="Accepted gestures from the live dashboard will appear here." />
      ) : (
        <InfoCard>
          <SectionTitle title="Recent detections" subtitle="Newest accepted events appear first." />
          <View style={styles.list}>
            {events.map((event) => (
              <View key={event.id} style={styles.historyCard}>
                <View style={styles.timeColumn}>
                  <Text style={styles.time}>{formatTime(event.timestamp)}</Text>
                  <Text style={styles.date}>{formatDate(event.timestamp)}</Text>
                </View>
                <View style={styles.eventBody}>
                  <View style={styles.badgeRow}>
                    <StatusBadge label={event.label} tone="success" />
                    <LanguageBadge label={event.languageCode} />
                    <StatusBadge label={formatConfidence(event.confidence)} tone="success" />
                  </View>
                  <Text style={[styles.phrase, event.languageCode.startsWith('ar') && styles.rtlText]}>{event.phrase}</Text>
                </View>
              </View>
            ))}
          </View>
          <SecondaryButton label="Clear History" onPress={clear} style={styles.clearButton} />
        </InfoCard>
      )}
    </AppScreen>
  );
};

const styles = StyleSheet.create({
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  summaryNumber: {
    color: colors.text,
    fontSize: 36,
    fontWeight: '900',
  },
  summaryLabel: {
    color: colors.textMuted,
    fontWeight: '800',
  },
  list: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  historyCard: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  timeColumn: {
    width: 72,
  },
  time: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '900',
  },
  date: {
    color: colors.textMuted,
    fontSize: typography.caption,
    fontWeight: '700',
    marginTop: spacing.xxs,
  },
  eventBody: {
    flex: 1,
    gap: spacing.sm,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  phrase: {
    color: colors.text,
    fontSize: typography.bodyLarge,
    fontWeight: '800',
    lineHeight: 24,
  },
  rtlText: {
    writingDirection: 'rtl',
    textAlign: 'right',
  },
  clearButton: {
    marginTop: spacing.md,
    borderColor: colors.danger,
  },
});

export default AslHistoryScreen;
