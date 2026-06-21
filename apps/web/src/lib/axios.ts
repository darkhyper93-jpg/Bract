import axios, { AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '../stores/authStore';

const apiClient = axios.create({
  baseURL: import.meta.env['VITE_API_URL'] ?? 'http://localhost:4000/api/v1',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: unknown) => void;
}> = [];

function processQueue(error: unknown, token: string | null = null) {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token!);
    }
  });
  failedQueue = [];
}

apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = useAuthStore.getState().accessToken;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

apiClient.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error);
    }

    // El propio endpoint de refresh devolviendo 401 NO debe disparar otro refresh
    // (si no, se re-entra al interceptor con isRefreshing=true y se cuelga la cola).
    if (originalRequest.url?.includes('/auth/refresh')) {
      useAuthStore.getState().logout();
      return Promise.reject(error);
    }

    // Queue subsequent 401s while refresh is in flight
    if (isRefreshing) {
      return new Promise<string>((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      }).then((token) => {
        originalRequest.headers.Authorization = `Bearer ${token}`;
        return apiClient(originalRequest);
      });
    }

    originalRequest._retry = true;
    isRefreshing = true;

    try {
      const response = await apiClient.post<{
        data: { access_token: string };
      }>('/auth/refresh');
      const { access_token } = response.data.data;

      useAuthStore.getState().setToken(access_token);
      processQueue(null, access_token);

      originalRequest.headers.Authorization = `Bearer ${access_token}`;
      return apiClient(originalRequest);
    } catch (refreshError) {
      processQueue(refreshError, null);
      // DECISIÓN: solo deslogueamos ante un fallo de auth REAL (refresh → 401 = sesión
      // inválida). Un error sin response (red/timeout) o un 5xx (API de Render dormida)
      // es transitorio: rechazamos los requests encolados y el original, pero mantenemos
      // la sesión intacta para que el usuario pueda reintentar sin perder el login.
      if (axios.isAxiosError(refreshError) && refreshError.response?.status === 401) {
        useAuthStore.getState().logout();
        // Sin hard-redirect: logout() actualiza el store y el router muestra /login solo.
        // (window.location.href causaba un loop de reloads en el bootstrap sin sesión.)
      }
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  },
);

export default apiClient;
