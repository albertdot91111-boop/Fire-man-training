import lockfile from './_export_assets/pnpm-lock.yaml?raw';
import handoffDoc from './_export_assets/HANDOFF.md?raw';

/*
 * Portable, dependency-free ZIP export.
 *
 * The export is generated in the browser from the source files bundled by Vite.
 * It deliberately contains only source/configuration/documentation files and
 * never includes environment values, auth tokens, or user credentials.
 */

const textEncoder = new TextEncoder();

const SOURCE_CONFIG_FILES = {
    'README.md': `# BOMBER TRAINER

Aplicació web responsiva d'entrenament per a opositors de Bombers.

## Estat d'aquesta exportació

Aquesta exportació inclou tot el frontend i la seva configuració de reconstrucció.
L'exportació adjunta original no contenia cap implementació verificable de
\`apps/api\` ni \`apps/pocketbase\`; aquestes absències estan documentades a
\`docs/PORTABILITY_STATUS.md\` i no s'han inventat ni substituït per mocks.

## Instal·lació del frontend

1. \`pnpm install\` o \`npm install\`
2. Copia \`.env.example\` a \`.env\` i omple només els valors necessaris.
3. \`npm run dev\`

## Domini funcional

Tipus de sessió: pit, cames, estructural, forestal, manteniment, ràpid, dia no disponible.
Punts: entrenament complet +100, manteniment +40, mínim +20.
Nivells: Aspirant, Preparació, Bomber, Elite.

Filosofia: no busquem entrenaments perfectes, busquem acumular feina útil.
`,
    'package.json': `{
  "name": "bomber-trainer-web",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite --config apps/web/vite.config.js",
    "build": "vite build --config apps/web/vite.config.js"
  },
  "dependencies": {
    "@radix-ui/react-accordion": "^1.2.11",
    "@radix-ui/react-alert-dialog": "^1.1.14",
    "@radix-ui/react-aspect-ratio": "^1.1.7",
    "@radix-ui/react-avatar": "^1.1.10",
    "@radix-ui/react-checkbox": "^1.3.2",
    "@radix-ui/react-collapsible": "^1.1.11",
    "@radix-ui/react-context-menu": "^2.2.15",
    "@radix-ui/react-dialog": "^1.1.14",
    "@radix-ui/react-dropdown-menu": "^2.1.15",
    "@radix-ui/react-hover-card": "^1.1.14",
    "@radix-ui/react-label": "^2.1.7",
    "@radix-ui/react-menubar": "^1.1.15",
    "@radix-ui/react-navigation-menu": "^1.2.13",
    "@radix-ui/react-popover": "^1.1.14",
    "@radix-ui/react-progress": "^1.1.7",
    "@radix-ui/react-radio-group": "^1.3.7",
    "@radix-ui/react-scroll-area": "^1.2.9",
    "@radix-ui/react-select": "^2.2.5",
    "@radix-ui/react-separator": "^1.1.7",
    "@radix-ui/react-slider": "^1.3.5",
    "@radix-ui/react-slot": "^1.2.3",
    "@radix-ui/react-switch": "^1.2.5",
    "@radix-ui/react-tabs": "^1.1.12",
    "@radix-ui/react-toast": "^1.2.14",
    "@radix-ui/react-toggle": "^1.1.9",
    "@radix-ui/react-toggle-group": "^1.1.10",
    "@radix-ui/react-tooltip": "^1.2.7",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "cmdk": "^1.1.1",
    "embla-carousel-react": "^8.5.2",
    "framer-motion": "^11.15.0",
    "input-otp": "^1.4.2",
    "lucide-react": "^0.469.0",
    "next-themes": "^0.4.4",
    "pocketbase": "^0.27.1",
    "react": "^18.3.1",
    "react-day-picker": "^9.7.0",
    "react-dom": "^18.3.1",
    "react-helmet": "^6.1.0",
    "react-hook-form": "^7.54.2",
    "react-resizable-panels": "^2.1.7",
    "react-router-dom": "^7.18.2",
    "recharts": "^2.15.4",
    "sonner": "^1.7.1",
    "tailwind-merge": "^2.6.0",
    "vaul": "^1.1.2"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.4.1",
    "autoprefixer": "^10.4.20",
    "postcss": "^8.4.49",
    "tailwindcss": "^3.4.17",
    "vite": "^6.0.7"
  }
}`,
    '.env.example': `# BOMBER TRAINER — mai committis valors reals
VITE_POCKETBASE_URL=/hcgi/platform
VITE_API_SERVER_URL=/hcgi/api
PORT=5173
CORS_ORIGIN=
WEBSITE_DOMAIN=
INTEGRATED_AI_API_URL=
INTEGRATED_AI_API_KEY=
PB_SUPERUSER_EMAIL=
PB_SUPERUSER_PASSWORD=
`,
    'apps/web/index.html': `<!doctype html>
<html lang="ca">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="theme-color" content="#f8fafc" />
    <title>BOMBER TRAINER</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
`,
    'apps/web/vite.config.js': `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
    root: path.resolve(process.cwd(), 'apps/web'),
    plugins: [react()],
    resolve: { alias: { '@': path.resolve(process.cwd(), 'apps/web/src') } },
    server: { host: '0.0.0.0', port: Number(process.env.PORT || 5173) },
    build: { outDir: path.resolve(process.cwd(), 'dist'), emptyOutDir: true },
});
`,
    'apps/web/tailwind.config.js': `import path from 'node:path';

export default {
    content: [path.resolve(process.cwd(), 'apps/web/src/**/*.{js,jsx,ts,tsx}')],
    theme: { extend: {} },
    plugins: [],
};
`,
    'apps/web/postcss.config.js': `export default {
    plugins: { tailwindcss: {}, autoprefixer: {} },
};
`,
    'docs/TECHNICAL.md': `# Documentació tècnica

## Frontend

- React + Vite + Tailwind.
- Entry point: \`apps/web/src/main.jsx\`.
- Alias \`@\`: \`apps/web/src\`.
- Client PocketBase: \`apps/web/src/lib/pocketbaseClient.js\`.
- Client API/IA: \`apps/web/src/lib/apiServerClient.js\` i \`integratedAiClient.js\`.
- Exportació: \`apps/web/src/lib/btExport.js\`.

## Serveis externs esperats

El frontend espera PocketBase a \`VITE_POCKETBASE_URL\` i l'API a
\`VITE_API_SERVER_URL\`. El material original revisat no contenia els serveis
\`apps/api\` ni \`apps/pocketbase\`; vegeu \`docs/PORTABILITY_STATUS.md\`.
`,
};

const PORTABILITY_STATUS = `# PORTABILITY_STATUS

## Verificat a l'exportació

- El frontend React existent i els seus imports locals.
- El fitxer \`apps/web/src/lib/btExport.js\`.
- La configuració mínima de Vite, Tailwind i PostCSS.
- Les dependències utilitzades pel frontend principal.
- La plantilla \`.env.example\`, sense secrets.

## Absències confirmades al material original

No s'ha trobat cap implementació verificable de:

- \`apps/api\`
- \`apps/api/src/constants/prompts.js\`
- \`apps/pocketbase\`
- migracions, esquemes o regles PocketBase
- rutes servidor \`/hcgi/api\` i \`/hcgi/platform\`

El frontend continua apuntant a aquestes rutes perquè són part del contracte de
l'exportació original. Cal recuperar el backend i la configuració de PocketBase
originals per aconseguir una reconstrucció full-stack completa. No s'han
inventat implementacions noves durant aquesta correcció de portabilitat.
`;

const HANDOFF_DOCUMENTS = {
    'PROJECT_CONTEXT.md': `# PROJECT_CONTEXT

BOMBER TRAINER és una app per a opositors de Bombers.

Filosofia: "NO BUSQUEM ENTRENAMENTS PERFECTES. BUSQUEM ACUMULAR FEINA ÚTIL."

Arquitectura verificada en aquesta exportació: frontend React + Vite amb clients
per a PocketBase i l'API d'IA. El backend Express i PocketBase no estan inclosos
en el material original revisat.
`,
    'FEATURES.md': `# FEATURES

Implementat al frontend exportat:

- Autenticació PocketBase.
- Pantalla "Què puc fer avui?".
- Entrenaments de pit, cames, estructural, forestal, manteniment i ràpid.
- Registre de sessions, incidències, notes, temps i dades d'exercicis.
- Punts, ratxa, nivells i progrés.
- Pes corporal i objectius.
- Material disponible.
- Context real per a l'assistent IA.
- Exportació portable de SOURCE i HANDOFF.

No s'han afegit funcionalitats noves en aquesta correcció.
`,
    'DATABASE.md': `# DATABASE (estat verificat)

El frontend espera les col·leccions PocketBase següents:

- \`users\`: autenticació PocketBase.
- \`bt_sessions\`: type, date, duration, points, incidents, notes, data, owner.
- \`bt_weights\`: date, weight, fat, owner.
- \`bt_goals\`: title, target, current, unit, owner.
- \`bt_settings\`: material, displayName, owner.
- \`_integratedAiMessages\`: historial intern del client d'IA.
- \`_integratedAiImages\`: fitxers i referències internes del client d'IA.

No s'han exportat migracions, esquemes ni regles PocketBase verificables. Les
regles de propietari únic descrites anteriorment són una intenció documentada,
no una configuració que es pugui comprovar en aquest SOURCE.
`,
    'AI_INSTRUCTIONS.md': `# AI_INSTRUCTIONS

El frontend construeix \`[DADES DE L'USUARI]\` amb ratxa, punts, nivell, dies
des de cada tipus, material, objectius, pes recent i els últims 25 entrenaments.

El client envia el streaming a:

\`POST /hcgi/api/integrated-ai/stream\`

El prompt de sistema i el servidor que haurien d'atendre aquesta ruta no
estaven inclosos en el SOURCE original revisat. No hi ha claus reals en aquesta
exportació.
`,
    'PROJECT_STATUS.md': `# PROJECT_STATUS

## Auditoria funcional del MVP — 12/08/2026

- 🟢 Interfície, rutes, formularis originals, opcions de temps 5/10/15/20/30/45+
  i exportadors compilen.
- 🟡 La persistència end-to-end no es pot verificar perquè el SOURCE no inclou
  PocketBase ni les rutes del servei d'IA.
- 🟡 Manteniment accepta sèries 15/15/12 i Progrés en mostra l'evolució quan
  la sessió existeix a l'historial.
- 🔴 No es pot validar una sessió real ni una recomanació IA sense recuperar
  els serveis externs originals.

Regles verificades: específic +100, manteniment +40, mínim +20 i NO DISPONIBLE
amb 0 punts sense penalitzar la ratxa. No s'ha inventat backend, PocketBase,
persistència local alternativa ni dades demo.
`,
    'CHANGELOG.md': `# CHANGELOG

## Auditoria funcional del MVP — 12/08/2026

- Corregit el bloqueig d'arrencada de l'adaptador de PocketBase de portabilitat.
- Mantenint el model de sessió existent, manteniment accepta sèries separades
  per /, per exemple 15/15/12.
- Progrés mostra l'evolució de les sèries de manteniment i admet registres antics
  amb temps.
- Verificats els punts +100/+40/+20, NO DISPONIBLE i 5/10/15/20/30/45+.
- Confirmada l'absència de backend PocketBase i API d'IA; no s'hi ha afegit cap
  implementació nova.
`,
    'TODO.md': `# TODO

## Bloquejos existents

- Recuperar el backend PocketBase original, col·leccions, migracions i regles.
- Recuperar el servei de l'Assistent IA i /hcgi/api/integrated-ai/stream.
- Repetir l'auditoria end-to-end amb un usuari real, dades persistides i
  sincronització.

No afegir funcionalitats noves ni tocar la portabilitat ja corregida.
`,
};

const sourceModules = import.meta.glob('./**/*.{js,jsx,css}', {
    query: '?raw',
    import: 'default',
    eager: true,
});

function sourceEntries() {
    const entries = Object.entries(sourceModules).map(([filePath, content]) => [
        `apps/web/src/${filePath.replace(/^\.\.\//, '')}`,
        content,
    ]);

    return Object.fromEntries(entries);
}

function writeU16(value) {
    return [value & 0xff, (value >>> 8) & 0xff];
}

function writeU32(value) {
    return [value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff];
}

function crc32(bytes) {
    let crc = 0xffffffff;
    for (const byte of bytes) {
        crc ^= byte;
        for (let bit = 0; bit < 8; bit += 1) {
            crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
        }
    }
    return (crc ^ 0xffffffff) >>> 0;
}

function pushBytes(target, bytes) {
    target.push(...bytes);
}

function zip(entries) {
    const localParts = [];
    const centralParts = [];
    let offset = 0;
    const normalized = Object.entries(entries)
        .filter(([, value]) => typeof value === 'string')
        .sort(([a], [b]) => a.localeCompare(b));

    for (const [name, content] of normalized) {
        const filename = textEncoder.encode(name);
        const data = textEncoder.encode(content);
        const checksum = crc32(data);
        const local = [];
        pushBytes(local, [0x50, 0x4b, 0x03, 0x04]);
        pushBytes(local, writeU16(20));
        pushBytes(local, writeU16(0));
        pushBytes(local, writeU16(0));
        pushBytes(local, writeU16(0));
        pushBytes(local, writeU16(0));
        pushBytes(local, writeU32(checksum));
        pushBytes(local, writeU32(data.length));
        pushBytes(local, writeU32(data.length));
        pushBytes(local, writeU16(filename.length));
        pushBytes(local, writeU16(0));
        pushBytes(local, filename);
        pushBytes(local, data);
        localParts.push(local);

        const central = [];
        pushBytes(central, [0x50, 0x4b, 0x01, 0x02]);
        pushBytes(central, writeU16(20));
        pushBytes(central, writeU16(20));
        pushBytes(central, writeU16(0));
        pushBytes(central, writeU16(0));
        pushBytes(central, writeU16(0));
        pushBytes(central, writeU16(0));
        pushBytes(central, writeU32(checksum));
        pushBytes(central, writeU32(data.length));
        pushBytes(central, writeU32(data.length));
        pushBytes(central, writeU16(filename.length));
        pushBytes(central, writeU16(0));
        pushBytes(central, writeU16(0));
        pushBytes(central, writeU16(0));
        pushBytes(central, writeU16(0));
        pushBytes(central, writeU32(0));
        pushBytes(central, writeU32(offset));
        pushBytes(central, filename);
        centralParts.push(central);
        offset += local.length;
    }

    const centralOffset = offset;
    const output = [];
    localParts.forEach((part) => pushBytes(output, part));
    centralParts.forEach((part) => pushBytes(output, part));
    const centralSize = output.length - centralOffset;
    const end = [];
    pushBytes(end, [0x50, 0x4b, 0x05, 0x06]);
    pushBytes(end, writeU16(0));
    pushBytes(end, writeU16(0));
    pushBytes(end, writeU16(normalized.length));
    pushBytes(end, writeU16(normalized.length));
    pushBytes(end, writeU32(centralSize));
    pushBytes(end, writeU32(centralOffset));
    pushBytes(end, writeU16(0));
    pushBytes(output, end);

    return new Blob([new Uint8Array(output)], { type: 'application/zip' });
}

export function download(file, filename) {
    const url = URL.createObjectURL(file);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function buildSourceZip() {
    return zip({
        ...sourceEntries(),
        ...SOURCE_CONFIG_FILES,
        'pnpm-lock.yaml': lockfile,
        'HANDOFF.md': handoffDoc,
        'docs/PORTABILITY_STATUS.md': PORTABILITY_STATUS,
        ...Object.fromEntries(Object.entries(HANDOFF_DOCUMENTS).map(([name, content]) => [`docs/handoff/${name}`, content])),
    });
}

function sanitizeRecord(record) {
    return Object.fromEntries(
        Object.entries(record || {}).filter(([key]) => !['id', 'collectionId', 'collectionName', 'owner', 'created', 'updated'].includes(key)),
    );
}

export function buildHandoffZip({ sessions = [], weights = [], goals = [], material = [], points = 0, level = 'Aspirant', streakDays = 0 } = {}) {
    const snapshot = {
        sessions: sessions.map(sanitizeRecord),
        weights: weights.map(sanitizeRecord),
        goals: goals.map(sanitizeRecord),
        material,
    };

    const status = `${HANDOFF_DOCUMENTS['PROJECT_STATUS.md']}

## Snapshot de dades

- Sessions: ${snapshot.sessions.length}
- Pesos: ${snapshot.weights.length}
- Objectius: ${snapshot.goals.length}
- Punts: ${points}
- Nivell: ${level}
- Ratxa: ${streakDays} dies
`;

    return zip({
        ...HANDOFF_DOCUMENTS,
        'HANDOFF.md': handoffDoc,
        'PROJECT_STATUS.md': status,
        'DATA_SNAPSHOT.json': JSON.stringify(snapshot, null, 2),
        'PORTABILITY_STATUS.md': PORTABILITY_STATUS,
    });
}