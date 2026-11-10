export async function requestJson(email, path, options, unavailableMessage) {
  const response = await fetch(`/api/v1${path}`, {
    ...options,
    headers: { "X-User-Email": email, ...options.headers },
  }).catch((error) => {
    if (error.name === "AbortError") throw error;
    throw new Error(unavailableMessage);
  });

  const data = await response.json().catch(() => null);
  if (!response.ok || !data) {
    const message = response.status === 401
      ? "Sign out and sign in with a seeded demo email for your role."
      : data?.message ?? unavailableMessage;
    throw Object.assign(new Error(message), { status: response.status, fields: data?.fields });
  }

  return data;
}
