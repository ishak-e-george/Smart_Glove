/**
 * BleLabelScreen.tsx
 *
 * Final BLE label flow:
 *   Arduino (on-device AI)  →  BLE label packet  →  Phone displays + speaks
 *
 * Packet format:  "HELLO|Hello|0.89|78,0,7,100,20"
 *   Field 0: gesture code  (HELLO)
 *   Field 1: human phrase  (Hello)
 *   Field 2: confidence    (0.89)
 *   Field 3: finger values (78,0,7,100,20)
 *
 * This screen consumes final gesture labels from the Arduino BLE service.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ActivityIndicator,
  Animated,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Speech from 'expo-speech';
import {
  scanForLabelGlove,
  stopLabelScan,
  connectToLabelGlove,
  startLabelStream,
  stopLabelStream,
  disconnectLabelGlove,
  GloveLabel,
} from '../services/bleLabelService';
import type { Device } from 'react-native-ble-plx';
import { colors, radius, shadow, spacing } from '../styles/theme';
import { profileService } from '../services/profileService';
import { aslSettingsService } from '../services/aslSettingsService';
import { aslSpeechService } from '../services/aslSpeechService';
import { aslHistoryService } from '../services/aslHistoryService';
import { GestureLabel } from '../types/gesture';

// ── Types ─────────────────────────────────────────────────────────────────────

type Phase = 'idle' | 'scanning' | 'connecting' | 'connected' | 'error';

// ── Helpers ───────────────────────────────────────────────────────────────────

function confidenceColor(c: number): string {
  if (c >= 0.85) return colors.success;
  if (c >= 0.65) return colors.warning;
  return colors.danger;
}

function FingerBar({ value, label }: { value: number; label: string }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <View style={fingerStyles.row}>
      <Text style={fingerStyles.label}>{label}</Text>
      <View style={fingerStyles.track}>
        <View style={[fingerStyles.fill, { width: `${pct}%` as any }]} />
      </View>
      <Text style={fingerStyles.value}>{value}%</Text>
    </View>
  );
}

const FINGER_NAMES = ['Thumb', 'Index', 'Middle', 'Ring', 'Pinky'];

// ── Main screen ───────────────────────────────────────────────────────────────

const BleLabelScreen = ({ navigation }: any) => {
  const [phase, setPhase]                     = useState<Phase>('idle');
  const [errorMsg, setErrorMsg]               = useState('');
  const [connectedDevice, setConnectedDevice] = useState<Device | null>(null);
  const [currentLabel, setCurrentLabel]       = useState<GloveLabel | null>(null);
  const [history, setHistory]                 = useState<GloveLabel[]>([]);
  const [isSpeaking, setIsSpeaking]           = useState(false);

  // Pulse animation for the "connected" indicator dot
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (phase === 'connected') {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.4, duration: 700, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1,   duration: 700, useNativeDriver: true }),
        ])
      );
      loop.start();
      return () => loop.stop();
    }
  }, [phase]);

  // Word-pop animation when a new label arrives
  const wordScale = useRef(new Animated.Value(1)).current;
  const triggerWordPop = useCallback(() => {
    wordScale.setValue(0.75);
    Animated.spring(wordScale, {
      toValue: 1,
      friction: 4,
      tension: 120,
      useNativeDriver: true,
    }).start();
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopLabelScan();
      stopLabelStream();
      disconnectLabelGlove().catch(() => {});
      Speech.stop();
    };
  }, []);

  // ── BLE handlers ──────────────────────────────────────────────────────────

  const handleScan = () => {
    setPhase('scanning');
    setErrorMsg('');

    scanForLabelGlove(
      async (device) => {
        setPhase('connecting');
        try {
          const connected = await connectToLabelGlove(device);
          setConnectedDevice(connected);
          setPhase('connected');
          beginListening();
        } catch (err: any) {
          setPhase('error');
          setErrorMsg(err.message ?? 'Connection failed.');
        }
      },
      (msg) => {
        setPhase('error');
        setErrorMsg(msg);
      }
    );
  };

  const speakLabel = useCallback(async (phrase: string) => {
    try {
      const settings = await aslSettingsService.getSettings();
      setIsSpeaking(true);
      await aslSpeechService.speak(phrase, settings.speechLanguageCode, settings.speechVoiceId);
    } catch (err) {
      console.warn('speakLabel failed:', err);
    } finally {
      setTimeout(() => setIsSpeaking(false), 1200);
    }
  }, []);

  const beginListening = () => {
    startLabelStream(
      async (label) => {
        try {
          const active = await profileService.getActiveProfile();
          const settings = await aslSettingsService.getSettings();
          const translation = await profileService.getPhraseTranslation(
            active.id,
            label.label as GestureLabel,
            settings.speechLanguageCode
          );

          const phraseToUse = translation.phrase || label.phrase;

          // Check if this label has speakEnabled
          const phraseSettings = await profileService.getPhraseForLabel(label.label as GestureLabel);

          const updatedLabel: GloveLabel = {
            ...label,
            phrase: phraseToUse,
          };

          setCurrentLabel(updatedLabel);
          setHistory((prev) => [updatedLabel, ...prev].slice(0, 20));
          triggerWordPop();

          if (phraseSettings.speakEnabled) {
            await speakLabel(phraseToUse);
          }

          // Save to global detection history
          await aslHistoryService.add({
            label: label.label,
            phrase: phraseToUse,
            languageCode: settings.speechLanguageCode,
            confidence: label.confidence,
          });
        } catch (err) {
          console.warn('Error resolving BLE label translation:', err);
          setCurrentLabel(label);
          setHistory((prev) => [label, ...prev].slice(0, 20));
          triggerWordPop();
          await speakLabel(label.phrase);
        }
      },
      (msg) => {
        setErrorMsg(msg);
      }
    );
  };

  const handleDisconnect = async () => {
    stopLabelStream();
    await disconnectLabelGlove();
    setConnectedDevice(null);
    setCurrentLabel(null);
    setPhase('idle');
    setErrorMsg('');
    aslSpeechService.stop();
  };

  const handleRepeat = () => {
    if (currentLabel) {
      speakLabel(currentLabel.phrase);
    }
  };

  // ── Status label/color ────────────────────────────────────────────────────

  const statusText = {
    idle:       'Ready to scan',
    scanning:   'Scanning for SmartGlove…',
    connecting: 'Connecting…',
    connected:  'Connected — listening',
    error:      'Error',
  }[phase];

  const statusColor = phase === 'connected' ? colors.success
    : phase === 'error' ? colors.danger
    : colors.textMuted;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>BLE Label Mode</Text>
          <Text style={styles.title}>Smart Glove</Text>
        </View>
        <TouchableOpacity style={styles.homeBtn} onPress={() => navigation.navigate('Main')}>
          <Text style={styles.homeBtnText}>Home</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Status card */}
        <View style={styles.statusCard}>
          <Animated.View style={[styles.statusDot, { backgroundColor: statusColor, transform: [{ scale: phase === 'connected' ? pulseAnim : 1 }] }]} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.statusText, { color: statusColor }]}>{statusText}</Text>
            {connectedDevice && (
              <Text style={styles.deviceName}>{connectedDevice.name ?? 'SmartGlove'}</Text>
            )}
          </View>
          {isSpeaking && <ActivityIndicator size="small" color={colors.primary} style={{ marginLeft: spacing.sm }} />}
        </View>

        {/* Error banner */}
        {!!errorMsg && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>⚠ {errorMsg}</Text>
          </View>
        )}

        {/* Big phrase display */}
        {currentLabel ? (
          <Animated.View style={[styles.phraseCard, { transform: [{ scale: wordScale }] }]}>
            <Text style={styles.phraseLabel}>DETECTED GESTURE</Text>
            <Text style={styles.phraseWord}>{currentLabel.phrase}</Text>
            <Text style={styles.phraseCode}>{currentLabel.label}</Text>
            <View style={styles.confidenceRow}>
              <Text style={styles.confidenceLabel}>Confidence</Text>
              <Text style={[styles.confidenceValue, { color: confidenceColor(currentLabel.confidence) }]}>
                {(currentLabel.confidence * 100).toFixed(0)}%
              </Text>
            </View>

            {currentLabel.fingers.length > 0 && (
              <View style={styles.fingersSection}>
                <Text style={styles.fingersTitle}>Finger Bend</Text>
                {currentLabel.fingers.map((v, i) => (
                  <FingerBar key={i} value={v} label={FINGER_NAMES[i] ?? `F${i + 1}`} />
                ))}
              </View>
            )}

            <TouchableOpacity style={styles.repeatBtn} onPress={handleRepeat}>
              <Text style={styles.repeatBtnText}>🔊 Speak Again</Text>
            </TouchableOpacity>
          </Animated.View>
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>🧤</Text>
            <Text style={styles.emptyTitle}>
              {phase === 'connected' ? 'Waiting for gesture…' : 'No prediction yet'}
            </Text>
            <Text style={styles.emptyText}>
              {phase === 'connected'
                ? 'Move your glove — Arduino will send a label over BLE'
                : 'Connect the glove first'}
            </Text>
          </View>
        )}

        {/* Action buttons */}
        <View style={styles.actions}>
          {phase !== 'connected' ? (
            <TouchableOpacity
              style={[styles.primaryBtn, (phase === 'scanning' || phase === 'connecting') && styles.btnDisabled]}
              onPress={handleScan}
              disabled={phase === 'scanning' || phase === 'connecting'}
            >
              {(phase === 'scanning' || phase === 'connecting') ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={styles.primaryBtnText}>
                  {phase === 'error' ? '🔄 Retry Scan' : '🔍 Scan for Glove'}
                </Text>
              )}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.disconnectBtn} onPress={handleDisconnect}>
              <Text style={styles.disconnectBtnText}>Disconnect</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* History */}
        {history.length > 0 && (
          <View style={styles.historyCard}>
            <Text style={styles.historyTitle}>Recent Predictions</Text>
            {history.map((item, i) => (
              <View key={i} style={styles.historyRow}>
                <Text style={styles.historyPhrase}>{item.phrase}</Text>
                <Text style={[styles.historyConf, { color: confidenceColor(item.confidence) }]}>
                  {(item.confidence * 100).toFixed(0)}%
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Debug raw packet */}
        {currentLabel && (
          <View style={styles.debugCard}>
            <Text style={styles.debugTitle}>BLE Packet (raw)</Text>
            <Text style={styles.debugText}>{currentLabel.raw}</Text>
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
};

// ── Finger bar styles ─────────────────────────────────────────────────────────

const fingerStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  label: {
    width: 52,
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
  },
  track: {
    flex: 1,
    height: 8,
    backgroundColor: colors.surfaceMuted,
    borderRadius: 4,
    overflow: 'hidden',
  },
  fill: {
    height: 8,
    backgroundColor: colors.primary,
    borderRadius: 4,
  },
  value: {
    width: 38,
    textAlign: 'right',
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
  },
});

// ── Main styles ───────────────────────────────────────────────────────────────

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
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 2,
  },
  title: {
    fontSize: 26,
    fontWeight: '900',
    color: colors.text,
  },
  homeBtn: {
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
  },
  homeBtnText: {
    color: colors.primary,
    fontWeight: '800',
  },
  scroll: {
    padding: spacing.lg,
    paddingBottom: 60,
  },

  // Status
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow,
    marginBottom: spacing.md,
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: spacing.md,
  },
  statusText: {
    fontSize: 15,
    fontWeight: '800',
  },
  deviceName: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },

  // Error
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
    fontSize: 13,
  },

  // Phrase card
  phraseCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
    borderWidth: 2,
    borderColor: colors.primary,
    ...shadow,
    marginBottom: spacing.md,
    alignItems: 'center',
  },
  phraseLabel: {
    fontSize: 11,
    fontWeight: '900',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: spacing.sm,
  },
  phraseWord: {
    fontSize: 56,
    fontWeight: '900',
    color: colors.text,
    textAlign: 'center',
    lineHeight: 64,
  },
  phraseCode: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textMuted,
    marginTop: spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  confidenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 99,
  },
  confidenceLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textMuted,
  },
  confidenceValue: {
    fontSize: 15,
    fontWeight: '900',
  },
  fingersSection: {
    width: '100%',
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  fingersTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  repeatBtn: {
    marginTop: spacing.lg,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 99,
  },
  repeatBtnText: {
    color: 'white',
    fontWeight: '800',
    fontSize: 15,
  },

  // Empty state
  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xs,
    lineHeight: 20,
  },

  // Buttons
  actions: {
    marginBottom: spacing.md,
  },
  primaryBtn: {
    backgroundColor: colors.primary,
    padding: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
    minHeight: 54,
    justifyContent: 'center',
  },
  primaryBtnText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '800',
  },
  btnDisabled: {
    opacity: 0.6,
  },
  disconnectBtn: {
    backgroundColor: colors.textMuted,
    padding: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
    minHeight: 54,
    justifyContent: 'center',
  },
  disconnectBtnText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '800',
  },

  // History
  historyCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
    ...shadow,
  },
  historyTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  historyPhrase: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  historyConf: {
    fontSize: 14,
    fontWeight: '800',
  },

  // Debug
  debugCard: {
    backgroundColor: '#1E293B',
    borderRadius: radius.sm,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  debugTitle: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  debugText: {
    color: '#94A3B8',
    fontFamily: 'monospace',
    fontSize: 12,
  },
});

export default BleLabelScreen;
