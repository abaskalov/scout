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
    let message = 'Ошибка запроса';
    if (typeof json.error === 'string') {
      message = json.error;
    } else if (json.error?.issues) {
      // Zod validation errors
      const fieldNames: Record<string, string> = {
        password: 'Пароль', email: 'Эл. почта', name: 'Имя',
        slug: 'Слаг', message: 'Сообщение', role: 'Роль',
      };
      message = json.error.issues.map((i: { path: string[]; message: string }) => {
        const pathKey = i.path?.[0] || '';
        const field = fieldNames[pathKey] || pathKey;
        const msg = i.message
          .replace('String must contain at least', 'Минимум')
          .replace('character(s)', 'символов')
          .replace('Invalid email', 'Некорректный email')
          .replace('Required', 'Обязательное поле');
        return field ? `${field}: ${msg}` : msg;
      }).join('. ');
    } else if (json.message) {
      message = json.message;
    }
    throw new ApiError(res.status, message);
  }

  return json.data as T;
}
