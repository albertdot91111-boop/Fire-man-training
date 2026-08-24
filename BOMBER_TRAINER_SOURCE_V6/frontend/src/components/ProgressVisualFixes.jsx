import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import pb from '@/lib/pocketbaseClient';
import { readNutritionStatus } from './NutritionDaily';

const STORAGE_PREFIX = 'bomber-trainer-personal-calendar-v1-user-';

function personalStorageKey(owner) {
  return owner ? `${STORAGE_PREFIX}${owner}` : null;
}

function readPersonalDay(owner, date) {
  try {
    const key = personalStorageKey(owner);
    if (!key) return null;
    const raw = localStorage.getItem(key);
    const data = raw ? JSON.parse(raw) : {};
    return data?.[date] || null;
  } catch (_) {
    return null;
  }
}

function addPercentToGrades() {
  const nodes = [...document.querySelectorAll('p')].filter((el) => /Nota(?: aprox\.)?\s+\d+(?:\.\d+)?(?:\s|$)/i.test(el.textContent || '') && !el.dataset.btGradePercent);
  nodes.forEach((el) => {
    const match = (el.textContent || '').match(/Nota(?: aprox\.)?\s+(\d+(?:\.\d+)?)/i);
    if (!match) return;
    const grade = Number(match[1]);
    if (!Number.isFinite(grade) || grade < 0 || grade > 10) return;
    el.textContent = `${el.textContent} · ${Math.round(grade * 10)}%`;
    el.dataset.btGradePercent = 'true';
  });
}

function compactForestalHome() {
  const link = document.querySelector('[data-testid="link-today-action-forestal"]');
  if (!link) return;
  link.style.minHeight = '0';
  link.style.padding = '12px';
  const progress = link.querySelector('div.mt-3.rounded-2xl');
  if (!progress) return;
  progress.style.marginTop = '8px';
  progress.style.padding = '8px';
  progress.style.borderRadius = '14px';
  progress.style.boxShadow = 'none';
  const grid = progress.firstElementChild;
  if (grid) {
    grid.style.gridTemplateColumns = 'repeat(4, minmax(0, 1fr))';
    grid.style.gap = '6px';
    [...grid.children].forEach((item) => {
      item.style.padding = '6px 7px';
      item.style.borderRadius = '10px';
      [...item.querySelectorAll('p')].forEach((p, index) => {
        p.style.marginTop = index === 1 ? '2px' : '0';
        if (index === 0) p.style.fontSize = '10px';
        if (index === 1) p.style.fontSize = '16px';
        if (index === 2) p.style.fontSize = '9px';
        p.style.lineHeight = '1.15';
      });
    });
  }
  const note = [...progress.querySelectorAll('p')].find((p) => /GLOBAL és 0%/i.test(p.textContent || ''));
  if (note) note.style.display = 'none';
}

function aquaticVisuals() {
  const title = [...document.querySelectorAll('h1,h2,p')].find((el) => /Prova aquàtica/i.test(el.textContent || ''));
  if (!title) return;
  const cards = [...document.querySelectorAll('section > div.rounded-3xl')];
  const items = [
    ['1. Entrada segura', '🧍‍♂️ → 🌊', 'Entrada peus primer · cap fora · contacte visual'],
    ['2. Apnea', '🌊 ─── 🤿 ─── 🧱', '15 m sota tanca'],
    ['3. Batuda / bicicleta', '🦵 ↔ 🦵', '30 s · cap i mans fora'],
    ['4. Estil lliure sota corxeres', '🏊 ───── ↔ ─────', '25 m anada + 25 m tornada · toca paret'],
    ['5. Crol de salvament', '🏊‍♂️ → 👀', '25 m · cap fora excepte corxeres'],
    ['6. Remolc de maniquí', '🏊‍♂️ ── 🧍', '25 m · vies aèries fora · extracció completa'],
  ];
  items.forEach(([name, diagram, detail]) => {
    const card = cards.find((el) => (el.textContent || '').includes(name));
    if (!card || card.querySelector('[data-bt-aquatic-visual]')) return;
    const visual = document.createElement('div');
    visual.dataset.btAquaticVisual = 'true';
    visual.style.cssText = 'margin-top:12px;padding:10px 12px;border-radius:16px;background:#e0f2fe;border:1px solid #bae6fd;display:flex;align-items:center;gap:10px;';
    visual.innerHTML = `<span style="font-size:22px;line-height:1">${diagram}</span><span style="font-size:12px;font-weight:700;color:#075985">${detail}</span>`;
    card.appendChild(visual);
  });
}

export default function ProgressVisualFixes() {
  const location = useLocation();
  useEffect(() => {
    const owner = pb.authStore.record?.id || '';
    let timer;
    const refresh = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        if (location.pathname === '/') compactForestalHome();
        if (location.pathname !== '/progres') return;
        aquaticVisuals();
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

            const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const personal = readPersonalDay(owner, date);
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
              markerText = '🍕'; markerLabel = 'Àpat fora'; outline = '#f59e0b';
            } else if (nutrition === 'good') {
              markerText = '✓'; markerLabel = 'Nutrició correcta'; outline = '#16a34a';
            } else if (nutrition === 'bad') {
              markerText = '×'; markerLabel = 'Nutrició a millorar'; outline = '#dc2626';
            } else if (trained === true) {
              markerText = '✓'; markerLabel = 'Entrenament registrat'; outline = '#16a34a';
            } else if (trained === false) {
              markerText = '×'; markerLabel = 'No entrenat'; outline = '#dc2626';
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

        addPercentToGrades();
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
