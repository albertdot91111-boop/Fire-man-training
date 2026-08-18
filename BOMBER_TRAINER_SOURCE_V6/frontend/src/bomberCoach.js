import { displayGrade, gradeForPerformance, isInferred } from './barem';

export const BOMBER_COACH_VERSION = 'V7-coach-2';

const TESTS = ['aquatic', 'estructural', 'forestal'];
const LABELS = { aquatic: 'aquàtica', estructural: 'urbana / estructural', forestal: 'forestal' };

function number(value, fallback = 0) { const n = Number(value); return Number.isFinite(n) ? n : fallback; }

function secondsFromValue(value) {
    const text = String(value ?? '').trim();
    if (!text) return 0;
    if (text.includes(':')) { const [m, s = '0'] = text.split(':'); const mm = Number(m); const ss = Number(s); return Number.isFinite(mm) && Number.isFinite(ss) ? mm * 60 + ss : 0; }
    const n = Number(text); return Number.isFinite(n) && n > 0 ? (n < 20 ? n * 60 : n) : 0;
}

export function sessionSeconds(session) {
    const duration = number(session?.duration);
    if (duration > 0) return duration * 60;
    const entries = Array.isArray(session?.data) ? session.data : [];
    const complete = entries.find((entry) => String(entry?.exercici || '').toLowerCase().includes('circuit complet'));
    if (complete?.temps) return secondsFromValue(complete.temps);
    return entries.map((entry) => secondsFromValue(entry?.temps)).filter(Boolean).reduce((a, b) => a + b, 0);
}

export function adjustedSeconds(session) {
    const base = sessionSeconds(session); const penalties = number(session?.penalties);
    if (!base) return 0;
    return base + penalties * (session?.type === 'estructural' ? 5 : 10);
}

function sortedSessions(sessions, type) {
    return sessions.filter((s) => s.type === type && adjustedSeconds(s) > 0).slice().sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));
}

function average(values) { return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0; }

function gradeSummary(sessions, type) {
    const rows = sortedSessions(sessions, type).slice(-6); const times = rows.map(adjustedSeconds);
    if (!times.length) return { type, label: LABELS[type], sessions: 0, latest: null, best: null, latestGrade: null, trend: null };
    const latest = times[times.length - 1]; const grades = times.map((seconds) => gradeForPerformance(type, seconds)).filter((x) => x !== null); const best = Math.min(...times); const latestGrade = gradeForPerformance(type, latest);
    return { type, label: LABELS[type], sessions: rows.length, latest, best, latestGrade, bestGrade: gradeForPerformance(type, best), trend: latestGrade !== null && grades.length > 1 ? latestGrade - grades[0] : null, avgRecent: average(times.slice(-3)), inferred: isInferred(type), latestPenalties: number(rows[rows.length - 1]?.penalties) };
}

export function analyzeBomberAthlete({ sessions = [], weights = [], goals = [] } = {}) {
    const tests = TESTS.map((type) => gradeSummary(sessions, type));
    const available = tests.filter((x) => x.latestGrade !== null); const weakest = available.slice().sort((a, b) => a.latestGrade - b.latestGrade)[0] || null;
    const recent = sessions.slice().sort((a, b) => String(b.date || '').localeCompare(String(a.date || ''))).slice(0, 7);
    const uniqueDates = [...new Set(recent.map((s) => String(s.date || '').slice(0, 10)).filter(Boolean))];
    const recentPenalties = recent.reduce((sum, s) => sum + number(s.penalties), 0);
    const hardSessions = recent.filter((s) => TESTS.includes(s.type)).length;
    let readiness = 'normal'; const warnings = [];
    if (recentPenalties >= 3) { readiness = 'technical'; warnings.push('Hi ha penalitzacions recents: prioritza execució i tècnica abans d’afegir intensitat.'); }
    else if (uniqueDates.length >= 5 && hardSessions >= 5) { readiness = 'fatigue'; warnings.push('Hi ha molta càrrega recent: avui convé recuperar o fer una sessió curta i tècnica.'); }
    if (weights.length >= 2) {
        const recentWeights = weights.slice().sort((a, b) => String(a.date || '').localeCompare(String(b.date || ''))).slice(-3).map((x) => number(x.weight)).filter(Boolean);
        if (recentWeights.length >= 2 && recentWeights[recentWeights.length - 1] < recentWeights[0] - 2) warnings.push('El pes recent ha baixat més de 2 kg; no l’utilitzis com a criteri únic per augmentar càrrega.');
    }
    return { tests, weakest, readiness, warnings, recentSessionCount: recent.length, recentHardSessions: hardSessions, goalsCount: goals.length };
}

function chooseFocus(analysis) {
    if (!analysis.weakest) return { key: 'base', title: 'Construir base', reason: 'Encara falten marques comparables per prioritzar una prova.' };
    if (analysis.readiness === 'fatigue') return { key: 'recovery', title: 'Recuperació + tècnica', reason: 'La càrrega recent recomana assimilar abans de buscar una nova marca.' };
    if (analysis.weakest.latestPenalties > 0) return { key: analysis.weakest.type, title: `Tècnica de ${analysis.weakest.label}`, reason: 'La nota baixa va acompanyada de penalitzacions: primer cal netejar l’execució.' };
    return { key: analysis.weakest.type, title: `Millorar ${analysis.weakest.label}`, reason: `És la prova amb la nota actual més baixa (${displayGrade(analysis.weakest.type, analysis.weakest.latest)}/10).` };
}

// Memòria determinista: compara les dues últimes sessions de cada prova i
// converteix el resultat en una regla per a la següent sessió.
export function buildLearningLoop(sessions = []) {
    const tests = TESTS.map((type) => {
        const rows = sortedSessions(sessions, type); if (rows.length < 2) return null;
        const previous = rows[rows.length - 2]; const latest = rows[rows.length - 1];
        const previousGrade = gradeForPerformance(type, adjustedSeconds(previous)); const latestGrade = gradeForPerformance(type, adjustedSeconds(latest));
        if (previousGrade === null || latestGrade === null) return null;
        const delta = latestGrade - previousGrade; let decision = 'mantenir'; let reason = 'Canvi petit: repetir el patró i buscar una execució més neta.';
        if (number(latest.penalties) > number(previous.penalties)) { decision = 'consolidar'; reason = 'Han augmentat les penalitzacions: no progressar càrrega/intensitat fins netejar l’execució.'; }
        else if (delta >= 0.5) { decision = 'progressar'; reason = 'La nota ha millorat clarament: augmentar només una variable a la següent sessió.'; }
        else if (delta <= -0.5) { decision = 'baixar'; reason = 'La nota ha empitjorat clarament: reduir intensitat o volum i recuperar qualitat.'; }
        return { type, label: LABELS[type], previousDate: previous.date, latestDate: latest.date, previousGrade, latestGrade, delta, decision, reason };
    }).filter(Boolean);
    const actionable = tests.slice().sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))[0] || null;
    return { tests, actionable };
}

export function buildTodayPlan({ sessions = [], weights = [], goals = [], material = [], minutes = 45 } = {}) {
    const analysis = analyzeBomberAthlete({ sessions, weights, goals }); const learning = buildLearningLoop(sessions); const focus = chooseFocus(analysis);
    const availableMinutes = Math.max(20, number(minutes, 45)); const warmup = Math.min(10, Math.round(availableMinutes * 0.2)); const cooldown = Math.min(7, Math.round(availableMinutes * 0.12)); const main = Math.max(10, availableMinutes - warmup - cooldown);
    let blocks;
    if (focus.key === 'recovery') blocks = [`${warmup} min — escalfament + mobilitat específica`, `${Math.max(8, Math.round(main * 0.6))} min — aeròbic suau / bicicleta + tècnica`, `${Math.max(5, main - Math.round(main * 0.6))} min — mobilitat i respiració`, `${cooldown} min — tornada a la calma`];
    else if (focus.key === 'estructural') blocks = [`${warmup} min — escalfament dinàmic + patrons de step-up`, `${Math.round(main * 0.35)} min — força: discos 10 kg / kettlebells 16 kg, tècnica perfecta`, `${Math.round(main * 0.45)} min — intervals curts: trineu + arrossegament de 50 kg`, `${Math.max(4, main - Math.round(main * 0.35) - Math.round(main * 0.45))} min — esprint/tècnica sense arribar al límit`, `${cooldown} min — recuperació`];
    else if (focus.key === 'forestal') blocks = [`${warmup} min — escalfament + acceleracions progressives`, `${Math.round(main * 0.45)} min — intervals 20 m + slam ball, qualitat de moviment`, `${Math.round(main * 0.35)} min — blocs de resistència específica`, `${Math.max(4, main - Math.round(main * 0.45) - Math.round(main * 0.35))} min — tècnica sota fatiga`, `${cooldown} min — tornada a la calma`];
    else if (focus.key === 'aquatic') blocks = [`${warmup} min — activació fora de l’aigua + mobilitat`, `${Math.round(main * 0.3)} min — apnea/tècnica amb control i seguretat`, `${Math.round(main * 0.45)} min — natació + remolc de maniquí, qualitat abans que velocitat`, `${Math.max(4, main - Math.round(main * 0.3) - Math.round(main * 0.45))} min — intervals específics`, `${cooldown} min — recuperació`];
    else blocks = [`${warmup} min — escalfament`, `${main} min — força general + cardio`, `${cooldown} min — recuperació`];
    if (learning.actionable?.decision === 'progressar') blocks.push('Progressió: augmenta NOMÉS una variable (repeticions, càrrega o intensitat).');
    if (learning.actionable?.decision === 'baixar') blocks.push('Ajust: redueix la intensitat i busca una execució estable abans de tornar a progressar.');
    if (learning.actionable?.decision === 'consolidar') blocks.push('Consolidació: mantén càrrega i prioritza tècnica fins reduir penalitzacions.');
    return { version: BOMBER_COACH_VERSION, focus, readiness: analysis.readiness, warnings: analysis.warnings, blocks, materialUsed: material.length ? material : ['material bàsic / gimnàs'], learning, rule: 'No augmentar volum, càrrega i intensitat alhora.' };
}

export function coachBrief({ sessions = [], weights = [], goals = [], material = [], minutes = 45 } = {}) {
    const analysis = analyzeBomberAthlete({ sessions, weights, goals }); const plan = buildTodayPlan({ sessions, weights, goals, material, minutes });
    const lines = [`Prioritat: ${plan.focus.title}.`, plan.focus.reason, `Estat de càrrega: ${analysis.readiness}.`, ...analysis.tests.filter((t) => t.latestGrade !== null).map((t) => `${t.label}: ${Math.round(t.latestGrade * 10) / 10}/10 · millor ${Math.round((t.bestGrade ?? 0) * 10) / 10}/10${t.inferred ? ' (barem inferit)' : ''}.`), ...(plan.learning.actionable ? [`Aprenentatge: ${plan.learning.actionable.decision} — ${plan.learning.actionable.reason}`] : ['Aprenentatge: encara no hi ha dues sessions comparables de la mateixa prova.']), ...analysis.warnings];
    return { analysis, plan, text: lines.join('\n') };
}
