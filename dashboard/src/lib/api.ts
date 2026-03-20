const BASE_URL = import.meta.env.VITE_API_URL ?? '';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type TranslateFn = (key: string, params?: Record<string, string>) => string;

/**
 * Translate a Zod validation issue using i18n keys.
 */
function translateZodIssue(
  issue: { path: string[]; message: string },
  t: TranslateFn,
): string {
  const pathKey = issue.path?.[0] || '';
  const fieldKey = `validation.${pathKey}Field`;
  const field = t(fieldKey) !== fieldKey ? t(fieldKey) : pathKey;

  let msg = issue.message;

  // Translate common Zod messages
  const minMatch = msg.match(/^String must contain at least (\d+) character\(s\)$/);
  if (minMatch) {
    msg = `${t('validation.minChars')} ${minMatch[1]} ${t('validation.chars')}`;
  } else if (msg === 'Invalid email') {
    msg = t('validation.invalidEmail');
  } else if (msg === 'Required') {
    msg = t('validation.required');
  }

  return field ? `${field}: ${msg}` : msg;
}

export async function api<T = unknown>(
  path: string,
  body?: Record<string, unknown>,
  t?: TranslateFn,
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
    throw new ApiError(401, 'Unauthorized', 'UNAUTHORIZED');
  }

  const json = await res.json();

  if (!res.ok) {
    const code: string | undefined = json.code;

    // If server returned an error code and we have a translator, use i18n
    if (code && t) {
      const translated = t(`errors.${code}`);
      // If the key resolved (not returned as-is), use it
      if (translated !== `errors.${code}`) {
        throw new ApiError(res.status, translated, code);
      }
    }

    let message = t ? t('validation.requestError') : 'Request error';
    if (typeof json.error === 'string') {
      // If we have a code, prefer the raw code for the caller to translate
      message = code || json.error;
    } else if (json.error?.issues && t) {
      // Zod validation errors — translate with i18n
      message = json.error.issues
        .map((i: { path: string[]; message: string }) => translateZodIssue(i, t))
        .join('. ');
    } else if (json.error?.issues) {
      // Zod errors without translator — pass through raw
      message = json.error.issues
        .map((i: { path: string[]; message: string }) => {
          const field = i.path?.[0] || '';
          return field ? `${field}: ${i.message}` : i.message;
        })
        .join('. ');
    } else if (json.message) {
      message = json.message;
    }
    throw new ApiError(res.status, message, code);
  }

  return json.data as T;
}
