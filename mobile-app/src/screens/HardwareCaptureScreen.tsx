import React, { useState, useEffect, useRef } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { scanForGlove, connectToGlove, startGloveStream, stopGloveStream, disconnectGlove, GloveSample } from '../services/bleGloveService';
import { recordingApi } from '../api/recordingApi';
import { predictionApi } from '../api/predictionApi';
import type { Device } from 'react-native-ble-plx';
import { colors, radius, shadow, spacing } from '../styles/theme';

const HardwareCaptureScreen = ({ route, navigation }: any) => {
  const { deviceId, gestureCode = 'HELP' } = route.params;
  
  const [status, setStatus] = useState('Disconnected');
  const [isScanning, setIsScanning] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [samples, setSamples] = useState<GloveSample[]>([]);
  const [connectedDevice, setConnectedDevice] = useState<Device | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const samplesRef = useRef<GloveSample[]>([]);

  useEffect(() => {
    return () => {
      disconnectGlove().catch(console.error);
      if (recordingTimerRef.current) clearTimeout(recordingTimerRef.current);
    };
  }, []);

  const handleScan = () => {
    setIsScanning(true);
    setErrorMessage('');
    setStatus('Scanning...');
    scanForGlove(
      async (device) => {
        setIsScanning(false);
        setStatus(`Found ${device.name}. Connecting...`);
        try {
          const connected = await connectToGlove(device);
          setConnectedDevice(connected);
          setStatus('Connected');
        } catch (error: any) {
          setErrorMessage(error.message);
          setStatus('Disconnected');
        }
      },
      (error) => {
        setIsScanning(false);
        setStatus('Scan Failed');
        setErrorMessage(error);
      }
    );
  };

  const startCapture = async () => {
    if (!connectedDevice) return;
    
    samplesRef.current = [];
    setSamples([]);
    setIsRecording(true);
    setStatus('Streaming Data...');
    
    try {
      await startGloveStream(
        (sample) => {
          samplesRef.current = [...samplesRef.current, sample];
          setSamples(samplesRef.current);
        },
        (error) => {
          setErrorMessage(error);
          stopCapture();
        }
      );

      // Auto-stop after 2 seconds
      recordingTimerRef.current = setTimeout(() => {
        stopCapture();
      }, 2000);
      
    } catch (error: any) {
      setErrorMessage(error.message);
      setIsRecording(false);
    }
  };

  const stopCapture = async () => {
    setIsRecording(false);
    if (recordingTimerRef.current) clearTimeout(recordingTimerRef.current);
    
    setStatus('Processing...');
    try {
      await stopGloveStream();
      setStatus('Stopped');
      
      const capturedSamples = samplesRef.current;
      if (capturedSamples.length > 0) {
        uploadData(capturedSamples);
      } else {
        setErrorMessage('No samples were collected.');
      }
    } catch (error: any) {
      setErrorMessage(error.message);
    }
  };

  const toModelFeatureSamples = (capturedSamples: GloveSample[]) => {
    return capturedSamples
      .filter((sample) => sample.length >= 2)
      .map((sample) => {
        const indexRaw = sample[0];
        const middleRaw = sample[1];
        const indexPercent = Math.max(0, Math.min(100, Math.round(((indexRaw - 300) / 400) * 100)));
        const middlePercent = Math.max(0, Math.min(100, Math.round(((middleRaw - 300) / 400) * 100)));

        return [
          indexRaw,
          indexRaw,
          indexPercent,
          middleRaw,
          middleRaw,
          middlePercent,
        ];
      });
  };

  const uploadData = async (capturedSamples: GloveSample[]) => {
    setStatus('Uploading...');
    try {
      const featureSamples = toModelFeatureSamples(capturedSamples);
      const recordingPayload = {
        device_id: deviceId,
        gesture_code: gestureCode,
        sample_rate: 50,
        duration_ms: 2000,
        sensor_count: 6,
        samples: featureSamples
      };

      const recording = await recordingApi.uploadJson(recordingPayload);
      const prediction = await predictionApi.createFromRecording(recording.id);
      
      navigation.navigate('PhraseOutput', {
        gestureId: prediction.gesture_id,
        modelLabel: prediction.model_label,
        confidence: prediction.confidence,
      });
      
    } catch (error: any) {
      setErrorMessage(error.message);
      setStatus('Connected');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>Live BLE Capture</Text>
          <Text style={styles.title}>Glove Session</Text>
        </View>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => navigation.navigate('Main')}
          disabled={isRecording}
        >
          <Text style={styles.headerButtonText}>Home</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <View style={styles.statusCard}>
          <View>
            <Text style={styles.statusLabel}>Connection</Text>
            <Text style={[styles.statusValue, status === 'Connected' && styles.statusConnected]}>{status}</Text>
          </View>
          <View style={styles.sampleCounter}>
            <Text style={styles.sampleCount}>{samples.length}</Text>
            <Text style={styles.sampleLabel}>samples</Text>
          </View>
        </View>

        {!!errorMessage && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        )}

        <View style={styles.controls}>
        {!connectedDevice ? (
          <TouchableOpacity 
            style={[styles.button, isScanning && styles.buttonDisabled]} 
            onPress={handleScan}
            disabled={isScanning}
          >
            {isScanning ? <ActivityIndicator color="white" /> : <Text style={styles.buttonText}>Scan</Text>}
          </TouchableOpacity>
        ) : (
          <>
            <TouchableOpacity 
              style={[styles.button, styles.captureButton, isRecording && styles.buttonDisabled]} 
              onPress={startCapture}
              disabled={isRecording}
            >
              <Text style={styles.buttonText}>{isRecording ? 'Capturing' : 'Start Capture'}</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.button, styles.disconnectButton]} 
              onPress={() => {
                disconnectGlove();
                setConnectedDevice(null);
                samplesRef.current = [];
                setStatus('Disconnected');
                setSamples([]);
              }}
            >
              <Text style={styles.buttonText}>Disconnect</Text>
            </TouchableOpacity>
          </>
        )}
        </View>

        <View style={styles.samplePanel}>
          <Text style={styles.panelTitle}>Latest Samples</Text>
          <ScrollView style={styles.sampleList}>
            {samples.slice(-5).map((s, i) => (
              <Text key={i} style={styles.sampleItem}>
                [{s.join(', ')}]
              </Text>
            ))}
            {samples.length === 0 && <Text style={styles.emptyText}>No samples yet.</Text>}
            {samples.length > 5 && <Text style={styles.moreText}>{samples.length - 5} earlier samples</Text>}
          </ScrollView>
        </View>
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
  },
  statusCard: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow,
  },
  statusLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textMuted,
  },
  statusValue: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.danger,
    marginTop: spacing.xs,
  },
  statusConnected: {
    color: colors.success,
  },
  sampleCounter: {
    alignItems: 'flex-end',
  },
  sampleCount: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '900',
  },
  sampleLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  errorBox: {
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
  controls: {
    marginTop: spacing.lg,
  },
  button: {
    backgroundColor: colors.primary,
    padding: spacing.md,
    borderRadius: radius.sm,
    alignItems: 'center',
    marginBottom: spacing.sm,
    minHeight: 54,
    justifyContent: 'center',
  },
  captureButton: {
    backgroundColor: colors.warning,
    height: 58,
    justifyContent: 'center',
  },
  disconnectButton: {
    backgroundColor: colors.textMuted,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '800',
  },
  samplePanel: {
    marginTop: spacing.lg,
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  panelTitle: {
    color: colors.text,
    fontWeight: '800',
    marginBottom: spacing.sm,
  },
  sampleList: {
    flex: 1,
  },
  sampleItem: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: colors.text,
    marginBottom: 5,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 14,
  },
  moreText: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
  }
});

export default HardwareCaptureScreen;
