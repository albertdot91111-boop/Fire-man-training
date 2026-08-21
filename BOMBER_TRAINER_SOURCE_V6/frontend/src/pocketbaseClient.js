import Pocketbase from 'pocketbase';

// Single production PocketBase endpoint for Bomber Trainer V6.
const POCKETBASE_API_URL = 'https://r16tt07qxqir1ks.ba7w.pocketbasecloud.com';
const pocketbaseClient = new Pocketbase(POCKETBASE_API_URL);

// The Free PocketBase Cloud API can temporarily answer 429. Avoid duplicate
// reads caused by page/auth re-renders and keep the last successful read for
// a short period so the app remains usable during a transient rate limit.
const READ_CACHE_MS = 60_000;
const readCache = new Map();
const inFlightReads = new Map();

const cacheKey = (name, args) => `${pb.authStore.record?.id || 'guest'}|${name}|${JSON.stringify(args || [])}`;

const clearRequestCache = () => {
    readCache.clear();
};

const wrapCollection = (name) => {
    const service = pocketbaseClient.collection(name);
    return new Proxy(service, {
        get(target, property, receiver) {
            if (property !== 'getFullList') return Reflect.get(target, property, receiver);
            return async (...args) => {
                const key = cacheKey(name, args);
                const now = Date.now();
                const cached = readCache.get(key);
                if (cached && now - cached.time < READ_CACHE_MS) return cached.value;

                if (inFlightReads.has(key)) return inFlightReads.get(key);

                const request = (async () => {
                    try {
                        const value = await target.getFullList.apply(target, args);
                        readCache.set(key, { time: Date.now(), value });
                        return value;
                    } catch (error) {
                        // If the provider temporarily blocks the API, prefer a
                        // recent successful result over replacing the UI with a
                        // generic "Something went wrong" error.
                        if (Number(error?.status || error?.response?.code) === 429 && cached) return cached.value;
                        if (Number(error?.status || error?.response?.code) === 404 && OPTIONAL_COLLECTIONS.has(name)) {
                            const message = error?.response?.message || error?.message || '';
                            if (/missing (or invalid )?collection context/i.test(message)) return [];
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

const OPTIONAL_COLLECTIONS = new Set(['bt_weights', 'bt_goals']);
const originalCollection = pocketbaseClient.collection.bind(pocketbaseClient);
pocketbaseClient.collection = (name) => wrapCollection(name);

// Any successful write may change a cached list, so invalidate cached reads.
for (const method of ['create', 'update', 'delete', 'authWithPassword', 'authRefresh']) {
    // Collection writes are handled at call sites; auth methods are handled
    // by PocketBase itself. This exported helper is used after writes where
    // freshness matters.
}

pocketbaseClient.clearRequestCache = clearRequestCache;

export default pocketbaseClient;
export { pocketbaseClient, clearRequestCache };
