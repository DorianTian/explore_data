const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:3100';

interface ApiResult<T> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string };
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<ApiResult<T>> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      headers: { 'Content-Type': 'application/json', ...options.headers },
      ...options,
    });

    if (res.status === 204) {
      return { success: true };
    }

    const text = await res.text();
    if (!text) {
      return { success: res.ok };
    }

    try {
      return JSON.parse(text);
    } catch {
      return {
        success: false,
        error: { code: 'PARSE_ERROR', message: `Server returned non-JSON: ${res.status}` },
      };
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Network error';
    return {
      success: false,
      error: { code: 'NETWORK_ERROR', message },
    };
  }
}

export async function apiPost<T>(path: string, body: unknown) {
  return apiFetch<T>(path, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function apiPatch<T>(path: string, body: unknown) {
  return apiFetch<T>(path, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export async function apiDelete(path: string): Promise<ApiResult<void>> {
  return apiFetch<void>(path, { method: 'DELETE' });
}
