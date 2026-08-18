import { coachBrief as buildCoachBrief } from './bomberCoach';

/**
 * Compatibilitat del Bomber Coach: manté una API petita per a AiPage.
 * La lògica real continua centralitzada a bomberCoach.js.
 */
export function coachBrief(args = {}) {
    return buildCoachBrief(args);
}

export default coachBrief;
