import pb from '@/lib/pocketbaseClient';

const ACCESS_LOGGED_KEY = 'bt:access-logged-session';

// Registra l'accés un cop per sessió. Guardem el correu sia al camp email
// (quan existeix) sia dins action com a fallback, perquè l'admin el pugui
// identificar encara que PocketBase no tingui el camp email sincronitzat.
export async function logAuthenticatedAccess(user) {
  if (!user?.id || !user?.email) return;
  if (sessionStorage.getItem(ACCESS_LOGGED_KEY) === user.id) return;

  try {
    await pb.collection('bt_access_logs').create({
      relation: user.id,
      email: user.email,
      date: new Date().toISOString(),
      action: `login|${user.email}`,
    });
    sessionStorage.setItem(ACCESS_LOGGED_KEY, user.id);
  } catch (error) {
    // Fallback for an older PocketBase schema without the email field.
    try {
      await pb.collection('bt_access_logs').create({
        relation: user.id,
        date: new Date().toISOString(),
        action: `login|${user.email}`,
      });
      sessionStorage.setItem(ACCESS_LOGGED_KEY, user.id);
    } catch (fallbackError) {
      console.warn('Bomber Trainer access log unavailable', fallbackError);
    }
  }
}
