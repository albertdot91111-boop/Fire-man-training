# Test Credentials

## PocketBase Superuser (Admin)
- **URL admin (només intern)**: http://127.0.0.1:8090/_/
- **URL API (públic via proxy)**: https://trainer-source-real.preview.emergentagent.com/api/pb/
- **Email**: `admin@bombertrainer.local`
- **Password**: `27_bp6hygL5FH7Cx54BjPK0t`
- **ID**: `srjjbua570w83l0`

## Auth endpoint
```
POST /api/pb/api/collections/_superusers/auth-with-password
Content-Type: application/json
{"identity":"admin@bombertrainer.local","password":"27_bp6hygL5FH7Cx54BjPK0t"}
```

## Notes
- Credencials també a `/app/backend/.env` (`PB_SUPERUSER_EMAIL`, `PB_SUPERUSER_PASSWORD`).
- Dades PocketBase persistides a `/app/pocketbase/pb_data/data.db`.
- PocketBase v0.23.12 (arm64), servei supervisor `pocketbase` a 127.0.0.1:8090.

## Frontend auth (FASE 2 — 2026-06)
- Frontend V3 (Vite) muntat a `/app/frontend`, arrenca amb `yarn start` → `vite` al port 3000.
- Autenticació real via PocketBase (`VITE_POCKETBASE_URL=/api/pb`), SDK `pocketbase`.
- Pàgines: `/login` (disseny BOMBER), `/register`, `/forgot-password`, `/reset-password`.
- Registre obert: qualsevol pot crear compte (email + contrasenya, mínim 8 car., sense OTP).
- No hi ha usuari sembrat; per provar, registra un compte nou des de `/register`.
- Google OAuth: ACTIU. Proveïdor configurat a PocketBase (users.oauth2, provider "google", PKCE **desactivat**). Botó "Continua amb Google" a /login i /register. Flux manual de codi via /oauth/callback (el proxy no fa WebSocket). Client ID: 701574923842-8mlnqvnf2k4ts5p3c8gdk8dpn7uqhj3i.apps.googleusercontent.com (secret només al servidor PocketBase). Redirect URI: https://pocketbase-setup-1.preview.emergentagent.com/oauth/callback
- IMPORTANT (fix bug): PKCE ha d'estar DESACTIVAT per al proveïdor Google. Amb PKCE actiu, PocketBase no envia el client_secret i Google (client "Web application") retorna "client_secret is missing" → "Failed to fetch OAuth2 token".
- Forgot/Reset: connectat als endpoints de PocketBase; els emails NO s'envien fins configurar SMTP.

## Col·leccions (FASE 1 — creades i verificades 2026-06)
- `users` (auth, registre públic), `bt_sessions`, `bt_weights`, `bt_goals`, `bt_settings` (base).
- Regles de propietat: `owner = @request.auth.id` (list/view/create/update/delete) a totes les col·leccions d'app; `id = @request.auth.id` a `users`.
- Verificació: `python3 /app/scripts/verify_phase1.py` → 13/13 PASS.
- No hi ha usuaris d'app persistents (els de test s'eliminen automàticament).
