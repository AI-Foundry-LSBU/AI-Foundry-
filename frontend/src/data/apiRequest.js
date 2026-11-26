let csrfToken;

export function clearSessionToken() {
  csrfToken = undefined;
}

export async function requestApi(path, options = {}, unavailableMessage = 'The service is unavailable. Please try again.') {
  const method = options.method ?? 'GET';
  const writes = !['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase());
  const response = await fetch(`/api/v1${path}`, {
    ...options,
    credentials: 'same-origin',
    headers: { ...options.headers, ...(writes && csrfToken ? { 'X-CSRF-Token': csrfToken } : {}) },
  }).catch((error) => {
    if (error.name === "AbortError") throw error;
    throw new Error(unavailableMessage);
  });

  if (response.status === 204) return null;
  const data = await response.json().catch(() => null);
  if (!response.ok || !data) {
    if (response.status === 401 && path !== '/auth/login' && path !== '/auth/me') {
      clearSessionToken();
      window.dispatchEvent(new Event('ai-foundry:session-ended'));
    }
    const message = response.status >= 500 ? unavailableMessage : data?.message ?? unavailableMessage;
    throw Object.assign(new Error(message), { status: response.status, fields: data?.fields });
  }
  if (data.csrfToken) csrfToken = data.csrfToken;
  return data;
}

// Existing data functions still use email to key their React loading state.
// Identity on the wire comes only from the session cookie, never from that argument.
export function requestJson(_email, path, options, unavailableMessage) {
  return requestApi(path, options, unavailableMessage);
}
