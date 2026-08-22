import { analyzeBomberAthlete, adjustedSeconds } from './bomberCoach';

const STRENGTH_TYPES = ['pressbanca'];
const LABELS = { pressbanca: 'press banca' };
const PRIORITY_TESTS = new Set(['forestal', 'estructural']);

function n(v) {
    const x = Number(v);
    return Number.isFinite(x) ? x : null;
}

function extractStrengthRecords(sessions, type) {
    return sessions.filter((s) => s.type === type).flatMap((s) => {
        const data = Array.isArray(s.data) ? s.data : [];
        return data.map((entry) => ({
            date: s.date,
            exercise: String(entry.exercici || entry.exercise || ''),
            weight: n(entry.pes ?? entry.weight),
            reps: n(entry.reps ?? entry.repeticions),
            series: n(entry.series),
            incidents: s.incidents || [],
        })).filter((x) => x.weight !== null || x.reps !== null);
    }).sort((a, b) => String(a.date).localeCompare(String(b.date)));
}

function bestStrength(records) {
    const valid = records.filter((x) => x.weight !== null && x.reps !== null && x.weight > 0 && x.reps > 0);
    return valid.reduce((best, row) => {
        const score = row.weight * (1 + Math.min(row.reps, 20) / 100);
        return !best || score > best.score ? { ...row, score } : best;
    }, null);
}

export function buildAdaptiveRecommendations({ sessions = [], goals = [], minutes = 45 } = {}) {
    const analysis = analyzeBomberAthlete({ sessions, goals });
    const recommendations = [];

    for (const type of STRENGTH_TYPES) {
        const records = extractStrengthRecords(sessions, type);
        const best = bestStrength(records);
        const days = sessions.filter((s) => s.type === type).map((s) => s.date).sort().pop();
        if (!best) {
            recommendations.push({ type, action: 'build', title: `Construir base de ${LABELS[type]}`, detail: 'Encara no hi ha prou registres de càrrega/repeticions per fer una progressió automàtica segura.' });
            continue;
        }
        const hasPain = records.slice(-5).some((r) => (r.incidents || []).some((x) => String(x).toLowerCase().includes('dolor')));
        if (hasPain) {
            recommendations.push({ type, action: 'hold', title: `Mantenir ${LABELS[type]}`, detail: 'Hi ha dolor registrat recentment. No augmentar càrrega automàticament.' });
        } else {
            const target = best.reps >= 18 ? best.weight + 2.5 : best.weight;
            recommendations.push({
                type,
                action: best.reps >= 18 ? 'progress' : 'repeat',
                title: best.reps >= 18 ? `Progressar ${LABELS[type]}` : `Consolidar ${LABELS[type]}`,
                detail: best.reps >= 18 ? `Propera exposició orientativa: ${target} kg mantenint tècnica i deixant marge.` : `Repetir aproximadament ${best.weight} kg fins consolidar més repeticions.`,
                lastDate: days,
                lastWeight: best.weight,
                lastReps: best.reps,
            });
        }
    }

    if (analysis.weakest && PRIORITY_TESTS.has(analysis.weakest.type) && analysis.weakest.latestGrade !== null) {
        recommendations.push({
            type: analysis.weakest.type,
            action: 'priority',
            title: `Prioritat específica: ${analysis.weakest.label}`,
            detail: `És la prova prioritària amb pitjor nota actual (${analysis.weakest.latestGrade.toFixed(1)}/10).`,
        });
    }

    const shortSession = Number(minutes) > 0 && Number(minutes) <= 30;
    return {
        recommendations,
        sessionMode: shortSession ? 'micro-sessió' : 'sessió completa',
        principle: 'Prioritza circuit forestal i estructural; mantén aquàtica en segon pla fins que surtin les bases. Progressa només una variable principal cada vegada i reavalua amb les dades següents.',
    };
}

export function buildGoalRoadmap({ sessions = [], goals = [], minutes = 45 } = {}) {
    const adaptive = buildAdaptiveRecommendations({ sessions, goals, minutes });
    return adaptive.recommendations.map((item) => ({
        ...item,
        nextCheck: item.action === 'progress' ? 'Revisar després de la següent sessió.' : 'Revisar després de 2-3 exposicions.',
    }));
}
