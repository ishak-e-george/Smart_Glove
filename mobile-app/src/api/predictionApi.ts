import client from './client';
import { PredictionRequest, PredictionResponse, RecordingPredictionResponse } from '../types/recording';

export const predictionApi = {
  createPrediction: async (data: PredictionRequest): Promise<PredictionResponse> => {
    const response = await client.post('/predictions/', data);
    return response.data;
  },

  getPredictions: async (deviceId?: number): Promise<PredictionResponse[]> => {
    const response = await client.get('/predictions/', {
      params: {
        device_id: deviceId,
      },
    });
    return response.data;
  },

  createFromRecording: async (recordingId: number): Promise<RecordingPredictionResponse> => {
    const response = await client.post(`/predictions/from-recording/${recordingId}`);
    return response.data;
  },
};
