#!/usr/bin/env python3
"""Verify the PocketBase rules required by the Bomber Trainer admin dashboard.

Usage:
  POCKETBASE_URL=... PB_SUPERUSER_EMAIL=... PB_SUPERUSER_PASSWORD=... \
    python scripts/verify_admin_pocketbase.py

This only reads configuration; it does not modify PocketBase.
"""
import json
import os
import sys
import urllib.request
import urllib.error

PB = os.environ.get("POCKETBASE_URL", "http://127.0.0.1:8090").rstrip("/")
EMAIL = os.environ.get("PB_SUPERUSER_EMAIL")
PASSWORD = os.environ.get("PB_SUPERUSER_PASSWORD")
ADMIN_EMAIL = os.environ.get("PB_ADMIN_EMAIL", "albertdot91@gmail.com").strip().lower()

if not EMAIL or not PASSWORD:
    print("FATAL: set PB_SUPERUSER_EMAIL and PB_SUPERUSER_PASSWORD")
    sys.exit(2)


def req(method, path, token=None, body=None):
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(f"{PB}{path}", data=data, method=method)
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


status, auth = req(
    "POST",
    "/api/collections/_superusers/auth-with-password",
    body={"identity": EMAIL, "password": PASSWORD},
)
if status != 200:
    print(f"FATAL: superuser authentication failed ({status})")
    print(json.dumps(auth, indent=2))
    sys.exit(1)

token = auth["token"]

for name in ("users", "bt_sessions", "bt_access_logs"):
    status, collection = req("GET", f"/api/collections/{name}", token)
    if status != 200:
        print(f"FAIL {name}: collection lookup returned {status}")
        continue
    print(f"\n{name}")
    for rule in ("listRule", "viewRule", "createRule", "updateRule", "deleteRule"):
        print(f"  {rule}: {collection.get(rule)!r}")

print(f"\nExpected admin email: {ADMIN_EMAIL}")
print("Verification complete. No PocketBase data or rules were changed.")
