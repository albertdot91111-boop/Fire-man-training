#!/usr/bin/env python3
"""Phase 1: create/update the 4 app collections in PocketBase.
Idempotent: creates if missing, updates fields+rules if present.
Only documented fields are used. `owner` is a relation to the users auth
collection to enforce per-user ownership rules.
"""
import json
import os
import sys
import urllib.request
import urllib.error

PB = os.environ.get("POCKETBASE_URL", "http://127.0.0.1:8090")
EMAIL = os.environ["PB_SUPERUSER_EMAIL"]
PASSWORD = os.environ["PB_SUPERUSER_PASSWORD"]
USERS_ID = "_pb_users_auth_"

OWNER_RULE = '@request.auth.id != "" && owner = @request.auth.id'


def req(method, path, token=None, body=None):
    url = f"{PB}{path}"
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(url, data=data, method=method)
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
        "name": "owner",
        "type": "relation",
        "required": True,
        "collectionId": USERS_ID,
        "cascadeDelete": False,
        "minSelect": 0,
        "maxSelect": 1,
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
        text("incidents"), text("notes"), json_field("data"), owner_field(),
    ],
    "bt_weights": [
        text("date"), number("weight"), number("fat"), owner_field(),
    ],
    "bt_goals": [
        text("title"), number("target"), number("current"), text("unit"), owner_field(),
    ],
    "bt_settings": [
        json_field("material"), text("displayName"), owner_field(),
    ],
}

RULES = {
    "listRule": OWNER_RULE,
    "viewRule": OWNER_RULE,
    "createRule": OWNER_RULE,
    "updateRule": OWNER_RULE,
    "deleteRule": OWNER_RULE,
}


def main():
    status, auth = req(
        "POST",
        "/api/collections/_superusers/auth-with-password",
        body={"identity": EMAIL, "password": PASSWORD},
    )
    if status != 200:
        print("FATAL: superuser auth failed", status, auth)
        sys.exit(1)
    token = auth["token"]

    for name, fields in COLLECTIONS.items():
        payload = {"name": name, "type": "base", "fields": fields, **RULES}
        s, existing = req("GET", f"/api/collections/{name}", token)
        if s == 200:
            up = {"fields": fields, **RULES}
            s2, res = req("PATCH", f"/api/collections/{existing['id']}", token, up)
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

    users_rules = {
        "listRule": "id = @request.auth.id",
        "viewRule": "id = @request.auth.id",
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
