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
    const sensorCount = 6;
    const profileByGesture: Record<string, [number, number]> = {
      REST: [8, 8],
      INDEX_BENT: [78, 12],
      MIDDLE_BENT: [12, 78],
      BOTH_BENT: [82, 82],
      INDEX_HALF: [48, 12],
    };
    const [indexTarget, middleTarget] = profileByGesture[gestureCode] ?? profileByGesture.BOTH_BENT;
    
    const samples: number[][] = [];
    
    for (let i = 0; i < numSamples; i++) {
      const noise = Math.sin(i * 0.33) * 3;
      const indexPercent = Math.max(0, Math.min(100, Math.round(indexTarget + noise)));
      const middlePercent = Math.max(0, Math.min(100, Math.round(middleTarget - noise)));
      const indexRaw = Math.round(300 + indexPercent * 4);
      const middleRaw = Math.round(300 + middlePercent * 4);

      samples.push([
        indexRaw,
        indexRaw,
        indexPercent,
        middleRaw,
        middleRaw,
        middlePercent,
      ]);
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
