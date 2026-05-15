import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { mockSensorService } from '../services/mockSensorService';
import { recordingApi } from '../api/recordingApi';
import { predictionApi } from '../api/predictionApi';

const MockCaptureScreen = ({ route, navigation }: any) => {
  const { deviceId } = route.params;
  const [capturing, setCapturing] = useState(false);
  const [uploading, setUploading] = useState(false);

  const handleCapture = async () => {
    setCapturing(true);
    
    // Simulate capture time
    setTimeout(async () => {
      setCapturing(false);
      setUploading(true);
      
      try {
        // Generate mock data
        const mockData = mockSensorService.generateMockRecording('BOTH_BENT', deviceId);
        const recording = await recordingApi.uploadJson(mockData);
        const prediction = await predictionApi.createFromRecording(recording.id);
        
        Alert.alert('Success', 'Gesture captured and analyzed');
        navigation.navigate('PhraseOutput', {
          gestureId: prediction.gesture_id,
          modelLabel: prediction.model_label,
          confidence: prediction.confidence,
        });
      } catch (error) {
        console.error(error);
        Alert.alert('Error', 'Failed to upload and analyze recording.');
      } finally {
        setUploading(false);
      }
    }, 2000);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Gesture Capture</Text>
        <Text style={styles.description}>
          Perform a gesture with your Smart Glove and press the button below to simulate the capture.
        </Text>
        
        <View style={styles.statusContainer}>
          {capturing && (
            <View style={styles.statusBox}>
              <ActivityIndicator size="large" color="#e67e22" />
              <Text style={styles.statusText}>Capturing Gesture...</Text>
            </View>
          )}
          
          {uploading && (
            <View style={styles.statusBox}>
              <ActivityIndicator size="large" color="#3498db" />
              <Text style={styles.statusText}>Analyzing Data...</Text>
            </View>
          )}
          
          {!capturing && !uploading && (
            <TouchableOpacity 
              style={styles.captureButton} 
              onPress={handleCapture}
            >
              <View style={styles.innerCircle}>
                <Text style={styles.captureButtonText}>START</Text>
              </View>
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
    backgroundColor: '#f5f5f5',
  },
  content: {
    flex: 1,
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 20,
  },
  description: {
    fontSize: 16,
    textAlign: 'center',
    color: '#7f8c8d',
    marginBottom: 50,
  },
  statusContainer: {
    height: 250,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusBox: {
    alignItems: 'center',
  },
  statusText: {
    marginTop: 15,
    fontSize: 18,
    color: '#34495e',
    fontWeight: '500',
  },
  captureButton: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: '#3498db',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  innerCircle: {
    width: 170,
    height: 170,
    borderRadius: 85,
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureButtonText: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
  },
  backButton: {
    marginTop: 50,
    padding: 10,
  },
  backButtonText: {
    color: '#e74c3c',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default MockCaptureScreen;
