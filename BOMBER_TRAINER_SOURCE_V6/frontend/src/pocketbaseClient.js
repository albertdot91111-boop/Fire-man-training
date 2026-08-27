import Pocketbase from 'pocketbase';

// Single production PocketBase endpoint for Bomber Trainer V6.
const POCKETBASE_API_URL = 'https://r16tt07qxqir1ks.ba7w.pocketbasecloud.com';
const pocketbaseClient = new Pocketbase(POCKETBASE_API_URL);
const ADMIN_EMAIL = 'albertdot91@gmail.com';

// Avoid duplicate reads caused by page/auth re-renders. Keep stale successful
// values available during a temporary 429 so the app remains usable.
const READ_CACHE_MS = 60_000;
const readCache = new Map();
const inFlightReads = new Map();
const OPTIONAL_COLLECTIONS = new Set(['bt_weights', 'bt_goals']);
const USER_PRIVATE_COLLECTIONS = new Set(['bt_sessions', 'bt_weights', 'bt_goals']);
const NO_READ_CACHE_COLLECTIONS = new Set(['bt_access_logs']);
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
                const isAdmin = String(pocketbaseClient.authStore.record?.email || '').toLowerCase() === ADMIN_EMAIL;
                let requestArgs = args;

                // Personal training/progress reads are restricted to the current
                // user. The administrator is the deliberate exception for the
                // admin users-progress dashboard.
                if (USER_PRIVATE_COLLECTIONS.has(name) && owner && !isAdmin) {
                    const options = { ...(args[0] || {}) };
                    const ownFilter = `owner = \"${owner}\"`;
                    options.filter = options.filter ? `(${options.filter}) && ${ownFilter}` : ownFilter;
                    requestArgs = [options, ...args.slice(1)];
                } else if (USER_PRIVATE_COLLECTIONS.has(name) && isAdmin && args[0]?.filter) {
                    // ProgressPage historically supplied an owner filter even for
                    // the administrator. Drop only that exact owner-only filter so
                    // the admin path remains unrestricted as intended.
                    const options = { ...(args[0] || {}) };
                    if (/^\s*owner\s*=\s*[\"'][^\"']+[\"']\s*$/.test(String(options.filter))) {
                        delete options.filter;
                        requestArgs = [options, ...args.slice(1)];
                    }
                }

                // Access logs are live admin telemetry. Never serve a stale
                // 60-second cached copy here.
                const cacheable = !NO_READ_CACHE_COLLECTIONS.has(name);
                const key = cacheKey(name, requestArgs);
                const cached = cacheable ? readCache.get(key) : null;
                if (cached && Date.now() - cached.time < READ_CACHE_MS) return cached.value;
                if (cacheable && inFlightReads.has(key)) return inFlightReads.get(key);

                const request = (async () => {
                    try {
                        const rawValue = await target.getFullList.apply(target, requestArgs);
                        // Defense in depth: normal personal screens must never
                        // receive another user's records. Admin intentionally gets all.
                        const value = USER_PRIVATE_COLLECTIONS.has(name) && owner && !isAdmin && Array.isArray(rawValue)
                            ? rawValue.filter((record) => String(record?.owner || '') === String(owner))
                            : rawValue;
                        if (cacheable) readCache.set(key, { time: Date.now(), value });
                        return value;
                    } catch (error) {
                        const status = Number(error?.status || error?.response?.code || 0);
                        if (status === 429 && cached) return cached.value;
                        // Weight history and goals are auxiliary to the main
                        // progress feed. If their collection/rules are temporarily
                        // unavailable (including PocketBase 400s caused by schema
                        // drift), do not make the whole Progrés page fail.
                        if ((status === 400 || status === 404 || status === 429) && OPTIONAL_COLLECTIONS.has(name)) {
                            return cached?.value || [];
                        }
                        throw error;
                    } finally {
                        if (cacheable) inFlightReads.delete(key);
                    }
                })();

                if (cacheable) inFlightReads.set(key, request);
                return request;
            };
        },
    });
};

pocketbaseClient.clearRequestCache = clearRequestCache;
export default pocketbaseClient;
export { pocketbaseClient };
