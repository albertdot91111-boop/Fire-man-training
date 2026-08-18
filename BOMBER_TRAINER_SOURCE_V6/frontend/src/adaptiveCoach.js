import { analyzeBomberAthlete, buildLearningLoop } from './bomberCoach';

/**
 * Capa adaptativa local: transforma l'anàlisi determinista del Bomber Coach
 * en recomanacions curtes que AiPage pot incorporar al context de la IA.
 */
export function buildAdaptiveRecommendations({ sessions = [], weights = [], goals = [], minutes = 45 } = {}) {
    const analysis = analyzeBomberAthlete({ sessions, weights, goals });
    const learning = buildLearningLoop(sessions);
    const recommendations = [];

    if (analysis.weakest) {
        const t = analysis.weakest;
        recommendations.push({
            type: t.type,
            title: `Prioritza ${t.label}`,
            detail: t.latestPenalties > 0
                ? 'Treballa primer la tècnica i redueix penalitzacions abans de buscar una marca millor.'
                : `La nota actual és ${Math.round((t.latestGrade ?? 0) * 10) / 10}/10; dedica-hi la part específica principal de la sessió.`,
        });
    } else {
        recommendations.push({
            type: 'base',
            title: 'Construir una línia base',
            detail: 'Registra proves cronometrades de les diferents modalitats abans de fer progressions agressives.',
        });
    }

    if (analysis.readiness === 'fatigue') {
        recommendations.push({ type: 'recovery', title: 'Baixa la càrrega avui', detail: 'La càrrega recent indica que convé recuperar i consolidar la tècnica.' });
    }

    const actionable = learning.actionable;
    if (actionable) {
        const labels = { progressar: 'Progressar', mantenir: 'Mantenir', consolidar: 'Consolidar', baixar: 'Baixar' };
        recommendations.push({
            type: actionable.type,
            title: `${labels[actionable.decision] || 'Ajustar'} ${actionable.label}`,
            detail: actionable.reason,
        });
    }

    recommendations.push({
        type: 'load',
        title: `Sessió adaptada a ${minutes} minuts`,
        detail: 'No augmentis volum, càrrega i intensitat alhora; la següent sessió ha de respondre al resultat de l’anterior.',
    });

    return {
        principle: 'Cada sessió alimenta la següent: resultat → anàlisi → ajust → nova sessió.',
        recommendations,
    };
}

export default buildAdaptiveRecommendations;
