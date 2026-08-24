import pb from '@/lib/pocketbaseClient';

const OWNER_PREFIX = 'bomber-trainer-personal-calendar-v1-user-';
const CLEANUP_KEY = 'bt:cleanup:2026-08-21-23:v1';

export function cleanupOldTestCalendarEntries() {
  try {
    const owner = pb.authStore.record?.id;
    if (!owner || sessionStorage.getItem(CLEANUP_KEY) === owner) return;
    const key = `${OWNER_PREFIX}${owner}`;
    const raw = localStorage.getItem(key);
    if (!raw) { sessionStorage.setItem(CLEANUP_KEY, owner); return; }
    const calendar = JSON.parse(raw);
    if (!calendar || typeof calendar !== 'object') { sessionStorage.setItem(CLEANUP_KEY, owner); return; }
    for (const date of ['2026-08-21', '2026-08-22', '2026-08-23']) delete calendar[date];
    localStorage.setItem(key, JSON.stringify(calendar));
    window.dispatchEvent(new CustomEvent('bt-personal-calendar-change'));
    window.dispatchEvent(new CustomEvent('bt:progress-updated'));
    sessionStorage.setItem(CLEANUP_KEY, owner);
  } catch (error) { console.warn('Calendar cleanup skipped', error); }
}
