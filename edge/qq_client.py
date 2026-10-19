"""Qurilish Qalqoni — platforma bilan xavfsiz aloqa (HMAC-SHA256 imzo).

Har bir so'rov sarlavhalari:
    X-QQ-Key:       qurilma kaliti identifikatori (qqd_...)
    X-QQ-Timestamp: unix soniya
    X-QQ-Signature: hex(HMAC-SHA256(secret, f"{timestamp}.{body}"))

Faqat standart kutubxona ishlatiladi (requests shart emas).
"""
from __future__ import annotations

import hashlib
import hmac
import json
import ssl
import time
import urllib.error
import urllib.request
from urllib.parse import urlparse


class PlatformError(Exception):
    def __init__(self, status: int, message: str):
        super().__init__(f"{status}: {message}")
        self.status = status


class QQClient:
    def __init__(self, base_url: str, key_id: str, secret: str, timeout: float = 10.0):
        u = urlparse(base_url)
        if u.scheme != "https" and not (u.scheme == "http" and u.hostname in {"localhost", "127.0.0.1"}):
            raise ValueError("Platforma manzili faqat HTTPS bo'lishi kerak")
        self.base_url = base_url.rstrip("/")
        self.key_id = key_id
        self._secret = secret.encode()
        self.timeout = timeout
        self._ctx = ssl.create_default_context()  # sertifikat doim tekshiriladi

    def _post(self, path: str, payload: dict) -> dict:
        body = json.dumps(payload, separators=(",", ":"), ensure_ascii=False)
        ts = str(int(time.time()))
        sig = hmac.new(self._secret, f"{ts}.{body}".encode(), hashlib.sha256).hexdigest()
        req = urllib.request.Request(
            self.base_url + path,
            data=body.encode(),
            method="POST",
            headers={
                "Content-Type": "application/json",
                "X-QQ-Key": self.key_id,
                "X-QQ-Timestamp": ts,
                "X-QQ-Signature": sig,
                "User-Agent": "qq-edge/1.0",
            },
        )
        try:
            with urllib.request.urlopen(req, timeout=self.timeout, context=self._ctx) as r:
                return json.loads(r.read() or b"{}")
        except urllib.error.HTTPError as e:
            try:
                msg = json.loads(e.read()).get("error", e.reason)
            except Exception:  # noqa: BLE001
                msg = e.reason
            raise PlatformError(e.code, str(msg)) from None

    def heartbeat(self, cameras: list[dict], stats: dict | None = None) -> dict:
        payload: dict = {"cameras": cameras}
        if stats:
            payload["stats"] = stats
        return self._post("/api/v1/heartbeat", payload)

    def event(self, **event) -> dict:
        return self._post("/api/v1/events", {k: v for k, v in event.items() if v is not None})
