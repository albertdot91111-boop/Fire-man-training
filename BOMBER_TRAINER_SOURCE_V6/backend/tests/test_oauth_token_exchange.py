"""Verify PocketBase Google OAuth token-exchange sends client_secret (PKCE disabled)."""
import time
import requests

BASE = "https://pocketbase-setup-1.preview.emergentagent.com"
PB = f"{BASE}/api/pb"
ADMIN_EMAIL = "admin@bombertrainer.local"
ADMIN_PASSWORD = "27_bp6hygL5FH7Cx54BjPK0t"
REDIRECT = f"{BASE}/oauth/callback"


def test_auth_methods_google_pkce_disabled():
    r = requests.get(f"{PB}/api/collections/users/auth-methods", timeout=30)
    assert r.status_code == 200, r.text
    data = r.json()
    providers = data.get("oauth2", {}).get("providers", []) or data.get("authProviders", [])
    google = next((p for p in providers if p.get("name") == "google"), None)
    assert google is not None, f"google provider missing: {data}"
    print("Google authURL:", google.get("authURL", "")[:120])
    # When PKCE is disabled PocketBase does not include code_challenge in authURL
    assert "code_challenge" not in google.get("authURL", ""), \
        "code_challenge still present -> PKCE still enabled"


def test_token_exchange_dummy_code_rejects_at_google_not_client_secret():
    # Trigger token exchange with a bogus code -> forces PB to hit Google's token endpoint
    payload = {
        "provider": "google",
        "code": "DUMMY_INVALID_CODE",
        "codeVerifier": "",
        "redirectUrl": REDIRECT,
    }
    r = requests.post(
        f"{PB}/api/collections/users/auth-with-oauth2",
        json=payload,
        timeout=30,
    )
    print("token-exchange status:", r.status_code, "body:", r.text[:400])
    assert r.status_code >= 400  # dummy code must fail
    # Wait for async log flush
    time.sleep(6)

    # Superuser auth
    auth = requests.post(
        f"{PB}/api/collections/_superusers/auth-with-password",
        json={"identity": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
        timeout=30,
    )
    assert auth.status_code == 200, auth.text
    token = auth.json()["token"]

    logs = requests.get(
        f"{PB}/api/logs",
        params={"perPage": 10, "sort": "-created",
                "filter": "data.url~'auth-with-oauth2'"},
        headers={"Authorization": token},
        timeout=30,
    )
    assert logs.status_code == 200, logs.text
    items = logs.json().get("items", [])
    assert items, "no auth-with-oauth2 logs found"
    newest = items[0]
    details = (newest.get("data") or {}).get("details", "")
    print("newest log details:", details)
    assert "client_secret is missing" not in details, \
        f"REGRESSION: PocketBase still omitting client_secret -> {details}"
    assert "Malformed auth code" in details or "invalid_grant" in details, \
        f"unexpected error, expected invalid_grant/Malformed auth code, got: {details}"
