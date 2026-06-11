import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  AppHeader,
  AppScreen,
  InfoCard,
  SecondaryButton,
  SectionTitle,
  StatusBadge,
} from '../components/aslUi';
import { colors, spacing, typography } from '../styles/theme';

type NavigationLike = {
  goBack: () => void;
};

type Props = {
  navigation: NavigationLike;
};

const plannedSteps = [
  'Create a new custom gesture label.',
  'Enter the phrase the user wants to speak.',
  'Record sensor samples while holding the gesture.',
  'Save the gesture and update the recognition model.',
];

const AslTrainingScreen = ({ navigation }: Props) => {
  return (
    <AppScreen>
      <AppHeader
        title="Custom Training"
        subtitle="Future work for recording new gestures and assigning phrases."
        actionLabel="Back"
        onAction={navigation.goBack}
      />

      <InfoCard tone="primary" style={styles.hero}>
        <StatusBadge label="Future Work" tone="info" />
        <Text style={styles.heroTitle}>Custom gesture training is planned after the live ASL demo is stable.</Text>
        <Text style={styles.heroBody}>
          The current version already supports custom phrase mapping without retraining the AI model. This keeps the
          final demo reliable while still showing personalization.
        </Text>
      </InfoCard>

      <InfoCard>
        <SectionTitle
          title="Current version"
          subtitle="Recognizes selected ASL labels and lets the mobile app customize what each label speaks."
        />
        <View style={styles.currentGrid}>
          <View style={styles.currentItem}>
            <Text style={styles.currentTitle}>AI model</Text>
            <Text style={styles.currentText}>Fixed selected ASL vocabulary</Text>
          </View>
          <View style={styles.currentItem}>
            <Text style={styles.currentTitle}>Mobile app</Text>
            <Text style={styles.currentText}>Profiles, languages, speech, and history</Text>
          </View>
        </View>
      </InfoCard>

      <InfoCard tone="info">
        <SectionTitle title="Planned training flow" subtitle="A later version can add data collection and model update tools." />
        <View style={styles.steps}>
          {plannedSteps.map((step, index) => (
            <View key={step} style={styles.stepRow}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>{index + 1}</Text>
              </View>
              <Text style={styles.stepText}>{step}</Text>
            </View>
          ))}
        </View>
      </InfoCard>

      <InfoCard tone="warning">
        <SectionTitle
          title="Why it is future work"
          subtitle="Movement-based and user-defined signs need window-based recognition, new datasets, and model validation before they are safe for live speech."
        />
      </InfoCard>

      <SecondaryButton label="Back to Previous Screen" onPress={navigation.goBack} />
    </AppScreen>
  );
};

const styles = StyleSheet.create({
  hero: {
    gap: spacing.md,
  },
  heroTitle: {
    color: colors.text,
    fontSize: typography.title,
    lineHeight: 30,
    fontWeight: '900',
  },
  heroBody: {
    color: colors.textMuted,
    fontSize: typography.body,
    lineHeight: 22,
    fontWeight: '700',
  },
  currentGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  currentItem: {
    flex: 1,
    backgroundColor: colors.surfaceMuted,
    borderRadius: 12,
    padding: spacing.md,
  },
  currentTitle: {
    color: colors.text,
    fontWeight: '900',
    marginBottom: spacing.xs,
  },
  currentText: {
    color: colors.textMuted,
    fontWeight: '700',
    lineHeight: 20,
  },
  steps: {
    marginTop: spacing.md,
    gap: spacing.md,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  stepNumber: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: {
    color: colors.white,
    fontWeight: '900',
  },
  stepText: {
    flex: 1,
    color: colors.text,
    fontWeight: '800',
    lineHeight: 21,
  },
});

export default AslTrainingScreen;
