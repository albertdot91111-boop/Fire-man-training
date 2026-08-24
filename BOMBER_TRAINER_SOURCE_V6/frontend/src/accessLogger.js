import pb from '@/lib/pocketbaseClient';

// One access record per real authentication token.
const ACCESS_LOGGED_KEY = 'bt:access-logged-session-v6';

export async function logAuthenticatedAccess(user) {
  if (!user?.id || !user?.email) return false;

  const token = pb.authStore?.token || '';
  const sessionKey = `${user.id}:${token}`;
  if (sessionStorage.getItem(ACCESS_LOGGED_KEY) === sessionKey) return true;

  const date = new Date().toISOString();

  // Create using only the fields that are essential. This avoids an email-field
  // schema mismatch preventing the whole login record from being saved.
  try {
    const record = await pb.collection('bt_access_logs').create({
      relation: user.id,
      date,
      action: 'login',
    });

    if (!record?.id) throw new Error('PocketBase returned no access-log id');

    // Store the email separately when the field exists. The admin page can also
    // resolve it from relation, so failure here must never delete the login event.
    try {
      await pb.collection('bt_access_logs').update(record.id, {
        email: user.email,
        action: `login|${user.email}`,
      });
    } catch (emailError) {
      console.warn('Access log saved without email field; relation remains available', emailError);
    }

    sessionStorage.setItem(ACCESS_LOGGED_KEY, sessionKey);
    return true;
  } catch (error) {
    console.error('Bomber Trainer access log failed', error);
    return false;
  }
}
