import pb from '@/lib/pocketbaseClient';

const ACCESS_LOG_SESSION_KEY = 'bt:access-log-session';

// Records one access for the current authenticated browser session.
// The PocketBase collection uses relation, date and action.
export async function logAuthenticatedAccess(user, force = false) {
  if (!user?.id) return false;

  if (!force && sessionStorage.getItem(ACCESS_LOG_SESSION_KEY) === user.id) {
    return false;
  }

  const payload = {
    relation: user.id,
    date: new Date().toISOString(),
    action: 'login',
  };

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const record = await pb.collection('bt_access_logs').create(payload);
      if (!record?.id) throw new Error('PocketBase returned no access-log id');
      sessionStorage.setItem(ACCESS_LOG_SESSION_KEY, user.id);
      return true;
    } catch (error) {
      if (attempt === 0) {
        await new Promise((resolve) => setTimeout(resolve, 350));
      } else {
        // Logging must NEVER block an otherwise successful login.
        console.error('Bomber Trainer access log failed', error);
      }
    }
  }

  return false;
}

export function clearAccessLogSessionMarker() {
  sessionStorage.removeItem(ACCESS_LOG_SESSION_KEY);
}
