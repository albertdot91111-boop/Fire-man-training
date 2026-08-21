const STORAGE_KEY = 'bt_daily_coach_v1';

const DEFAULT_FIRST_HOUR = 10;
const SECOND_WINDOW_HOURS = 6;

export const COACH_OPTIONS = [
    { key: 'circuit', label: '🏃 CIRCUIT', type: 'forestal', to: '/entrena/forestal', detail: 'Circuit forestal / resistència' },
    { key: 'pit', label: '💪 PIT', type: 'pressbanca', to: '/entrena/pressbanca', detail: 'Press banca i tren superior' },
    { key: 'manteniment', label: '🔧 MANTENIMENT', type: 'manteniment', to: '/entrena/manteniment', detail: 'Manteniment curt i útil' },
];

const MOTIVATIONAL = [
    'No busquis el dia perfecte. Fes feina útil.',
    'Una sessió curta avui val més que una promesa per demà.',
    'La constància és el que et porta a la plaça.',
    '🔥 Avui no cal fer-ho perfecte. Cal fer-ho.',
    'Cada sessió registrada és una passa més cap a Bombers.',
    '💪 La disciplina guanya els dies de poca motivació.',
];

function dateKey(date = new Date()) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function readState() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
}

function writeState(state) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* private mode */ }
}

export function getTodayCoachState() {
    const today = dateKey();
    const state = readState();
    return state.date === today ? state : { date: today, status: 'pending', firstPromptAt: null, secondPromptAt: null, choice: null };
}

export function chooseCoachOption(key) {
    const option = COACH_OPTIONS.find((item) => item.key === key);
    if (!option) return null;
    const now = Date.now();
    const state = { ...getTodayCoachState(), status: 'chosen', choice: key, chosenAt: now, secondPromptAt: now + (SECOND_WINDOW_HOURS * 60 * 60 * 1000), completedAt: null };
    writeState(state);
    return state;
}

export function markCoachUnavailable() {
    const state = { ...getTodayCoachState(), status: 'unavailable', unavailableAt: Date.now(), secondPromptAt: null };
    writeState(state);
    return state;
}

export function markCoachCompleted() {
    const state = { ...getTodayCoachState(), status: 'completed', completedAt: Date.now(), secondPromptAt: null };
    writeState(state);
    return state;
}

export function shouldCoachPrompt({ hasTodayTraining, now = Date.now() } = {}) {
    if (hasTodayTraining) return { prompt: false, reason: 'completed' };
    const state = getTodayCoachState();
    if (state.status === 'completed' || state.status === 'unavailable') return { prompt: false, reason: state.status };

    const hour = new Date(now).getHours();
    if (!state.firstPromptAt && hour >= DEFAULT_FIRST_HOUR) {
        const next = { ...state, firstPromptAt: now, status: 'prompted', secondPromptAt: now + (SECOND_WINDOW_HOURS * 60 * 60 * 1000) };
        writeState(next);
        return { prompt: true, kind: 'first', state: next };
    }

    if (state.secondPromptAt && now >= state.secondPromptAt) {
        const next = { ...state, status: 'prompted-second', secondPromptAt: null, secondPromptShownAt: now };
        writeState(next);
        return { prompt: true, kind: 'second', state: next };
    }

    return { prompt: false, reason: 'waiting', state };
}

export function nextCoachCheckMs({ hasTodayTraining, now = Date.now() } = {}) {
    if (hasTodayTraining) return null;
    const state = getTodayCoachState();
    if (state.status === 'completed' || state.status === 'unavailable') return null;
    if (!state.firstPromptAt) {
        const first = new Date(now);
        first.setHours(DEFAULT_FIRST_HOUR, 0, 0, 0);
        if (first.getTime() <= now) return 0;
        return first.getTime() - now;
    }
    if (state.secondPromptAt) return Math.max(0, state.secondPromptAt - now);
    return null;
}

export function getCoachMotivation(seed = Date.now()) {
    return MOTIVATIONAL[Math.abs(Number(seed) || 0) % MOTIVATIONAL.length];
}

export async function requestCoachNotifications() {
    if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
    if (Notification.permission === 'granted') return 'granted';
    if (Notification.permission === 'denied') return 'denied';
    try { return await Notification.requestPermission(); } catch { return 'denied'; }
}

export async function showCoachNotification(title, body) {
    if (typeof window === 'undefined' || !('Notification' in window) || Notification.permission !== 'granted') return false;
    try {
        const registration = await navigator.serviceWorker?.getRegistration?.();
        if (registration?.showNotification) {
            await registration.showNotification(title, { body, icon: '/bomber-icon.svg', badge: '/bomber-icon.svg', tag: 'bomber-trainer-daily-coach', renotify: true });
        } else {
            new Notification(title, { body, tag: 'bomber-trainer-daily-coach' });
        }
        return true;
    } catch { return false; }
}
