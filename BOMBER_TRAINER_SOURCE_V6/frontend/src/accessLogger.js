import pb from '@/lib/pocketbaseClient';

// Log once per PocketBase authentication token, not once per browser tab/user.
// This means a real new login is recorded while page refreshes do not create duplicates.
const ACCESS_LOGGED_KEY = 'bt:access-logged-session-v5';

export async function logAuthenticatedAccess(user) {
  if (!user?.id || !user?.email) return;

  const token = pb.authStore?.token || '';
  const sessionKey = `${user.id}:${token}`;
  if (sessionStorage.getItem(ACCESS_LOGGED_KEY) === sessionKey) return;

  const date = new Date().toISOString();

  // Try the full record first, including the email.
  try {
    const record = await pb.collection('bt_access_logs').create({
      relation: user.id,
      email: user.email,
      date,
      action: `login|${user.email}`,
    });
    if (record?.id) sessionStorage.setItem(ACCESS_LOGGED_KEY, sessionKey);
    return;
  } catch (error) {
    console.warn('Full access-log create failed; trying fallback', error);
  }

  // Fallback for an older schema without the email field.
  try {
    const record = await pb.collection('bt_access_logs').create({
      relation: user.id,
      date,
      action: `login|${user.email}`,
    });
    if (record?.id) sessionStorage.setItem(ACCESS_LOGGED_KEY, sessionKey);
  } catch (error) {
    console.error('Bomber Trainer access log failed', error);
  }
}
