import client from './client';

export interface TrainingExport {
  recording_count: number;
  row_count: number;
  label_counts: Record<string, number>;
  csv_columns: string[];
  csv_preview: Record<string, string | number>[];
  manifest: {
    feature_set: string;
    samples: Array<{
      recording_id: number;
      gesture_code: string;
      file_path: string;
      sample_rate?: number;
      duration_ms?: number;
      sensor_count?: number;
      rows_exported: number;
    }>;
    skipped: Array<{
      recording_id: number;
      reason: string;
    }>;
  };
}

export const datasetExportApi = {
  exportRecordings: async (): Promise<TrainingExport> => {
    const response = await client.get('/datasets/export/recordings');
    return response.data;
  },
};
