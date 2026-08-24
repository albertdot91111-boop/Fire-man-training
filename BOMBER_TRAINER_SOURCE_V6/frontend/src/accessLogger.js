import pb from '@/lib/pocketbaseClient';

// Versioned key: ensures an already-open session gets one fresh access log
// after this email-tracking change is deployed.
const ACCESS_LOGGED_KEY = 'bt:access-logged-session-v2';

export async function logAuthenticatedAccess(user) {
  if (!user?.id || !user?.email) return;
  if (sessionStorage.getItem(ACCESS_LOGGED_KEY) === user.id) return;

  const payload = {
    relation: user.id,
    email: user.email,
    date: new Date().toISOString(),
    action: 'login',
  };

  try {
    await pb.collection('bt_access_logs').create(payload);
    sessionStorage.setItem(ACCESS_LOGGED_KEY, user.id);
  } catch (error) {
    try {
      await pb.collection('bt_access_logs').create({
        relation: user.id,
        date: payload.date,
        action: `login|${user.email}`,
      });
      sessionStorage.setItem(ACCESS_LOGGED_KEY, user.id);
    } catch (fallbackError) {
      console.warn('Bomber Trainer access log unavailable', fallbackError);
    }
  }
}
