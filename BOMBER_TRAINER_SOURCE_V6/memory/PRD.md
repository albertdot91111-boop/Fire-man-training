# Bomber Trainer V3 — PRD

## Problema original
Restaurar i deixar funcional el projecte BOMBER TRAINER V3 original, mantenint disseny i funcionalitats existents, però amb persistència REAL via PocketBase (no Base44). Treball en BLOCS PETITS amb backup després de cada bloc.

## Font de veritat
- `bomber-trainer-source-v2.zip` → V3 original (SOURCE, font de veritat)
- `bomber-trainer-v3-pendent.zip` → HANDOFF/traspàs (referència d'organització)

## Regles absolutes
- Cap migració gran de cop. Una tasca petita, parar, verificar, backup, esperar confirmació.
- No inventar funcionalitats, pantalles, camps, prompts, credencials.
- Conservar disseny V3 original. No recrear des de zero.
- Cada tasca acabada → regenerar SOURCE + HANDOFF ZIPs abans de continuar.

## Stack objectiu V3
React 18, Vite 6, Tailwind v3, shadcn, framer-motion, react-router-dom v7, recharts, sonner, react-hook-form, PocketBase ^0.27.1.

## Pàgines V3
- Auth: LoginPage, Register, ForgotPassword, ResetPassword, OAuthConsent
- App: HomePage `/`, TrainPage `/entrena/:type`, ProgressPage `/progres`, AiPage `/ia`, SettingsPage `/configuracio`, DownloadPage `/descarrega`, PageNotFound

## Domini (btData.js)
- Tipus: pit, cames, estructural, forestal, manteniment, ràpid, descans
- Punts: 100/40/20
- Nivells: Aspirant → Preparació → Bomber → Elite
- Ratxa, Material, Incidències, MOTIVATION, buildUserContext (IA)

## Backend PocketBase (objectiu, no implementat encara)
- PocketBase com a servei intern (port intern p.ex. 8090)
- FastAPI proxy `/api/pb/*` → PocketBase
- Frontend: `VITE_POCKETBASE_URL=/api/pb`
- Col·leccions: users, bt_sessions, bt_weights, bt_goals, bt_settings

## Estat actual (implementat)
### 2026-02 — Tasca 1: Backups descarregables
- `/app/backups/source.zip` (348.421 bytes) — SOURCE V3 preservat
- `/app/backups/handoff.zip` (371.994 bytes) — HANDOFF preservat
- Endpoints FastAPI:
  - `GET /api/backups` → llistat amb mida, data i URL
  - `GET /api/backups/source.zip` → descàrrega SOURCE
  - `GET /api/backups/handoff.zip` → descàrrega HANDOFF
- Validat: ZIPs íntegres (`unzip -tq` sense errors), accessibles via URL pública del preview.

## Backlog prioritzat (pendent de confirmació de l'usuari)
- **P0 — Tasca 2**: Extreure SOURCE V3 dins `/app` (backup previ) i identificar exactament estructura Vite vs plantilla CRA actual. Cap canvi encara.
- **P0 — Tasca 3**: Aixecar PocketBase real com a servei intern (port 8090) + proxy FastAPI `/api/pb/*`. Sense col·leccions encara.
- **P0 — Tasca 4**: Crear col·leccions users/bt_sessions/bt_weights/bt_goals/bt_settings segons DATABASE.md del handoff.
- **P1 — Tasca 5**: `pocketbaseClient.js` real (substituint dependència Base44 gradualment).
- **P1 — Tasca 6**: `AuthContext.jsx` amb PocketBase (Login/Register/Forgot/Reset).
- **P1 — Tasca 7**: Migrar HomePage + TrainPage cap a PocketBase.
- **P1 — Tasca 8**: ProgressPage + SettingsPage + DownloadPage.
- **P2 — Tasca 9**: AiPage `/ia` — deixar UI, pendent de decisió sobre backend IA (NO inventar prompt).
- **P2 — Tasca 10**: `/descarrega` genera ZIPs reals del projecte actual (SOURCE + HANDOFF auto).

## Regla de treball recordatori
Després de cada tasca funcional → regenerar SOURCE + HANDOFF ZIPs → esperar confirmació.

## 2026-06 — FASE 1: PocketBase real (col·leccions + regles) ✅ VERIFICAT
- Entorn reiniciat a plantilla; restaurat estat V3 des de source.zip (backend, memory, pb_data) + binari PocketBase v0.23.12 (arm64).
- Creades 5 col·leccions segons DATABASE.md (cap camp inventat): users (auth) + bt_sessions, bt_weights, bt_goals, bt_settings (base). owner = relation a users.
- Regles de propietat aplicades a totes les col·leccions (owner = @request.auth.id; users: id = @request.auth.id; createRule users = "" per registre).
- Verificat (13/13 PASS via scripts/verify_phase1.py): crear registre, autenticar, crear/llegir/modificar dades pròpies, aïllament entre usuaris, superusuari.
- Frontend NO tocat.
- Backups descarregables generats i validats (HTTP 200 via URL pública):
  - BOMBER_TRAINER_SOURCE_V4.zip (codi actual + pb_data + scripts)
  - BOMBER_TRAINER_HANDOFF_V4.zip (estat, col·leccions, camps, regles, verificat, pendent, següent pas)
- Scripts: scripts/create_collections.py (idempotent), scripts/verify_phase1.py.

## Següent (esperant confirmació de l'usuari)
- FASE 2: AUTENTICACIÓ FRONTEND (connectar pantalles auth V3 amb PocketBase real). NO iniciar fins ordre expressa.

## 2026-06 — FASE 2: Autenticació Frontend (V3 real + PocketBase) ✅
- Migrat el frontend V3 (Vite) a /app/frontend; arrenca amb `yarn start` (vite) al port 3000. Disseny BOMBER original intacte.
- Eliminada la dependència Base44 de la capa d'auth; les pàgines de dades ja usen el client PocketBase real (@/lib/pocketbaseClient).
- Reescrites amb PocketBase (via /api/pb): AuthContext (lib + contexts), LoginPage, Register, ForgotPassword, ResetPassword, App.jsx (rutes), PageNotFound. Alias Vite `@/lib`→src i `@`→src.
- Verificat contra la URL pública /api/pb: create (signup) + auth-with-password + auth-refresh (sessió persistent) + request-password-reset (204). Aïllament de propietat intacte.
- Login/Register: email+contrasenya directe (sense OTP). Forgot/Reset connectats (emails pendents d'SMTP).
- Google OAuth: AJORNAT (usuari sense credencials). Botó amagat; codi de suport (OAuthCallback/googleOAuth) eliminat. Reactivable quan hi hagi Client ID/Secret + config a PocketBase.
- Pàgines NO tocades (per ordre): Home/Train/Progress/Settings (segueixen amb el client PocketBase real que ja tenien).
- Lint (ESLint 9 flat config restaurat) i `vite build` passen nets.

## Següent (esperant ordre de l'usuari)
- Regenerar backups SOURCE/HANDOFF V5 quan l'usuari ho demani.
- Migrar/validar Home/Train/Progress/Settings end-to-end amb dades reals.
- (Opcional) Configurar Google OAuth i SMTP quan hi hagi credencials.

## 2026-06 — Google OAuth ACTIVAT i verificat ✅
- Proveïdor "google" configurat a PocketBase (users.oauth2, PKCE, enabled). Secret només al servidor.
- Frontend: botó "Continua amb Google" restaurat a /login i /register; flux manual de codi (googleOAuth.js) + ruta /oauth/callback (OAuthCallback.jsx) amb authWithOAuth2Code.
- Testing agent (iteration_1.json): 6/6 PASS — register email/contrasenya→home, persistència de sessió, login, error de contrasenya, INICIACIÓ Google (redirigeix a accounts.google.com amb client_id i redirect_uri correctes), i /oauth/callback amb gestió d'error correcta.
- Fix menor aplicat: LoginPage navega dins useEffect (evita setState-durant-render).
- NOTA: la finalització real del consentiment Google requereix un compte Google humà (no automatitzable); la integració està correctament configurada fins la pantalla de Google.
- ZIP V5: NO generats encara (per ordre de l'usuari, fins confirmar Google en ús real).

## 2026-06 — FIX bug Google OAuth "Failed to fetch OAuth2 token" ✅
- Causa arrel: PKCE actiu al proveïdor Google de PocketBase → PocketBase no enviava el client_secret; Google (client Web) el requereix → "client_secret is missing".
- Fix: PKCE desactivat (users.oauth2 provider google pkce=false) + client_secret re-establert.
- Verificat (testing agent iteration_2.json): backend 2/2 + frontend 5/5. El bescanvi de codi ja passa l'autenticació de client (dummy code → "invalid_grant / Malformed auth code", ja NO "client_secret is missing"). Regressió email/contrasenya + iniciació Google + callback OK.
- Pendent NOMÉS: confirmació humana del consentiment Google real (no automatitzable).

## 2026-06 — Validació E2E de la V5 (només comprovació, sense canvis) ✅ 9/9 PASS
- testing agent iteration_3.json: totes les 9 comprovacions verdes (UI + API).
- 1) Login email/contrasenya ✅  2) Registre ✅  3) Iniciació Google OAuth ✅ (consentiment real ja confirmat per l'usuari)  4) Logout ("Tancar sessió" a Config) + re-login ✅  5) Aïllament per usuari (owner rules) ✅  6) Home llegeix PocketBase ✅  7) Train escriu bt_sessions ✅  8) Progress llegeix/escriu bt_weights+bt_goals ✅  9) Settings llegeix/escriu bt_settings ✅
- Observacions NO bloquejants (no corregides, per ordre de l'usuari): Cloudflare 429 en navegacions ràpides seguides (infra, no bug); pàgines de dades no mostren estats de càrrega/error (catch silenciós); manquen alguns data-testid (botons Train, formularis Progress, "Tancar sessió").
- Dades de prova deixades a PocketBase: compte A (qaA_1786680495@bt.local) amb registres de mostra i compte B buit (aïllament). No s'han eliminat per no modificar res.
- ZIP: NO generats (per ordre de l'usuari).

## 2026-06 — Canvis Incendi forestal (4 opcions) + nou Press banca ✅
- btData.js: PLANS.forestal ara 4 targetes (TRAM 1: 8 slam balls+20m; TRAM 2: 16 slam balls+20m; TRAM 3: 10 slam balls+20m; CIRCUIT COMPLET: 3 trams seguits, temps total + tram1/2/3). Nou TYPES.pressbanca + PLANS.pressbanca (pes, reps, series, descans opcional).
- TrainPage.jsx: FIELD_LABELS (pes/reps/series/temps/descans/tram1-3) + data-testids (train-field-<i>-<camp>, train-save-complet/manteniment/minim). Cap altre canvi.
- NO tocats: Home, Progrés, IA, Configuració, auth, disseny general.
- Accés: /entrena/forestal i /entrena/pressbanca per URL (no s'ha afegit enllaç a Home per ordre de l'usuari).
- Verificat testing agent iteration_4.json: forestal 4 opcions, press banca (Pes/Repeticions/Sèries/Descans opcional), desat a bt_sessions (type forestal/pressbanca), regressió estructural OK. Build + ESLint OK.
- Notes no bloquejants: Complet dona +100 també a pressbanca (no especificat); fitxer obsolet src/pages/btData.js sense ús; Cloudflare challenge en navegació automatitzada intensa (infra).

## 2026-06 — Accessos a Home per Incendi forestal i Press banca ✅
- HomePage.jsx: afegides 2 targetes a TODAY_ACTIONS: '🌲 ESPECÍFIC'→/entrena/forestal (Incendi forestal) i '🏋️ PRESS BANCA'→/entrena/pressbanca. L'accés a Incendi estructural ja hi era.
- Fix testid duplicat (detectat per testing agent): afegit camp opcional `id`; la targeta RECOMANACIÓ (que reutilitzava type='forestal') ara té id='recomanacio'; testid = `link-today-action-${id||type}`. Sense canvi visual.
- NO tocats: Google OAuth (l'usuari reporta 403 al preview però ha demanat no tocar-ho), auth, IA, Progrés, disseny/estructura de Home.
- Verificat testing agent iteration_5 (6/6) + iteration_6 (testids únics + navegació). Build + ESLint OK.
