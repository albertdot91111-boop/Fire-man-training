import { diagnoseBomberProgress } from '@/aiEngine';

// Prioritats actuals decidides per l'usuari.
// FASE 1: només FORESTAL vs ESTRUCTURAL.
// AQUÀTICA/PISCINA i PRESS BANCA queden fora de la priorització fins a les noves bases.
export function diagnoseCurrentPriority(sessions = []) {
  const base = diagnoseBomberProgress(sessions);
  const active = (base.tests || []).filter(t => t.type === 'forestal' || t.type === 'estructural');
  if (!active.length) return { ...base, priority: null, activeTypes: ['forestal', 'estructural'], reason: 'Falten dades de Forestal i/o Estructural.' };

  const score = (t) => {
    const r = t.readiness;
    const gap = r?.target ? Math.max(0, (r.latest - r.target) / r.target) : 0;
    const penalties = Number(t.penaltiesLatest || 0) * 0.12;
    const regression = r?.trendPerSession > 0 ? Math.min(0.5, r.trendPerSession / Math.max(1, r.latest || 1)) : 0;
    return gap + penalties + regression;
  };
  const ranked = active.slice().sort((a,b) => score(b) - score(a));
  const f = active.find(t => t.type === 'forestal');
  const e = active.find(t => t.type === 'estructural');
  return {
    ...base,
    tests: active,
    priority: ranked[0]?.type || null,
    comparison: { forestal: f || null, estructural: e || null },
    activeTypes: ['forestal', 'estructural'],
    inactiveUntilBases: ['aquatic', 'pressbanca'],
    reason: ranked.length > 1
      ? `Comparació activa només Forestal vs Estructural. Prioritat actual: ${ranked[0].label}. Aquàtica/Piscina i Press banca estan desactivades de prioritats fins a les noves bases.`
      : 'Calen dades de Forestal i Estructural per comparar-les.'
  };
}
