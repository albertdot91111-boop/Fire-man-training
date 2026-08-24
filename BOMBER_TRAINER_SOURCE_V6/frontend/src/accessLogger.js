import pb from '@/lib/pocketbaseClient';

const ACCESS_LOGGED_KEY = 'bt:access-logged-session';

// Registra l'accés un cop per sessió de navegador. Guardem també el correu
// directament al registre perquè l'administrador el pugui veure encara que
// l'usuari ja no existeixi o l'expansió de la relació no estigui disponible.
export async function logAuthenticatedAccess(user) {
  if (!user?.id || !user?.email) return;
  if (sessionStorage.getItem(ACCESS_LOGGED_KEY) === user.id) return;

  try {
    await pb.collection('bt_access_logs').create({
      relation: user.id,
      email: user.email,
      date: new Date().toISOString(),
      action: 'login',
    });
    sessionStorage.setItem(ACCESS_LOGGED_KEY, user.id);
  } catch (error) {
    console.warn('Bomber Trainer access log unavailable', error);
  }
}
