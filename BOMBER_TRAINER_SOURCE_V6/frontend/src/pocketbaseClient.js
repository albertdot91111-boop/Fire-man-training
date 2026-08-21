import Pocketbase from 'pocketbase';

// Single production PocketBase endpoint for Bomber Trainer V6.
const POCKETBASE_API_URL = 'https://r16tt07qxqir1ks.ba7w.pocketbasecloud.com';
const pocketbaseClient = new Pocketbase(POCKETBASE_API_URL);

// Avoid duplicate reads caused by page/auth re-renders. A short read cache
// also keeps the UI usable when PocketBase Cloud temporarily answers 429.
const READ_CACHE_MS = 60_000;
const readCache = new Map();
const inFlightReads = new Map();
const OPTIONAL_COLLECTIONS = new Set(['bt_weights', 'bt_goals']);

const cacheKey = (name, args) => `${pocketbaseClient.authStore.record?.id || 'guest'}|${name}|${JSON.stringify(args || [])}`;

export const clearRequestCache = () => readCache.clear();

const originalCollection = pocketbaseClient.collection.bind(pocketbaseClient);
pocketbaseClient.collection = (name) => {
    const service = originalCollection(name);
    return new Proxy(service, {
        get(target, property, receiver) {
            if (property !== 'getFullList') return Reflect.get(target, property, receiver);
            return async (...args) => {
                const key = cacheKey(name, args);
                const cached = readCache.get(key);
                if (cached && Date.now() - cached.time < READ_CACHE_MS) return cached.value;
                if (inFlightReads.has(key)) return inFlightReads.get(key);

                const request = (async () => {
                    try {
                        const value = await target.getFullList.apply(target, args);
                        readCache.set(key, { time: Date.now(), value });
                        return value;
                    } catch (error) {
                        const status = Number(error?.status || error?.response?.code || 0);
                        // Never hammer a rate-limited API with automatic retries.
                        // If we have a recent result, keep showing that result.
                        if (status === 429 && cached) return cached.value;
                        if (status === 404 && OPTIONAL_COLLECTIONS.has(name)) {
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

pocketbaseClient.clearRequestCache = clearRequestCache;

export default pocketbaseClient;
export { pocketbaseClient };
