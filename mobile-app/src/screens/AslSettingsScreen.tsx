import React, { useEffect, useState } from 'react';
import { StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import * as Speech from 'expo-speech';
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
import { DEFAULT_WS_URL, SUPPORTED_SPEECH_LANGUAGES } from '../constants/defaultProfiles';
import { aslSettingsService } from '../services/aslSettingsService';
import { aslSpeechService } from '../services/aslSpeechService';
import { colors, radius, spacing, typography } from '../styles/theme';

type NavigationLike = {
  goBack: () => void;
};

type Props = {
  navigation: NavigationLike;
};

function samplePhrase(languageCode: string): string {
  if (languageCode === 'ar-SA') return 'نعم';
  if (languageCode === 'fr-FR') return 'Oui';
  return 'Yes';
}

const AslSettingsScreen = ({ navigation }: Props) => {
  const [wsUrl, setWsUrl] = useState(DEFAULT_WS_URL);
  const [autoConnect, setAutoConnect] = useState(false);
  const [showRaw, setShowRaw] = useState(true);
  const [speechLanguageCode, setSpeechLanguageCode] = useState('en-US');
  const [speechVoiceId, setSpeechVoiceId] = useState('');
  const [voices, setVoices] = useState<Speech.Voice[]>([]);

  useEffect(() => {
    aslSettingsService.getSettings().then((settings) => {
      setWsUrl(settings.websocketUrl);
      setAutoConnect(settings.autoConnect);
      setShowRaw(settings.showRawMessages);
      setSpeechLanguageCode(settings.speechLanguageCode);
      setSpeechVoiceId(settings.speechVoiceId);
    });
    Speech.getAvailableVoicesAsync()
      .then(setVoices)
      .catch(() => setVoices([]));
  }, []);

  const save = async () => {
    await aslSettingsService.saveSettings({
      websocketUrl: wsUrl.trim(),
      autoConnect,
      showRawMessages: showRaw,
      speechLanguageCode,
      speechVoiceId,
    });
    navigation.goBack();
  };

  const filteredVoices = voices.filter((voice) => (
    voice.language?.toLowerCase().startsWith(speechLanguageCode.slice(0, 2).toLowerCase())
  ));

  const testSpeech = async () => {
    await aslSpeechService.speak(samplePhrase(speechLanguageCode), speechLanguageCode, speechVoiceId);
  };

  const selectedLanguage = SUPPORTED_SPEECH_LANGUAGES.find((language) => language.code === speechLanguageCode);

  return (
    <AppScreen>
      <AppHeader
        title="Settings"
        subtitle="Configure the Python bridge connection and multilingual speech output."
        actionLabel="Back"
        onAction={navigation.goBack}
      />

      <InfoCard>
        <SectionTitle title="WebSocket bridge" subtitle="The mobile app receives accepted gesture labels from Python." />
        <Text style={styles.label}>WebSocket URL</Text>
        <TextInput
          style={styles.input}
          value={wsUrl}
          onChangeText={setWsUrl}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          placeholder={DEFAULT_WS_URL}
          placeholderTextColor={colors.textMuted}
        />
        <View style={styles.helpCard}>
          <Text style={styles.helpTitle}>Connection help</Text>
          <Text style={styles.helpText}>Android emulator: ws://10.0.2.2:8765</Text>
          <Text style={styles.helpText}>Physical Android phone: use your laptop IP address on the same Wi-Fi.</Text>
        </View>
      </InfoCard>

      <InfoCard>
        <SectionTitle title="App behavior" subtitle="These settings are saved locally on the device." />
        <View style={styles.switchRow}>
          <View style={styles.switchCopy}>
            <Text style={styles.switchTitle}>Auto-connect on app start</Text>
            <Text style={styles.switchMeta}>Connect to the saved WebSocket URL automatically.</Text>
          </View>
          <Switch value={autoConnect} onValueChange={setAutoConnect} />
        </View>
        <View style={styles.switchRow}>
          <View style={styles.switchCopy}>
            <Text style={styles.switchTitle}>Show raw bridge messages</Text>
            <Text style={styles.switchMeta}>Useful while debugging the live bridge.</Text>
          </View>
          <Switch value={showRaw} onValueChange={setShowRaw} />
        </View>
      </InfoCard>

      <InfoCard>
        <View style={styles.languageHeader}>
          <SectionTitle title="Speech language" subtitle="Phrases are stored per language, not automatically translated." />
          <LanguageBadge label={selectedLanguage?.nativeName ?? speechLanguageCode} />
        </View>
        <View style={styles.languageRow}>
          {SUPPORTED_SPEECH_LANGUAGES.map((language) => (
            <SecondaryButton
              key={language.code}
              label={language.nativeName}
              onPress={() => {
                setSpeechLanguageCode(language.code);
                setSpeechVoiceId('');
              }}
              style={[styles.languageButton, speechLanguageCode === language.code && styles.activeChoice]}
            />
          ))}
        </View>

        <Text style={styles.voiceNote}>
          If a selected voice is not installed on the emulator, Android may fall back to a system default voice.
        </Text>
      </InfoCard>

      <InfoCard>
        <View style={styles.voiceHeader}>
          <SectionTitle title="Voice" subtitle="Choose a device voice when available." />
          <StatusBadge label={`${filteredVoices.length} found`} tone={filteredVoices.length > 0 ? 'success' : 'warning'} />
        </View>
        <View style={styles.voiceList}>
          <SecondaryButton
            label="System default"
            onPress={() => setSpeechVoiceId('')}
            style={[styles.voiceButton, !speechVoiceId && styles.activeChoice]}
          />
          {filteredVoices.slice(0, 5).map((voice) => (
            <SecondaryButton
              key={voice.identifier}
              label={`${voice.name} · ${voice.language}`}
              onPress={() => setSpeechVoiceId(voice.identifier)}
              style={[styles.voiceButton, speechVoiceId === voice.identifier && styles.activeChoice]}
            />
          ))}
        </View>
      </InfoCard>

      <View style={styles.actionRow}>
        <SecondaryButton label="Test Voice" onPress={testSpeech} style={styles.actionButton} />
        <PrimaryButton label="Save Settings" onPress={save} style={styles.actionButton} />
      </View>
    </AppScreen>
  );
};

const styles = StyleSheet.create({
  label: {
    color: colors.textMuted,
    fontSize: typography.caption,
    fontWeight: '900',
    textTransform: 'uppercase',
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '800',
  },
  helpCard: {
    backgroundColor: colors.infoSoft,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  helpTitle: {
    color: colors.info,
    fontWeight: '900',
    marginBottom: spacing.xs,
  },
  helpText: {
    color: colors.text,
    fontWeight: '700',
    lineHeight: 21,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  switchCopy: {
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
    lineHeight: 20,
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
  languageButton: {
    flex: 1,
  },
  activeChoice: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  voiceNote: {
    color: colors.textMuted,
    fontWeight: '700',
    lineHeight: 20,
    marginTop: spacing.md,
  },
  voiceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  voiceList: {
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  voiceButton: {
    alignItems: 'flex-start',
    paddingHorizontal: spacing.md,
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionButton: {
    flex: 1,
  },
});

export default AslSettingsScreen;
