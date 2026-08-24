import pb from '@/lib/pocketbaseClient';

// One access record per real authentication token.
const ACCESS_LOGGED_KEY = 'bt:access-logged-session-v7';

export async function logAuthenticatedAccess(user) {
  if (!user?.id) return false;

  const token = pb.authStore?.token || '';
  const sessionKey = `${user.id}:${token}`;
  if (sessionStorage.getItem(ACCESS_LOGGED_KEY) === sessionKey) return true;

  try {
    // Create the complete record in one request. Normal users are allowed to
    // create their own access record; the administrator can then list them.
    const record = await pb.collection('bt_access_logs').create({
      relation: user.id,
      email: user.email || '',
      date: new Date().toISOString(),
      action: 'login',
    });

    if (!record?.id) throw new Error('PocketBase returned no access-log id');
    sessionStorage.setItem(ACCESS_LOGGED_KEY, sessionKey);
    return true;
  } catch (error) {
    // A logging problem must NEVER block an otherwise successful login.
    console.error('Bomber Trainer access log failed', error);
    return false;
  }
}
