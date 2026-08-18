import Pocketbase from 'pocketbase';

// Single production PocketBase endpoint for Bomber Trainer V6.
// Keep the frontend and the PocketBase collections on the same backend.
const POCKETBASE_API_URL = 'https://r16tt07qxqir1ks.ba7w.pocketbasecloud.com';

const pocketbaseClient = new Pocketbase(POCKETBASE_API_URL);

export default pocketbaseClient;

export { pocketbaseClient };
