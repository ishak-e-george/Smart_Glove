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
    const profileByGesture: Record<string, [number, number, number, number, number, number]> = {
      REST: [1764, 1763, 2, 1913, 1912, 6],
      INDEX_BENT: [1549, 1545, 70, 1912, 1909, 7],
      MIDDLE_BENT: [1733, 1735, 5, 1870, 1870, 47],
    };
    const [
      indexRawTarget,
      indexSmoothTarget,
      indexPercentTarget,
      middleRawTarget,
      middleSmoothTarget,
      middlePercentTarget,
    ] =
      profileByGesture[gestureCode] ?? profileByGesture.INDEX_BENT;
    
    const samples: number[][] = [];
    
    for (let i = 0; i < numSamples; i++) {
      const noise = Math.sin(i * 0.33) * 3;
      const indexRaw = Math.round(indexRawTarget + noise);
      const indexSmooth = Math.round(indexSmoothTarget + noise);
      const middleRaw = Math.round(middleRawTarget - noise);
      const middleSmooth = Math.round(middleSmoothTarget - noise);
      const indexPercent = Math.max(0, Math.min(100, Math.round(indexPercentTarget + noise)));
      const middlePercent = Math.max(0, Math.min(100, Math.round(middlePercentTarget - noise)));

      samples.push([
        indexRaw,
        indexSmooth,
        indexPercent,
        middleRaw,
        middleSmooth,
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
