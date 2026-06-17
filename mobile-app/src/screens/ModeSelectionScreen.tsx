import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
  AppHeader,
  AppScreen,
  InfoCard,
  LanguageBadge,
  PrimaryButton,
  SecondaryButton,
  SectionTitle,
  StatusBadge,
} from '../components/aslUi';
import {
  ALPHABET_PROFILE_ID,
  BOTH_HANDS_PROFILE_ID,
  CUSTOM_PROFILE_ID,
  DEFAULT_ASL_PROFILE_ID,
  DEFAULT_WS_URL,
  SUPPORTED_SPEECH_LANGUAGES,
} from '../constants/defaultProfiles';
import { aslSettingsService } from '../services/aslSettingsService';
import { profileService } from '../services/profileService';
import { colors, radius, spacing, typography } from '../styles/theme';

type Props = {
  navigation: any;
  route?: {
    params?: {
      email?: string;
    };
  };
};

type ModeChoice = 'asl' | 'custom' | 'alphabet' | 'bothHands';

const ModeSelectionScreen = ({ navigation, route }: Props) => {
  const [selectedLanguage, setSelectedLanguage] = useState('en-US');
  const [loadingMode, setLoadingMode] = useState<ModeChoice | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const email = route?.params?.email ?? 'Local user';

  const selectedLanguageInfo = SUPPORTED_SPEECH_LANGUAGES.find((language) => language.code === selectedLanguage);

  const startMode = async (mode: ModeChoice) => {
    try {
      setErrorMessage('');
      setLoadingMode(mode);
      const settings = await aslSettingsService.getSettings();
      const profileId = mode === 'asl'
        ? DEFAULT_ASL_PROFILE_ID
        : mode === 'alphabet'
          ? ALPHABET_PROFILE_ID
          : mode === 'bothHands'
            ? BOTH_HANDS_PROFILE_ID
            : CUSTOM_PROFILE_ID;
      await profileService.activateProfile(profileId);
      await aslSettingsService.saveSettings({
        ...settings,
        websocketUrl: settings.websocketUrl || DEFAULT_WS_URL,
        speechLanguageCode: selectedLanguage,
        speechVoiceId: '',
      });
      navigation.replace('WebSocketLabel');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to start the selected mode.');
    } finally {
      setLoadingMode(null);
    }
  };

  const editCustomPhrases = async () => {
    try {
      setErrorMessage('');
      setLoadingMode('custom');
      const settings = await aslSettingsService.getSettings();
      await profileService.activateProfile(CUSTOM_PROFILE_ID);
      await aslSettingsService.saveSettings({
        ...settings,
        speechLanguageCode: selectedLanguage,
        speechVoiceId: '',
      });
      navigation.navigate('PhraseEditor', { profileId: CUSTOM_PROFILE_ID, label: 'A' });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to open phrase editor.');
    } finally {
      setLoadingMode(null);
    }
  };

  return (
    <AppScreen>
      <AppHeader
        title="Choose Communication Mode"
        subtitle="Select how this user wants the glove output to be spoken."
        actionLabel="Logout"
        onAction={() => navigation.replace('Login')}
      />

      <InfoCard tone="info">
        <View style={styles.sessionRow}>
          <View>
            <Text style={styles.sessionLabel}>Signed in as</Text>
            <Text style={styles.sessionEmail}>{email}</Text>
          </View>
          <StatusBadge label="Local profile" tone="info" />
        </View>
      </InfoCard>

      <InfoCard>
        <View style={styles.languageHeader}>
          <SectionTitle
            title="Speech Language"
            subtitle="The app will speak the selected profile phrases in this language."
          />
          <LanguageBadge label={selectedLanguageInfo?.nativeName ?? selectedLanguage} />
        </View>
        <View style={styles.languageRow}>
          {SUPPORTED_SPEECH_LANGUAGES.map((language) => (
            <TouchableOpacity
              key={language.code}
              style={[styles.languageChoice, selectedLanguage === language.code && styles.activeChoice]}
              onPress={() => setSelectedLanguage(language.code)}
              activeOpacity={0.82}
            >
              <Text style={[styles.languageName, selectedLanguage === language.code && styles.activeChoiceText]}>
                {language.nativeName}
              </Text>
              <Text style={styles.languageMeta}>{language.name}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </InfoCard>

      <InfoCard tone="success">
        <View style={styles.modeHeader}>
          <View style={[styles.modeIcon, styles.customIcon]}>
            <Text style={styles.modeIconText}>ME</Text>
          </View>
          <View style={styles.modeCopy}>
            <Text style={styles.modeTitle}>My Language Mode</Text>
            <Text style={styles.modeText}>
              Uses the editable custom phrase profile so this user can speak personal phrases in the selected language.
            </Text>
          </View>
        </View>
        <View style={styles.buttonRow}>
          <SecondaryButton
            label="Edit Phrases"
            onPress={editCustomPhrases}
            disabled={loadingMode !== null}
            style={styles.rowButton}
          />
          <PrimaryButton
            label={loadingMode === 'custom' ? 'Starting...' : 'Use My Mode'}
            onPress={() => startMode('custom')}
            disabled={loadingMode !== null}
            style={styles.rowButton}
          />
        </View>
      </InfoCard>

      <InfoCard tone="warning">
        <View style={styles.modeHeader}>
          <View style={[styles.modeIcon, styles.alphabetIcon]}>
            <Text style={styles.modeIconText}>AZ</Text>
          </View>
          <View style={styles.modeCopy}>
            <Text style={styles.modeTitle}>ASL Alphabet Mode</Text>
            <Text style={styles.modeText}>
              Prepares the app for an A-Z fingerspelling model. Use this after training the alphabet model.
            </Text>
          </View>
        </View>
        <PrimaryButton
          label={loadingMode === 'alphabet' ? 'Starting...' : 'Use Alphabet Mode'}
          onPress={() => startMode('alphabet')}
          disabled={loadingMode !== null}
        />
      </InfoCard>

      <InfoCard tone="info">
        <View style={styles.modeHeader}>
          <View style={[styles.modeIcon, styles.bothHandsIcon]}>
            <Text style={styles.modeIconText}>LR</Text>
          </View>
          <View style={styles.modeCopy}>
            <Text style={styles.modeTitle}>Both Hands Alphabet Mode</Text>
            <Text style={styles.modeText}>
              Shows paired left and right hand ASL letters from the two-glove WebSocket bridge.
            </Text>
          </View>
        </View>
        <PrimaryButton
          label={loadingMode === 'bothHands' ? 'Starting...' : 'Use Both Hands Mode'}
          onPress={() => startMode('bothHands')}
          disabled={loadingMode !== null}
        />
      </InfoCard>

      {loadingMode !== null && (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.loadingText}>Saving profile and language...</Text>
        </View>
      )}

      {!!errorMessage && (
        <InfoCard tone="danger">
          <Text style={styles.errorText}>{errorMessage}</Text>
        </InfoCard>
      )}
    </AppScreen>
  );
};

const styles = StyleSheet.create({
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  sessionLabel: {
    color: colors.textMuted,
    fontSize: typography.caption,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  sessionEmail: {
    color: colors.text,
    fontSize: typography.bodyLarge,
    fontWeight: '900',
    marginTop: spacing.xxs,
  },
  languageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  languageRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  languageChoice: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    backgroundColor: colors.surface,
    minHeight: 74,
    justifyContent: 'center',
  },
  activeChoice: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  languageName: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '900',
    textAlign: 'center',
  },
  activeChoiceText: {
    color: colors.primary,
  },
  languageMeta: {
    color: colors.textMuted,
    fontSize: typography.caption,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: spacing.xxs,
  },
  modeHeader: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  modeIcon: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customIcon: {
    backgroundColor: colors.success,
  },
  alphabetIcon: {
    backgroundColor: colors.warning,
  },
  bothHandsIcon: {
    backgroundColor: colors.primary,
  },
  modeIconText: {
    color: colors.white,
    fontWeight: '900',
  },
  modeCopy: {
    flex: 1,
  },
  modeTitle: {
    color: colors.text,
    fontSize: typography.bodyLarge,
    fontWeight: '900',
  },
  modeText: {
    color: colors.textMuted,
    fontSize: typography.body,
    fontWeight: '700',
    lineHeight: 21,
    marginTop: spacing.xxs,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  rowButton: {
    flex: 1,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  loadingText: {
    color: colors.textMuted,
    fontWeight: '800',
  },
  errorText: {
    color: colors.danger,
    fontWeight: '900',
    lineHeight: 21,
  },
});

export default ModeSelectionScreen;
