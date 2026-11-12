export const testPasswords = {
  DEMO_STAFF_PASSWORD: 'Staff-test-password-2026',
  DEMO_STAFF2_PASSWORD: 'Second-staff-test-2026',
  DEMO_MANAGER_PASSWORD: 'Manager-test-password-2026',
  DEMO_ENGINEER_PASSWORD: 'Engineer-test-password-2026'
};
const passwords = new Map([
  ['staff@lsbu.ac.uk', testPasswords.DEMO_STAFF_PASSWORD],
  ['staff2@lsbu.ac.uk', testPasswords.DEMO_STAFF2_PASSWORD],
  ['manager@lsbu.ac.uk', testPasswords.DEMO_MANAGER_PASSWORD],
  ['engineer@lsbu.ac.uk', testPasswords.DEMO_ENGINEER_PASSWORD]
]);
export const sessionSecret = 'Only-for-automated-tests-not-a-deployment-secret-2026';

export async function rawRequest(server, path, {
  cookie, token, body, rawBody, method, headers = {}, contentType = 'application/json'
} = {}) {
  const requestHeaders = { ...headers };
  if (cookie) requestHeaders.Cookie = cookie;
  if (token) requestHeaders['X-CSRF-Token'] = token;
  if (body !== undefined || rawBody !== undefined) requestHeaders['Content-Type'] = contentType;
  const response = await fetch(`http://127.0.0.1:${server.address().port}${path}`, {
    method: method ?? (body !== undefined || rawBody !== undefined ? 'POST' : 'GET'),
    headers: requestHeaders,
    body: rawBody ?? (body === undefined ? undefined : JSON.stringify(body))
  });
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : null, headers: response.headers };
}

export async function login(server, email, password = passwords.get(email.toLowerCase()) ?? 'Not-a-real-password') {
  const anonymous = await rawRequest(server, '/api/v1/auth/csrf');
  const anonymousCookie = anonymous.headers.getSetCookie()[0]?.split(';')[0];
  const response = await rawRequest(server, '/api/v1/auth/login', {
    cookie: anonymousCookie, token: anonymous.body.csrfToken, body: { email, password }
  });
  return {
    ...response, anonymousCookie,
    cookie: response.headers.getSetCookie()[0]?.split(';')[0], token: response.body?.csrfToken
  };
}

const sessions = new WeakMap();
export async function authenticatedRequest(server, path, { email, ...options } = {}) {
  if (email === undefined) return rawRequest(server, path, options);
  if (!sessions.has(server)) sessions.set(server, new Map());
  const users = sessions.get(server);
  if (!users.has(email)) {
    const signedIn = await login(server, email);
    if (signedIn.status !== 200) return signedIn;
    users.set(email, signedIn);
  }
  const { cookie, token } = users.get(email);
  return rawRequest(server, path, { ...options, cookie, token });
}
