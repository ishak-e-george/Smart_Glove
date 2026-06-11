import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
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
import { DEFAULT_SPEECH_LANGUAGE, DEFAULT_WS_URL, SUPPORTED_SPEECH_LANGUAGES } from '../constants/defaultProfiles';
import { aslHistoryService } from '../services/aslHistoryService';
import { aslSettingsService } from '../services/aslSettingsService';
import { aslSpeechService } from '../services/aslSpeechService';
import { parseGestureMessage } from '../services/aslWebSocketService';
import { profileService } from '../services/profileService';
import { colors, radius, spacing, typography } from '../styles/theme';
import { DetectionEvent, GestureLabel, GesturePhraseTranslation, GestureProfile } from '../types/gesture';

type ConnState = 'disconnected' | 'connecting' | 'connected' | 'error';

type NavigationLike = {
  navigate: (screen: string, params?: Record<string, unknown>) => void;
  addListener?: (event: 'focus', callback: () => void) => () => void;
};

type Props = {
  navigation: NavigationLike;
};

function formatConfidence(confidence?: number): string {
  if (typeof confidence !== 'number') return '--';
  return `${Math.round(confidence * 100)}%`;
}

function connectionLabel(state: ConnState): string {
  if (state === 'connected') return 'Connected';
  if (state === 'connecting') return 'Connecting';
  if (state === 'error') return 'Connection Error';
  return 'Disconnected';
}

function connectionTone(state: ConnState): 'neutral' | 'success' | 'warning' | 'danger' {
  if (state === 'connected') return 'success';
  if (state === 'connecting') return 'warning';
  if (state === 'error') return 'danger';
  return 'neutral';
}

function stateTone(systemState: string): 'success' | 'warning' | 'danger' | 'info' {
  const normalized = systemState.toLowerCase();
  if (normalized.includes('ready')) return 'success';
  if (normalized.includes('rest') || normalized.includes('connecting')) return 'warning';
  if (normalized.includes('disconnect') || normalized.includes('error')) return 'danger';
  return 'info';
}

const WebSocketLabelScreen = ({ navigation }: Props) => {
  const [connState, setConnState] = useState<ConnState>('disconnected');
  const [errorMessage, setErrorMessage] = useState('');
  const [wsUrl, setWsUrl] = useState(DEFAULT_WS_URL);
  const [activeProfile, setActiveProfile] = useState<GestureProfile | null>(null);
  const [translations, setTranslations] = useState<GesturePhraseTranslation[]>([]);
  const [languageCode, setLanguageCode] = useState(DEFAULT_SPEECH_LANGUAGE);
  const [voiceId, setVoiceId] = useState('');
  const [currentLabel, setCurrentLabel] = useState<GestureLabel | null>(null);
  const [currentPhrase, setCurrentPhrase] = useState('');
  const [confidence, setConfidence] = useState<number | undefined>();
  const [systemState, setSystemState] = useState('Disconnected');
  const [history, setHistory] = useState<DetectionEvent[]>([]);
  const [muted, setMuted] = useState(aslSpeechService.isMuted());
  const [rawMessage, setRawMessage] = useState('');
  const [showRawMessages, setShowRawMessages] = useState(true);
  const [autoConnect, setAutoConnect] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);

  const refreshProfileState = useCallback(async () => {
    const [state, recent, settings] = await Promise.all([
      profileService.getState(),
      aslHistoryService.getRecent(),
      aslSettingsService.getSettings(),
    ]);
    const active = state.profiles.find((profile) => profile.isActive) ?? state.profiles[0];
    setActiveProfile(active);
    setTranslations(active ? await profileService.getTranslationsForProfileLanguage(active.id, settings.speechLanguageCode) : []);
    setHistory(recent);
    setWsUrl(settings.websocketUrl);
    setShowRawMessages(settings.showRawMessages);
    setAutoConnect(settings.autoConnect);
    setLanguageCode(settings.speechLanguageCode);
    setVoiceId(settings.speechVoiceId);
  }, []);

  useEffect(() => {
    const unsubscribe = navigation.addListener?.('focus', refreshProfileState);
    refreshProfileState();
    return unsubscribe;
  }, [navigation, refreshProfileState]);

  useEffect(() => {
    return () => {
      wsRef.current?.close();
      aslSpeechService.stop();
    };
  }, []);

  const resolvePhrase = useCallback(async (label: GestureLabel) => {
    const active = await profileService.getActiveProfile();
    const settings = await aslSettingsService.getSettings();
    const translation = await profileService.getPhraseTranslation(active.id, label, settings.speechLanguageCode);
    return { translation, settings };
  }, []);

  const handleGesture = useCallback(async (label: GestureLabel, incomingConfidence?: number, raw?: string) => {
    setRawMessage(raw ?? '');

    if (label === 'REST') {
      setCurrentLabel('REST');
      setCurrentPhrase('');
      setConfidence(incomingConfidence);
      setSystemState('Ready for next gesture');
      return;
    }

    const { translation, settings } = await resolvePhrase(label);
    setCurrentLabel(label);
    setCurrentPhrase(translation.phrase);
    setConfidence(incomingConfidence);
    setSystemState('Waiting for REST');
    setLanguageCode(settings.speechLanguageCode);
    setVoiceId(settings.speechVoiceId);

    const nextHistory = await aslHistoryService.add({
      label,
      phrase: translation.phrase,
      languageCode: settings.speechLanguageCode,
      confidence: incomingConfidence,
    });
    setHistory(nextHistory);

    const phraseSettings = await profileService.getPhraseForLabel(label);
    if (phraseSettings.speakEnabled) {
      await aslSpeechService.speak(translation.phrase, settings.speechLanguageCode, settings.speechVoiceId);
    }
  }, [resolvePhrase]);

  const connect = useCallback(async () => {
    wsRef.current?.close();
    const currentSettings = await aslSettingsService.getSettings();
    const nextUrl = wsUrl.trim();
    await aslSettingsService.saveSettings({
      websocketUrl: nextUrl,
      autoConnect: currentSettings.autoConnect,
      showRawMessages: currentSettings.showRawMessages,
      speechLanguageCode: currentSettings.speechLanguageCode,
      speechVoiceId: currentSettings.speechVoiceId,
    });
    setConnState('connecting');
    setErrorMessage('');
    setSystemState('Connecting to bridge');

    try {
      const socket = new WebSocket(nextUrl);

      socket.onopen = () => {
        setConnState('connected');
        setSystemState('Waiting for REST');
      };

      socket.onmessage = (event) => {
        const raw = String(event.data);
        const message = parseGestureMessage(raw);
        if (!message) return;
        setRawMessage(raw);

        if (message.type === 'system_state') {
          setSystemState(message.state === 'READY' ? 'Ready for next gesture' : message.state ?? 'System update');
          if (message.label === 'REST') {
            setCurrentLabel('REST');
            setCurrentPhrase('');
            setConfidence(message.confidence);
          }
          return;
        }

        if (message.label) {
          handleGesture(message.label, message.confidence, raw);
        }
      };

      socket.onerror = () => {
        setConnState('error');
        setSystemState('Connection error');
        setErrorMessage('Unable to connect to the Python WebSocket bridge.');
      };

      socket.onclose = () => {
        setConnState((previous) => (previous === 'error' ? previous : 'disconnected'));
        setSystemState('Disconnected');
        wsRef.current = null;
      };

      wsRef.current = socket;
    } catch (error: unknown) {
      setConnState('error');
      setSystemState('Connection error');
      setErrorMessage(error instanceof Error ? error.message : 'WebSocket connection failed.');
    }
  }, [handleGesture, wsUrl]);

  useEffect(() => {
    if (autoConnect && connState === 'disconnected') {
      connect();
    }
  }, [autoConnect, connState, connect]);

  const disconnect = () => {
    wsRef.current?.close();
    wsRef.current = null;
    setConnState('disconnected');
    setSystemState('Disconnected');
  };

  const toggleMute = () => {
    const next = !muted;
    aslSpeechService.setMuted(next);
    setMuted(next);
  };

  const repeatLast = () => {
    aslSpeechService.repeat(languageCode, voiceId);
  };

  const currentLanguage = SUPPORTED_SPEECH_LANGUAGES.find((language) => language.code === languageCode);
  const isArabic = languageCode.startsWith('ar');
  const phraseValue = currentPhrase || (currentLabel === 'REST' ? 'No speech for REST' : 'Waiting for accepted gesture');
  const profileMode = activeProfile?.mode === 'CUSTOM' ? 'Custom Phrase Mode' : 'Default ASL Mode';

  return (
    <AppScreen>
      <AppHeader
        title="Smart Glove"
        subtitle="ASL Gesture Recognition"
        actionLabel="Home"
        onAction={() => navigation.navigate('Main')}
      />

      <InfoCard>
        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.cardLabel}>Connection</Text>
            <Text style={styles.cardTitle}>{connectionLabel(connState)}</Text>
          </View>
          <View style={styles.statusRight}>
            <StatusBadge label={connectionLabel(connState)} tone={connectionTone(connState)} />
            {connState === 'connecting' && <ActivityIndicator color={colors.primary} />}
          </View>
        </View>
        <Text style={styles.monoText}>{wsUrl}</Text>
        <View style={styles.buttonRow}>
          {connState === 'connected' ? (
            <SecondaryButton label="Disconnect" onPress={disconnect} style={styles.flexButton} />
          ) : (
            <PrimaryButton label={connState === 'error' ? 'Reconnect' : 'Connect'} onPress={connect} style={styles.flexButton} />
          )}
          <SecondaryButton label={muted ? 'Unmute' : 'Mute'} onPress={toggleMute} style={styles.flexButton} />
        </View>
        {!!errorMessage && <Text style={styles.errorText}>{errorMessage}</Text>}
      </InfoCard>

      <InfoCard tone="primary">
        <View style={styles.profileTop}>
          <View style={styles.profileBody}>
            <Text style={styles.cardLabel}>Active profile</Text>
            <Text style={styles.cardTitle}>{activeProfile?.name ?? 'Loading profile'}</Text>
            <Text style={styles.helperText}>{profileMode}</Text>
          </View>
          <LanguageBadge label={currentLanguage?.nativeName ?? languageCode} />
        </View>
      </InfoCard>

      <InfoCard style={styles.heroCard}>
        <Text style={styles.cardLabel}>Detected Gesture</Text>
        <Text style={styles.gestureText}>{currentLabel ?? '--'}</Text>
        <View style={styles.heroMetaRow}>
          {currentLabel && <GestureBadge label={currentLabel} />}
          <StatusBadge label={`Confidence ${formatConfidence(confidence)}`} tone="info" />
        </View>
      </InfoCard>

      <InfoCard>
        <Text style={styles.cardLabel}>Spoken Phrase</Text>
        <Text style={[styles.phraseText, isArabic && styles.rtlText]}>{phraseValue}</Text>
      </InfoCard>

      <InfoCard tone={stateTone(systemState)}>
        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.cardLabel}>System state</Text>
            <Text style={styles.stateText}>{systemState}</Text>
          </View>
          <StatusBadge label={systemState} tone={stateTone(systemState)} />
        </View>
      </InfoCard>

      <View style={styles.buttonGrid}>
        <SecondaryButton label="Repeat Last Phrase" onPress={repeatLast} style={styles.gridButton} />
        <SecondaryButton label="Profiles" onPress={() => navigation.navigate('AslProfiles')} style={styles.gridButton} />
        <SecondaryButton label="History" onPress={() => navigation.navigate('AslHistory')} style={styles.gridButton} />
        <SecondaryButton label="Settings" onPress={() => navigation.navigate('AslSettings')} style={styles.gridButton} />
      </View>

      <InfoCard>
        <SectionTitle
          title="Current phrase map"
          subtitle="The app speaks the phrase for the active profile and selected language."
        />
        <View style={styles.list}>
          {translations.map((phrase) => (
            <View key={phrase.id} style={styles.mapRow}>
              <Text style={styles.mapLabel}>{phrase.label}</Text>
              <Text style={[styles.mapPhrase, phrase.languageCode.startsWith('ar') && styles.rtlInlineText]}>
                {phrase.phrase || 'No speech'}
              </Text>
            </View>
          ))}
        </View>
      </InfoCard>

      <InfoCard>
        <SectionTitle title="Recent outputs" subtitle="Latest accepted gestures from the Python bridge." />
        <View style={styles.list}>
          {history.slice(0, 4).map((event) => (
            <View key={event.id} style={styles.historyRow}>
              <View style={styles.historyText}>
                <Text style={styles.historyLabel}>{event.label}</Text>
                <Text style={styles.historyPhrase}>{event.phrase}</Text>
              </View>
              <Text style={styles.historyMeta}>{event.languageCode}</Text>
            </View>
          ))}
          {history.length === 0 && <Text style={styles.emptyText}>No accepted phrases yet.</Text>}
        </View>
      </InfoCard>

      {!!rawMessage && showRawMessages && (
        <InfoCard style={styles.debugCard}>
          <Text style={styles.debugTitle}>Last bridge message</Text>
          <Text style={styles.rawText}>{rawMessage}</Text>
        </InfoCard>
      )}
    </AppScreen>
  );
};

const styles = StyleSheet.create({
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  cardLabel: {
    color: colors.textMuted,
    fontSize: typography.caption,
    fontWeight: '900',
    letterSpacing: 0,
    textTransform: 'uppercase',
    marginBottom: spacing.xxs,
  },
  cardTitle: {
    color: colors.text,
    fontSize: typography.bodyLarge,
    fontWeight: '900',
  },
  statusRight: {
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  monoText: {
    color: colors.textMuted,
    fontWeight: '800',
    marginTop: spacing.sm,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  flexButton: {
    flex: 1,
  },
  errorText: {
    color: colors.danger,
    fontWeight: '800',
    marginTop: spacing.sm,
    lineHeight: 20,
  },
  profileTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  profileBody: {
    flex: 1,
  },
  helperText: {
    color: colors.textMuted,
    fontWeight: '700',
    marginTop: spacing.xxs,
  },
  heroCard: {
    paddingVertical: spacing.xl,
  },
  gestureText: {
    color: colors.text,
    fontSize: typography.display,
    fontWeight: '900',
    marginTop: spacing.xs,
  },
  heroMetaRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap',
    marginTop: spacing.md,
  },
  phraseText: {
    color: colors.primaryDark,
    fontSize: 28,
    lineHeight: 36,
    fontWeight: '900',
    marginTop: spacing.xs,
  },
  rtlText: {
    writingDirection: 'rtl',
    textAlign: 'right',
  },
  rtlInlineText: {
    writingDirection: 'rtl',
    textAlign: 'right',
  },
  stateText: {
    color: colors.text,
    fontSize: typography.bodyLarge,
    fontWeight: '900',
  },
  buttonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  gridButton: {
    flexGrow: 1,
    flexBasis: 150,
  },
  list: {
    marginTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  mapRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  mapLabel: {
    width: 70,
    color: colors.text,
    fontWeight: '900',
  },
  mapPhrase: {
    flex: 1,
    color: colors.textMuted,
    fontWeight: '800',
    lineHeight: 20,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  historyText: {
    flex: 1,
  },
  historyLabel: {
    color: colors.text,
    fontWeight: '900',
  },
  historyPhrase: {
    color: colors.textMuted,
    fontWeight: '700',
    marginTop: spacing.xxs,
  },
  historyMeta: {
    color: colors.info,
    fontWeight: '900',
    fontSize: typography.caption,
  },
  emptyText: {
    color: colors.textMuted,
    fontWeight: '700',
    paddingTop: spacing.md,
  },
  debugCard: {
    backgroundColor: '#1F2937',
    borderColor: '#1F2937',
  },
  debugTitle: {
    color: colors.white,
    fontWeight: '900',
    marginBottom: spacing.sm,
  },
  rawText: {
    color: '#D1D5DB',
    fontFamily: 'monospace',
    fontSize: typography.caption,
    lineHeight: 18,
  },
});

export default WebSocketLabelScreen;
