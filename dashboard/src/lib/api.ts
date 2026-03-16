const BASE_URL = import.meta.env.VITE_API_URL ?? '';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function api<T = unknown>(
  path: string,
  body?: Record<string, unknown>,
): Promise<T> {
  const token = localStorage.getItem('scout_token');

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers,
    body: body ? JSON.stringify(body) : JSON.stringify({}),
  });

  if (res.status === 401) {
    localStorage.removeItem('scout_token');
    localStorage.removeItem('scout_user');
    window.location.href = '/login';
    throw new ApiError(401, 'Unauthorized');
  }

  const json = await res.json();

  if (!res.ok) {
    throw new ApiError(res.status, json.message ?? 'Request failed');
  }

  return json.data as T;
}
