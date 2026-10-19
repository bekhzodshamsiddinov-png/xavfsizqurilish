"""Qurilmasiz sinov: platformaga imzolangan heartbeat va bitta test hodisasini yuboradi.

    python simulate.py --url https://<sayt>.vercel.app --key qqd_... --secret ... --camera KAM-01 [--type zone_intrusion]
"""
import argparse
import uuid
from datetime import datetime, timezone

from qq_client import QQClient

ap = argparse.ArgumentParser()
ap.add_argument("--url", required=True)
ap.add_argument("--key", required=True)
ap.add_argument("--secret", required=True)
ap.add_argument("--camera", required=True)
ap.add_argument("--type", default="no_helmet",
                choices=["no_helmet", "no_vest", "no_harness", "zone_intrusion", "person_down", "after_hours", "other"])
a = ap.parse_args()

c = QQClient(a.url, a.key, a.secret)
hb = c.heartbeat([{"code": a.camera}], {"persons_checked": 120, "ppe_violations": 4})
print("Heartbeat:", "OK" if hb.get("ok") else hb, "| zonalar:", len(hb.get("zones", [])))
ev = c.event(event_id=uuid.uuid4().hex, camera_code=a.camera, type=a.type,
             detected_at=datetime.now(timezone.utc).isoformat(timespec="seconds"),
             detail="Simulyator orqali test hodisasi")
print("Hodisa:", ev)
