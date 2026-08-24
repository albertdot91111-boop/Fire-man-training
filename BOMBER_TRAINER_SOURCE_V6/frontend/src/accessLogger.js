import pb from '@/lib/pocketbaseClient';

// This function is called only after a successful authentication/signup.
// Do not de-duplicate with sessionStorage: after clearing the admin history,
// a user must be able to create a new login record immediately.
export async function logAuthenticatedAccess(user) {
  if (!user?.id) return false;

  try {
    const record = await pb.collection('bt_access_logs').create({
      relation: user.id,
      email: user.email || '',
      date: new Date().toISOString(),
      action: 'login',
    });

    if (!record?.id) throw new Error('PocketBase returned no access-log id');
    return true;
  } catch (error) {
    // Logging must NEVER block an otherwise successful login.
    console.error('Bomber Trainer access log failed', error);
    return false;
  }
}
