import Pocketbase from 'pocketbase';

// Production PocketBase for Bomber Trainer V6.
// VITE_POCKETBASE_URL can still override this value in Vercel.
const POCKETBASE_API_URL = import.meta.env.VITE_POCKETBASE_URL || 'https://r16tt07qxqir1ks.ba7w.pocketbasecloud.com';

const pocketbaseClient = new Pocketbase(POCKETBASE_API_URL);

export default pocketbaseClient;

export { pocketbaseClient };
