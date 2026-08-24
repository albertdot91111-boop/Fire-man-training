import pb from '@/lib/pocketbaseClient';

const ACCESS_LOGGED_KEY = 'bt:access-logged-session';

// Guarda el correu directament al registre d'accés perquè l'administrador
// pugui identificar sempre qui ha iniciat sessió.
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
    // If the deployed PocketBase schema is older and has no email field,
    // keep the access event usable by storing the email in action as fallback.
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
