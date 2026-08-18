import Pocketbase from 'pocketbase';

// Single production PocketBase endpoint for Bomber Trainer V6.
// Keep the frontend and the PocketBase collections on the same backend.
const POCKETBASE_API_URL = 'https://r16tt07qxqir1ks.ba7w.pocketbasecloud.com';

const pocketbaseClient = new Pocketbase(POCKETBASE_API_URL);

// Progrés loads sessions, weights and goals together. If an optional collection
// is not present yet in PocketBase Cloud, don't let that break the sessions data.
// Creates/updates still surface their real error so missing collections are not hidden.
const OPTIONAL_COLLECTIONS = new Set(['bt_weights', 'bt_goals']);
const originalCollection = pocketbaseClient.collection.bind(pocketbaseClient);
pocketbaseClient.collection = (name) => {
    const service = originalCollection(name);
    if (!OPTIONAL_COLLECTIONS.has(name)) return service;

    return new Proxy(service, {
        get(target, property, receiver) {
            if (property !== 'getFullList') return Reflect.get(target, property, receiver);
            return async (...args) => {
                try {
                    return await target.getFullList.apply(target, args);
                } catch (error) {
                    const message = error?.response?.message || error?.message || '';
                    if (error?.status === 404 && /missing (or invalid )?collection context/i.test(message)) {
                        return [];
                    }
                    throw error;
                }
            };
        },
    });
};

export default pocketbaseClient;

export { pocketbaseClient };
