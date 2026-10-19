"""Qurilish Qalqoni — edge agent (NVIDIA Jetson / har qanday Linux kompyuter).

Vazifasi:
  1. IP-kameralardan (RTSP) kadr oladi.
  2. YOLO modeli bilan odam va himoya vositalarini (kaska, yelek, kamar) aniqlaydi.
  3. Platformada chizilgan xavfli zonalarni (heartbeat javobidan) oladi va odam oyog'i zonaga kirsa:
       - joyida sirena / karnayni yoqadi (internet bo'lmasa ham ishlaydi),
       - platformaga imzolangan signal yuboradi (internet uzilsa — navbatda saqlab, keyin yuboradi).

Ishga tushirish:
    pip install -r requirements.txt
    cp config.example.json config.json   # kalitlarni kiriting
    python agent.py --config config.json

Model: `ppe_model` — kaska/yelek/kamar uchun o'qitilgan YOLO (classes: person, helmet, no_helmet, vest, no_vest, harness).
Agar PPE modeli bo'lmasa, oddiy `yolov8n.pt` bilan faqat odam + xavfli zona nazorati ishlaydi.
"""
from __future__ import annotations

import argparse
import base64
import json
import logging
import os
import sqlite3
import subprocess
import threading
import time
import uuid
from dataclasses import dataclass, field

from qq_client import PlatformError, QQClient

log = logging.getLogger("qq-edge")

# ----------------------------------------------------------------------------- geometriya

def point_in_polygon(x: float, y: float, poly: list[list[float]]) -> bool:
    inside = False
    j = len(poly) - 1
    for i in range(len(poly)):
        xi, yi = poly[i]
        xj, yj = poly[j]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / ((yj - yi) or 1e-9) + xi:
            inside = not inside
        j = i
    return inside


def zone_active_now(zone: dict) -> bool:
    now = time.strftime("%H:%M")
    a, b = zone.get("active_from", "00:00")[:5], zone.get("active_to", "23:59")[:5]
    return a <= now <= b if a <= b else (now >= a or now <= b)

# ----------------------------------------------------------------------------- oflayn navbat

class OfflineQueue:
    """Internet uzilganda signallar yo'qolmasligi uchun SQLite navbat."""

    def __init__(self, path: str):
        self.db = sqlite3.connect(path, check_same_thread=False)
        self.db.execute("CREATE TABLE IF NOT EXISTS q (id TEXT PRIMARY KEY, payload TEXT, created REAL)")
        self.lock = threading.Lock()

    def put(self, payload: dict):
        with self.lock:
            self.db.execute("INSERT OR IGNORE INTO q VALUES (?,?,?)", (payload["event_id"], json.dumps(payload), time.time()))
            self.db.commit()

    def drain(self, client: QQClient, limit: int = 20):
        with self.lock:
            rows = self.db.execute("SELECT id, payload, created FROM q ORDER BY created LIMIT ?", (limit,)).fetchall()
        for eid, payload, created in rows:
            if time.time() - created > 23 * 3600:  # server 24 soatdan eski hodisani qabul qilmaydi
                self._delete(eid)
                continue
            try:
                client.event(**json.loads(payload))
                self._delete(eid)
            except PlatformError as e:
                if 400 <= e.status < 500 and e.status != 429:
                    log.error("Hodisa rad etildi (%s), navbatdan o'chirildi", e)
                    self._delete(eid)
                else:
                    break
            except OSError:
                break  # hali internet yo'q

    def _delete(self, eid: str):
        with self.lock:
            self.db.execute("DELETE FROM q WHERE id = ?", (eid,))
            self.db.commit()

# ----------------------------------------------------------------------------- mahalliy signal

class LocalAlarm:
    """Joyidagi sirena/karnay. Buyruqlar konfiguratsiyada (masalan GPIO skript yoki IP-karnay API)."""

    def __init__(self, cfg: dict):
        self.siren_cmd = cfg.get("siren_command")      # masalan: ["/opt/qq/siren.sh", "{camera}"]
        self.voice_cmd = cfg.get("voice_command")      # masalan: ["aplay", "/opt/qq/diqqat_xavfli_zona.wav"]
        self.cooldown = cfg.get("cooldown_sec", 15)
        self._last: dict[str, float] = {}

    def trigger(self, key: str, camera: str, siren: bool, voice: bool):
        now = time.time()
        if now - self._last.get(key, 0) < self.cooldown:
            return
        self._last[key] = now
        for enabled, cmd in ((siren, self.siren_cmd), (voice, self.voice_cmd)):
            if enabled and cmd:
                try:
                    subprocess.Popen([c.replace("{camera}", camera) for c in cmd])  # shell=False — inyeksiyadan himoya
                except OSError as e:
                    log.error("Mahalliy signal xatosi: %s", e)

# ----------------------------------------------------------------------------- kamera ishchisi

@dataclass
class CameraState:
    code: str
    url: str
    frame: object = None
    persons: int = 0
    violations: int = 0
    last_event: dict = field(default_factory=dict)


class Agent:
    def __init__(self, cfg: dict):
        self.cfg = cfg
        self.client = QQClient(cfg["platform_url"], cfg["key_id"], os.environ.get("QQ_SECRET") or cfg["secret"])
        self.queue = OfflineQueue(cfg.get("queue_path", "qq_queue.db"))
        self.alarm = LocalAlarm(cfg.get("local_alarm", {}))
        self.cams = {c["code"]: CameraState(c["code"], c["rtsp_url"]) for c in cfg["cameras"]}
        self.zones: list[dict] = []
        self.lock = threading.Lock()
        self.event_cooldown = cfg.get("event_cooldown_sec", 30)
        self.min_conf = cfg.get("min_confidence", 0.5)

        from ultralytics import YOLO  # og'ir import — faqat ishga tushganda
        self.model = YOLO(cfg.get("ppe_model") or "yolov8n.pt")
        self.names = self.model.names

    # --- yordamchilar
    def _jpeg_b64(self, frame) -> str:
        import cv2
        h, w = frame.shape[:2]
        scale = min(1.0, 640 / w)
        small = cv2.resize(frame, (int(w * scale), int(h * scale))) if scale < 1 else frame
        ok, buf = cv2.imencode(".jpg", small, [cv2.IMWRITE_JPEG_QUALITY, 70])
        return base64.b64encode(buf.tobytes()).decode() if ok else ""

    def _emit(self, cam: CameraState, etype: str, frame, zone_id: str | None = None, detail: str = ""):
        key = f"{cam.code}:{etype}:{zone_id}"
        now = time.time()
        if now - cam.last_event.get(key, 0) < self.event_cooldown:
            return
        cam.last_event[key] = now
        payload = {
            "event_id": uuid.uuid4().hex,
            "camera_code": cam.code,
            "type": etype,
            "zone_id": zone_id,
            "detail": detail[:300],
            "detected_at": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
            "snapshot_jpeg_b64": self._jpeg_b64(frame),
        }
        payload["detected_at"] = payload["detected_at"][:-2] + ":" + payload["detected_at"][-2:]
        self.queue.put(payload)
        log.warning("HODISA %s %s %s", cam.code, etype, detail)

    # --- tahlil
    def analyze(self, cam: CameraState, frame):
        h, w = frame.shape[:2]
        res = self.model(frame, verbose=False, conf=self.min_conf)[0]
        persons, gear = [], []
        for box, cls in zip(res.boxes.xyxy.tolist(), res.boxes.cls.tolist()):
            name = self.names[int(cls)]
            (persons if name == "person" else gear).append((name, box))
        cam.persons += len(persons)

        with self.lock:
            zones = [z for z in self.zones if z["camera_code"] == cam.code and zone_active_now(z)]

        for _, (x1, y1, x2, y2) in persons:
            foot = ((x1 + x2) / 2 / w * 100, y2 / h * 100)
            for z in zones:
                if point_in_polygon(foot[0], foot[1], z["points"]):
                    self.alarm.trigger(z["id"], cam.code, z.get("signal_siren", True), z.get("signal_voice", True))
                    self._emit(cam, "zone_intrusion", frame, z["id"], f"{z['name']} zonasiga kirish")
            # PPE: shaxs ramkasi ichidagi "no_*" sinflari
            inside = [n for n, (gx1, gy1, gx2, gy2) in gear if gx1 >= x1 - 10 and gx2 <= x2 + 10 and gy1 >= y1 - 10 and gy2 <= y2 + 10]
            for bad, etype in (("no_helmet", "no_helmet"), ("no_vest", "no_vest"), ("no_harness", "no_harness")):
                if bad in inside:
                    cam.violations += 1
                    self._emit(cam, etype, frame, detail="Himoya vositasi aniqlanmadi")
            if (x2 - x1) > (y2 - y1) * 1.4:
                self._emit(cam, "person_down", frame, detail="Yotgan holatdagi odam")

    def camera_loop(self, cam: CameraState):
        import cv2
        fps = self.cfg.get("analyze_fps", 3)
        while True:
            cap = cv2.VideoCapture(cam.url)
            if not cap.isOpened():
                log.error("%s: kameraga ulanib bo'lmadi, 10 s dan keyin qayta urinish", cam.code)
                time.sleep(10)
                continue
            last = 0.0
            while True:
                ok, frame = cap.read()
                if not ok:
                    log.error("%s: oqim uzildi", cam.code)
                    break
                if time.time() - last < 1 / fps:
                    continue
                last = time.time()
                cam.frame = frame
                try:
                    self.analyze(cam, frame)
                except Exception as e:  # noqa: BLE001
                    log.exception("%s: tahlil xatosi: %s", cam.code, e)
            cap.release()
            time.sleep(3)

    def sync_loop(self):
        every = self.cfg.get("heartbeat_sec", 30)
        while True:
            cams = []
            persons = violations = 0
            for c in self.cams.values():
                item = {"code": c.code}
                if c.frame is not None:
                    item["snapshot_jpeg_b64"] = self._jpeg_b64(c.frame)
                cams.append(item)
                persons, violations = persons + c.persons, violations + c.violations
            # umumiy hajm cheklovi (server 560 KB gacha qabul qiladi)
            while sum(len(c.get("snapshot_jpeg_b64", "")) for c in cams) > 500_000:
                for c in cams:
                    if "snapshot_jpeg_b64" in c:
                        del c["snapshot_jpeg_b64"]
                        break
            try:
                resp = self.client.heartbeat(cams, {"persons_checked": persons, "ppe_violations": min(violations, persons)})
                for c in self.cams.values():
                    c.persons = c.violations = 0
                with self.lock:
                    self.zones = resp.get("zones", [])
                self.queue.drain(self.client)
            except (PlatformError, OSError) as e:
                log.warning("Platforma bilan aloqa yo'q: %s (signallar navbatda saqlanadi)", e)
            time.sleep(every)

    def run(self):
        threading.Thread(target=self.sync_loop, daemon=True).start()
        for cam in self.cams.values():
            threading.Thread(target=self.camera_loop, args=(cam,), daemon=True).start()
        while True:
            time.sleep(3600)


def main():
    ap = argparse.ArgumentParser(description="Qurilish Qalqoni edge agenti")
    ap.add_argument("--config", default="config.json")
    args = ap.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    with open(args.config, encoding="utf-8") as f:
        cfg = json.load(f)
    Agent(cfg).run()


if __name__ == "__main__":
    main()
