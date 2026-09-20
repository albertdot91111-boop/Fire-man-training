import React from 'react';
import { Link, useParams } from 'react-router-dom';
import AppShell from '@/components/AppShell';

const UPDATED = '20 de setembre de 2026';

function Section({ title, children }) {
  return <section className="rounded-3xl bg-white border border-slate-200 p-5 shadow-sm"><h2 className="text-lg font-black">{title}</h2><div className="mt-3 text-sm leading-6 text-slate-600 space-y-3">{children}</div></section>;
}

function Privacy() {
  return <><Section title="Informació bàsica de protecció de dades">
    <p><strong>Responsable:</strong> el titular/operador de BOMBER TRAINER que consti identificat en la informació legal de l'app.</p>
    <p><strong>Finalitats:</strong> crear i gestionar el compte; autenticar l'usuari; guardar i sincronitzar entrenaments, progressos, objectius i dades introduïdes voluntàriament; prestar les funcions de l'app; mantenir la seguretat i prevenir usos indeguts.</p>
    <p><strong>Categories de dades:</strong> dades identificatives i de contacte del compte, dades d'autenticació i dades d'entrenament que l'usuari decideixi introduir, com ara temps, repeticions, pesos, objectius, pes corporal o observacions.</p>
    <p><strong>Base jurídica:</strong> execució del servei/relació amb l'usuari per a les dades necessàries per prestar l'app; obligacions legals quan correspongui; i consentiment quan una finalitat concreta requereixi consentiment. El consentiment serà específic, informat, revocable i separable d'altres assumptes.</p>
    <p><strong>Destinataris i proveïdors:</strong> les dades poden ser tractades pels proveïdors tecnològics necessaris per allotjar, autenticar, emmagatzemar i prestar el servei, amb les garanties contractuals i legals aplicables.</p><p><strong>Accés per part del responsable:</strong> la informació que introdueixis a BOMBER TRAINER pot ser accessible al responsable de l'aplicació quan sigui necessari per gestionar i mantenir el servei, donar suport, resoldre incidències, garantir la seguretat o complir obligacions legals. Aquest accés es limita a les finalitats legítimes del servei i no implica que les dades es facin públiques ni es comparteixin indiscriminadament amb tercers.</p>
    <p><strong>Conservació:</strong> durant el temps necessari per prestar el servei i, posteriorment, durant els terminis exigibles per obligacions legals o per determinar responsabilitats.</p>
    <p><strong>Drets:</strong> pots sol·licitar accés, rectificació, supressió, limitació, oposició i, quan sigui aplicable, portabilitat. També pots retirar un consentiment en qualsevol moment. Per exercir-los caldrà utilitzar el canal de contacte que identifiqui el responsable a la versió publicada de la política.</p>
    <p><strong>Reclamació:</strong> pots presentar una reclamació davant l'Agència Espanyola de Protecció de Dades (AEPD) si consideres que el tractament no s'ajusta a la normativa.</p>
  </Section>
  <Section title="Dades d'entrenament i salut"><p>BOMBER TRAINER és una eina d'organització i seguiment de l'entrenament. No és un servei mèdic ni substitueix professionals sanitaris. Evita introduir informació mèdica o de salut que no sigui necessària per al teu ús personal de l'app.</p><p>Si en una funcionalitat concreta es tractessin categories especials de dades, s'informarà específicament i, quan sigui exigible, es demanarà consentiment explícit separat.</p></Section>
  <Section title="Decisions automatitzades i IA"><p>Les funcions d'assistent o recomanacions, si estan disponibles, tenen finalitat informativa i d'entrenament. No constitueixen diagnòstic mèdic ni decisions professionals. Si una funcionalitat impliqués elaboració de perfils o decisions automatitzades amb efectes jurídics o similars, s'informaria específicament abans d'utilitzar-la.</p></Section></>;
}

function Terms() {
  return <><Section title="Objecte"><p>BOMBER TRAINER ofereix eines per registrar entrenaments, consultar progressos i preparar les proves físiques de les oposicions de Bombers. Les referències a convocatòries, barems o proves s'han de contrastar sempre amb les bases oficials vigents.</p></Section>
  <Section title="Compte d'usuari"><p>L'usuari és responsable de mantenir la confidencialitat de les seves credencials i de la informació introduïda al compte. No està permès utilitzar l'app per accedir al compte d'una altra persona, interferir en el servei o intentar obtenir dades d'altres usuaris.</p></Section>
  <Section title="Entrenament i responsabilitat"><p>Els entrenaments, càrregues, temps i recomanacions són orientatius. L'usuari ha d'adaptar l'entrenament a la seva situació i, si existeix qualsevol risc o limitació física, consultar un professional qualificat. L'app no garanteix resultats en proves d'oposició.</p></Section>
  <Section title="Continguts oficials"><p>Les bases i barems poden canviar. Quan l'app mostri dades relatives a una convocatòria, preval sempre la normativa i publicació oficial corresponent.</p></Section>
  <Section title="Propietat intel·lectual"><p>El programari, disseny, textos i elements propis de BOMBER TRAINER estan protegits per la normativa aplicable. No es permet copiar, revendre o redistribuir parts protegides del servei sense autorització, excepte en els casos permesos legalment.</p></Section>
  <Section title="Suspensió i disponibilitat"><p>El servei pot experimentar interrupcions per manteniment, incidències de proveïdors o causes fora del control del responsable. Es podran suspendre comptes que incompleixin aquestes condicions o la normativa aplicable.</p></Section>
  <Section title="Modificacions"><p>Les condicions poden actualitzar-se per canvis legals, funcionals o de seguretat. Les modificacions rellevants es comunicaran mitjançant l'app o el canal corresponent.</p></Section></>;
}

function Cookies() {
  return <><Section title="Què són les cookies?"><p>Són fitxers o tecnologies similars que poden emmagatzemar informació al dispositiu o permetre reconèixer una sessió.</p></Section>
  <Section title="Cookies necessàries"><p>Les tecnologies estrictament necessàries per iniciar sessió, mantenir la sessió, protegir el servei o recordar configuracions essencials poden funcionar sense consentiment quan estiguin exemptes segons la normativa aplicable.</p></Section>
  <Section title="Cookies d'anàlisi o publicitat"><p>BOMBER TRAINER no ha d'activar cookies analítiques, publicitàries o de seguiment no necessàries abans d'obtenir el consentiment corresponent. Si s'afegeixen en el futur, es mostraran en un gestor de preferències amb opcions separades.</p></Section>
  <Section title="Gestió"><p>Les preferències es podran modificar mitjançant el gestor de privacitat/cookies de l'app quan aquesta funcionalitat estigui disponible.</p></Section></>;
}

export default function LegalPage() {
  const { type = 'privacitat' } = useParams();
  const title = type === 'condicions' ? "Condicions d'ús" : type === 'cookies' ? 'Política de cookies' : 'Política de privacitat';
  return <AppShell title={title}><div className="space-y-4">
    <div className="rounded-3xl bg-slate-900 text-white p-5"><p className="text-xs font-bold tracking-widest text-slate-400">INFORMACIÓ LEGAL</p><h1 className="mt-1 text-2xl font-black">{title}</h1><p className="mt-2 text-xs text-slate-400">Última actualització: {UPDATED}</p></div>
    {type === 'condicions' ? <Terms /> : type === 'cookies' ? <Cookies /> : <Privacy />}
    <div className="flex flex-wrap gap-2 text-sm font-bold"><Link to="/legal/privacitat" className="rounded-xl bg-white border border-slate-200 px-3 py-2">Privacitat</Link><Link to="/legal/condicions" className="rounded-xl bg-white border border-slate-200 px-3 py-2">Condicions</Link><Link to="/legal/cookies" className="rounded-xl bg-white border border-slate-200 px-3 py-2">Cookies</Link></div>
    <p className="text-[11px] leading-5 text-slate-400">Nota: abans de publicar comercialment l'app, el titular ha de completar les dades identificatives i de contacte exigides per la normativa i revisar els proveïdors, transferències internacionals, terminis de conservació i configuració real de cookies/analítica.</p>
  </div></AppShell>;
}
