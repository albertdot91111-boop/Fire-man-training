import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import pb from '@/lib/pocketbaseClient';
import { readNutritionStatus } from './NutritionDaily';

const keyFor = (year, month, day) => `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
const PERSONAL_KEY = 'bomber-trainer-personal-calendar-v1';

function readPersonalDay(date) {
  try {
    const raw = localStorage.getItem(PERSONAL_KEY);
    const data = raw ? JSON.parse(raw) : {};
    return data?.[date] || null;
  } catch (_) {
    return null;
  }
}

export default function ProgressVisualFixes() {
  const location = useLocation();
  useEffect(() => {
    if (location.pathname !== '/progres') return undefined;
    const owner = pb.authStore.record?.id || 'guest';
    let timer;
    const refresh = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        const heading = [...document.querySelectorAll('h2')].find((el) => el.textContent?.trim() === 'Calendari del mes');
        const calendar = heading?.closest('section');
        if (calendar) {
          const now = new Date();
          const buttons = [...calendar.querySelectorAll('button')];
          buttons.forEach((button) => {
            const dayNode = [...button.querySelectorAll('span')].find((el) => /^\d{1,2}$/.test(el.textContent?.trim() || ''));
            const day = Number(dayNode?.textContent?.trim());
            if (!day || day < 1 || day > 31) return;

            button.disabled = false;
            button.removeAttribute('disabled');
            button.style.cursor = 'pointer';
            button.setAttribute('aria-label', `Obrir calendari personal del dia ${day}`);

            const date = keyFor(now.getFullYear(), now.getMonth(), day);
            const personal = readPersonalDay(date);
            const nutrition = personal?.nutrition || readNutritionStatus(owner, date);
            const trained = typeof personal?.trained === 'boolean' ? personal.trained : null;

            button.querySelectorAll('[data-bt-food-marker]').forEach((el) => el.remove());
            button.querySelectorAll('[data-bt-personal-marker]').forEach((el) => el.remove());
            button.style.boxShadow = '';
            button.style.borderRadius = '';
            button.title = '';

            let markerText = '';
            let markerLabel = '';
            let outline = '';
            if (nutrition === 'free_meal' || nutrition === 'out') {
              markerText = '🍕';
              markerLabel = 'Àpat fora';
              outline = '#f59e0b';
            } else if (nutrition === 'good') {
              markerText = '✓';
              markerLabel = 'Nutrició correcta';
              outline = '#16a34a';
            } else if (nutrition === 'bad') {
              markerText = '×';
              markerLabel = 'Nutrició a millorar';
              outline = '#dc2626';
            } else if (trained === true) {
              markerText = '✓';
              markerLabel = 'Entrenament registrat';
              outline = '#16a34a';
            } else if (trained === false) {
              markerText = '×';
              markerLabel = 'No entrenat';
              outline = '#dc2626';
            }

            if (!markerText) return;
            const marker = document.createElement('span');
            marker.dataset.btPersonalMarker = 'true';
            marker.textContent = markerText;
            marker.setAttribute('aria-label', markerLabel);
            marker.style.cssText = 'position:absolute;right:4px;bottom:3px;font-size:12px;font-weight:900;line-height:1;pointer-events:none;';
            button.style.position = 'relative';
            button.style.boxShadow = `inset 0 0 0 3px ${outline}`;
            button.style.borderRadius = '0.75rem';
            button.title = markerLabel;
            button.appendChild(marker);
          });
        }

        const weakHeading = [...document.querySelectorAll('h2,h3')].find((el) => /Punts febles/i.test(el.textContent || ''));
        const weakSection = weakHeading?.closest('section');
        if (weakSection) {
          [...weakSection.querySelectorAll('p,h3,h4,span')].forEach((el) => {
            const text = el.textContent?.trim();
            if (text === 'PIT' || text === 'Pit' || text === 'Pit / Tren superior') el.textContent = 'Press banca';
          });
        }
      }, 50);
    };
    const observer = new MutationObserver(refresh);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('bt:nutrition-updated', refresh);
    window.addEventListener('bt:progress-updated', refresh);
    window.addEventListener('bt-personal-calendar-change', refresh);
    window.addEventListener('storage', refresh);
    refresh();
    return () => {
      observer.disconnect();
      window.removeEventListener('bt:nutrition-updated', refresh);
      window.removeEventListener('bt:progress-updated', refresh);
      window.removeEventListener('bt-personal-calendar-change', refresh);
      window.removeEventListener('storage', refresh);
      window.clearTimeout(timer);
    };
  }, [location.pathname]);
  return null;
}
