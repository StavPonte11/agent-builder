"""
seed_demo.py — Seeds the Infrastructure Analysis Workflow demo blueprint into the
               platform database so it appears in the Canvas UI for demo and testing.

Usage (from the backend directory):
    python tests/seed_demo.py
    python tests/seed_demo.py --email admin@org.com --password secret

What it does:
  1. Logs in as the specified user (or creates a test account if not found)
  2. Loads tests/demo_blueprint.json
  3. POSTs it to /api/v1/blueprints
  4. Optionally publishes it as v1
  5. Prints the blueprint ID and the direct Canvas URL

After running, open http://localhost:5173/blueprints/<id> to see the Canvas.
"""
from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys
from pathlib import Path

import httpx

BACKEND_URL = os.getenv("BACKEND_BASE_URL", "http://localhost:8000")
API_BASE    = f"{BACKEND_URL}/api/v1"
DEMO_BP_PATH = Path(__file__).parent / "demo_blueprint.json"
FRONTEND_URL = os.getenv("FRONTEND_BASE_URL", "http://localhost:5173")


async def seed(
    email:    str = "admin@example.com",
    password: str = "Password123!",
    publish:  bool = True,
) -> dict:
    async with httpx.AsyncClient(base_url=API_BASE, timeout=30) as client:

        # ── 1. Login ─────────────────────────────────────────────────────────────
        print(f"  → Logging in as {email}...")
        r = await client.post("/auth/login", json={"email": email, "password": password})
        if r.status_code == 401:
            print(f"  ✗ Login failed (401). Check credentials.")
            sys.exit(1)
        r.raise_for_status()
        token = r.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        print("  ✓ Authenticated")

        # ── 2. Load blueprint JSON ────────────────────────────────────────────────
        defn = json.loads(DEMO_BP_PATH.read_text())
        # Strip internal comment keys before POSTing
        clean = {k: v for k, v in defn.items() if not k.startswith("_")}
        # Add a UI-friendly name with timestamp
        from datetime import datetime, timezone
        clean["name"] = f"[Demo] Infrastructure Analysis Workflow"
        clean["description"] = (
            "Demonstrates the orchestrator.py workflow rebuilt as a native platform blueprint. "
            "Classifies reports → resolves entities → dispatches alerts → generates brief."
        )
        print(f"  → Creating blueprint '{clean['name']}'...")

        # ── 3. Check if demo already exists ──────────────────────────────────────
        list_r = await client.get("/blueprints", headers=headers)
        existing = [b for b in list_r.json() if "[Demo] Infrastructure" in b.get("name", "")]
        if existing:
            bp_id = existing[0]["id"]
            print(f"  ℹ Demo blueprint already exists: {bp_id}")
        else:
            create_r = await client.post("/blueprints", headers=headers, json=clean)
            if create_r.status_code not in (200, 201):
                print(f"  ✗ Create failed ({create_r.status_code}): {create_r.text[:300]}")
                sys.exit(1)
            bp_id = create_r.json()["id"]
            print(f"  ✓ Created: {bp_id}")

        # ── 4. Validate ───────────────────────────────────────────────────────────
        print("  → Validating blueprint...")
        val_r = await client.post(f"/blueprints/{bp_id}/validate", headers=headers)
        if val_r.status_code == 200:
            val = val_r.json()
            status_icon = "✓" if val.get("valid") else "⚠"
            print(f"  {status_icon} Validation: {len(val.get('errors', []))} errors, "
                  f"{len(val.get('warnings', []))} warnings")
            for e in val.get("errors", []):
                print(f"       ✗ {e}")
            for w in val.get("warnings", []):
                print(f"       ⚠ {w}")

        # ── 5. Publish (optional) ─────────────────────────────────────────────────
        if publish and not existing:
            print("  → Publishing v1...")
            pub_r = await client.post(f"/blueprints/{bp_id}/publish", headers=headers,
                                      json={"release_notes": "Initial demo release"})
            if pub_r.status_code in (200, 201):
                print(f"  ✓ Published v{pub_r.json().get('version_number', 1)}")
            else:
                print(f"  ⚠ Publish returned {pub_r.status_code} (continuing as draft)")

        return {"blueprint_id": bp_id, "token": token}


async def seed_procurement_fraud(
    email:    str = "admin@example.com",
    password: str = "Password123!",
    publish:  bool = True,
) -> dict:
    """Seed the Procurement Fraud Investigator blueprint (Mission-Critical test case)."""
    from pathlib import Path as _Path
    fraud_bp_path = _Path(__file__).parent / "procurement_fraud_blueprint.json"
    if not fraud_bp_path.exists():
        print(f"  ✗ procurement_fraud_blueprint.json not found at {fraud_bp_path}")
        return {}

    async with httpx.AsyncClient(base_url=API_BASE, timeout=30) as client:
        print(f"  → Logging in as {email}...")
        r = await client.post("/auth/login", json={"email": email, "password": password})
        if r.status_code == 401:
            print("  ✗ Login failed (401).")
            return {}
        r.raise_for_status()
        token = r.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        defn = json.loads(fraud_bp_path.read_text())
        clean = {k: v for k, v in defn.items() if not k.startswith("_")}
        clean["name"] = "[Demo] Procurement Fraud Investigator"

        # Check for existing
        list_r = await client.get("/blueprints", headers=headers)
        existing = [b for b in list_r.json() if "Procurement Fraud" in b.get("name", "")]
        if existing:
            bp_id = existing[0]["id"]
            print(f"  ℹ Procurement Fraud blueprint already exists: {bp_id}")
        else:
            create_r = await client.post("/blueprints", headers=headers, json=clean)
            if create_r.status_code not in (200, 201):
                print(f"  ✗ Create failed ({create_r.status_code}): {create_r.text[:300]}")
                return {}
            bp_id = create_r.json()["id"]
            print(f"  ✓ Created Procurement Fraud blueprint: {bp_id}")

        if publish and not existing:
            pub_r = await client.post(
                f"/blueprints/{bp_id}/publish", headers=headers,
                json={"release_notes": "Mission-Critical test case — Procurement Fraud Investigator"}
            )
            if pub_r.status_code in (200, 201):
                print(f"  ✓ Published v{pub_r.json().get('version_number', 1)}")
            else:
                print(f"  ⚠ Publish returned {pub_r.status_code}")

        return {"blueprint_id": bp_id}


async def main():
    parser = argparse.ArgumentParser(description="Seed demo blueprint into the platform")
    parser.add_argument("--backend",   default=BACKEND_URL, help="Backend API URL")
    parser.add_argument("--email",     default=os.getenv("TEST_USER_EMAIL", "admin@example.com"))
    parser.add_argument("--password",  default=os.getenv("TEST_USER_PASSWORD", "Password123!"))
    parser.add_argument("--no-publish", action="store_true", help="Skip publishing, leave as draft")
    parser.add_argument("--procurement", action="store_true",
                        help="Also seed the Procurement Fraud Investigator blueprint")
    args = parser.parse_args()

    global API_BASE
    API_BASE = f"{args.backend}/api/v1"

    print()
    print("━" * 60)
    print("  Agent Builder — Demo Blueprint Seeder")
    print("━" * 60)

    result = await seed(
        email=args.email,
        password=args.password,
        publish=not args.no_publish,
    )

    bp_id = result["blueprint_id"]
    canvas_url = f"{FRONTEND_URL}/blueprints/{bp_id}"

    print()
    print("━" * 60)
    print("  ✅ Infrastructure Analysis Workflow seeded!")
    print(f"  Blueprint ID : {bp_id}")
    print(f"  Canvas URL   : {canvas_url}")
    print(f"  API URL      : {API_BASE}/blueprints/{bp_id}")

    if args.procurement:
        print()
        print("━" * 60)
        print("  Seeding Procurement Fraud Investigator...")
        print("━" * 60)
        fraud_result = await seed_procurement_fraud(
            email=args.email,
            password=args.password,
            publish=not args.no_publish,
        )
        if fraud_result.get("blueprint_id"):
            fraud_id = fraud_result["blueprint_id"]
            fraud_url = f"{FRONTEND_URL}/blueprints/{fraud_id}"
            print()
            print("  ✅ Procurement Fraud blueprint seeded!")
            print(f"  Blueprint ID : {fraud_id}")
            print(f"  Canvas URL   : {fraud_url}")

    print()
    print("  Run 'npm run test:vibe' for the Golden Run test.")
    print("━" * 60)
    print()


if __name__ == "__main__":
    asyncio.run(main())

