import client from './client';

export interface DeviceCreate {
  device_name: string;
  serial_number: string;
  device_type: string;
}

export const deviceApi = {
  getDevices: async () => {
    const response = await client.get('/devices/');
    return response.data;
  },
  
  createDevice: async (data: DeviceCreate) => {
    const response = await client.post('/devices/', data);
    return response.data;
  },
  
  deleteDevice: async (id: number) => {
    const response = await client.delete(`/devices/${id}`);
    return response.data;
  },
};
