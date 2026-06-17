import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import {
  AppHeader,
  AppScreen,
  GestureBadge,
  InfoCard,
  LanguageBadge,
  PrimaryButton,
  SecondaryButton,
  SectionTitle,
  StatusBadge,
} from '../components/aslUi';
import {
  CUSTOM_TRANSLATIONS,
  DEFAULT_TRANSLATIONS,
  GESTURE_LABELS,
  SUPPORTED_SPEECH_LANGUAGES,
  WORD_GESTURE_LABELS,
  ALPHABET_TRANSLATIONS,
} from '../constants/defaultProfiles';
import { aslSettingsService } from '../services/aslSettingsService';
import { aslSpeechService } from '../services/aslSpeechService';
import { profileService } from '../services/profileService';
import { colors, radius, spacing, typography } from '../styles/theme';
import { GestureLabel, GesturePhrase, GestureProfile, WordGestureLabel, AlphabetGestureLabel } from '../types/gesture';

type NavigationLike = {
  goBack: () => void;
};

type RouteLike = {
  params?: {
    profileId?: string;
    label?: GestureLabel;
  };
};

type Props = {
  navigation: NavigationLike;
  route: RouteLike;
};

const editableLabels = GESTURE_LABELS.filter((label) => label !== 'REST') as GestureLabel[];

function toEditableLabel(label: GestureLabel): GestureLabel {
  return editableLabels.includes(label) ? label : (editableLabels[0] || 'A');
}

const PhraseEditorScreen = ({ navigation, route }: Props) => {
  const profileId = route.params?.profileId ?? '';
  const initialLabel = route.params?.label ?? 'A';
  const [profile, setProfile] = useState<GestureProfile | null>(null);
  const [phrase, setPhrase] = useState<GesturePhrase | null>(null);
  const [selectedLabel, setSelectedLabel] = useState<GestureLabel>(toEditableLabel(initialLabel));
  const [text, setText] = useState('');
  const [speakEnabled, setSpeakEnabled] = useState(true);
  const [languageCode, setLanguageCode] = useState('en-US');

  const loadPhrase = useCallback(async (nextLabel: GestureLabel, nextLanguage: string) => {
    const [state, settings] = await Promise.all([
      profileService.getState(),
      aslSettingsService.getSettings(),
    ]);
    const foundProfile = state.profiles.find((item) => item.id === profileId) ?? null;
    const foundPhrase = state.phrases.find((item) => item.profileId === profileId && item.label === nextLabel) ?? null;
    const translation = await profileService.getPhraseTranslation(profileId, nextLabel, nextLanguage || settings.speechLanguageCode);
    setProfile(foundProfile);
    setPhrase(foundPhrase);
    setLanguageCode(nextLanguage || settings.speechLanguageCode);
    setText(translation.phrase);
    setSpeakEnabled(foundPhrase?.speakEnabled ?? nextLabel !== 'REST');
  }, [profileId]);

  useEffect(() => {
    aslSettingsService.getSettings().then((settings) => {
      loadPhrase(selectedLabel, settings.speechLanguageCode);
    });
  }, [loadPhrase, selectedLabel]);

  const selectGesture = (nextLabel: GestureLabel) => {
    setSelectedLabel(nextLabel);
    loadPhrase(nextLabel, languageCode);
  };

  const selectLanguage = async (nextLanguage: string) => {
    setLanguageCode(nextLanguage);
    await loadPhrase(selectedLabel, nextLanguage);
  };

  const save = async () => {
    const cleanText = text.trim();
    await profileService.updatePhrase(profileId, selectedLabel, cleanText, speakEnabled && selectedLabel !== 'REST');
    await profileService.updatePhraseTranslation(profileId, selectedLabel, languageCode, cleanText);
    navigation.goBack();
  };

  const testSpeech = async () => {
    const settings = await aslSettingsService.getSettings();
    await aslSpeechService.speak(text.trim(), languageCode, settings.speechVoiceId);
  };

  const resetPhrase = () => {
    let resetVal = '';
    const isWordLabel = WORD_GESTURE_LABELS.includes(selectedLabel as WordGestureLabel);
    if (isWordLabel) {
      const source = profile?.mode === 'CUSTOM' ? CUSTOM_TRANSLATIONS : DEFAULT_TRANSLATIONS;
      resetVal = source[languageCode]?.[selectedLabel as WordGestureLabel] ?? DEFAULT_TRANSLATIONS['en-US'][selectedLabel as WordGestureLabel] ?? '';
    } else {
      resetVal = ALPHABET_TRANSLATIONS[languageCode]?.[selectedLabel as AlphabetGestureLabel] ?? selectedLabel;
    }
    setText(resetVal);
  };

  const locked = profile?.isLocked || selectedLabel === 'REST';
  const selectedLanguage = SUPPORTED_SPEECH_LANGUAGES.find((language) => language.code === languageCode);
  const isArabic = languageCode.startsWith('ar');

  return (
    <AppScreen>
      <AppHeader
        title="Phrase Editor"
        subtitle="Edit the spoken output for each recognized gesture and language."
        actionLabel="Cancel"
        onAction={navigation.goBack}
      />

      <InfoCard tone={profile?.isLocked ? 'info' : 'primary'}>
        <View style={styles.profileHeader}>
          <View style={styles.profileCopy}>
            <Text style={styles.cardLabel}>Selected profile</Text>
            <Text style={styles.profileName}>{profile?.name ?? 'Loading profile'}</Text>
            <Text style={styles.helperText}>
              {profile?.mode === 'CUSTOM' ? 'Custom phrases are editable.' : 'Default ASL phrases are protected.'}
            </Text>
          </View>
          {profile?.isLocked ? <StatusBadge label="Protected" tone="info" /> : <StatusBadge label="Editable" tone="success" />}
        </View>
      </InfoCard>

      <InfoCard>
        <SectionTitle title="Gesture label" subtitle="Choose the ASL label whose spoken phrase you want to edit." />
        <View style={styles.segmentRow}>
          {editableLabels.map((label) => (
            <SecondaryButton
              key={label}
              label={label}
              onPress={() => selectGesture(label)}
              style={[styles.segmentButton, selectedLabel === label && styles.activeSegmentButton]}
            />
          ))}
        </View>
        <View style={styles.selectedBadges}>
          <GestureBadge label={selectedLabel} />
          <LanguageBadge label={selectedLanguage?.nativeName ?? languageCode} />
        </View>
      </InfoCard>

      <InfoCard>
        <SectionTitle title="Speech language" subtitle="The same gesture can speak a different phrase in each language." />
        <View style={styles.languageRow}>
          {SUPPORTED_SPEECH_LANGUAGES.map((language) => (
            <SecondaryButton
              key={language.code}
              label={language.nativeName}
              onPress={() => selectLanguage(language.code)}
              style={[styles.languageButton, language.code === languageCode && styles.activeLanguageButton]}
            />
          ))}
        </View>
      </InfoCard>

      <InfoCard>
        <Text style={styles.cardLabel}>Spoken phrase</Text>
        <TextInput
          style={[styles.input, locked && styles.disabledInput, isArabic && styles.rtlInput]}
          value={text}
          onChangeText={setText}
          editable={!locked}
          multiline
          placeholder="Enter phrase"
          placeholderTextColor={colors.textMuted}
          textAlignVertical="top"
        />

        <View style={styles.switchRow}>
          <View style={styles.switchTextArea}>
            <Text style={styles.switchTitle}>Speak automatically</Text>
            <Text style={styles.switchMeta}>REST is treated as no speech.</Text>
          </View>
          <Switch value={speakEnabled && selectedLabel !== 'REST'} onValueChange={setSpeakEnabled} disabled={locked} />
        </View>

        {locked ? (
          <Text style={styles.lockedText}>Switch to a custom profile to personalize this phrase.</Text>
        ) : (
          <View style={styles.actionRow}>
            <SecondaryButton label="Reset Default" onPress={resetPhrase} style={styles.actionButton} />
            <SecondaryButton label="Test Speech" onPress={testSpeech} style={styles.actionButton} />
            <PrimaryButton label="Save Phrase" onPress={save} style={styles.actionButton} />
          </View>
        )}
      </InfoCard>

      {!!phrase && (
        <InfoCard tone="info">
          <Text style={styles.cardLabel}>Last updated</Text>
          <Text style={styles.helperText}>{new Date(phrase.updatedAt).toLocaleString()}</Text>
        </InfoCard>
      )}
    </AppScreen>
  );
};

const styles = StyleSheet.create({
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  profileCopy: {
    flex: 1,
  },
  cardLabel: {
    color: colors.textMuted,
    fontSize: typography.caption,
    fontWeight: '900',
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  profileName: {
    color: colors.text,
    fontSize: typography.title,
    fontWeight: '900',
  },
  helperText: {
    color: colors.textMuted,
    fontWeight: '700',
    lineHeight: 20,
  },
  segmentRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  segmentButton: {
    minHeight: 42,
    flexGrow: 1,
    flexBasis: 92,
  },
  activeSegmentButton: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  selectedBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  languageRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  languageButton: {
    flex: 1,
  },
  activeLanguageButton: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  input: {
    minHeight: 140,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.md,
    color: colors.text,
    fontSize: typography.bodyLarge,
    fontWeight: '800',
    lineHeight: 24,
  },
  rtlInput: {
    writingDirection: 'rtl',
    textAlign: 'right',
  },
  disabledInput: {
    backgroundColor: colors.surfaceMuted,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  switchTextArea: {
    flex: 1,
  },
  switchTitle: {
    color: colors.text,
    fontSize: typography.bodyLarge,
    fontWeight: '900',
  },
  switchMeta: {
    color: colors.textMuted,
    fontWeight: '700',
    marginTop: spacing.xxs,
  },
  lockedText: {
    color: colors.textMuted,
    fontWeight: '700',
    lineHeight: 20,
    marginTop: spacing.md,
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  actionButton: {
    flexGrow: 1,
    flexBasis: 130,
  },
});

export default PhraseEditorScreen;
