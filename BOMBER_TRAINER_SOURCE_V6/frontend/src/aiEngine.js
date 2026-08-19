export const BOMBER_AI_SOURCE_POLICY = {
    priority: [
        'barem/protocol oficial de la convocatòria',
        'document o protocol INEFC incorporat al projecte',
        'documents tècnics d\'entrenadors especialitzats',
        'dades reals registrades per l\'usuari',
        'inferència de la IA',
    ],
    rule: 'Mai presentar una dada provisional o una inferència com si fos un barem oficial.',
};

export const BOMBER_AI_CONFIG = {
    structural: { kettlebellKg: 16, manikinKg: 50, status: 'configuració fixa del projecte decidida per l\'usuari' },
    userBenchmarks: { structural10ApproxSeconds: 130, forestal10ApproxSeconds: 190, aquatic10ApproxSeconds: null, status: 'orientatius, no oficials' },
};

export const BOMBER_TESTS = {
    aquatic: { label: 'Prova aquàtica', source: 'Protocol/document INEFC incorporat al projecte', continuous: true, phases: [
        'Entrada segura: peus primer, cap fora i contacte visual.', '15 m d\'apnea sota tanca.', '30 s de batuda alterna/bicicleta amb cap i mans fora.',
        '25 m anada + 25 m tornada en estil lliure sota corxeres, tocant paret i sense viratge.', '25 m de crol de salvament amb cap fora excepte al pas de corxeres.',
        '25 m de remolc de maniquí amb vies aèries fora excepte al pas de corxeres i extracció completa.',
    ], userReference: '10 aproximadament en 3 minuts i poc; maniquí 35 kg. No oficial.' },
    estructural: { label: 'Prova estructural/urbana', source: 'Protocol/document INEFC incorporat al projecte + configuració de l\'usuari', phases: [
        '2 discos de 10 kg + equilibri + 10 step-ups.', '2 kettlebells de 16 kg + equilibri + 10 step-ups.', 'Trineu: 10 m estirar + 10 m empènyer.',
        'Recorregut C sota tanques.', 'Arrossegament de ninot de 50 kg.', 'Esprint final de 10 m.',
    ], userReference: '10 aproximadament en 2 minuts i poc. No oficial.' },
    forestal: { label: 'Prova forestal', source: 'Protocol/document INEFC incorporat al projecte', phases: [
        'Bloc 1: 8 x 20 m + 16 slam balls.', 'Bloc 2: 10 x 20 m + 20 slam balls.', 'Bloc 3: 12 x 20 m + 24 slam balls.',
    ], userReference: '10 aproximadament en 3 minuts i poc. No oficial.' },
};

function safeNumber(value, fallback = 0) { const n = Number(value); return Number.isFinite(n) ? n : fallback; }
function legacyTimeSeconds(value) {
    const text = String(value ?? '').trim(); if (!text) return 0;
    if (text.includes(':')) { const [m, s = '0'] = text.split(':'); const minutes = Number(m); const seconds = Number(s); return Number.isFinite(minutes) && Number.isFinite(seconds) ? minutes * 60 + seconds : 0; }
    const n = Number(text); if (!Number.isFinite(n) || n <= 0) return 0; return n < 20 ? n * 60 : n;
}
function sessionSeconds(session) {
    if (!session) return 0;
    const duration = safeNumber(session.duration, 0); if (duration > 0) return duration * 60;
    const data = Array.isArray(session.data) ? session.data : [];
    const complete = data.find((entry) => String(entry.exercici || '').toLowerCase().includes('circuit complet'));
    if (complete?.temps) return legacyTimeSeconds(complete.temps);
    return data.map((entry) => legacyTimeSeconds(entry?.temps)).filter((value) => value > 0).reduce((sum, value) => sum + value, 0);
}
export function adjustedTime(session) {
    const base = sessionSeconds(session); const penalties = safeNumber(session?.penalties, 0); if (!base) return 0;
    if (session?.type === 'aquatic') return base + penalties * 10;
    if (session?.type === 'estructural') return base + penalties * 5;
    if (session?.type === 'forestal') return base + penalties * 10;
    return base;
}
function latestByType(sessions, type) { return sessions.filter((s) => s.type === type).slice().sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))[0] || null; }
function recentByType(sessions, type, n = 8) { return sessions.filter((s) => s.type === type).slice().sort((a, b) => String(a.date || '').localeCompare(String(b.date || ''))).slice(-n); }

function daysSince(date) { const t = Date.parse(date || ''); return Number.isFinite(t) ? Math.max(0, (Date.now() - t) / 86400000) : null; }
function sessionLoad(session) {
    const minutes = safeNumber(session?.duration, 0); const points = safeNumber(session?.points, 0); const penalties = safeNumber(session?.penalties, 0);
    const typeFactor = { forestal: 1.15, estructural: 1.2, aquatic: 1.05, pit: 0.9, cames: 1, pressbanca: 1 }[session?.type] || 1;
    return Math.max(1, (minutes || 15) * typeFactor + penalties * 8 + (points > 0 ? Math.min(points, 20) * 0.3 : 0));
}
function fatigueScore(sessions) {
    const recent = sessions.filter((s) => { const d = daysSince(s.date); return d !== null && d <= 7; });
    const load = recent.reduce((sum, s) => sum + sessionLoad(s), 0);
    const last3 = recent.slice().sort((a, b) => String(b.date || '').localeCompare(String(a.date || ''))).slice(0, 3);
    const hard = last3.reduce((sum, s) => sum + (sessionLoad(s) >= 45 ? 1 : 0), 0);
    const consecutive = recent.slice().sort((a, b) => String(a.date || '').localeCompare(String(b.date || ''))).slice(-4).length;
    const score = Math.max(0, Math.min(100, Math.round(load * 1.25 + hard * 12 + Math.max(0, consecutive - 2) * 8)));
    const level = score >= 75 ? 'vermell' : score >= 55 ? 'taronja' : score >= 30 ? 'groc' : 'verd';
    return { score, level, recentSessions: recent.length, load: Math.round(load), hardLast3: hard };
}

function readinessForType(type, rows) {
    const target = BOMBER_AI_CONFIG.userBenchmarks[`${type}10ApproxSeconds`];
    if (!rows.length || !target) return null;
    const latest = adjustedTime(rows[rows.length - 1]); const best = Math.min(...rows.map(adjustedTime));
    const ratio = latest / target; const trend = rows.length >= 3 ? (adjustedTime(rows[0]) - latest) / Math.max(1, rows.length - 1) : 0;
    const progress = Math.max(0, Math.min(100, (1 - (latest - target) / Math.max(target, 1)) * 100));
    return { latest, best, target, ratio, trendPerSession: trend, progress: Math.round(progress) };
}

export function diagnoseBomberProgress(sessions = []) {
    const tests = ['aquatic', 'estructural', 'forestal'].map((type) => {
        const latest = latestByType(sessions, type); const recent = recentByType(sessions, type, 8); const times = recent.map(adjustedTime).filter((x) => x > 0);
        const first = times[0] || null; const last = times[times.length - 1] || null;
        const readiness = readinessForType(type, recent);
        return { type, label: BOMBER_TESTS[type].label, sessions: recent.length, latestTimeSeconds: last, bestTimeSeconds: times.length ? Math.min(...times) : null, trendSeconds: first && last ? last - first : null, penaltiesLatest: latest ? safeNumber(latest.penalties, 0) : 0, readiness };
    });
    const withData = tests.filter((x) => x.latestTimeSeconds);
    if (!withData.length) return { tests, priority: null, reason: 'Encara no hi ha proves cronometrades per detectar un limitant.' };
    const ranked = withData.slice().sort((a, b) => {
        const aGap = a.readiness ? Math.max(0, a.readiness.latest - a.readiness.target) / a.readiness.target : 0.5;
        const bGap = b.readiness ? Math.max(0, b.readiness.latest - b.readiness.target) / b.readiness.target : 0.5;
        const aScore = aGap * 100 + a.penaltiesLatest * 12 + Math.max(0, a.trendSeconds || 0);
        const bScore = bGap * 100 + b.penaltiesLatest * 12 + Math.max(0, b.trendSeconds || 0);
        return bScore - aScore;
    });
    const priority = ranked[0];
    return { tests, priority: priority.type, reason: priority.penaltiesLatest > 0 ? 'La prova prioritària combina marge de millora i penalitzacions recents.' : 'La prioritat combina distància a la referència, tendència i consistència; es recalcula amb cada sessió.' };
}

export function buildBomberAiContext({ sessions = [], weights = [], goals = [], material = [], minutes = '' }) {
    const diagnosis = diagnoseBomberProgress(sessions); const fatigue = fatigueScore(sessions);
    const recent = sessions.slice(0, 20).map((s) => ({ data: s.date, tipus: s.type, minuts: s.duration, punts: s.points, penalitzacions: s.penalties, incidencies: s.incidents, notes: s.notes, registre: s.data }));
    const performance = diagnosis.tests.map((t) => ({ prova: t.label, sessions: t.sessions, ultim_s: t.latestTimeSeconds, millor_s: t.bestTimeSeconds, tendencia_s: t.trendSeconds, penalitzacions: t.penaltiesLatest, lectura: t.readiness })).filter((x) => x.sessions);
    return [
        '[BOMBER TRAINER — CERVELL DE RENDIMENT]',
        `Jerarquia de fonts: ${BOMBER_AI_SOURCE_POLICY.priority.join(' > ')}.`, BOMBER_AI_SOURCE_POLICY.rule,
        `Configuració fixa: estructural = 2 kettlebells de ${BOMBER_AI_CONFIG.structural.kettlebellKg} kg i ninot de ${BOMBER_AI_CONFIG.structural.manikinKg} kg.`,
        `Referències orientatives: forestal 10 ≈ ${BOMBER_AI_CONFIG.userBenchmarks.forestal10ApproxSeconds}s; estructural 10 ≈ ${BOMBER_AI_CONFIG.userBenchmarks.structural10ApproxSeconds}s; aquàtica sense barem numèric fix.`,
        `Prioritat calculada: ${diagnosis.priority || 'pendent'}. ${diagnosis.reason}`,
        `ESTAT DE FATIGA: ${fatigue.level.toUpperCase()} (${fatigue.score}/100). Càrrega 7 dies=${fatigue.load}; sessions=${fatigue.recentSessions}; sessions dures últimes 3=${fatigue.hardLast3}.`,
        `PERFIL DE RENDIMENT: ${JSON.stringify(performance)}`,
        `Material: ${material.length ? material.join(', ') : 'no indicat'}. Temps disponible avui: ${minutes || 'no indicat'} minuts.`,
        `Objectius: ${goals.length ? goals.map((g) => `${g.title} (${g.current || 0}/${g.target || 0} ${g.unit || ''})`).join('; ') : 'cap'}.`,
        `Pes recent: ${weights.slice(0, 5).map((w) => `${w.date}:${w.weight}kg`).join(', ') || 'sense dades'}.`,
        `Historial recent: ${JSON.stringify(recent)}`,
        '[MOTOR DE DECISIÓ]',
        'Abans de recomanar res, avalua: 1) fatiga actual, 2) distància a objectiu, 3) tendència, 4) penalitzacions/incidències, 5) càrrega dels últims dies.',
        'Si la fatiga és vermella, prioritza recuperació/tècnica i evita un test màxim. Si és taronja, redueix volum o intensitat. Si és verda, pots proposar una sessió de qualitat.',
        'No augmentis volum, càrrega i intensitat alhora. Després de cada sessió, compara el resultat amb les 3-8 anteriors i adapta la següent.',
        'Quan hi hagi prou dades, identifica un únic limitant principal i un segon objectiu secundari. Explica breument per què.',
        'No inventis marques ni atribueixis barems oficials a estimacions. Si no hi ha dades suficients, digues exactament què falta.',
        'Quan l\'usuari demani què fer avui, dona una sessió concreta amb durada, blocs, descansos, intensitat relativa i criteri per aturar o reduir.',
        'Quan l\'usuari pregunti per progrés, separa clarament: dada registrada → interpretació → recomanació.',
        'Si hi ha dolor, lesió o símptomes preocupants, no diagnostiquis; recomana aturar l\'exercici i consultar un professional sanitari.',
        '[FI CERVELL DE RENDIMENT]',
    ].join('\n');
}
