import { diagnoseBomberProgress } from '@/aiEngine';
const normalize = (v) => String(v || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
const LOCAL_TERMS = ['com vaig','com estic','progres','evolucio','millorar','millora','punt feble','punts febles','prioritat','que faig avui','entreno avui','fc','freqüencia cardiaca','frequencia cardiaca','pulsacions','batecs','km','distancia','distància','ritme','correr','córrer','millor sessio','millor sessió','record','quant fa','fa quant','temps que no','dies que no','objectiu','objectius','sessio','sessió','entrenament','entrenaments'];
export function routeAiQuestion(question, data) {
  const q = normalize(question);
  const diagnosis = diagnoseBomberProgress(Array.isArray(data?.sessions) ? data.sessions : []);
  const hasLocalTerm = LOCAL_TERMS.some(t => q.includes(normalize(t)));
  const explicitKnowledge = /^(que|què) (es|és|vol dir)|\bexplica\b|\bdefinicio\b|\bdefinició\b|\bcom funciona\b/.test(q);
  const personalData = /\b(meu|meva|meves|meus|jo|tinc|porto|vaig|estic)\b/.test(q);
  if (hasLocalTerm || personalData) return { engine: 'local', reason: 'Dades i anàlisi de Bomber Trainer.', diagnosis };
  if (explicitKnowledge || q.length > 0) return { engine: 'gemini', reason: 'Pregunta oberta o de coneixement.', diagnosis };
  return { engine: 'local', reason: 'Pregunta buida.', diagnosis };
}
