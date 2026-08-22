export const TYPES = {
    estructural: { key: 'estructural', label: 'Incendi estructural', short: 'ESTRUCTURAL', color: '#dc2626', soft: '#fee2e2' },
    forestal: { key: 'forestal', label: 'Incendi forestal', short: 'FORESTAL', color: '#ea580c', soft: '#ffedd5' },
    aquatic: { key: 'aquatic', label: 'Prova aquàtica', short: 'AQUÀTICA', color: '#0284c7', soft: '#e0f2fe' },
    pressbanca: { key: 'pressbanca', label: 'Press banca', short: 'PRESS BANCA', color: '#7c3aed', soft: '#ede9fe' },
    manteniment: { key: 'manteniment', label: 'Manteniment', short: 'MANTENIMENT', color: '#ca8a04', soft: '#fef9c3' },
    rapid: { key: 'rapid', label: 'Entrenament ràpid', short: 'RÀPID', color: '#d97706', soft: '#fef3c7' },
    descans: { key: 'descans', label: 'Dia no disponible', short: 'NO DISPONIBLE', color: '#64748b', soft: '#f1f5f9' },
};

export const MATERIAL = [
    'Trineu', 'Corda', 'Slam balls', 'Box', 'Discos', 'Kettlebells',
    'Armilla llastrada', 'Tanques', 'Cons', 'Barra d\'equilibri', 'Maniquí',
];

export const PLANS = {
    estructural: [
        { name: '1. Discos (transport)', detail: '2 discos de 10 kg · equilibri + 10 step-ups', fields: ['temps', 'descans'] },
        { name: '2. Kettlebells', detail: '2 kettlebells de 16 kg · configuració fixa del projecte', fields: ['temps', 'descans'] },
        { name: '3. Trineu', detail: '10 m estirar + 10 m empènyer', fields: ['temps', 'descans'] },
        { name: '4. Recorregut en C', detail: 'Recorregut sota tanques', fields: ['temps', 'descans'] },
        { name: '5. Arrossegament de maniquí', detail: 'Ninot de 50 kg · configuració fixa del projecte', fields: ['temps', 'descans'] },
        { name: '6. Esprint final', detail: '10 m', fields: ['temps', 'descans'] },
    ],
    forestal: [
        { name: 'TRAM 1', detail: 'Bloc INEFC: 8 x 20 m + 16 slam balls', fields: ['temps', 'descans'] },
        { name: 'TRAM 2', detail: 'Bloc INEFC: 10 x 20 m + 20 slam balls', fields: ['temps', 'descans'] },
        { name: 'TRAM 3', detail: 'Bloc INEFC: 12 x 20 m + 24 slam balls', fields: ['temps', 'descans'] },
        { name: 'CIRCUIT COMPLET', detail: 'Els 3 blocs seguits · temps total i temps de cada bloc', fields: ['temps', 'tram1', 'tram2', 'tram3'] },
    ],
    aquatic: [
        { name: '1. Entrada segura', detail: 'Peus primer, cap fora i contacte visual', fields: ['temps'] },
        { name: '2. Apnea', detail: '15 m sota tanca', fields: ['temps'] },
        { name: '3. Batuda / bicicleta', detail: '30 s amb cap i mans fora', fields: ['temps'] },
        { name: '4. Estil lliure sota corxeres', detail: '25 m anada + 25 m tornada · tocant paret i sense viratge', fields: ['temps'] },
        { name: '5. Crol de salvament', detail: '25 m amb cap fora excepte al pas de corxeres', fields: ['temps'] },
        { name: '6. Remolc de maniquí', detail: '25 m · vies aèries fora excepte al pas de corxeres · extracció completa', fields: ['temps'] },
    ],
    manteniment: [
        { name: 'Dominades', detail: 'Repeticions per sèrie · sense material', fields: ['series'] },
        { name: 'Flexions', detail: 'Repeticions per sèrie · sense material', fields: ['series'] },
        { name: 'Planxa / abdominals', detail: 'Segons o repeticions per sèrie · tria planxa o abdominals', fields: ['series'] },
        { name: 'Sentadilla', detail: 'Repeticions per sèrie · sense material', fields: ['series'] },
        { name: 'Pes mort', detail: 'Repeticions per sèrie · sense material', fields: ['series'] },
    ],
    rapid: [
        { name: 'Circuit ràpid', detail: 'Adaptat als minuts disponibles', fields: ['temps'] },
    ],
    pressbanca: [
        { name: 'Press banca', detail: 'Registra pes, repeticions i temps de la prova', fields: ['pes', 'reps', 'temps'] },
    ],
    descans: [],
};

export const INCIDENTS = ['Caiguda', 'Fatiga', 'Dolor', 'Material insuficient', 'Falta de temps', 'Calor'];
export const POINTS = { complet: 100, manteniment: 40, minim: 20 };

// Barem PROVISIONAL propi de Bomber Trainer. Es substituirà quan surtin les bases.
export const PHYSICAL_BAREMS = {
    forestal: { 0: 280, 1: 270, 2: 260, 3: 250, 4: 240, 5: 230, 6: 220, 7: 210, 8: 205, 9: 200, 10: 190 },
    estructural: { 0: 230, 1: 220, 2: 210, 3: 200, 4: 190, 5: 180, 6: 170, 7: 160, 8: 150, 9: 140, 10: 130 },
    aquatic: { 0: 280, 1: 270, 2: 260, 3: 250, 4: 240, 5: 230, 6: 220, 7: 210, 8: 205, 9: 200, 10: 190 },
};

// Barem provisional actual de press banca: 65 kg + 20 repeticions + 45 s = 10.
// Menys temps és millor. La nota final és el mínim de pes, repeticions i temps.
export const PRESS_BENCH_TARGET = { weightKg: 65, reps: 20, timeSeconds: 45 };

export function formatTime(totalSeconds) {
    const seconds = Math.max(0, Math.round(Number(totalSeconds) || 0));
    const minutes = Math.floor(seconds / 60);
    const rest = seconds % 60;
    return `${minutes}:${String(rest).padStart(2, '0')}`;
}

export function parseTime(value) {
    if (typeof value === 'number') return Number.isFinite(value) ? value * 60 : 0;
    const text = String(value ?? '').trim();
    if (!text) return 0;
    if (text.includes(':')) {
        const [m, s = '0'] = text.split(':');
        const minutes = Number(m);
        const seconds = Number(s);
        return Number.isFinite(minutes) && Number.isFinite(seconds) ? (minutes * 60) + seconds : 0;
    }
    if (/^\d+\s*,\s*\d{1,2}$/.test(text)) {
        const [m, s] = text.split(',').map((part) => Number(part.trim()));
        return Number.isFinite(m) && Number.isFinite(s) && s >= 0 && s < 60 ? (m * 60) + s : 0;
    }
    const minutes = Number(text);
    return Number.isFinite(minutes) ? minutes * 60 : 0;
}

export function gradeForTime(type, totalSeconds) {
    const barem = PHYSICAL_BAREMS[type];
    const time = Number(totalSeconds);
    if (!barem || !Number.isFinite(time) || time <= 0) return null;
    const grades = Object.keys(barem).map(Number).sort((a, b) => a - b);
    if (time <= barem[10]) return 10;
    if (time >= barem[0]) return 0;
    for (let i = 0; i < grades.length - 1; i += 1) {
        const lowGrade = grades[i];
        const highGrade = grades[i + 1];
        const slow = barem[lowGrade];
        const fast = barem[highGrade];
        if (time <= slow && time >= fast) {
            const ratio = (slow - time) / (slow - fast);
            return Math.round((lowGrade + ratio * (highGrade - lowGrade)) * 10) / 10;
        }
    }
    return 0;
}

export function gradeForBench(weight, reps, timeSeconds) {
    const kg = Number(weight) || 0;
    const repetitions = Number(reps) || 0;
    const time = Number(timeSeconds);
    if (kg <= 0 || repetitions <= 0) return null;
    const weightScore = Math.max(0, Math.min(10, (kg / PRESS_BENCH_TARGET.weightKg) * 10));
    const repsScore = Math.max(0, Math.min(10, (repetitions / PRESS_BENCH_TARGET.reps) * 10));
    const timeScore = Number.isFinite(time) && time > 0
        ? (time <= PRESS_BENCH_TARGET.timeSeconds ? 10 : Math.max(0, Math.min(10, 10 - ((time - PRESS_BENCH_TARGET.timeSeconds) / PRESS_BENCH_TARGET.timeSeconds) * 10)))
        : null;
    const scores = [weightScore, repsScore];
    if (timeScore !== null) scores.push(timeScore);
    return Math.round(Math.min(...scores) * 10) / 10;
}

export const LEVELS = [
    { name: 'Aspirant', min: 0 },
    { name: 'Preparació', min: 600 },
    { name: 'Bomber', min: 2000 },
    { name: 'Elite', min: 5000 },
];

export const levelFor = (points) => LEVELS.reduce((acc, l) => (points >= l.min ? l : acc), LEVELS[0]);
export const nextLevel = (points) => LEVELS.find((l) => l.min > points) || null;
export const today = () => new Date().toISOString().slice(0, 10);
export const dayDiff = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000);

export function totalPoints(sessions) {
    return sessions.reduce((sum, s) => sum + (s.points || 0), 0);
}

export function parseSeries(value) {
    if (Array.isArray(value)) return value.map(Number).filter(Number.isFinite);
    return String(value ?? '').split(/[\/,\s]+/).map(Number).filter(Number.isFinite);
}

export function maintenanceEvolution(sessions) {
    const byExercise = {};
    sessions.filter((s) => s.type === 'manteniment').forEach((s) => {
        const data = Array.isArray(s.data) ? s.data : [];
        data.filter((item) => item?.exercici && item.exercici !== 'Bloc de manteniment').forEach((item) => {
            const name = String(item.exercici).trim();
            const reps = Number(item.repeticions ?? item.reps);
            const weight = Number(item.llastKg ?? item.pes);
            const time = String(item.temps ?? '').trim();
            if (!byExercise[name]) byExercise[name] = [];
            if ((Number.isFinite(weight) && weight > 0) || (Number.isFinite(reps) && reps > 0) || time) {
                byExercise[name].push({ date: s.date, weight: weight > 0 ? weight : null, reps: reps > 0 ? reps : null, time: time || null });
            }
        });
        const legacy = data.find((item) => item?.exercici === 'Bloc de manteniment');
        if (legacy) {
            const values = parseSeries(legacy.series ?? legacy.reps ?? legacy.temps);
            if (values.length) {
                if (!byExercise.Manteniment) byExercise.Manteniment = [];
                byExercise.Manteniment.push({ date: s.date, weight: null, reps: values.reduce((a, b) => a + b, 0), time: null });
            }
        }
    });
    return Object.entries(byExercise).map(([exercici, history]) => {
        const sorted = history.sort((a, b) => String(a.date).localeCompare(String(b.date)));
        const last = sorted.at(-1) || null;
        const previous = sorted.length > 1 ? sorted.at(-2) : null;
        const bestWeight = Math.max(0, ...sorted.map((x) => x.weight || 0));
        const bestReps = Math.max(0, ...sorted.map((x) => x.reps || 0));
        return { exercici, history: sorted, last, previous, bestWeight: bestWeight || null, bestReps: bestReps || null };
    }).sort((a, b) => a.exercici.localeCompare(b.exercici));
}

export function streak(sessions) {
    const days = new Set(sessions.filter((s) => s.type !== 'descans').map((s) => s.date));
    const rest = new Set(sessions.filter((s) => s.type === 'descans').map((s) => s.date));
    let count = 0;
    const cursor = new Date(today());
    for (let i = 0; i < 400; i += 1) {
        const key = cursor.toISOString().slice(0, 10);
        if (days.has(key)) count += 1;
        else if (rest.has(key) || (i === 0 && !days.has(key))) { }
        else break;
        cursor.setDate(cursor.getDate() - 1);
    }
    return count;
}

export function daysSince(sessions, type) {
    const last = sessions.filter((s) => s.type === type).map((s) => s.date).sort().pop();
    return last ? dayDiff(last, today()) : null;
}

export function weakPoints(sessions) {
    return ['forestal', 'estructural'].map((t) => ({ type: t, days: daysSince(sessions, t) }))
        .filter((x) => x.days === null || x.days >= 7).sort((a, b) => (b.days ?? 999) - (a.days ?? 999));
}

export const MOTIVATION = [
    'No necessites estar motivat cada dia. Necessites continuar.',
    'El manteniment manté la ratxa, però no substitueix l\'entrenament específic.',
    'No busquem entrenaments perfectes. Busquem acumular feina útil.',
    'Cada sèrie registrada és una prova superada abans de la prova.',
];

export function buildUserContext({ sessions, weights, goals, material, minutes }) {
    const recent = sessions.slice(0, 25).map((s) => ({ data: s.date, tipus: s.type, minuts: s.duration, punts: s.points, incidencies: s.incidents, registre: s.data }));
    return [
        '[DADES DE L\'USUARI]',
        `Ratxa: ${streak(sessions)} dies. Punts totals: ${totalPoints(sessions)}. Nivell: ${levelFor(totalPoints(sessions)).name}.`,
        `Dies sense treballar: ${['estructural', 'forestal', 'manteniment'].map((t) => `${TYPES[t].short}=${daysSince(sessions, t) ?? 'mai'}`).join(', ')}.`,
        `Material disponible: ${(material && material.length ? material : ['cap indicat']).join(', ')}.`,
        `Objectius: ${goals.length ? goals.map((g) => `${g.title} (${g.current || 0}/${g.target || 0} ${g.unit || ''})`).join('; ') : 'cap'}.`,
        `Pes corporal recent: ${weights.slice(0, 5).map((w) => `${w.date}:${w.weight}kg`).join(', ') || 'sense registres'}.`,
        minutes ? `Temps disponible avui: ${minutes} minuts.` : '',
        `Últims entrenaments (JSON): ${JSON.stringify(recent)}`,
        '[FI DADES]',
    ].filter(Boolean).join('\n');
}
