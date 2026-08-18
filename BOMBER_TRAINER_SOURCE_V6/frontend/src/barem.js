// Motor únic de barems de BOMBER TRAINER.
// IMPORTANT: els ancoratges actuals són INFERITS i NO oficials.

export const BAREM_CONFIG = {
    forestal: { t10: 190, t0: 570, direction: 'lower_is_better', inferred: true },
    estructural: { t10: 130, t0: 390, direction: 'lower_is_better', inferred: true },
    aquatic: { t10: 190, t0: 570, direction: 'lower_is_better', inferred: true },
};

export const BAREM_NOTES = {
    forestal: '10 ≈ 3:10. Valor inferit, NO oficial.',
    estructural: '10 ≈ 2:10. Valor inferit, NO oficial.',
    aquatic: '10 ≈ 3:10, inferit a partir de "3 minuts i poc". NO oficial.',
};

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

export function gradeForPerformance(type, value, options = {}) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) return null;

    const config = BAREM_CONFIG[type];
    const direction = options.direction || config?.direction || 'lower_is_better';
    const t10 = Number(options.t10 ?? config?.t10);
    if (!Number.isFinite(t10) || t10 <= 0) return null;

    if (direction === 'higher_is_better') {
        const t0 = Number(options.t0 ?? t10 / 3);
        if (!Number.isFinite(t0) || t0 >= t10) return null;
        return clamp(10 * (numeric - t0) / (t10 - t0), 0, 10);
    }

    const t0 = Number(options.t0 ?? config?.t0 ?? (3 * t10));
    if (!Number.isFinite(t0) || t0 <= t10) return null;
    return clamp(5 * (t0 - numeric) / t10, 0, 10);
}

export function displayGrade(type, value, options = {}) {
    const grade = gradeForPerformance(type, value, options);
    return grade === null ? null : Math.round(grade * 10) / 10;
}

export function isInferred(type) {
    return Boolean(BAREM_CONFIG[type]?.inferred);
}
