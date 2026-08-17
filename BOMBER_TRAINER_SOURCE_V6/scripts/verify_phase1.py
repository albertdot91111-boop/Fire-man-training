#!/usr/bin/env python3
"""Phase 1 verification: exercise PocketBase through the FastAPI proxy.
Proves: register user, authenticate, create/read/update own data, and that
ownership rules block cross-user access. Cleans up test users afterwards.
"""
import json
import os
import sys
import time
import urllib.request
import urllib.error

BASE = os.environ.get("VERIFY_BASE", "http://127.0.0.1:8001/api/pb")
PB = os.environ.get("POCKETBASE_URL", "http://127.0.0.1:8090")
EMAIL = os.environ["PB_SUPERUSER_EMAIL"]
PASSWORD = os.environ["PB_SUPERUSER_PASSWORD"]

ok = True


def req(method, path, token=None, body=None, base=None):
    url = f"{base or BASE}{path}"
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


def check(label, cond, detail=""):
    global ok
    mark = "PASS" if cond else "FAIL"
    if not cond:
        ok = False
    print(f"[{mark}] {label} {detail}")


def make_user(n):
    ts = int(time.time() * 1000)
    email = f"phase1_test_{n}_{ts}@bt.local"
    pw = "Test123456!"
    s, r = req("POST", "/api/collections/users/records",
               body={"email": email, "password": pw, "passwordConfirm": pw})
    return email, pw, s, r


def main():
    # 1. CREATE (register) user A + user B
    ea, pa, sa, ra = make_user("A")
    check("create user A", sa == 200, f"http={sa}")
    eb, pb_, sb, rb = make_user("B")
    check("create user B", sb == 200, f"http={sb}")
    if not ok:
        print(json.dumps(ra, indent=2)); sys.exit(1)

    # 2. AUTHENTICATE user A + B
    s, auth_a = req("POST", "/api/collections/users/auth-with-password",
                    body={"identity": ea, "password": pa})
    check("authenticate user A", s == 200 and auth_a.get("token"), f"http={s}")
    tok_a = auth_a["token"]; id_a = auth_a["record"]["id"]
    s, auth_b = req("POST", "/api/collections/users/auth-with-password",
                    body={"identity": eb, "password": pb_})
    tok_b = auth_b["token"]; id_b = auth_b["record"]["id"]

    # 3. CREATE own data (one record per collection) as user A
    s, sess = req("POST", "/api/collections/bt_sessions/records", tok_a,
                  {"type": "pit", "date": "2026-06-01", "duration": 30,
                   "points": 100, "incidents": "cap", "notes": "test",
                   "data": [{"ex": "flexions"}], "owner": id_a})
    check("create bt_sessions (own)", s == 200, f"http={s}")
    sess_id = sess.get("id")
    for coll, payload in [
        ("bt_weights", {"date": "2026-06-01", "weight": 80, "fat": 15, "owner": id_a}),
        ("bt_goals", {"title": "Press 65kg", "target": 20, "current": 5, "unit": "reps", "owner": id_a}),
        ("bt_settings", {"material": ["barra", "manuelles"], "displayName": "Bomber A", "owner": id_a}),
    ]:
        s, _ = req("POST", f"/api/collections/{coll}/records", tok_a, payload)
        check(f"create {coll} (own)", s == 200, f"http={s}")

    # 4. READ own data as user A
    s, lst = req("GET", "/api/collections/bt_sessions/records", tok_a)
    check("read own bt_sessions", s == 200 and lst.get("totalItems", 0) >= 1,
          f"http={s} items={lst.get('totalItems')}")

    # 5. MODIFY own data as user A
    s, upd = req("PATCH", f"/api/collections/bt_sessions/records/{sess_id}", tok_a,
                 {"notes": "updated", "points": 120})
    check("update own bt_sessions", s == 200 and upd.get("notes") == "updated",
          f"http={s} notes={upd.get('notes')}")

    # 6. OWNERSHIP ISOLATION: user B must NOT read/update user A's record
    s, _ = req("GET", f"/api/collections/bt_sessions/records/{sess_id}", tok_b)
    check("user B cannot VIEW user A record", s in (403, 404), f"http={s}")
    s, lstb = req("GET", "/api/collections/bt_sessions/records", tok_b)
    check("user B list excludes user A data", s == 200 and lstb.get("totalItems", 0) == 0,
          f"http={s} items={lstb.get('totalItems')}")
    s, _ = req("PATCH", f"/api/collections/bt_sessions/records/{sess_id}", tok_b,
               {"notes": "hacked"})
    check("user B cannot UPDATE user A record", s in (403, 404), f"http={s}")

    # 7. UNAUTHENTICATED must be blocked
    s, _ = req("GET", "/api/collections/bt_sessions/records")
    check("anonymous cannot list bt_sessions", s in (400, 403, 404) or
          (s == 200 and _.get("totalItems", 1) == 0), f"http={s}")

    # cleanup test users (superuser)
    s, su = req("POST", "/api/collections/_superusers/auth-with-password",
                base=PB, body={"identity": EMAIL, "password": PASSWORD})
    st = su.get("token")
    for uid in (id_a, id_b):
        req("DELETE", f"/api/collections/users/records/{uid}", st, base=PB)
    print("\ncleanup: removed test users A & B")

    print("\nRESULT:", "ALL PHASE 1 CHECKS PASSED" if ok else "SOME CHECKS FAILED")
    sys.exit(0 if ok else 2)


if __name__ == "__main__":
    main()
