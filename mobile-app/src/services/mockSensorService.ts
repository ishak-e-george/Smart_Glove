import { RecordingData } from '../types/recording';

export const mockSensorService = {
  /**
   * Generates mock sensor data for a given gesture and device.
   * Mimics the logic in backend/app/scripts/generate_mock_recordings.py
   */
  generateMockRecording(gestureCode: string, deviceId: number): RecordingData {
    const sampleRate = 50;
    const durationMs = 2000;
    const numSamples = (durationMs / 1000) * sampleRate;
    const sensorCount = 5;
    
    const samples: number[][] = [];
    
    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate;
      const sample: number[] = [];
      
      for (let j = 0; j < sensorCount; j++) {
        // Simulate sine-wave-like sensor values (0-1023 range)
        // Similar to the python: int(512 + 200 * math.sin(2 * math.pi * 1 * t + (j * 0.5)))
        const value = Math.floor(512 + 200 * Math.sin(2 * Math.PI * 1 * t + (j * 0.5)));
        sample.push(value);
      }
      
      samples.push(sample);
    }

    return {
      device_id: deviceId,
      gesture_code: gestureCode,
      sample_rate: sampleRate,
      duration_ms: durationMs,
      sensor_count: sensorCount,
      samples: samples
    };
  }
};
