export class ApiError extends Error {
  status: number;
  blocked?: boolean;
  constructor(message: string, status: number, blocked?: boolean) {
    super(message);
    this.status = status;
    this.blocked = blocked;
  }
}

const RAW_API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').trim().replace(/\/+$/, '');

function getSafeApiBaseUrl(): string {
  if (!RAW_API_BASE_URL) return '';
  let base = RAW_API_BASE_URL;
  // Strip trailing /api if configured as http://host:3000/api since callers pass /api/...
  if (/\/api$/i.test(base)) {
    base = base.slice(0, -4);
  }
  if (typeof window !== 'undefined') {
    const pageHost = window.location.hostname;
    const isPageLocal =
      pageHost === 'localhost' || pageHost === '127.0.0.1' || pageHost === '::1';
    try {
      const parsed = new URL(base, window.location.origin);
      const isBaseLocal =
        parsed.hostname === 'localhost' ||
        parsed.hostname === '127.0.0.1' ||
        parsed.hostname === '::1';
      // Never route a cloud/hosted browser origin to localhost
      if (isBaseLocal && !isPageLocal) {
        return '';
      }
    } catch {
      return '';
    }
  }
  return base.replace(/\/+$/, '');
}

const API_BASE_URL = getSafeApiBaseUrl();
const TOKEN_STORAGE_KEY = 'vexora_auth_token';
let inMemoryToken: string | null = null;

export function resolveApiUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  if (!API_BASE_URL) return path;
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${normalizedPath}`;
}

export function getSessionToken(): string | null {
  if (inMemoryToken) return inMemoryToken;
  try {
    const stored =
      window.localStorage.getItem(TOKEN_STORAGE_KEY) ||
      window.sessionStorage.getItem(TOKEN_STORAGE_KEY);
    if (stored) {
      inMemoryToken = stored;
      return stored;
    }
  } catch {
    // Storage may be restricted in sandboxed third-party iframes; fall back to memory
  }
  return null;
}

export function setSessionToken(token: string | null | undefined): void {
  inMemoryToken = token || null;
  try {
    if (token) {
      window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
      window.sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
    } else {
      window.localStorage.removeItem(TOKEN_STORAGE_KEY);
      window.sessionStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  } catch {
    // Ignore storage restriction errors in sandboxed iframes
  }
}

export function clearSessionToken(): void {
  setSessionToken(null);
}

function waitMs(ms: number, signal?: AbortSignal | null): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }
    const timer = window.setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      window.clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

export async function apiFetch<T = any>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const isFormData = options.body instanceof FormData;
  const headers: Record<string, string> = {
    ...((options.headers as Record<string, string>) || {}),
  };
  if (!isFormData && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const token = getSessionToken();
  if (token && !headers['Authorization']) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const method = (options.method || 'GET').toUpperCase();
  const isIdempotent = method === 'GET' || method === 'HEAD';
  const maxAttempts = isIdempotent ? 4 : 1;
  const retryDelays = [350, 800, 1500];
  const resolvedUrl = resolveApiUrl(url);

  let res: Response | null = null;
  let lastNetworkError: unknown = null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      res = await fetch(resolvedUrl, {
        ...options,
        credentials: 'include',
        headers,
      });

      if (
        isIdempotent &&
        [502, 503, 504].includes(res.status) &&
        attempt < maxAttempts - 1
      ) {
        await waitMs(retryDelays[attempt] ?? 1000, options.signal);
        continue;
      }
      lastNetworkError = null;
      break;
    } catch (err: any) {
      if (err?.name === 'AbortError' || options.signal?.aborted) {
        throw err;
      }
      lastNetworkError = err;
      if (attempt < maxAttempts - 1) {
        await waitMs(retryDelays[attempt] ?? 1000, options.signal);
        continue;
      }
    }
  }

  if (!res) {
    const rawMsg =
      lastNetworkError instanceof Error ? lastNetworkError.message : 'Network request failed';
    const friendly = /failed to fetch|networkerror|load failed/i.test(rawMsg)
      ? 'Unable to connect to the server. Please check your connection and click Retry.'
      : rawMsg;
    throw new ApiError(friendly, 0);
  }

  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { error: text || 'Unexpected response' };
  }

  if (!res.ok) {
    if (res.status === 401 && url === '/api/auth/me') {
      clearSessionToken();
    }
    throw new ApiError(
      data?.error || `Request failed with status ${res.status}`,
      res.status,
      Boolean(data?.blocked)
    );
  }
  return data as T;
}

export function getDeviceFingerprint(): string {
  const key = 'velostream_device_fp';
  try {
    let existing = window.localStorage.getItem(key);
    if (!existing) {
      existing = `vs_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
      window.localStorage.setItem(key, existing);
    }
    return existing;
  } catch {
    return 'vs_web_default';
  }
}

export function detectClientPlatform(): { deviceName: string; platform: string } {
  if (typeof navigator === 'undefined') return { deviceName: 'Web Client', platform: 'Web' };
  const ua = navigator.userAgent;
  if (/Tizen/i.test(ua)) return { deviceName: 'Samsung Smart TV', platform: 'Samsung Tizen' };
  if (/Web0S|webOS/i.test(ua)) return { deviceName: 'LG webOS TV', platform: 'LG webOS' };
  if (/Android TV|BRAVIA|AFT/i.test(ua)) return { deviceName: 'Android TV', platform: 'Android TV' };
  if (/Android/i.test(ua)) return { deviceName: 'Android Mobile', platform: 'Android' };
  if (/iPhone|iPad|iPod/i.test(ua)) return { deviceName: 'Apple iOS Device', platform: 'iOS' };
  if (/Windows/i.test(ua)) return { deviceName: 'Windows Desktop', platform: 'Windows' };
  if (/Linux/i.test(ua)) return { deviceName: 'Linux Desktop', platform: 'Linux' };
  return { deviceName: 'Web Browser', platform: 'Web' };
}

export function formatCurrency(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function formatDuration(minutes: number): string {
  if (!minutes || minutes <= 0) return 'Live';
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
}

export function formatTimecode(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  if (hrs > 0) {
    return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${mins}:${String(secs).padStart(2, '0')}`;
}
