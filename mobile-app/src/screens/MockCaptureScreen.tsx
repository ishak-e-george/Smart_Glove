import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { mockSensorService } from '../services/mockSensorService';
import { recordingApi } from '../api/recordingApi';
import { predictionApi } from '../api/predictionApi';
import { colors, radius, shadow, spacing } from '../styles/theme';

const SUPPORTED_GESTURES = [
  {
    code: 'INDEX_BENT',
    title: 'Index Bend',
    phrase: 'Yes',
    detail: 'Trained sample from the current 2-finger model.',
  },
  {
    code: 'MIDDLE_BENT',
    title: 'Middle Bend',
    phrase: 'No',
    detail: 'Trained sample from the current 2-finger model.',
  },
  {
    code: 'REST',
    title: 'Rest',
    phrase: 'Silent',
    detail: 'Neutral hand position used as the baseline class.',
  },
];

const MockCaptureScreen = ({ route, navigation }: any) => {
  const { deviceId } = route.params;
  const [capturing, setCapturing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [selectedGesture, setSelectedGesture] = useState(SUPPORTED_GESTURES[0]);

  const handleCapture = async () => {
    setCapturing(true);
    setErrorMessage('');
    
    // Simulate capture time
    setTimeout(async () => {
      setCapturing(false);
      setUploading(true);
      
      try {
        // Generate mock data
        const mockData = mockSensorService.generateMockRecording(selectedGesture.code, deviceId);
        const recording = await recordingApi.uploadJson(mockData);
        const prediction = await predictionApi.createFromRecording(recording.id);
        
        navigation.navigate('PhraseOutput', {
          gestureId: prediction.gesture_id,
          modelLabel: prediction.model_label,
          confidence: prediction.confidence,
        });
      } catch (error) {
        console.error(error);
        setErrorMessage('Unable to analyze the captured recording.');
      } finally {
        setUploading(false);
      }
    }, 2000);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>Software Capture</Text>
          <Text style={styles.title}>Gesture Sample</Text>
        </View>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => navigation.navigate('Main')}
          disabled={capturing || uploading}
        >
          <Text style={styles.headerButtonText}>Home</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <View style={styles.introCard}>
          <Text style={styles.introTitle}>Select a trained gesture</Text>
          <Text style={styles.introText}>
            The app generates sensor-shaped samples, uploads the recording, runs ML inference, and returns a phrase.
          </Text>
        </View>

        <View style={styles.gesturePicker}>
          {SUPPORTED_GESTURES.map((gesture) => {
            const selected = gesture.code === selectedGesture.code;
            return (
              <TouchableOpacity
                key={gesture.code}
                style={[styles.gestureOption, selected && styles.gestureOptionSelected]}
                onPress={() => setSelectedGesture(gesture)}
                disabled={capturing || uploading}
              >
                <View style={styles.gestureOptionHeader}>
                  <Text style={[styles.gestureTitle, selected && styles.gestureTitleSelected]}>
                    {gesture.title}
                  </Text>
                  <Text style={[styles.gesturePhrase, selected && styles.gesturePhraseSelected]}>
                    {gesture.phrase}
                  </Text>
                </View>
                <Text style={[styles.gestureDetail, selected && styles.gestureDetailSelected]}>
                  {gesture.detail}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.pipelineCard}>
          <View style={styles.pipelineStep}>
            <Text style={styles.stepNumber}>1</Text>
            <Text style={styles.stepLabel}>Record</Text>
          </View>
          <View style={styles.pipelineDivider} />
          <View style={styles.pipelineStep}>
            <Text style={styles.stepNumber}>2</Text>
            <Text style={styles.stepLabel}>Predict</Text>
          </View>
          <View style={styles.pipelineDivider} />
          <View style={styles.pipelineStep}>
            <Text style={styles.stepNumber}>3</Text>
            <Text style={styles.stepLabel}>Translate</Text>
          </View>
        </View>

        {!!errorMessage && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        )}
        
        <View style={styles.statusContainer}>
          {capturing && (
            <View style={styles.statusBox}>
              <ActivityIndicator size="large" color={colors.warning} />
              <Text style={styles.statusText}>Capturing</Text>
            </View>
          )}
          
          {uploading && (
            <View style={styles.statusBox}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.statusText}>Analyzing</Text>
            </View>
          )}
          
          {!capturing && !uploading && (
            <TouchableOpacity 
              style={styles.captureButton}
              onPress={handleCapture}
            >
              <Text style={styles.captureButtonText}>Run Capture</Text>
              <Text style={styles.captureButtonSubtext}>{selectedGesture.code}</Text>
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          disabled={capturing || uploading}
        >
          <Text style={styles.backButtonText}>Cancel</Text>
        </TouchableOpacity>
      </View>
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
    fontSize: 26,
    fontWeight: '800',
    color: colors.text,
  },
  headerButton: {
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
  },
  headerButtonText: {
    color: colors.primary,
    fontWeight: '800',
  },
  content: {
    flex: 1,
    padding: spacing.lg,
    alignItems: 'center',
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
  },
  introCard: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadow,
  },
  introTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  introText: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    marginTop: spacing.xs,
  },
  pipelineCard: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    ...shadow,
  },
  gesturePicker: {
    width: '100%',
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  gestureOption: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  gestureOptionSelected: {
    borderColor: colors.primary,
    backgroundColor: '#EAF4F7',
  },
  gestureOptionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  gestureTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  gestureTitleSelected: {
    color: colors.primaryDark,
  },
  gesturePhrase: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '800',
  },
  gesturePhraseSelected: {
    color: colors.primary,
  },
  gestureDetail: {
    color: colors.textMuted,
    fontSize: 13,
  },
  gestureDetailSelected: {
    color: colors.primaryDark,
  },
  pipelineStep: {
    alignItems: 'center',
    flex: 1,
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceMuted,
    textAlign: 'center',
    lineHeight: 28,
    color: colors.primary,
    fontWeight: '900',
  },
  stepLabel: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '800',
    marginTop: spacing.xs,
  },
  pipelineDivider: {
    height: 1,
    width: 28,
    backgroundColor: colors.border,
  },
  errorBox: {
    width: '100%',
    backgroundColor: '#FEE4E2',
    borderColor: '#FDA29B',
    borderWidth: 1,
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginTop: spacing.md,
  },
  errorText: {
    color: colors.danger,
    fontWeight: '700',
  },
  statusContainer: {
    width: '100%',
    paddingVertical: spacing.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusBox: {
    alignItems: 'center',
  },
  statusText: {
    marginTop: spacing.md,
    fontSize: 18,
    color: colors.text,
    fontWeight: '800',
  },
  captureButton: {
    width: '100%',
    maxWidth: 360,
    minHeight: 64,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  captureButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '900',
  },
  captureButtonSubtext: {
    color: '#D7EEF4',
    fontSize: 12,
    fontWeight: '800',
    marginTop: 2,
  },
  backButton: {
    padding: spacing.md,
  },
  backButtonText: {
    color: colors.danger,
    fontSize: 16,
    fontWeight: '800',
  },
});

export default MockCaptureScreen;
