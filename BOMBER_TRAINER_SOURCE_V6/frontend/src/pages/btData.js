export const TYPES = {
    pit: { key: 'pit', label: 'Pit / Tren superior', short: 'PIT', color: '#2563eb', soft: '#dbeafe', emoji: '' },
    cames: { key: 'cames', label: 'Cames', short: 'CAMES', color: '#16a34a', soft: '#dcfce7' },
    estructural: { key: 'estructural', label: 'Incendi estructural', short: 'ESTRUCTURAL', color: '#dc2626', soft: '#fee2e2' },
    forestal: { key: 'forestal', label: 'Incendi forestal', short: 'FORESTAL', color: '#ea580c', soft: '#ffedd5' },
    aquatic: { key: 'aquatic', label: 'Prova aquàtica', short: 'AQUÀTIC', color: '#0284c7', soft: '#e0f2fe' },
    manteniment: { key: 'manteniment', label: 'Manteniment', short: 'MANTENIMENT', color: '#ca8a04', soft: '#fef9c3' },
    rapid: { key: 'rapid', label: 'Entrenament ràpid', short: 'RÀPID', color: '#d97706', soft: '#fef3c7' },
    descans: { key: 'descans', label: 'Dia no disponible', short: 'NO DISPONIBLE', color: '#64748b', soft: '#f1f5f9' },
};

export const MATERIAL = [
    'Trineu', 'Corda', 'Slam balls', 'Box', 'Discos', 'Kettlebells',
    'Armilla llastrada', 'Tanques', 'Cons', 'Barra d\'equilibri', 'Maniquí',
];

export const PLANS = {
    pit: [
        { name: 'Press banca', detail: '5 sèries', fields: ['pes', 'reps'] },
        { name: 'Press inclinat amb manuelles', detail: '4 sèries', fields: ['pes', 'reps'] },
        { name: 'Dominades', detail: '4 sèries', fields: ['reps'] },
        { name: 'Rem amb barra', detail: '4 sèries', fields: ['pes', 'reps'] },
        { name: 'Fons / Press militar', detail: '3 sèries', fields: ['pes', 'reps'] },
    ],
    cames: [
        { name: 'Sentadilla', detail: '5 sèries', fields: ['pes', 'reps'] },
        { name: 'Pes mort', detail: '4 sèries', fields: ['pes', 'reps'] },
        { name: 'Gambades', detail: '3 sèries per cama', fields: ['pes', 'reps'] },
        { name: 'Step-up al box', detail: '3 sèries', fields: ['pes', 'reps'] },
        { name: 'Bessons', detail: '3 sèries', fields: ['pes', 'reps'] },
    ],
    estructural: [
        { name: '1. Discos (transport)', detail: 'Temps de la seqüència', fields: ['temps', 'descans'] },
        { name: '2. Kettlebells', detail: 'Temps de la seqüència', fields: ['temps', 'descans'] },
        { name: '3. Trineu', detail: 'Temps de la seqüència', fields: ['temps', 'descans'] },
        { name: '4. Recorregut en C', detail: 'Temps de la seqüència', fields: ['temps', 'descans'] },
        { name: '5. Arrossegament de maniquí', detail: 'Temps de la seqüència', fields: ['temps', 'descans'] },
        { name: '6. Esprint final', detail: 'Temps de la seqüència', fields: ['temps', 'descans'] },
    ],
    forestal: [
        { name: 'TRAM 1', detail: 'Registra el temps del tram', fields: ['temps'] },
        { name: 'TRAM 2', detail: 'Registra el temps del tram', fields: ['temps'] },
        { name: 'TRAM 3', detail: 'Registra el temps del tram', fields: ['temps'] },
        { name: 'CIRCUIT COMPLET', detail: 'Només si has fet la ruta completa', fields: ['temps'] },
    ],
    aquatic: [
        { name: 'Prova aquàtica', detail: 'Temps total', fields: ['temps'] },
    ],
    manteniment: [
        { name: 'Dominades', detail: 'Repeticions per sèrie', fields: ['series'] },
        { name: 'Sentadilla', detail: 'Repeticions per sèrie', fields: ['series'] },
        { name: 'Gambades', detail: 'Repeticions per sèrie', fields: ['series'] },
    ],
    rapid: [
        { name: 'Circuit ràpid', detail: 'Adaptat als minuts disponibles', fields: ['temps'] },
    ],
    descans: [],
};

export const INCIDENTS = ['Caiguda', 'Fatiga', 'Dolor', 'Material insuficient', 'Falta de temps', 'Calor'];

export const POINTS = { complet: 100, manteniment: 40, minim: 20 };

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
export function totalPoints(sessions) { return sessions.reduce((sum, s) => sum + (s.points || 0), 0); }
export function parseSeries(value) {
    if (Array.isArray(value)) return value.map(Number).filter(Number.isFinite);
    return String(value ?? '').split(/[\/,\s]+/).map(Number).filter(Number.isFinite);
}
export function maintenanceEvolution(sessions) {
    return sessions.filter((s) => s.type === 'manteniment').flatMap((s) => {
        const data = Array.isArray(s.data) ? s.data : [];
        const exerciseEntries = data.filter((item) => item.exercici && item.exercici !== 'Bloc de manteniment').map((item) => ({ exercici: item.exercici, values: parseSeries(item.series ?? item.reps ?? item.temps) })).filter((item) => item.values.length);
        if (exerciseEntries.length) { const values = exerciseEntries.flatMap((item) => item.values); return [{ date: s.date, values, total: values.reduce((sum, value) => sum + value, 0), entries: exerciseEntries }]; }
        const legacyEntry = data.find((item) => item.exercici === 'Bloc de manteniment');
        const legacyValues = parseSeries(legacyEntry?.series ?? legacyEntry?.temps);
        return legacyValues.length ? [{ date: s.date, values: legacyValues, total: legacyValues.reduce((sum, value) => sum + value, 0), entries: [{ exercici: 'Manteniment', values: legacyValues }] }] : [];
    }).sort((a, b) => a.date.localeCompare(b.date));
}
export function streak(sessions) {
    const days = new Set(sessions.filter((s) => s.type !== 'descans').map((s) => s.date));
    const rest = new Set(sessions.filter((s) => s.type === 'descans').map((s) => s.date));
    let count = 0; const cursor = new Date(today());
    for (let i = 0; i < 400; i += 1) { const key = cursor.toISOString().slice(0, 10); if (days.has(key)) count += 1; else if (rest.has(key) || (i === 0 && !days.has(key))) {} else break; cursor.setDate(cursor.getDate() - 1); }
    return count;
}
export function daysSince(sessions, type) { const last = sessions.filter((s) => s.type === type).map((s) => s.date).sort().pop(); return last ? dayDiff(last, today()) : null; }
export function weakPoints(sessions) { return ['pit', 'cames', 'estructural', 'forestal'].map((t) => ({ type: t, days: daysSince(sessions, t) })).filter((x) => x.days === null || x.days >= 7).sort((a, b) => (b.days ?? 999) - (a.days ?? 999)); }
export const MOTIVATION = ['No necessites estar motivat cada dia. Necessites continuar.', 'El manteniment manté la ratxa, però no substitueix l\'entrenament específic.', 'No busquem entrenaments perfectes. Busquem acumular feina útil.', 'Cada sèrie registrada és una prova superada abans de la prova.'];
export function buildUserContext({ sessions, weights, goals, material, minutes }) {
    const recent = sessions.slice(0, 25).map((s) => ({ data: s.date, tipus: s.type, minuts: s.duration, punts: s.points, incidencies: s.incidents, registre: s.data }));
    return ['[DADES DE L\'USUARI]', `Ratxa: ${streak(sessions)} dies. Punts totals: ${totalPoints(sessions)}. Nivell: ${levelFor(totalPoints(sessions)).name}.`, `Dies sense treballar: ${['pit', 'cames', 'estructural', 'forestal', 'manteniment'].map((t) => `${TYPES[t].short}=${daysSince(sessions, t) ?? 'mai'}`).join(', ')}.`, `Material disponible: ${(material && material.length ? material : ['cap indicat']).join(', ')}.`, `Objectius: ${goals.length ? goals.map((g) => `${g.title} (${g.current || 0}/${g.target || 0} ${g.unit || ''})`).join('; ') : 'cap'}.`, `Pes corporal recent: ${weights.slice(0, 5).map((w) => `${w.date}:${w.weight}kg`).join(', ') || 'sense registres'}.`, minutes ? `Temps disponible avui: ${minutes} minuts.` : '', `Últims entrenaments (JSON): ${JSON.stringify(recent)}`, '[FI DADES]'].filter(Boolean).join('\n');
}
