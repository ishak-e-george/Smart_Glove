import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  AppHeader,
  AppScreen,
  InfoCard,
  PrimaryButton,
  SecondaryButton,
  SectionTitle,
  StatusBadge,
} from '../components/aslUi';
import { GESTURE_LABELS, SUPPORTED_SPEECH_LANGUAGES } from '../constants/defaultProfiles';
import { aslSettingsService } from '../services/aslSettingsService';
import { profileService } from '../services/profileService';
import { colors, spacing, typography } from '../styles/theme';
import { GesturePhrase, GesturePhraseTranslation, GestureProfile } from '../types/gesture';

type NavigationLike = {
  goBack: () => void;
  navigate: (screen: string, params?: Record<string, unknown>) => void;
  addListener?: (event: 'focus', callback: () => void) => () => void;
};

type Props = {
  navigation: NavigationLike;
};

const AslProfilesScreen = ({ navigation }: Props) => {
  const [profiles, setProfiles] = useState<GestureProfile[]>([]);
  const [phrases, setPhrases] = useState<GesturePhrase[]>([]);
  const [translations, setTranslations] = useState<GesturePhraseTranslation[]>([]);
  const [languageCode, setLanguageCode] = useState('en-US');

  const load = useCallback(async () => {
    const [state, settings] = await Promise.all([
      profileService.getState(),
      aslSettingsService.getSettings(),
    ]);
    setProfiles(state.profiles);
    setPhrases(state.phrases);
    setLanguageCode(settings.speechLanguageCode);
    const allTranslations = await Promise.all(
      state.profiles.map((profile) => profileService.getTranslationsForProfileLanguage(profile.id, settings.speechLanguageCode)),
    );
    setTranslations(allTranslations.flat());
  }, []);

  useEffect(() => {
    const unsubscribe = navigation.addListener?.('focus', load);
    load();
    return unsubscribe;
  }, [load, navigation]);

  const activate = async (profileId: string) => {
    const state = await profileService.activateProfile(profileId);
    setProfiles(state.profiles);
    setPhrases(state.phrases);
  };

  const resetProfiles = async () => {
    const state = await profileService.reset();
    setProfiles(state.profiles);
    setPhrases(state.phrases);
    await load();
  };

  const currentLanguage = SUPPORTED_SPEECH_LANGUAGES.find((language) => language.code === languageCode);

  return (
    <AppScreen>
      <AppHeader
        title="Phrase Profiles"
        subtitle="Choose how recognized ASL labels are converted into spoken phrases."
        actionLabel="Back"
        onAction={navigation.goBack}
      />

      <InfoCard tone="info">
        <SectionTitle
          title="Profile modes"
          subtitle="Default ASL keeps the selected ASL vocabulary protected. Custom Phrase Mode lets the user personalize speech without retraining the AI model."
        />
      </InfoCard>

      {profiles.map((profile) => {
        const profilePhrases = phrases.filter((phrase) => phrase.profileId === profile.id);
        const profileTranslations = translations.filter((phrase) => phrase.profileId === profile.id);
        const modeText = profile.mode === 'CUSTOM' ? 'Custom Phrase Mode' : 'Default ASL Mode';

        return (
          <InfoCard key={profile.id} tone={profile.isActive ? 'success' : 'default'} style={styles.profileCard}>
            <View style={styles.profileHeader}>
              <View style={styles.profileTitleArea}>
                <Text style={styles.profileName}>{profile.name}</Text>
                <Text style={styles.profileMeta}>{modeText} · {currentLanguage?.nativeName ?? languageCode}</Text>
              </View>
              <View style={styles.badgeColumn}>
                {profile.isActive && <StatusBadge label="Active" tone="success" />}
                {profile.isLocked && <StatusBadge label="Protected" tone="info" />}
              </View>
            </View>

            <View style={styles.phraseList}>
              {GESTURE_LABELS.map((label) => {
                const phrase = profileTranslations.find((item) => item.label === label)
                  ?? profilePhrases.find((item) => item.label === label);
                const canEdit = !profile.isLocked && label !== 'REST';
                return (
                  <View key={label} style={styles.phraseRow}>
                    <View style={styles.phraseTextArea}>
                      <Text style={styles.phraseLabel}>{label}</Text>
                      <Text style={[styles.phraseText, languageCode.startsWith('ar') && styles.rtlText]}>
                        {phrase?.phrase || 'No speech'}
                      </Text>
                    </View>
                    {canEdit && (
                      <SecondaryButton
                        label="Edit"
                        onPress={() => navigation.navigate('PhraseEditor', { profileId: profile.id, label })}
                        style={styles.editButton}
                      />
                    )}
                  </View>
                );
              })}
            </View>

            <View style={styles.actions}>
              <PrimaryButton
                label={profile.isActive ? 'Selected Profile' : 'Use This Profile'}
                disabled={profile.isActive}
                onPress={() => activate(profile.id)}
                style={styles.actionButton}
              />
              {!profile.isLocked && (
                <SecondaryButton
                  label="Edit Phrases"
                  onPress={() => navigation.navigate('PhraseEditor', { profileId: profile.id, label: 'FEEL' })}
                  style={styles.actionButton}
                />
              )}
            </View>
          </InfoCard>
        );
      })}

      <InfoCard tone="warning">
        <SectionTitle
          title="Reset defaults"
          subtitle="Restores the built-in English, Arabic, and French phrase mappings for the default and custom profiles."
        />
        <SecondaryButton label="Reset Profiles" onPress={resetProfiles} style={styles.resetButton} />
      </InfoCard>
    </AppScreen>
  );
};

const styles = StyleSheet.create({
  profileCard: {
    gap: spacing.md,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  profileTitleArea: {
    flex: 1,
  },
  profileName: {
    color: colors.text,
    fontSize: typography.title,
    fontWeight: '900',
  },
  profileMeta: {
    color: colors.textMuted,
    fontWeight: '700',
    marginTop: spacing.xxs,
  },
  badgeColumn: {
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  phraseList: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  phraseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  phraseTextArea: {
    flex: 1,
  },
  phraseLabel: {
    color: colors.text,
    fontWeight: '900',
    marginBottom: spacing.xxs,
  },
  phraseText: {
    color: colors.textMuted,
    fontWeight: '700',
    lineHeight: 20,
  },
  rtlText: {
    writingDirection: 'rtl',
    textAlign: 'right',
  },
  editButton: {
    minHeight: 40,
    paddingHorizontal: spacing.md,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionButton: {
    flex: 1,
  },
  resetButton: {
    marginTop: spacing.md,
    borderColor: colors.warning,
  },
});

export default AslProfilesScreen;
