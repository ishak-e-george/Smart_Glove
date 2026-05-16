import client from './client';

export interface ReadyLabel {
  code: string;
  output: string;
  samples: number;
  status: string;
}

export interface PendingLabel {
  code: string;
  output: string;
  required_action: string;
}

export interface ModelStatus {
  trained_model: {
    path: string;
    exists: boolean;
    feature_set?: string;
    feature_columns: string[];
    labels: string[];
    load_error?: string;
  };
  dataset_counts: Record<string, number>;
  ready_labels: ReadyLabel[];
  pending_labels: PendingLabel[];
}

export const modelStatusApi = {
  getStatus: async (): Promise<ModelStatus> => {
    const response = await client.get('/datasets/status/model');
    return response.data;
  },
};
