import pb from '@/lib/pocketbaseClient';

const ACCESS_LOGGED_KEY = 'bt:access-logged-session';

// Log at most once per browser session. The record itself is readable only by
// the founder account through the PocketBase collection rules.
export async function logAuthenticatedAccess(user) {
  if (!user?.id || !user?.email) return;
  if (sessionStorage.getItem(ACCESS_LOGGED_KEY) === user.id) return;

  try {
    await pb.collection('bt_access_logs').create({
      relation: user.id,
      date: new Date().toISOString(),
      action: 'login',
    });
    sessionStorage.setItem(ACCESS_LOGGED_KEY, user.id);
  } catch (error) {
    // Access logging must never block the Trainer if the collection is
    // temporarily unavailable or has not been provisioned yet.
    console.warn('Bomber Trainer access log unavailable', error);
  }
}
