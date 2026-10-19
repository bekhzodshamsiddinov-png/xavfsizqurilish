import 'server-only';
import { sql } from '@/lib/db';
import { alertTypeLabel, severityMeta, type AlertType, type Severity } from '@/lib/labels';

export const MAX_SNAPSHOT_BYTES = 400 * 1024;

/** Faqat haqiqiy JPEG qabul qilinadi (magic bytes), hajm cheklangan. */
export function parseJpegBase64(b64?: string | null): Buffer | null {
  if (!b64) return null;
  const clean = b64.replace(/^data:image\/jpeg;base64,/, '');
  if (clean.length > Math.ceil((MAX_SNAPSHOT_BYTES * 4) / 3) + 8) throw new Error('Rasm juda katta');
  if (!/^[A-Za-z0-9+/=]+$/.test(clean)) throw new Error('Rasm formati noto\'g\'ri');
  const buf = Buffer.from(clean, 'base64');
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8 || buf[2] !== 0xff) throw new Error('Faqat JPEG rasm qabul qilinadi');
  return buf;
}

export interface NewAlert {
  siteId: string;
  cameraId: string | null;
  zoneId?: string | null;
  type: AlertType;
  severity: Severity;
  detail?: string;
  source: 'device' | 'browser' | 'demo';
  eventUid: string;
  snapshot?: Buffer | null;
  detectedAt?: Date;
}

/** Ogohlantirish yaratadi (event_uid takrorlansa — e'tiborsiz qoldiradi: idempotent, replay'dan himoya). */
export async function createAlert(a: NewAlert): Promise<{ id: string; created: boolean }> {
  const rows = await sql<{ id: string }[]>`
    INSERT INTO alerts (site_id, camera_id, zone_id, type, severity, detail, source, event_uid, snapshot, detected_at)
    VALUES (${a.siteId}, ${a.cameraId}, ${a.zoneId ?? null}, ${a.type}, ${a.severity}, ${(a.detail ?? '').slice(0, 500)},
            ${a.source}, ${a.eventUid}, ${a.snapshot ?? null}, ${a.detectedAt ?? new Date()})
    ON CONFLICT (event_uid) DO NOTHING
    RETURNING id`;
  if (!rows[0]) {
    const [ex] = await sql<{ id: string }[]>`SELECT id FROM alerts WHERE event_uid = ${a.eventUid}`;
    return { id: ex.id, created: false };
  }
  if (a.source !== 'demo' && a.severity !== 'orta') {
    await notifyAlert(rows[0].id, 1).catch((e) => console.error('[telegram]', e.message));
  }
  return { id: rows[0].id, created: true };
}

/* ---------------- Telegram ---------------- */

export interface TelegramSettings { enabled: boolean; chatId: string; escalationChatId: string }

export async function getTelegramSettings(): Promise<TelegramSettings> {
  const [r] = await sql<{ value: TelegramSettings }[]>`SELECT value FROM app_settings WHERE key = 'telegram'`;
  return r?.value ?? { enabled: false, chatId: '', escalationChatId: '' };
}

async function tg(method: string, body: FormData | Record<string, unknown>) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return false;
  const isForm = body instanceof FormData;
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: isForm ? undefined : { 'content-type': 'application/json' },
    body: isForm ? body : JSON.stringify(body),
    signal: AbortSignal.timeout(5000),
  });
  return res.ok;
}

const esc = (s: string) => s.replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' })[c]!);

export async function sendTelegramText(chatId: string, html: string) {
  return tg('sendMessage', { chat_id: chatId, text: html, parse_mode: 'HTML', disable_web_page_preview: true });
}

/** level 1 — prorab/nazoratchi guruhi; level 2 — eskalatsiya (xavfsizlik boshlig'i). */
export async function notifyAlert(alertId: string, level: 1 | 2): Promise<'sent' | 'skipped' | 'failed'> {
  const s = await getTelegramSettings();
  if (!s.enabled || !process.env.TELEGRAM_BOT_TOKEN) return 'skipped';
  const groupChat = level === 2 ? s.escalationChatId || s.chatId : s.chatId;
  // Kritik signal shaxsiy chat ID kiritgan prorab/nazoratchi/adminlarga ham boradi
  const personal = await sql<{ telegram_chat_id: string }[]>`
    SELECT DISTINCT u.telegram_chat_id FROM users u, alerts a
    WHERE a.id = ${alertId} AND a.severity = 'kritik' AND u.is_active AND u.telegram_chat_id IS NOT NULL
      AND u.telegram_chat_id <> '' AND u.role IN ('admin','nazoratchi','prorab')`;
  const chats = [...new Set([groupChat, ...personal.map((p) => p.telegram_chat_id)].filter(Boolean))].slice(0, 20);
  if (!chats.length) return 'skipped';
  const [a] = await sql<{ type: AlertType; severity: Severity; detail: string; detected_at: Date; snapshot: Buffer | null; site: string; cam: string | null; floor: string | null }[]>`
    SELECT a.type, a.severity, a.detail, a.detected_at, a.snapshot, s.name AS site, c.name AS cam, c.floor
    FROM alerts a JOIN sites s ON s.id = a.site_id LEFT JOIN cameras c ON c.id = a.camera_id WHERE a.id = ${alertId}`;
  if (!a) return 'skipped';
  const head = level === 2 ? '🚨 <b>ESKALATSIYA — 2 daqiqada javob berilmadi!</b>\n' : '';
  const text = `${head}⚠️ <b>${esc(alertTypeLabel[a.type])}</b> · ${severityMeta[a.severity].label}\n` +
    `📍 ${esc(a.site)}${a.cam ? ` · ${esc(a.cam)}` : ''}${a.floor ? ` · ${esc(a.floor)}` : ''}\n` +
    (a.detail ? `${esc(a.detail)}\n` : '') +
    `🕒 ${new Date(a.detected_at).toLocaleString('uz-UZ', { timeZone: 'Asia/Tashkent' })}`;
  let anyOk = false;
  for (const chat of chats) {
    if (a.snapshot) {
      const fd = new FormData();
      fd.set('chat_id', chat);
      fd.set('caption', text);
      fd.set('parse_mode', 'HTML');
      fd.set('photo', new Blob([new Uint8Array(a.snapshot)], { type: 'image/jpeg' }), 'kadr.jpg');
      anyOk = (await tg('sendPhoto', fd).catch(() => false)) || anyOk;
    } else {
      anyOk = (await sendTelegramText(chat, text).catch(() => false)) || anyOk;
    }
  }
  return anyOk ? 'sent' : 'failed';
}

/**
 * Eskalatsiya: 2 daqiqa ichida hech kim olmagan kritik signallar yuqoriga yuboriladi.
 * Atomik UPDATE ... RETURNING — bir signal ikki marta eskalatsiya qilinmaydi.
 */
export async function runEscalations() {
  const rows = await sql<{ id: string }[]>`
    UPDATE alerts SET escalation_level = 2
    WHERE id IN (
      SELECT id FROM alerts
      WHERE status = 'yangi' AND severity = 'kritik' AND escalation_level < 2 AND source <> 'demo'
        AND created_at < now() - interval '2 minutes' AND created_at > now() - interval '1 day'
      LIMIT 10)
    RETURNING id`;
  for (const r of rows) {
    const res = await notifyAlert(r.id, 2).catch(() => 'failed' as const);
    // Yuborilmagan bo'lsa — keyingi chaqiriqda qayta urinish uchun bayroqni qaytaramiz
    if (res === 'failed') await sql`UPDATE alerts SET escalation_level = 1 WHERE id = ${r.id} AND status = 'yangi'`;
  }
}
