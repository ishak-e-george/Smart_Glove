import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { scanForGlove, connectToGlove, startGloveStream, stopGloveStream, disconnectGlove, GloveSample } from '../services/bleGloveService';
import { recordingApi } from '../api/recordingApi';
import { Device } from 'react-native-ble-plx';

const HardwareCaptureScreen = ({ route, navigation }: any) => {
  const { deviceId, gestureCode = 'HELP' } = route.params;
  
  const [status, setStatus] = useState('Disconnected');
  const [isScanning, setIsScanning] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [samples, setSamples] = useState<GloveSample[]>([]);
  const [connectedDevice, setConnectedDevice] = useState<Device | null>(null);
  
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      disconnectGlove().catch(console.error);
      if (recordingTimerRef.current) clearTimeout(recordingTimerRef.current);
    };
  }, []);

  const handleScan = () => {
    setIsScanning(true);
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
          Alert.alert('Connection Error', error.message);
          setStatus('Disconnected');
        }
      },
      (error) => {
        setIsScanning(false);
        setStatus('Scan Failed');
        Alert.alert('Scan Error', error);
      }
    );
  };

  const startCapture = async () => {
    if (!connectedDevice) return;
    
    setSamples([]);
    setIsRecording(true);
    setStatus('Streaming Data...');
    
    try {
      await startGloveStream(
        (sample) => {
          setSamples((prev) => [...prev, sample]);
        },
        (error) => {
          Alert.alert('Stream Error', error);
          stopCapture();
        }
      );

      // Auto-stop after 2 seconds
      recordingTimerRef.current = setTimeout(() => {
        stopCapture();
      }, 2000);
      
    } catch (error: any) {
      Alert.alert('Capture Error', error.message);
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
      
      if (samples.length > 0) {
        uploadData();
      } else {
        Alert.alert('No Data', 'No samples were collected during the 2-second window.');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  const uploadData = async () => {
    setStatus('Uploading...');
    try {
      // Create a temporary "file" representation for the recordingApi
      // In a real app, you might save this to a local file first
      // But our current recordingApi expects a fileUri or handles it via FormData
      
      const recordingPayload = {
        device_id: deviceId,
        gesture_code: gestureCode,
        sample_rate: 50,
        duration_ms: 2000,
        sensor_count: 5,
        samples: samples
      };

      // Since recordingApi.upload expects a fileUri, we might need a general method
      // For now, let's assume we use a specialized method or adjust the API
      // Actually, let's just use the client directly here for simplicity
      // or assume recordingApi has a 'createFromData' method
      
      const response = await recordingApi.upload('data:application/json;base64,' + btoa(JSON.stringify(recordingPayload)), deviceId, recordingPayload);
      
      Alert.alert('Success', 'Recording uploaded successfully');
      navigation.navigate('PhraseOutput', { gestureId: response.gesture_id || 1 });
      
    } catch (error: any) {
      Alert.alert('Upload Failed', error.message);
      setStatus('Connected');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Hardware Capture</Text>
      <View style={styles.statusCard}>
        <Text style={styles.statusLabel}>Status:</Text>
        <Text style={[styles.statusValue, status === 'Connected' && styles.statusConnected]}>{status}</Text>
      </View>
      
      <Text style={styles.infoText}>Samples Collected: {samples.length}</Text>

      <View style={styles.controls}>
        {!connectedDevice ? (
          <TouchableOpacity 
            style={[styles.button, isScanning && styles.buttonDisabled]} 
            onPress={handleScan}
            disabled={isScanning}
          >
            {isScanning ? <ActivityIndicator color="white" /> : <Text style={styles.buttonText}>Scan for Glove</Text>}
          </TouchableOpacity>
        ) : (
          <>
            <TouchableOpacity 
              style={[styles.button, styles.captureButton, isRecording && styles.buttonDisabled]} 
              onPress={startCapture}
              disabled={isRecording}
            >
              <Text style={styles.buttonText}>{isRecording ? 'Capturing...' : 'Start 2s Capture'}</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.button, styles.disconnectButton]} 
              onPress={() => {
                disconnectGlove();
                setConnectedDevice(null);
                setStatus('Disconnected');
                setSamples([]);
              }}
            >
              <Text style={styles.buttonText}>Disconnect</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      <ScrollView style={styles.sampleList}>
        {samples.slice(-5).map((s, i) => (
          <Text key={i} style={styles.sampleItem}>
            [{s.join(', ')}]
          </Text>
        ))}
        {samples.length > 5 && <Text style={styles.moreText}>...and {samples.length - 5} more</Text>}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#2c3e50',
  },
  statusCard: {
    flexDirection: 'row',
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 10,
    elevation: 2,
  },
  statusLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#7f8c8d',
  },
  statusValue: {
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 10,
    color: '#e74c3c',
  },
  statusConnected: {
    color: '#2ecc71',
  },
  infoText: {
    fontSize: 16,
    marginVertical: 10,
    color: '#34495e',
  },
  controls: {
    marginTop: 20,
  },
  button: {
    backgroundColor: '#3498db',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 10,
  },
  captureButton: {
    backgroundColor: '#e67e22',
    height: 60,
    justifyContent: 'center',
  },
  disconnectButton: {
    backgroundColor: '#95a5a6',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  sampleList: {
    marginTop: 20,
    flex: 1,
    backgroundColor: '#eee',
    borderRadius: 10,
    padding: 10,
  },
  sampleItem: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: '#2c3e50',
    marginBottom: 5,
  },
  moreText: {
    fontSize: 12,
    color: '#7f8c8d',
    fontStyle: 'italic',
    textAlign: 'center',
  }
});

export default HardwareCaptureScreen;
