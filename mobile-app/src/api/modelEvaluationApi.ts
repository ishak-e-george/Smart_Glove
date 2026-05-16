import client from './client';

export interface ModelEvaluation {
  status: 'ready' | 'unavailable';
  reason?: string;
  accuracy?: number;
  feature_set?: string;
  feature_columns?: string[];
  labels?: string[];
  label_counts?: Record<string, number>;
  test_rows?: number;
  classification_report?: Record<string, any>;
  confusion_matrix?: number[][];
}

export const modelEvaluationApi = {
  getEvaluation: async (): Promise<ModelEvaluation> => {
    const response = await client.get('/datasets/status/evaluation');
    return response.data;
  },
};
