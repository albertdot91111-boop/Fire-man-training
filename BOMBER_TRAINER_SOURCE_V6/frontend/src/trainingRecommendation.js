import { TYPES, weakPoints } from '@/lib/btData';

const FALLBACK = {
    type: 'manteniment',
    label: 'Manteniment',
    reason: 'Les proves principals consten com a treballades aquesta setmana. Mantén la base sense forçar una prova concreta.',
};

export function getTrainingRecommendation(sessions = []) {
    const weak = weakPoints(sessions);
    const priority = weak[0];

    if (priority) {
        const type = priority.type;
        const label = TYPES[type]?.label || type;
        const reason = priority.days === null
            ? `Encara no hi ha cap sessió registrada de ${label.toLowerCase()}.`
            : `Fa ${priority.days} dies que no registres ${label.toLowerCase()}.`;
        return { type, label, reason, days: priority.days };
    }

    return FALLBACK;
}

export function recommendationPath(type) {
    if (type === 'manteniment') return '/entrena/manteniment';
    return `/entrena/${type}`;
}
