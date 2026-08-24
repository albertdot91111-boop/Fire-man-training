import pb from '@/lib/pocketbaseClient';

// Versioned key: each user gets a fresh access log after this change.
const ACCESS_LOGGED_KEY = 'bt:access-logged-session-v3';

export async function logAuthenticatedAccess(user) {
  if (!user?.id || !user?.email) return;
  if (sessionStorage.getItem(ACCESS_LOGGED_KEY) === user.id) return;

  // Keep the email in the plain action field as a durable fallback.
  // This avoids depending on the users relation or an optional email field.
  const payload = {
    relation: user.id,
    email: user.email,
    date: new Date().toISOString(),
    action: `login|${user.email}`,
  };

  try {
    await pb.collection('bt_access_logs').create(payload);
    sessionStorage.setItem(ACCESS_LOGGED_KEY, user.id);
  } catch (error) {
    try {
      await pb.collection('bt_access_logs').create({
        relation: user.id,
        date: payload.date,
        action: payload.action,
      });
      sessionStorage.setItem(ACCESS_LOGGED_KEY, user.id);
    } catch (fallbackError) {
      console.warn('Bomber Trainer access log unavailable', fallbackError);
    }
  }
}
