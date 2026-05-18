import React, { useMemo, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius, shadow, spacing } from '../styles/theme';

type DemoGesture = {
  code: string;
  title: string;
  phrase: string;
  indexBend: number;
  middleBend: number;
  description: string;
};

const DEMO_GESTURES: DemoGesture[] = [
  {
    code: 'REST',
    title: 'Rest',
    phrase: 'Silent',
    indexBend: 0,
    middleBend: 0,
    description: 'Neutral baseline. No speech output.',
  },
  {
    code: 'INDEX_BENT',
    title: 'Index Bent',
    phrase: 'Yes',
    indexBend: 92,
    middleBend: 4,
    description: 'Index finger bends while middle finger stays open.',
  },
  {
    code: 'MIDDLE_BENT',
    title: 'Middle Bent',
    phrase: 'No',
    indexBend: 4,
    middleBend: 84,
    description: 'Middle finger bends while index finger stays open.',
  },
  {
    code: 'BOTH_BENT',
    title: 'Both Bent',
    phrase: 'Help',
    indexBend: 92,
    middleBend: 88,
    description: 'Both tracked fingers bend together.',
  },
  {
    code: 'INDEX_HALF',
    title: 'Index Half',
    phrase: 'Water',
    indexBend: 42,
    middleBend: 5,
    description: 'Index finger is partly bent; middle remains open.',
  },
];

const getSpeechText = (gesture: DemoGesture) => (gesture.code === 'REST' ? '' : gesture.phrase);

const speak = (text: string): string => {
  if (!text) return 'REST is silent.';
  if (Platform.OS !== 'web') return 'Speech is available in the web demo.';

  const speech = (globalThis as any).speechSynthesis;
  const Utterance = (globalThis as any).SpeechSynthesisUtterance;
  if (!speech || !Utterance) return 'Speech synthesis is not available in this browser.';

  speech.cancel();
  const utterance = new Utterance(text);
  utterance.rate = 0.9;
  utterance.pitch = 1;
  utterance.volume = 1;
  speech.speak(utterance);
  return `Speaking: ${text}`;
};

const Finger = ({ label, bend, offset }: { label: string; bend: number; offset: number }) => {
  const lowerAngle = bend > 75 ? 64 : bend > 20 ? 34 : 0;
  const tipAngle = bend > 75 ? 42 : bend > 20 ? 18 : 0;
  const lift = bend > 75 ? 18 : bend > 20 ? 8 : 0;

  return (
    <View style={[styles.fingerColumn, { left: offset }]}>
      <View style={[styles.fingerSegment, styles.fingerTop, { transform: [{ translateY: lift }, { rotateX: `${lowerAngle}deg` }] }]} />
      <View style={[styles.fingerJoint, { transform: [{ translateY: lift }] }]} />
      <View style={[styles.fingerSegment, styles.fingerBase, { transform: [{ translateY: lift / 2 }, { rotateX: `${tipAngle}deg` }] }]} />
      <Text style={styles.fingerLabel}>{label}</Text>
    </View>
  );
};

const SpeechDemoScreen = ({ navigation }: any) => {
  const [selectedGesture, setSelectedGesture] = useState(DEMO_GESTURES[1]);
  const [speechStatus, setSpeechStatus] = useState('Ready');

  const selectedPhrase = useMemo(() => getSpeechText(selectedGesture), [selectedGesture]);

  const handleSelect = (gesture: DemoGesture) => {
    setSelectedGesture(gesture);
    setSpeechStatus(gesture.code === 'REST' ? 'REST selected. No spoken output.' : `${gesture.phrase} selected.`);
  };

  const handleSpeak = () => {
    setSpeechStatus(speak(selectedPhrase));
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>Presentation Demo</Text>
          <Text style={styles.title}>3D Gesture to Speech</Text>
        </View>
        <TouchableOpacity style={styles.homeButton} onPress={() => navigation.navigate('Main')}>
          <Text style={styles.homeButtonText}>Home</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.stage}>
          <View style={styles.visualPanel}>
            <View style={styles.handScene}>
              <View style={styles.handShadow} />
              <View style={styles.wrist} />
              <View style={styles.palm}>
                <Finger label="Index" bend={selectedGesture.indexBend} offset={70} />
                <Finger label="Middle" bend={selectedGesture.middleBend} offset={145} />
                <View style={styles.thumb} />
                <Text style={styles.palmLabel}>Smart Glove</Text>
              </View>
            </View>
            <View style={styles.sensorReadout}>
              <View style={styles.sensorRow}>
                <Text style={styles.sensorLabel}>Index</Text>
                <Text style={styles.sensorValue}>{selectedGesture.indexBend}%</Text>
              </View>
              <View style={styles.sensorTrack}>
                <View style={[styles.sensorFill, { width: `${selectedGesture.indexBend}%` }]} />
              </View>
              <View style={styles.sensorRow}>
                <Text style={styles.sensorLabel}>Middle</Text>
                <Text style={styles.sensorValue}>{selectedGesture.middleBend}%</Text>
              </View>
              <View style={styles.sensorTrack}>
                <View style={[styles.sensorFill, { width: `${selectedGesture.middleBend}%` }]} />
              </View>
            </View>
          </View>

          <View style={styles.outputPanel}>
            <Text style={styles.outputLabel}>Recognized Gesture</Text>
            <Text style={styles.outputGesture}>{selectedGesture.code}</Text>
            <Text style={styles.outputPhrase}>{selectedGesture.phrase}</Text>
            <Text style={styles.outputDescription}>{selectedGesture.description}</Text>
            <TouchableOpacity style={styles.speakButton} onPress={handleSpeak}>
              <Text style={styles.speakButtonText}>Speak Output</Text>
            </TouchableOpacity>
            <Text style={styles.speechStatus}>{speechStatus}</Text>
          </View>
        </View>

        <View style={styles.gestureGrid}>
          {DEMO_GESTURES.map((gesture) => {
            const selected = selectedGesture.code === gesture.code;
            return (
              <TouchableOpacity
                key={gesture.code}
                style={[styles.gestureCard, selected && styles.gestureCardSelected]}
                onPress={() => handleSelect(gesture)}
              >
                <Text style={[styles.gestureTitle, selected && styles.gestureTitleSelected]}>{gesture.title}</Text>
                <Text style={[styles.gesturePhrase, selected && styles.gesturePhraseSelected]}>{gesture.phrase}</Text>
                <Text style={styles.gestureCode}>{gesture.code}</Text>
              </TouchableOpacity>
            );
          })}
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
    fontSize: 26,
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
    maxWidth: 1060,
    alignSelf: 'center',
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  stage: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  visualPanel: {
    flexGrow: 1,
    flexBasis: 520,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    ...shadow,
  },
  handScene: {
    height: 330,
    alignItems: 'center',
    justifyContent: 'flex-end',
    backgroundColor: '#EAF4F7',
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  handShadow: {
    position: 'absolute',
    bottom: 26,
    width: 260,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(15, 76, 92, 0.18)',
    transform: [{ scaleX: 1.35 }],
  },
  wrist: {
    width: 72,
    height: 86,
    backgroundColor: '#B8D8E1',
    borderWidth: 1,
    borderColor: '#8CB9C5',
    borderTopWidth: 0,
  },
  palm: {
    width: 230,
    height: 155,
    borderRadius: 28,
    backgroundColor: '#C8E6EE',
    borderWidth: 1,
    borderColor: '#8CB9C5',
    marginBottom: -4,
    transform: [{ perspective: 700 }, { rotateX: '10deg' }, { rotateZ: '-2deg' }],
  },
  palmLabel: {
    position: 'absolute',
    bottom: 30,
    left: 0,
    right: 0,
    color: colors.primaryDark,
    textAlign: 'center',
    fontWeight: '900',
  },
  fingerColumn: {
    position: 'absolute',
    bottom: 124,
    width: 56,
    alignItems: 'center',
  },
  fingerSegment: {
    width: 42,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: '#8CB9C5',
    backgroundColor: '#D7EEF4',
  },
  fingerTop: {
    height: 96,
    transformOrigin: 'bottom',
  } as any,
  fingerJoint: {
    width: 46,
    height: 12,
    borderRadius: 8,
    backgroundColor: '#9BC8D3',
    marginVertical: -2,
  },
  fingerBase: {
    height: 78,
    transformOrigin: 'bottom',
  } as any,
  fingerLabel: {
    marginTop: spacing.xs,
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
  },
  thumb: {
    position: 'absolute',
    left: -24,
    bottom: 60,
    width: 70,
    height: 34,
    borderRadius: 18,
    backgroundColor: '#D7EEF4',
    borderWidth: 1,
    borderColor: '#8CB9C5',
    transform: [{ rotateZ: '-32deg' }],
  },
  sensorReadout: {
    marginTop: spacing.md,
  },
  sensorRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  sensorLabel: {
    color: colors.text,
    fontWeight: '800',
  },
  sensorValue: {
    color: colors.primary,
    fontWeight: '900',
  },
  sensorTrack: {
    height: 8,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.sm,
    overflow: 'hidden',
    marginBottom: spacing.sm,
  },
  sensorFill: {
    height: 8,
    backgroundColor: colors.primary,
  },
  outputPanel: {
    flexGrow: 1,
    flexBasis: 300,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    ...shadow,
  },
  outputLabel: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '800',
  },
  outputGesture: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '900',
    marginTop: spacing.xs,
  },
  outputPhrase: {
    color: colors.primary,
    fontSize: 42,
    fontWeight: '900',
    marginTop: spacing.md,
  },
  outputDescription: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    marginTop: spacing.md,
  },
  speakButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    padding: spacing.md,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  speakButtonText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 16,
  },
  speechStatus: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
    marginTop: spacing.sm,
  },
  gestureGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  gestureCard: {
    flexGrow: 1,
    flexBasis: 170,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  gestureCardSelected: {
    borderColor: colors.primary,
    backgroundColor: '#EAF4F7',
  },
  gestureTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '900',
  },
  gestureTitleSelected: {
    color: colors.primaryDark,
  },
  gesturePhrase: {
    color: colors.primary,
    fontSize: 20,
    fontWeight: '900',
    marginTop: spacing.xs,
  },
  gesturePhraseSelected: {
    color: colors.primaryDark,
  },
  gestureCode: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '800',
    marginTop: spacing.sm,
  },
});

export default SpeechDemoScreen;
