import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import pb from '@/lib/pocketbaseClient';
import { readNutritionStatus } from './NutritionDaily';

const keyFor = (year, month, day) => `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

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
            const date = keyFor(now.getFullYear(), now.getMonth(), day);
            const status = readNutritionStatus(owner, date);
            button.querySelectorAll('[data-bt-food-marker]').forEach((el) => el.remove());
            button.style.boxShadow = '';
            button.style.borderRadius = '';
            if (!status) return;
            const marker = document.createElement('span');
            marker.dataset.btFoodMarker = 'true';
            marker.textContent = status === 'free_meal' ? '🍕' : status === 'good' ? '✓' : '×';
            marker.setAttribute('aria-label', status === 'free_meal' ? 'Àpat lliure' : status === 'good' ? 'Nutrició correcta' : 'Nutrició a millorar');
            marker.style.cssText = 'position:absolute;right:4px;bottom:3px;font-size:12px;font-weight:900;line-height:1;pointer-events:none;';
            button.style.position = 'relative';
            button.style.boxShadow = status === 'free_meal' ? 'inset 0 0 0 3px #f59e0b' : status === 'good' ? 'inset 0 0 0 3px #16a34a' : 'inset 0 0 0 3px #dc2626';
            button.style.borderRadius = '0.75rem';
            button.title = status === 'free_meal' ? '🍕 Àpat lliure' : status === 'good' ? '🟢 Nutrició correcta' : '🔴 Nutrició a millorar';
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
    refresh();
    return () => {
      observer.disconnect();
      window.removeEventListener('bt:nutrition-updated', refresh);
      window.removeEventListener('bt:progress-updated', refresh);
      window.clearTimeout(timer);
    };
  }, [location.pathname]);
  return null;
}
