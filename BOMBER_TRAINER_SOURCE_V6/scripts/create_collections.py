#!/usr/bin/env python3
"""Create/update the Bomber Trainer PocketBase collections.
Idempotent: creates if missing, updates fields+rules if present.
Also migrates legacy ownerless records created before owner scoping to the
configured Bomber Trainer admin account, so historical progress is preserved.
"""
import json
import os
import sys
import urllib.request
import urllib.error

PB = os.environ.get("POCKETBASE_URL", "http://127.0.0.1:8090").strip().rstrip("/")
for suffix in ("/_", "/api"):
    if PB.endswith(suffix):
        PB = PB[: -len(suffix)].rstrip("/")
        break
EMAIL = os.environ["PB_SUPERUSER_EMAIL"]
PASSWORD = os.environ["PB_SUPERUSER_PASSWORD"]
USERS_ID = "_pb_users_auth_"
ADMIN_EMAIL = os.environ.get("PB_ADMIN_EMAIL", "albertdot91@gmail.com")

OWNER_RULE = '@request.auth.id != "" && owner = @request.auth.id'
ADMIN_RULE = f'@request.auth.email = "{ADMIN_EMAIL}"'
OWNER_OR_ADMIN_RULE = f'({OWNER_RULE}) || ({ADMIN_RULE})'
ACCESS_OWNER_RULE = '@request.auth.id != "" && @request.data.relation = @request.auth.id'


def req(method, path, token=None, body=None):
    url = f"{PB}{path}"
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(url, data=data, method=method)
    r.add_header("User-Agent", "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36")
    r.add_header("Accept", "application/json")
    r.add_header("Content-Type", "application/json")
    if token:
        r.add_header("Authorization", token)
    try:
        with urllib.request.urlopen(r) as resp:
            raw = resp.read().decode()
            return resp.status, json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try:
            return e.code, json.loads(raw)
        except Exception:
            return e.code, {"raw": raw}


def owner_field():
    return {
        "name": "owner", "type": "relation", "required": True,
        "collectionId": USERS_ID, "cascadeDelete": False,
        "minSelect": 0, "maxSelect": 1,
    }


def relation_field():
    return {
        "name": "relation", "type": "relation", "required": True,
        "collectionId": USERS_ID, "cascadeDelete": False,
        "minSelect": 0, "maxSelect": 1,
    }


def text(name):
    return {"name": name, "type": "text"}


def number(name):
    return {"name": name, "type": "number"}


def json_field(name):
    return {"name": name, "type": "json", "maxSize": 2000000}


COLLECTIONS = {
    "bt_sessions": [
        text("type"), text("date"), number("duration"), number("points"),
        text("incidents"), text("notes"), json_field("data"), json_field("wearable"), owner_field(),
    ],
    "bt_weights": [text("date"), number("weight"), number("fat"), owner_field()],
    "bt_goals": [text("title"), number("target"), number("current"), text("unit"), owner_field()],
    "bt_settings": [json_field("material"), text("displayName"), owner_field()],
    "bt_access_logs": [relation_field(), text("email"), text("date"), text("action")],
}

PROFILE_RULES = {
    "listRule": OWNER_OR_ADMIN_RULE,
    "viewRule": OWNER_OR_ADMIN_RULE,
    "createRule": OWNER_OR_ADMIN_RULE,
    "updateRule": OWNER_OR_ADMIN_RULE,
    "deleteRule": OWNER_OR_ADMIN_RULE,
}

ACCESS_RULES = {
    "listRule": ADMIN_RULE,
    "viewRule": ADMIN_RULE,
    "createRule": ACCESS_OWNER_RULE,
    "updateRule": ADMIN_RULE,
    "deleteRule": ADMIN_RULE,
}

SESSION_ADMIN_RULES = {
    "listRule": OWNER_OR_ADMIN_RULE,
    "viewRule": OWNER_OR_ADMIN_RULE,
    "createRule": OWNER_RULE,
    "updateRule": OWNER_OR_ADMIN_RULE,
    "deleteRule": OWNER_OR_ADMIN_RULE,
}


def migrate_legacy_ownerless_records(token):
    """Assign pre-owner records to the configured Bomber Trainer admin."""
    user_filter = f'email="{ADMIN_EMAIL}"'
    status, users = req("GET", f"/api/collections/{USERS_ID}/records?perPage=10&filter={user_filter}", token)
    if status != 200 or not users.get("items"):
        print(f"LEGACY MIGRATION: admin user {ADMIN_EMAIL!r} not found; skipped")
        return
    admin_id = users["items"][0]["id"]

    for name in ("bt_sessions", "bt_weights", "bt_goals", "bt_settings"):
        page = 1
        migrated = 0
        while True:
            status, data = req("GET", f"/api/collections/{name}/records?page={page}&perPage=500&filter=owner = \"\"", token)
            if status != 200:
                print(f"LEGACY MIGRATION: could not read {name}: {status}")
                break
            items = data.get("items", [])
            for record in items:
                update_status, _ = req("PATCH", f"/api/collections/{name}/records/{record['id']}", token, {"owner": admin_id})
                if update_status < 300:
                    migrated += 1
                else:
                    print(f"LEGACY MIGRATION: could not assign {name}/{record['id']}: {update_status}")
            if page >= int(data.get("totalPages", page)):
                break
            page += 1
        if migrated:
            print(f"LEGACY MIGRATION: {name}: assigned {migrated} ownerless record(s) to {ADMIN_EMAIL}")


def main():
    health_status, health = req("GET", "/api/health")
    if health_status != 200:
        print("FATAL: PocketBase API health check failed", health_status, health)
        print("Normalized POCKETBASE_URL:", PB)
        sys.exit(1)

    status, auth = req("POST", "/api/collections/_superusers/auth-with-password", body={"identity": EMAIL, "password": PASSWORD})
    if status != 200:
        print("FATAL: superuser auth failed", status, auth)
        print("Normalized POCKETBASE_URL:", PB)
        sys.exit(1)
    token = auth["token"]

    for name, fields in COLLECTIONS.items():
        if name == "bt_access_logs":
            rules = ACCESS_RULES
        elif name == "bt_sessions":
            rules = SESSION_ADMIN_RULES
        else:
            rules = PROFILE_RULES
        payload = {"name": name, "type": "base", "fields": fields, **rules}
        s, existing = req("GET", f"/api/collections/{name}", token)
        if s == 200:
            s2, res = req("PATCH", f"/api/collections/{existing['id']}", token, {"fields": fields, **rules})
            print(f"UPDATE {name}: {s2}")
            if s2 >= 400:
                print(json.dumps(res, indent=2))
                sys.exit(1)
        else:
            s2, res = req("POST", "/api/collections", token, payload)
            print(f"CREATE {name}: {s2}")
            if s2 >= 400:
                print(json.dumps(res, indent=2))
                sys.exit(1)

    # Repair historical data after the owner field/rules exist. Superuser
    # access bypasses the owner API rules during this one-time migration.
    migrate_legacy_ownerless_records(token)

    users_rules = {
        "listRule": f'id = @request.auth.id || @request.auth.email = "{ADMIN_EMAIL}"',
        "viewRule": f'id = @request.auth.id || @request.auth.email = "{ADMIN_EMAIL}"',
        "updateRule": "id = @request.auth.id",
        "deleteRule": "id = @request.auth.id",
        "createRule": "",
    }
    s3, res = req("PATCH", f"/api/collections/{USERS_ID}", token, users_rules)
    print(f"UPDATE users rules: {s3}")
    if s3 >= 400:
        print(json.dumps(res, indent=2))
        sys.exit(1)

    print("\n=== FINAL COLLECTIONS ===")
    s, d = req("GET", "/api/collections?perPage=100", token)
    for c in d["items"]:
        print(f"- {c['name']} ({c['type']}) list={c.get('listRule')!r}")


if __name__ == "__main__":
    main()

# CI trigger marker: keep this schema sync workflow runnable on script changes.
