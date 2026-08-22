import { diagnoseBomberProgress } from '@/aiEngine';

const normalize = (v) => String(v || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

const LOCAL_TERMS = [
  'com vaig', 'com estic', 'com progreso', 'com evoluciono', 'evolucio',
  'millorar', 'millora', 'punt feble', 'punts febles', 'prioritat',
  'que faig avui', 'entreno avui', 'fc', 'freqüencia cardiaca', 'frequencia cardiaca',
  'pulsacions', 'batecs', 'km', 'distancia', 'distància', 'ritme', 'correr', 'córrer',
  'millor sessio', 'millor sessió', 'record', 'quant fa', 'fa quant', 'temps que no',
  'dies que no', 'objectiu', 'objectius', 'sessio', 'sessió', 'entrenament', 'entrenaments'
];

export function routeAiQuestion(question, data) {
  const q = normalize(question);
  const diagnosis = diagnoseBomberProgress(Array.isArray(data?.sessions) ? data.sessions : []);

  // Primer descartem preguntes de coneixement general. Això evita que frases com
  // "què és la FC?" o "com funciona el flashover?" acabin per error a la IA local.
  const explicitKnowledge = /^(que|què) (es|és|vol dir)|\bexplica\b|\bdefinicio\b|\bdefinició\b|\bcom funciona\b|\bper que\b|\bper què\b|\bquina diferencia\b|\bquina diferència\b/.test(q);
  if (explicitKnowledge) return { engine: 'gemini', reason: 'Pregunta de coneixement o explicació general.', diagnosis };

  const hasLocalTerm = LOCAL_TERMS.some(t => q.includes(normalize(t)));
  const personalData = /\b(meu|meva|meves|meus|jo|tinc|porto|vaig|estic|he fet|he entrenat)\b/.test(q);

  if (hasLocalTerm || personalData) return { engine: 'local', reason: 'Dades i anàlisi de Bomber Trainer.', diagnosis };
  if (q.length > 0) return { engine: 'gemini', reason: 'Pregunta oberta o de coneixement.', diagnosis };
  return { engine: 'local', reason: 'Pregunta buida.', diagnosis };
}
