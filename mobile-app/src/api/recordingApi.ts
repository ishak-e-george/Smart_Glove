import client from './client';

export const recordingApi = {
  upload: async (fileUri: string, deviceId: number, details: any) => {
    const formData = new FormData();
    // @ts-ignore
    formData.append('file', {
      uri: fileUri,
      name: 'recording.json',
      type: 'application/json',
    });
    formData.append('device_id', deviceId.toString());
    formData.append('sample_rate', details.sample_rate?.toString() || '50');
    formData.append('duration_ms', details.duration_ms?.toString() || '2000');
    formData.append('sensor_count', details.sensor_count?.toString() || '5');

    const response = await client.post('/recordings/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },
  
  getRecordings: async () => {
    const response = await client.get('/recordings/');
    return response.data;
  },
};
