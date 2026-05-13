export interface SensorSample {
  [index: number]: number;
}

export interface RecordingData {
  device_id: number;
  gesture_code: string;
  sample_rate: number;
  duration_ms: number;
  sensor_count: number;
  samples: number[][];
}

export interface Recording {
  id: number;
  device_id: number;
  gesture_id?: number;
  file_path: string;
  sample_rate: number;
  duration_ms: number;
  sensor_count: number;
  created_at: string;
}

export interface PredictionRequest {
  device_id: number;
  predicted_gesture_id: number;
  confidence: number;
  source_type: 'mock' | 'real';
}

export interface PredictionResponse {
  id: number;
  device_id: number;
  predicted_gesture_id: number;
  confidence: number;
  source_type: string;
  created_at: string;
}
