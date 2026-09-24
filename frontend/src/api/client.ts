/**
 * Minimal fetch wrapper for the Road-Trip OS FastAPI backend.
 *
 * Set EXPO_PUBLIC_API_URL (e.g. in frontend/.env.local) to point at another
 * backend. On a physical phone use your computer's LAN IP, not 127.0.0.1.
 */
export const ApiBaseUrl = (
  process.env.EXPO_PUBLIC_API_URL ?? 'http://127.0.0.1:8000'
).replace(/\/+$/, '');

export class ApiError extends Error {
  readonly status: number;
  // Validation messages keyed by request field name (e.g. `email`).
  readonly fieldErrors: Record<string, string>;
  // Machine-readable reason for some errors, e.g. `email_not_verified`.
  readonly code: string | null;

  constructor(
    status: number,
    message: string,
    fieldErrors: Record<string, string> = {},
    code: string | null = null,
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.fieldErrors = fieldErrors;
    this.code = code;
  }
}

let authToken: string | null = null;
let onUnauthorized: (() => void) | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
}

/**
 * Called when an authenticated request comes back 401 (e.g. expired token).
 */
export function setUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler;
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
};

export async function apiRequest<T>(
  path: string,
  { method = 'GET', body }: RequestOptions = {},
): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }

  let response: Response;

  try {
    response = await fetch(`${ApiBaseUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(
      0,
      `Can't reach the server at ${ApiBaseUrl}. Is the API running?`,
    );
  }

  const data = await response.json().catch(() => undefined);

  if (!response.ok) {
    if (response.status === 401 && authToken) {
      onUnauthorized?.();
    }

    throw toApiError(response.status, data);
  }

  return data as T;
}

type ValidationIssue = { loc?: (string | number)[]; msg?: string };

// FastAPI errors are `{ detail: string }`, `{ detail: { code, message } }`
// or, for 422s, `{ detail: [{ loc: ['body', 'email'], msg: '...' }] }`.
function toApiError(status: number, data: unknown): ApiError {
  const detail = (data as { detail?: unknown } | undefined)?.detail;

  if (typeof detail === 'string') {
    return new ApiError(status, detail);
  }

  if (detail && typeof detail === 'object' && !Array.isArray(detail)) {
    const { code, message } = detail as { code?: string; message?: string };

    return new ApiError(
      status,
      message ?? `Request failed (${status}).`,
      {},
      code ?? null,
    );
  }

  if (Array.isArray(detail)) {
    const fieldErrors: Record<string, string> = {};

    for (const issue of detail as ValidationIssue[]) {
      const field = issue.loc?.[issue.loc.length - 1];
      const message = cleanMessage(issue.msg);

      if (typeof field === 'string' && message && !fieldErrors[field]) {
        fieldErrors[field] = message;
      }
    }

    const first = cleanMessage((detail as ValidationIssue[])[0]?.msg);

    return new ApiError(
      status,
      first ?? 'Please check the highlighted fields.',
      fieldErrors,
    );
  }

  return new ApiError(status, `Request failed (${status}).`);
}

// Pydantic prefixes custom validator messages with "Value error, ".
function cleanMessage(message: string | undefined) {
  return message?.replace(/^Value error, /, '');
}

export function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Something went wrong.';
}
