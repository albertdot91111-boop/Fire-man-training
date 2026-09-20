export const TYPES = {
    estructural: { key: 'estructural', label: 'Incendi estructural', short: 'ESTRUCTURAL', color: '#dc2626', soft: '#fee2e2', official: true },
    forestal: { key: 'forestal', label: 'Incendi de vegetació', short: 'VEGETACIÓ', color: '#ea580c', soft: '#ffedd5', official: true },
    aquatic: { key: 'aquatic', label: 'Rescat aquàtic', short: 'RESCAT AQUÀTIC', color: '#0284c7', soft: '#e0f2fe', official: true },
    manteniment: { key: 'manteniment', label: 'Manteniment', short: 'MANTENIMENT', color: '#ca8a04', soft: '#fef9c3' },
    rapid: { key: 'rapid', label: 'Entrenament ràpid', short: 'RÀPID', color: '#d97706', soft: '#fef3c7' },
    descans: { key: 'descans', label: 'Dia no disponible', short: 'NO DISPONIBLE', color: '#64748b', soft: '#f1f5f9' },
    // Legacy only: kept so old sessions remain readable.
    pressbanca: { key: 'pressbanca', label: 'Històric · Press banca', short: 'HISTÒRIC', color: '#7c3aed', soft: '#ede9fe', legacy: true },
};

export const MATERIAL = [
    'Trineu', 'Corda', 'Slam balls', 'Box', 'Discos', 'Kettlebells',
    'Armilla llastrada', 'Tanques', 'Cons', 'Barra d\'equilibri', 'Maniquí',
];

export const PLANS = {
    forestal: [
        { name: '1. Fase 1 · 8 rectes + 16 llançaments', detail: '8 rectes de 20 m + 16 llançaments de pilota medicinal de 6 kg', fields: ['temps'] },
        { name: '2. Fase 2 · 10 rectes + 20 llançaments', detail: '10 rectes de 20 m + 20 llançaments de pilota medicinal de 6 kg', fields: ['temps'] },
        { name: '3. Fase 3 · 12 rectes + 24 llançaments', detail: '12 rectes de 20 m + 24 llançaments de pilota medicinal de 6 kg', fields: ['temps'] },
    ],
    estructural: [
        { name: '1. Discos + equilibri + calaix', detail: 'Armilla 10 kg · 2 discos de 10 kg · 40 m · barra d’equilibri 3 m · 10 pujades/baixades al calaix', fields: ['temps'] },
        { name: '2. Pesos russos + calaix', detail: 'Armilla 10 kg · 2 pesos russos de 12 kg · 40 m · 10 pujades/baixades al calaix', fields: ['temps'] },
        { name: '3. Estirar trineu', detail: 'Armilla 10 kg · trineu de 96 kg · estirada amb corda', fields: ['temps'] },
        { name: '4. Empènyer trineu', detail: 'Armilla 10 kg · trineu de 96 kg · empènyer 10 m', fields: ['temps'] },
        { name: '5. Recorregut en C', detail: 'Uns 10 m sota tanques de 91 cm · reptant o en quadrupèdia', fields: ['temps'] },
        { name: '6. Arrossegament de maniquí', detail: 'Maniquí de 50 kg · 18 m · primers 9 m en ziga-zaga', fields: ['temps'] },
        { name: '7. Esprint final', detail: 'Cursa de 9 m fins als cons finals', fields: ['temps'] },
    ],
    aquatic: [
        { name: '1. Entrada segura', detail: 'Entrada de peus · cap fora de l’aigua', fields: ['temps'] },
        { name: '2. Apnea', detail: '15 m en immersió completa · pas sota tanca d’1 m', fields: ['temps'] },
        { name: '3. Flotació', detail: '30 s · cap i els 10 dits visibles · sense tocar res', fields: ['temps'] },
        { name: '4. Estil lliure', detail: 'Dos trams · sota surades · tocar paret amb les mans · sense viratge ni impuls', fields: ['temps'] },
        { name: '5. Crol de salvament', detail: '25 m amb el cap fora de l’aigua', fields: ['temps'] },
        { name: '6. Remolc de maniquí', detail: '25 m · maniquí de 35 kg · vies aèries fora de l’aigua', fields: ['temps'] },
    ],
    manteniment: [
        { name: 'Dominades', detail: 'Repeticions per sèrie · sense material', fields: ['series'] },
        { name: 'Flexions', detail: 'Repeticions per sèrie · sense material', fields: ['series'] },
        { name: 'Planxa / abdominals', detail: 'Segons o repeticions per sèrie · tria planxa o abdominals', fields: ['series'] },
        { name: 'Sentadilla', detail: 'Repeticions per sèrie · sense material', fields: ['series'] },
        { name: 'Pes mort', detail: 'Repeticions per sèrie · sense material', fields: ['series'] },
    ],
    rapid: [{ name: 'Circuit ràpid', detail: 'Adaptat als minuts disponibles', fields: ['temps'] }],
    pressbanca: [{ name: 'Press banca · històric', detail: 'Només per consultar registres antics; ja no és prova 81/26.', fields: ['pes', 'reps', 'temps'] }],
    descans: [],
};

export const INCIDENTS = ['Caiguda', 'Fatiga', 'Dolor', 'Material insuficient', 'Falta de temps', 'Calor'];
export const POINTS = { complet: 100, manteniment: 40, minim: 20 };

export const PHYSICAL_BAREMS = {
    // Each array is [maximum seconds for grade], from 10 down to 0.5; 0 starts at the next second.
    resta: {
        forestal: [200,216,227,233,239,245,251,257,263,269,275,281,287,293,299,305,311,317,323,329],
        estructural: [86,102,113,119,125,131,137,143,149,155,161,167,173,179,185,191,197,203,209,215],
        aquatic: [128,144,155,161,167,173,179,185,191,197,203,209,215,221,227,233,239,245,251,257],
    },
    dones: {
        forestal: [236,252,263,269,275,281,287,293,299,305,311,317,323,329,335,341,347,353,359,365],
        estructural: [128,144,155,161,167,173,179,185,191,197,203,209,215,221,227,233,239,245,251,257],
        aquatic: [152,168,179,185,191,197,203,209,215,221,227,233,239,245,251,257,263,269,275,281],
    },
};

export const PHYSICAL_PENALTY_SECONDS = { forestal: 10, estructural: 5, aquatic: 10 };
export const PHYSICAL_GRADES = [10,9.5,9,8.5,8,7.5,7,6.5,6,5.5,5,4.5,4,3.5,3,2.5,2,1.5,1,0.5,0];

export function gradeForTime(type, totalSeconds, category = 'resta') {
    const table = PHYSICAL_BAREMS[category]?.[type] || PHYSICAL_BAREMS.resta?.[type];
    const time = Number(totalSeconds);
    if (!table || !Number.isFinite(time) || time <= 0) return null;
    for (let i = 0; i < table.length; i += 1) {
        if (time <= table[i]) return PHYSICAL_GRADES[i];
    }
    return 0;
}

export function physicalAverage(grades) {
    const valid = grades.map(Number).filter(Number.isFinite);
    if (valid.length !== 3) return null;
    return Math.round((valid.reduce((sum, value) => sum + value, 0) / 3) * 10) / 10;
}

export function officialPhysicalTime(type, rawSeconds, penalties = 0) {
    const raw = Number(rawSeconds) || 0;
    const count = Math.max(0, Number(penalties) || 0);
    return raw + count * (PHYSICAL_PENALTY_SECONDS[type] || 0);
}

export const LEGACY_PHYSICAL_TYPES = ['pressbanca'];
export const OFFICIAL_PHYSICAL_TYPES = ['forestal', 'estructural', 'aquatic'];

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

export const PRESS_BENCH_TARGET = { weightKg: 65, reps: 20, timeSeconds: 45 }; // legacy 81/25 only\n\nexport function gradeForBench(weight, reps, timeSeconds) {
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

// Per manteniment, el camp "temps" és temps de treball/manteniment.
// En una planxa, "30" significa 30 segons i "1:00" significa 60 segons.
function maintenanceSeconds(value) {
    const text = String(value ?? '').trim();
    if (!text) return 0;
    if (text.includes(':')) {
        const [m, s = '0'] = text.split(':');
        const minutes = Number(m), seconds = Number(s);
        return Number.isFinite(minutes) && Number.isFinite(seconds) ? (minutes * 60) + seconds : 0;
    }
    const n = Number(text.replace(',', '.'));
    return Number.isFinite(n) && n > 0 ? n : 0;
}

export function maintenanceEvolution(sessions) {
    const byDate = {};
    sessions.filter((s) => s.type === 'manteniment').forEach((s) => {
        const date = String(s.date || '').slice(0, 10);
        if (!date) return;
        const data = Array.isArray(s.data) ? s.data : [];
        const point = byDate[date] || {
            date: date.slice(5),
            fullDate: date,
            total: 0,
            totalReps: 0,
            totalWeightVolume: 0,
            planchaSeconds: 0,
            seriesCount: 0,
        };

        data.filter((item) => item?.exercici && item.exercici !== 'Bloc de manteniment').forEach((item) => {
            const exercise = String(item.exercici).trim();
            const reps = Number(item.repeticions ?? item.reps);
            const weight = Number(item.llastKg ?? item.pes);
            const time = maintenanceSeconds(item.temps);
            const hasValue = (Number.isFinite(reps) && reps > 0) || (Number.isFinite(weight) && weight > 0) || time > 0 || String(item.llastKg || '').toLowerCase() === 'pes corporal';
            if (!hasValue) return;

            point.seriesCount += 1;
            if (Number.isFinite(reps) && reps > 0) {
                point.totalReps += reps;
                if (Number.isFinite(weight) && weight > 0) point.totalWeightVolume += weight * reps;
            }
            if (exercise.toLowerCase().includes('planxa') && time > 0) point.planchaSeconds += time;
        });

        const legacy = data.find((item) => item?.exercici === 'Bloc de manteniment');
        if (legacy) {
            const values = parseSeries(legacy.series ?? legacy.reps ?? legacy.temps);
            if (values.length) {
                point.seriesCount += 1;
                point.totalReps += values.reduce((a, b) => a + b, 0);
            }
        }

        // El gràfic existent utilitza "total". Si la sessió és només de planxa,
        // fem que el punt sigui visible amb els segons de treball de la planxa.
        // Si hi ha repeticions, mantenim el total de repeticions com abans.
        point.total = point.totalReps > 0 ? point.totalReps : point.planchaSeconds;
        byDate[date] = point;
    });

    return Object.values(byDate)
        .sort((a, b) => a.fullDate.localeCompare(b.fullDate))
        .slice(-30);
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
