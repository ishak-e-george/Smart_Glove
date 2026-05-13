import client from './client';
import { PredictionRequest, PredictionResponse } from '../types/recording';

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
};
