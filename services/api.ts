// services/api.ts
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const LOCAL_BASE =
  Platform.OS === 'android' ? 'http://10.0.2.2:4000' : 'http://localhost:4000';

const ENV_BASE =
  (Constants.expoConfig?.extra as any)?.API_BASE_URL ||
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  LOCAL_BASE;

const withSlash = (p: string) => (p.startsWith('/') ? p : `/${p}`);

export async function apiGet<T = any>(
  path: string,
  params?: Record<string, unknown>,
  opts?: { timeoutMs?: number }
): Promise<T> {
  const idToken = await SecureStore.getItemAsync('idToken');

  const qs = params
    ? `?${new URLSearchParams(
        Object.entries(params).reduce<Record<string, string>>((a, [k, v]) => {
          a[k] = v == null ? '' : String(v);
          return a;
        }, {})
      ).toString()}`
    : '';

  const url = `${ENV_BASE}${withSlash(path)}${qs}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), opts?.timeoutMs ?? 10000);

  try {
    const res = await fetch(url, {
      headers: idToken ? { Authorization: `Bearer ${idToken}` } : {},
      signal: controller.signal,
    });

    const text = await res.text();
    const body = text ? (() => { try { return JSON.parse(text); } catch { return text; } })() : null;

    if (!res.ok) {
      throw new Error(
        typeof body === 'string' ? `HTTP ${res.status} ${body}` : `HTTP ${res.status} ${JSON.stringify(body)}`
      );
    }
    return body as T;
  } finally {
    clearTimeout(timeout);
  }
}
