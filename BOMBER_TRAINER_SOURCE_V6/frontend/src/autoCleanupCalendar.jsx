import { useEffect } from 'react';
import pb from '@/lib/pocketbaseClient';

export default function AutoCleanupCalendar() {
  useEffect(() => {
    const owner = pb.authStore.record?.id;
    if (!owner) return;
    const key = `bomber-trainer-personal-calendar-v1-user-${owner}`;
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return;
      const calendar = JSON.parse(raw);
      if (!calendar || typeof calendar !== 'object') return;
      let changed = false;
      for (const date of ['2026-08-21', '2026-08-22', '2026-08-23']) {
        if (Object.prototype.hasOwnProperty.call(calendar, date)) { delete calendar[date]; changed = true; }
      }
      if (changed) localStorage.setItem(key, JSON.stringify(calendar));
    } catch (error) { console.warn('Calendar cleanup skipped', error); }
  }, []);
  return null;
}
