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
    structural: {
        kettlebellKg: 16,
        manikinKg: 50,
        status: 'configuració fixa del projecte decidida per l\'usuari',
    },
    userBenchmarks: {
        structural10ApproxSeconds: 130,
        forestal10ApproxSeconds: 190,
        aquatic10ApproxSeconds: null,
        status: 'orientatius, no oficials',
    },
};

export const BOMBER_TESTS = {
    aquatic: {
        label: 'Prova aquàtica',
        source: 'Protocol/document INEFC incorporat al projecte',
        continuous: true,
        phases: [
            'Entrada segura: peus primer, cap fora i contacte visual.',
            '15 m d\'apnea sota tanca.',
            '30 s de batuda alterna/bicicleta amb cap i mans fora.',
            '25 m anada + 25 m tornada en estil lliure sota corxeres, tocant paret i sense viratge.',
            '25 m de crol de salvament amb cap fora excepte al pas de corxeres.',
            '25 m de remolc de maniquí amb vies aèries fora excepte al pas de corxeres i extracció completa.',
        ],
        userReference: '10 aproximadament en 3 minuts i poc; maniquí 35 kg. No oficial.',
    },
    estructural: {
        label: 'Prova estructural/urbana',
        source: 'Protocol/document INEFC incorporat al projecte + configuració de l\'usuari',
        phases: [
            '2 discos de 10 kg + equilibri + 10 step-ups.',
            '2 kettlebells de 16 kg + equilibri + 10 step-ups.',
            'Trineu: 10 m estirar + 10 m empènyer.',
            'Recorregut C sota tanques.',
            'Arrossegament de ninot de 50 kg.',
            'Esprint final de 10 m.',
        ],
        userReference: '10 aproximadament en 2 minuts i poc. No oficial.',
    },
    forestal: {
        label: 'Prova forestal',
        source: 'Protocol/document INEFC incorporat al projecte',
        phases: [
            'Bloc 1: 8 x 20 m + 16 slam balls.',
            'Bloc 2: 10 x 20 m + 20 slam balls.',
            'Bloc 3: 12 x 20 m + 24 slam balls.',
        ],
        userReference: '10 aproximadament en 3 minuts i poc. No oficial.',
    },
};

function safeNumber(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
}

function legacyTimeSeconds(value) {
    const text = String(value ?? '').trim();
    if (!text) return 0;
    if (text.includes(':')) {
        const [m, s = '0'] = text.split(':');
        const minutes = Number(m);
        const seconds = Number(s);
        return Number.isFinite(minutes) && Number.isFinite(seconds) ? (minutes * 60) + seconds : 0;
    }
    const n = Number(text);
    if (!Number.isFinite(n) || n <= 0) return 0;
    // Match ProgressPage's legacy convention: small bare values are minutes;
    // larger bare values are already seconds.
    return n < 20 ? n * 60 : n;
}

function sessionSeconds(session) {
    if (!session) return 0;
    const duration = safeNumber(session.duration, 0);
    // TrainPage stores total session duration in minutes.
    if (duration > 0) return duration * 60;

    const data = Array.isArray(session.data) ? session.data : [];
    const complete = data.find((entry) => String(entry.exercici || '').toLowerCase().includes('circuit complet'));
    if (complete?.temps) return legacyTimeSeconds(complete.temps);

    const phaseTimes = data
        .map((entry) => legacyTimeSeconds(entry?.temps))
        .filter((value) => value > 0);

    return phaseTimes.reduce((sum, value) => sum + value, 0);
}

export function adjustedTime(session) {
    const base = sessionSeconds(session);
    const penalties = safeNumber(session?.penalties, 0);
    if (!base) return 0;
    if (session?.type === 'aquatic') return base + penalties * 10;
    if (session?.type === 'estructural') return base + penalties * 5;
    if (session?.type === 'forestal') return base + penalties * 10;
    return base;
}

function latestByType(sessions, type) {
    return sessions
        .filter((s) => s.type === type)
        .slice()
        .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))[0] || null;
}

export function diagnoseBomberProgress(sessions = []) {
    const tests = ['aquatic', 'estructural', 'forestal'];
    const result = tests.map((type) => {
        const latest = latestByType(sessions, type);
        const recent = sessions
            .filter((s) => s.type === type)
            .slice()
            .sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')))
            .slice(-5);
        const times = recent.map(adjustedTime).filter((x) => x > 0);
        const first = times[0] || null;
        const last = times[times.length - 1] || null;
        return {
            type,
            label: BOMBER_TESTS[type].label,
            sessions: recent.length,
            latestTimeSeconds: last,
            bestTimeSeconds: times.length ? Math.min(...times) : null,
            trendSeconds: first && last ? last - first : null,
            penaltiesLatest: latest ? safeNumber(latest.penalties, 0) : 0,
        };
    });

    const withData = result.filter((x) => x.latestTimeSeconds);
    if (!withData.length) {
        return { tests: result, priority: null, reason: 'Encara no hi ha prou proves cronometrades per detectar un limitant.' };
    }

    const priority = withData
        .slice()
        .sort((a, b) => {
            if (b.penaltiesLatest !== a.penaltiesLatest) return b.penaltiesLatest - a.penaltiesLatest;
            return (b.trendSeconds || 0) - (a.trendSeconds || 0);
        })[0];

    return {
        tests: result,
        priority: priority.type,
        reason: priority.penaltiesLatest > 0
            ? 'La prova prioritària té penalitzacions recents; primer cal millorar l\'execució.'
            : 'La prioritat inicial es basa en la tendència observada; es recalcula amb cada nova sessió.',
    };
}

export function buildBomberAiContext({ sessions = [], weights = [], goals = [], material = [], minutes = '' }) {
    const diagnosis = diagnoseBomberProgress(sessions);
    const recent = sessions.slice(0, 20).map((s) => ({
        data: s.date,
        tipus: s.type,
        minuts: s.duration,
        punts: s.points,
        penalitzacions: s.penalties,
        incidencies: s.incidents,
        notes: s.notes,
        registre: s.data,
    }));

    return [
        '[BOMBER TRAINER — CONTEXT DE L\'USUARI]',
        `Jerarquia de fonts: ${BOMBER_AI_SOURCE_POLICY.priority.join(' > ')}.`,
        BOMBER_AI_SOURCE_POLICY.rule,
        `Configuració fixa: estructural = 2 kettlebells de ${BOMBER_AI_CONFIG.structural.kettlebellKg} kg i ninot de ${BOMBER_AI_CONFIG.structural.manikinKg} kg.`,
        `Referències de temps de l\'usuari: forestal 10 ≈ ${BOMBER_AI_CONFIG.userBenchmarks.forestal10ApproxSeconds}s; estructural 10 ≈ ${BOMBER_AI_CONFIG.userBenchmarks.structural10ApproxSeconds}s; aquàtica sense barem numèric fix. Totes són orientatives i no oficials.`,
        `Proves disponibles: ${Object.values(BOMBER_TESTS).map((t) => t.label).join(', ')}.`,
        `Prioritat actual detectada: ${diagnosis.priority || 'pendent de dades'}. ${diagnosis.reason}`,
        `Material: ${material.length ? material.join(', ') : 'no indicat'}.`,
        `Temps disponible avui: ${minutes || 'no indicat'} minuts.`,
        `Objectius: ${goals.length ? goals.map((g) => `${g.title} (${g.current || 0}/${g.target || 0} ${g.unit || ''})`).join('; ') : 'cap'}.`,
        `Pes recent: ${weights.slice(0, 5).map((w) => `${w.date}:${w.weight}kg`).join(', ') || 'sense dades'}.`,
        `Historial recent: ${JSON.stringify(recent)}`,
        '[INSTRUCCIONS DE L\'ASSISTENT]',
        'Actua com a entrenador especialitzat en preparació de proves de bombers.',
        'Quan planifiquis entrenaments, prioritza transferència a les proves, tècnica sota fatiga, força, potència, resistència muscular, capacitat aeròbica/anaeròbica i recuperació.',
        'No prescriguis augmentar volum, càrrega i intensitat alhora.',
        'Si hi ha dolor, lesió o símptomes preocupants, no facis diagnòstics: recomana aturar l\'exercici i consultar un professional sanitari.',
        'Quan una dada sigui provisional, digues-ho explícitament.',
        '[FI CONTEXT BOMBER TRAINER]',
    ].join('\n');
}
