import React, { useMemo, useRef, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { recordingApi } from '../api/recordingApi';
import { colors, radius, shadow, spacing } from '../styles/theme';

type SerialSample = [number, number, number, number, number, number];

type GestureResult = {
  code: string;
  phrase: string;
};

const GESTURE_LABELS = [
  { code: 'REST', phrase: 'Silent' },
  { code: 'INDEX_BENT', phrase: 'Yes' },
  { code: 'MIDDLE_BENT', phrase: 'No' },
  { code: 'BOTH_BENT', phrase: 'Help' },
  { code: 'INDEX_HALF', phrase: 'Water' },
];

const parseCsvLine = (line: string): SerialSample | null => {
  const trimmed = line.trim();
  if (!/^(-?\d+(?:\.\d+)?,){5}-?\d+(?:\.\d+)?$/.test(trimmed)) return null;
  const values = trimmed.split(',').map((value) => Number(value));
  if (values.some((value) => Number.isNaN(value))) return null;
  return values as SerialSample;
};

const classifySample = (sample: SerialSample | null): GestureResult => {
  if (!sample) return { code: 'WAITING', phrase: 'Waiting' };

  const indexPercent = sample[2];
  const middlePercent = sample[5];

  if (indexPercent >= 60 && middlePercent >= 60) return { code: 'BOTH_BENT', phrase: 'Help' };
  if (indexPercent >= 60 && middlePercent <= 20) return { code: 'INDEX_BENT', phrase: 'Yes' };
  if (indexPercent >= 25 && indexPercent <= 59 && middlePercent <= 20) return { code: 'INDEX_HALF', phrase: 'Water' };
  if (indexPercent <= 20 && middlePercent >= 60) return { code: 'MIDDLE_BENT', phrase: 'No' };
  if (indexPercent <= 20 && middlePercent <= 20) return { code: 'REST', phrase: 'Silent' };

  return { code: 'UNCERTAIN', phrase: 'Hold steady' };
};

const speak = (phrase: string) => {
  if (!phrase || phrase === 'Silent' || phrase === 'Waiting' || phrase === 'Hold steady') return;
  if (Platform.OS !== 'web') return;

  const speech = (globalThis as any).speechSynthesis;
  const Utterance = (globalThis as any).SpeechSynthesisUtterance;
  if (!speech || !Utterance) return;

  speech.cancel();
  const utterance = new Utterance(phrase);
  utterance.rate = 0.9;
  utterance.pitch = 1;
  speech.speak(utterance);
};

const FingerMeter = ({ label, percent }: { label: string; percent: number }) => {
  const bend = Math.max(0, Math.min(100, percent || 0));
  const fingerHeight = 130 - bend * 0.55;
  const bendOffset = bend * 0.28;

  return (
    <View style={styles.fingerMeter}>
      <View style={styles.fingerTrack}>
        <View
          style={[
            styles.liveFinger,
            {
              height: fingerHeight,
              transform: [{ translateY: bendOffset }, { rotateZ: `${bend * 0.22}deg` }],
            },
          ]}
        />
      </View>
      <Text style={styles.fingerName}>{label}</Text>
      <Text style={styles.fingerPercent}>{Math.round(bend)}%</Text>
    </View>
  );
};

const SerialGloveDemoScreen = ({ route, navigation }: any) => {
  const deviceId = route.params?.deviceId;
  const portRef = useRef<any>(null);
  const readerRef = useRef<any>(null);
  const bufferRef = useRef('');
  const collectingRef = useRef(false);
  const lastSpokenRef = useRef('');
  const [connected, setConnected] = useState(false);
  const [status, setStatus] = useState('Connect the Arduino USB serial stream.');
  const [lastLine, setLastLine] = useState('');
  const [latestSample, setLatestSample] = useState<SerialSample | null>(null);
  const [selectedLabel, setSelectedLabel] = useState('BOTH_BENT');
  const [collectedSamples, setCollectedSamples] = useState<SerialSample[]>([]);
  const [collecting, setCollecting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [speechEnabled, setSpeechEnabled] = useState(true);

  const classification = useMemo(() => classifySample(latestSample), [latestSample]);
  const indexPercent = latestSample?.[2] ?? 0;
  const middlePercent = latestSample?.[5] ?? 0;

  const processLine = (line: string) => {
    const sample = parseCsvLine(line);
    if (!sample) return;

    setLastLine(line.trim());
    setLatestSample(sample);

    if (collectingRef.current) {
      setCollectedSamples((current) => [...current, sample]);
    }

    const result = classifySample(sample);
    if (speechEnabled && result.code !== lastSpokenRef.current && result.phrase !== 'Silent' && result.phrase !== 'Hold steady') {
      lastSpokenRef.current = result.code;
      speak(result.phrase);
    }
  };

  const readLoop = async (reader: any) => {
    const decoder = new TextDecoder();

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      bufferRef.current += decoder.decode(value, { stream: true });
      const lines = bufferRef.current.split(/\r?\n/);
      bufferRef.current = lines.pop() ?? '';
      lines.forEach(processLine);
    }
  };

  const connect = async () => {
    if (Platform.OS !== 'web') {
      setStatus('USB serial demo is available in Chrome/Edge web on localhost.');
      return;
    }

    const serial = (navigator as any).serial;
    if (!serial) {
      setStatus('Web Serial is not available. Use Chrome or Edge on localhost.');
      return;
    }

    try {
      const port = await serial.requestPort();
      await port.open({ baudRate: 115200 });
      const reader = port.readable.getReader();
      portRef.current = port;
      readerRef.current = reader;
      setConnected(true);
      setStatus('Connected. Move your fingers and watch the live output.');
      readLoop(reader).catch(() => setStatus('Serial stream stopped.'));
    } catch (error) {
      setStatus('Unable to connect to Arduino serial.');
    }
  };

  const disconnect = async () => {
    collectingRef.current = false;
    setCollecting(false);

    try {
      await readerRef.current?.cancel();
      readerRef.current?.releaseLock();
      await portRef.current?.close();
    } catch {
      // Ignore disconnect cleanup errors.
    }

    readerRef.current = null;
    portRef.current = null;
    setConnected(false);
    setStatus('Disconnected.');
  };

  const toggleCollection = () => {
    const next = !collectingRef.current;
    collectingRef.current = next;
    setCollecting(next);
    setStatus(next ? `Collecting ${selectedLabel} samples.` : 'Collection paused.');
  };

  const clearCollection = () => {
    setCollectedSamples([]);
    setStatus('Collected samples cleared.');
  };

  const uploadCollection = async () => {
    if (!deviceId) {
      setStatus('Open this screen from a registered device first.');
      return;
    }
    if (!collectedSamples.length) {
      setStatus('No samples collected yet.');
      return;
    }

    setUploading(true);
    try {
      await recordingApi.uploadJson({
        device_id: deviceId,
        gesture_code: selectedLabel,
        sample_rate: 8,
        duration_ms: Math.round((collectedSamples.length / 8) * 1000),
        sensor_count: 6,
        samples: collectedSamples,
      });
      setStatus(`Uploaded ${collectedSamples.length} ${selectedLabel} samples.`);
      setCollectedSamples([]);
    } catch {
      setStatus('Upload failed. Check backend connection.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>Live USB Demo</Text>
          <Text style={styles.title}>Glove to Speech + Data</Text>
        </View>
        <TouchableOpacity style={styles.homeButton} onPress={() => navigation.navigate('Main')}>
          <Text style={styles.homeButtonText}>Home</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.stage}>
          <View style={styles.visualCard}>
            <View style={styles.liveHand}>
              <FingerMeter label="Index" percent={indexPercent} />
              <FingerMeter label="Middle" percent={middlePercent} />
              <View style={styles.palm}>
                <Text style={styles.palmText}>Live Glove</Text>
              </View>
            </View>

            <View style={styles.resultPanel}>
              <Text style={styles.resultLabel}>Detected</Text>
              <Text style={styles.resultGesture}>{classification.code}</Text>
              <Text style={styles.resultPhrase}>{classification.phrase}</Text>
              <Text style={styles.lastLine}>{lastLine || 'Waiting for CSV serial rows...'}</Text>
            </View>
          </View>

          <View style={styles.controlCard}>
            <Text style={styles.controlTitle}>Serial Connection</Text>
            <Text style={styles.statusText}>{status}</Text>
            <TouchableOpacity style={connected ? styles.secondaryButton : styles.primaryButton} onPress={connected ? disconnect : connect}>
              <Text style={connected ? styles.secondaryButtonText : styles.primaryButtonText}>
                {connected ? 'Disconnect' : 'Connect Arduino'}
              </Text>
            </TouchableOpacity>

            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>Speech</Text>
              <TouchableOpacity style={[styles.smallToggle, speechEnabled && styles.smallToggleActive]} onPress={() => setSpeechEnabled(!speechEnabled)}>
                <Text style={[styles.smallToggleText, speechEnabled && styles.smallToggleTextActive]}>
                  {speechEnabled ? 'On' : 'Off'}
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.sectionTitle}>Collect Label</Text>
            <View style={styles.labelGrid}>
              {GESTURE_LABELS.map((label) => (
                <TouchableOpacity
                  key={label.code}
                  style={[styles.labelButton, selectedLabel === label.code && styles.labelButtonActive]}
                  onPress={() => setSelectedLabel(label.code)}
                >
                  <Text style={[styles.labelButtonText, selectedLabel === label.code && styles.labelButtonTextActive]}>
                    {label.code}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.collectStats}>
              <Text style={styles.collectCount}>{collectedSamples.length}</Text>
              <Text style={styles.collectMeta}>samples for {selectedLabel}</Text>
            </View>

            <TouchableOpacity style={collecting ? styles.stopButton : styles.primaryButton} onPress={toggleCollection} disabled={!connected}>
              <Text style={styles.primaryButtonText}>{collecting ? 'Stop Collecting' : 'Start Collecting'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryButton} onPress={uploadCollection} disabled={uploading}>
              <Text style={styles.secondaryButtonText}>{uploading ? 'Uploading' : 'Upload Recording'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.clearButton} onPress={clearCollection}>
              <Text style={styles.clearButtonText}>Clear Samples</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
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
    color: colors.text,
    fontSize: 25,
    fontWeight: '900',
  },
  homeButton: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  homeButtonText: {
    color: colors.primary,
    fontWeight: '800',
  },
  content: {
    width: '100%',
    maxWidth: 1080,
    alignSelf: 'center',
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  stage: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  visualCard: {
    flexGrow: 1,
    flexBasis: 560,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    ...shadow,
  },
  liveHand: {
    height: 315,
    borderRadius: radius.md,
    backgroundColor: '#EAF4F7',
    alignItems: 'center',
    justifyContent: 'flex-end',
    flexDirection: 'row',
    gap: spacing.lg,
    paddingBottom: spacing.lg,
  },
  palm: {
    position: 'absolute',
    bottom: 28,
    width: 210,
    height: 82,
    borderRadius: 28,
    backgroundColor: '#C8E6EE',
    borderWidth: 1,
    borderColor: '#8CB9C5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  palmText: {
    color: colors.primaryDark,
    fontWeight: '900',
  },
  fingerMeter: {
    width: 82,
    alignItems: 'center',
    zIndex: 2,
  },
  fingerTrack: {
    width: 54,
    height: 160,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  liveFinger: {
    width: 42,
    borderRadius: 22,
    backgroundColor: '#D7EEF4',
    borderWidth: 1,
    borderColor: '#8CB9C5',
  },
  fingerName: {
    color: colors.text,
    fontWeight: '900',
    marginTop: spacing.sm,
  },
  fingerPercent: {
    color: colors.primary,
    fontWeight: '900',
    marginTop: 2,
  },
  resultPanel: {
    marginTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
  },
  resultLabel: {
    color: colors.textMuted,
    fontWeight: '800',
  },
  resultGesture: {
    color: colors.text,
    fontSize: 27,
    fontWeight: '900',
    marginTop: spacing.xs,
  },
  resultPhrase: {
    color: colors.primary,
    fontSize: 38,
    fontWeight: '900',
    marginTop: spacing.xs,
  },
  lastLine: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    marginTop: spacing.sm,
  },
  controlCard: {
    flexGrow: 1,
    flexBasis: 330,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    ...shadow,
  },
  controlTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '900',
  },
  statusText: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    padding: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '900',
  },
  secondaryButton: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  secondaryButtonText: {
    color: colors.primary,
    fontWeight: '900',
  },
  stopButton: {
    backgroundColor: colors.danger,
    borderRadius: radius.sm,
    padding: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  clearButton: {
    padding: spacing.sm,
    alignItems: 'center',
  },
  clearButtonText: {
    color: colors.danger,
    fontWeight: '800',
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  toggleLabel: {
    color: colors.text,
    fontWeight: '800',
  },
  smallToggle: {
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  smallToggleActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  smallToggleText: {
    color: colors.textMuted,
    fontWeight: '800',
  },
  smallToggleTextActive: {
    color: '#FFFFFF',
  },
  sectionTitle: {
    color: colors.text,
    fontWeight: '900',
    marginBottom: spacing.sm,
  },
  labelGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  labelButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  labelButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  labelButtonText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '800',
  },
  labelButtonTextActive: {
    color: '#FFFFFF',
  },
  collectStats: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
    marginBottom: spacing.sm,
  },
  collectCount: {
    color: colors.text,
    fontSize: 32,
    fontWeight: '900',
  },
  collectMeta: {
    color: colors.textMuted,
    fontWeight: '800',
  },
});

export default SerialGloveDemoScreen;
