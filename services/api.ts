// 1) imports
import axios, { AxiosInstance, AxiosRequestConfig } from "axios";
import * as SecureStore from "expo-secure-store";

// 2) BASE_URL + api instance
const BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || "";
const api: AxiosInstance = axios.create({ baseURL: BASE_URL, timeout: 20000 });

// 3) interceptor (auth + Accept-Language)
api.interceptors.request.use(async (config) => {
  config.headers = config.headers ?? {};

  const idToken = (await SecureStore.getItemAsync("idToken")) || "";
  if (idToken && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${idToken}`;
  }

  // IMPORTANT: prefer preferred_language, fallback to auth_language
  const preferred =
    (await SecureStore.getItemAsync("preferred_language")) ||
    (await SecureStore.getItemAsync("auth_language")) ||
    "en";

  config.headers["x-language"] = preferred;       // ✅ always reliable in Lambda
  config.headers["Accept-Language"] = preferred;
  console.log("➡️", config.method?.toUpperCase(), config.url, "Accept-Language:", config.headers?.['accept-Language'] || config.headers?.['accept-language']);

  return config;
});

// 4) helper exports (optional but good)
export async function apiGet<T = any>(url: string, config?: AxiosRequestConfig): Promise<T> {
  const res = await api.get<T>(url, config);
  return res.data;
}
export async function apiPost<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
  const res = await api.post<T>(url, data, config);
  return res.data;
}
export async function apiPut<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
  const res = await api.put<T>(url, data, config);
  return res.data;
}
export async function apiDelete<T = any>(url: string, config?: AxiosRequestConfig): Promise<T> {
  const res = await api.delete<T>(url, config);
  return res.data;
}

// 5) default export
export default api;
