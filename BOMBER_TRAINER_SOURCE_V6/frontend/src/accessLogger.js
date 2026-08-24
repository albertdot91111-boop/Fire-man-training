import pb from '@/lib/pocketbaseClient';

const ACCESS_LOGGED_KEY = 'bt:access-logged-session-v4';

export async function logAuthenticatedAccess(user) {
  if (!user?.id || !user?.email) return;
  if (sessionStorage.getItem(ACCESS_LOGGED_KEY) === user.id) return;

  const date = new Date().toISOString();

  // Try the full record first, including the email.
  try {
    const record = await pb.collection('bt_access_logs').create({
      relation: user.id,
      email: user.email,
      date,
      action: `login|${user.email}`,
    });
    if (record?.id) sessionStorage.setItem(ACCESS_LOGGED_KEY, user.id);
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
    if (record?.id) sessionStorage.setItem(ACCESS_LOGGED_KEY, user.id);
  } catch (error) {
    console.error('Bomber Trainer access log failed', error);
  }
}
