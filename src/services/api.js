import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add token to requests if available
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Handle authentication errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  signup: (email, username, password) =>
    api.post('/auth/signup', { email, username, password }),

  login: (email, password) =>
    api.post('/auth/login', { email, password }),

  getCurrentUser: () =>
    api.get('/auth/me')
};

// Evolution API
export const evolutionAPI = {
  getInstance: () =>
    api.get('/evolution/instance'),

  createInstance: () =>
    api.post('/evolution/instance/create'),

  // Proxy methods for Evolution API
  proxy: (path, method = 'GET', data = null) =>
    api({
      method,
      url: `/evolution/proxy/${path}`,
      data
    })
};

export default api;
