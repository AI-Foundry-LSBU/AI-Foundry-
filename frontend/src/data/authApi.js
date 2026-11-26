import { clearSessionToken, requestApi } from './apiRequest';

const unavailable = 'Sign-in is unavailable. Check that the backend is running and try again.';
const labels = { staff: 'Staff', manager: 'Digital Project Manager', team: 'AI Foundry Engineer' };

function toUser({ user }) {
  if (!labels[user?.role]) throw new Error('This account does not have a supported role.');
  return {
    ...user,
    role: labels[user.role],
    initials: user.name.split(' ').filter(Boolean).map((part) => part[0]).join('').slice(0, 2),
    team: user.role === 'staff' ? 'LSBU Staff' : 'AI Foundry'
  };
}

export async function getCurrentSession(signal) {
  return toUser(await requestApi('/auth/me', { signal }, unavailable));
}

export async function signInWithPassword(email, password) {
  await requestApi('/auth/csrf', {}, unavailable);
  return toUser(await requestApi('/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email.trim().toLowerCase(), password })
  }, unavailable));
}

export async function endSession() {
  await requestApi('/auth/logout', { method: 'POST' }, 'Could not sign out. Please try again.');
  clearSessionToken();
}
