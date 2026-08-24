import Pocketbase from 'pocketbase';

// Single production PocketBase endpoint for Bomber Trainer V6.
const POCKETBASE_API_URL = 'https://r16tt07qxqir1ks.ba7w.pocketbasecloud.com';
const pocketbaseClient = new Pocketbase(POCKETBASE_API_URL);

// Avoid duplicate reads caused by page/auth re-renders. Keep stale successful
// values available during a temporary 429 so the app remains usable.
const READ_CACHE_MS = 60_000;
const readCache = new Map();
const inFlightReads = new Map();
const OPTIONAL_COLLECTIONS = new Set(['bt_weights', 'bt_goals']);
const USER_PRIVATE_COLLECTIONS = new Set(['bt_sessions', 'bt_weights', 'bt_goals']);
const WRITE_METHODS = new Set(['create', 'update', 'upsert', 'delete']);
const cacheKey = (name, args) => `${pocketbaseClient.authStore.record?.id || 'guest'}|${name}|${JSON.stringify(args || [])}`;
export const clearRequestCache = () => readCache.clear();

const originalCollection = pocketbaseClient.collection.bind(pocketbaseClient);
pocketbaseClient.collection = (name) => {
    const service = originalCollection(name);
    return new Proxy(service, {
        get(target, property, receiver) {
            if (WRITE_METHODS.has(property)) {
                const method = Reflect.get(target, property, receiver);
                if (typeof method !== 'function') return method;
                return async (...args) => {
                    const result = await method.apply(target, args);
                    clearRequestCache();
                    return result;
                };
            }
            if (property !== 'getFullList') return Reflect.get(target, property, receiver);
            return async (...args) => {
                const owner = pocketbaseClient.authStore.record?.id;
                let requestArgs = args;

                // PRIVACY BOUNDARY: all personal training/progress reads are
                // automatically restricted to the currently authenticated user.
                // This also protects older screens that forgot to add a filter.
                if (USER_PRIVATE_COLLECTIONS.has(name) && owner) {
                    const options = { ...(args[0] || {}) };
                    const ownFilter = `owner = "${owner}"`;
                    options.filter = options.filter ? `(${options.filter}) && ${ownFilter}` : ownFilter;
                    requestArgs = [options, ...args.slice(1)];
                }

                const key = cacheKey(name, requestArgs);
                const cached = readCache.get(key);
                if (cached && Date.now() - cached.time < READ_CACHE_MS) return cached.value;
                if (inFlightReads.has(key)) return inFlightReads.get(key);

                const request = (async () => {
                    try {
                        const rawValue = await target.getFullList.apply(target, requestArgs);
                        // Defense in depth: the admin account is intentionally allowed
                        // to read all session records for the admin panel, but normal
                        // personal screens must never receive another user's records.
                        const value = USER_PRIVATE_COLLECTIONS.has(name) && owner && Array.isArray(rawValue)
                            ? rawValue.filter((record) => String(record?.owner || '') === String(owner))
                            : rawValue;
                        readCache.set(key, { time: Date.now(), value });
                        return value;
                    } catch (error) {
                        const status = Number(error?.status || error?.response?.code || 0);
                        // A rate limit must never cause a request storm. If this
                        // exact query was loaded before, serve the stale result.
                        if (status === 429 && cached) return cached.value;
                        // Optional panels (weight/objectives) must not break the
                        // whole Progress screen when their collection is absent
                        // or temporarily rate-limited.
                        if ((status === 404 || status === 429) && OPTIONAL_COLLECTIONS.has(name)) {
                            const message = error?.response?.message || error?.message || '';
                            if (status === 429 || /missing (or invalid )?collection context/i.test(message)) return [];
                        }
                        throw error;
                    } finally {
                        inFlightReads.delete(key);
                    }
                })();

                inFlightReads.set(key, request);
                return request;
            };
        },
    });
};

pocketbaseClient.clearRequestCache = clearRequestCache;
export default pocketbaseClient;
export { pocketbaseClient };
