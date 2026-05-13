import axios from 'axios';

// Change this to your local machine IP if testing on physical device
// For Android Emulator, use http://10.0.2.2:8000
const BASE_URL = 'http://localhost:8000/api/v1';

const client = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const setAuthToken = (token: string | null) => {
  if (token) {
    client.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete client.defaults.headers.common['Authorization'];
  }
};

export default client;
