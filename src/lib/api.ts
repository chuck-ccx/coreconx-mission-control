const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://100.70.32.111:3100';
const API_TOKEN = process.env.NEXT_PUBLIC_API_TOKEN || 'coreconx-mc-2026';

export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T | null> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      headers: {
        Authorization: `Bearer ${API_TOKEN}`,
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      cache: 'no-store',
      ...options,
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}
