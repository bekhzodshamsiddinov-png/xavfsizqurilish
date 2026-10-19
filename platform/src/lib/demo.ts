import 'server-only';
import { randomUUID } from 'node:crypto';
import { sql } from '@/lib/db';
import { defaultSeverity, type AlertStatus, type AlertType, type Severity, type ZoneType } from '@/lib/labels';

export const DEMO_SITE_NAME = 'Yunusobod Residence — 3-blok (DEMO)';

const CAMERAS: { code: string; name: string; floor: string; online: boolean }[] = [
  { code: 'KAM-01', name: 'Kirish darvozasi va elektr shiti', floor: '1-qavat', online: true },
  { code: 'KAM-02', name: 'Lift shaxtasi oldi', floor: '4-qavat', online: true },
  { code: 'KAM-03', name: 'Sharqiy fasad, ochiq qirra', floor: '7-qavat', online: true },
  { code: 'KAM-04', name: 'Minorali kran maydoni', floor: 'Hovli', online: true },
  { code: 'KAM-05', name: 'Zina shaxtasi', floor: '11-qavat', online: true },
  { code: 'KAM-06', name: 'Tom va texnik qavat', floor: '16-qavat', online: false },
];

const ZONES: { cam: string; name: string; type: ZoneType; points: [number, number][]; warn: number }[] = [
  { cam: 'KAM-01', name: 'Yuqori kuchlanish shiti', type: 'tok', points: [[68, 30], [88, 30], [88, 72], [68, 72]], warn: 1.5 },
  { cam: 'KAM-02', name: '4-qavat lift shaxtasi', type: 'lift', points: [[38, 22], [62, 22], [62, 88], [38, 88]], warn: 2.0 },
  { cam: 'KAM-03', name: "Fasad — to'siqsiz qirra", type: 'deraza', points: [[5, 55], [95, 50], [95, 70], [5, 76]], warn: 2.5 },
  { cam: 'KAM-04', name: 'Kran yuk ko\'tarish radiusi', type: 'kran', points: [[30, 18], [72, 14], [86, 52], [60, 86], [22, 70]], warn: 3.0 },
  { cam: 'KAM-05', name: "11-qavat zina (to'siq o'rnatilmagan)", type: 'zina', points: [[12, 40], [44, 36], [48, 92], [10, 94]], warn: 1.5 },
];

const WORKERS: { name: string; trade: string; brigade: string; trainingDays: number }[] = [
  { name: 'Alisher Karimov', trade: 'Brigadir', brigade: '1-brigada', trainingDays: 210 },
  { name: 'Jasur Tursunov', trade: 'Betonchi', brigade: '1-brigada', trainingDays: 95 },
  { name: 'Sardor Rahimov', trade: 'Armaturachi', brigade: '1-brigada', trainingDays: -12 },
  { name: 'Bobur Yusupov', trade: 'Payvandchi', brigade: '2-brigada', trainingDays: 40 },
  { name: 'Otabek Xolmatov', trade: 'Elektrik', brigade: '2-brigada', trainingDays: 160 },
  { name: 'Dilshod Qodirov', trade: 'Kranchi', brigade: '2-brigada', trainingDays: 8 },
  { name: "Sherzod G'aniyev", trade: "G'isht teruvchi", brigade: '3-brigada', trainingDays: -45 },
  { name: 'Ulug\'bek Mirzayev', trade: 'Montajchi (balandlik)', brigade: '3-brigada', trainingDays: 120 },
  { name: 'Rustam Ergashev', trade: 'Slesar-santexnik', brigade: '3-brigada', trainingDays: -3 },
  { name: 'Farrux Abdullayev', trade: 'Suvoqchi', brigade: '3-brigada', trainingDays: 300 },
];

const ALERT_PLAN: AlertType[] = [
  ...Array<AlertType>(7).fill('no_helmet'),
  ...Array<AlertType>(5).fill('no_vest'),
  ...Array<AlertType>(6).fill('zone_intrusion'),
  ...Array<AlertType>(3).fill('no_harness'),
  'person_down', 'after_hours', 'after_hours', 'other',
];

const DETAILS: Record<AlertType, string[]> = {
  no_helmet: ['1 nafar xodim kaskasiz', '2 nafar xodim kaskasiz ishlamoqda', 'Kaska qo\'lda, boshda emas'],
  no_vest: ['Signal yeleksiz xodim', 'Yelek kiyilmagan — 1 nafar'],
  no_harness: ['Balandlikda strahovka kamarisiz ishlash', 'Kamar mahkamlanmagan'],
  zone_intrusion: ['Xodim xavfli zonaga kirdi', 'Xavfli zonaga 1 m gacha yaqinlashish'],
  person_down: ['Odam 20 soniyadan beri harakatsiz'],
  after_hours: ['Ish vaqtidan tashqari harakat aniqlandi'],
  other: ['Ochiq qolgan material, yiqilish xavfi'],
};

const pick = <T,>(arr: readonly T[]) => arr[Math.floor(Math.random() * arr.length)];
const rnd = (min: number, max: number) => min + Math.floor(Math.random() * (max - min + 1));

/** Toshkent vaqti bo'yicha `daysAgo` kun oldingi berilgan soatdagi lahza (UTC+5). */
function tashkentTime(daysAgo: number, hour: number, minute: number) {
  const now = new Date();
  const local = new Date(now.getTime() + 5 * 3600_000);
  const d = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() - daysAgo, hour, minute) - 5 * 3600_000;
  return new Date(Math.min(d, now.getTime() - rnd(2, 20) * 60_000));
}

/**
 * Namoyish uchun to'liq demo obyekt yaratadi (bitta tranzaksiyada).
 * Kadrlar (snapshot) yaratilmaydi; manba — 'demo', Telegram'ga yuborilmaydi.
 */
export async function seedDemo(userId: string): Promise<string> {
  return sql.begin(async (tx) => {
    const [site] = await tx<{ id: string }[]>`
      INSERT INTO sites (name, address, floors, is_demo)
      VALUES (${DEMO_SITE_NAME}, ${"Toshkent sh., Yunusobod tumani, 19-mavze"}, 16, true)
      RETURNING id`;

    const camIds: Record<string, string> = {};
    for (const c of CAMERAS) {
      const lastSeen = c.online ? new Date() : new Date(Date.now() - 3 * 3600_000);
      const [row] = await tx<{ id: string }[]>`
        INSERT INTO cameras (site_id, code, name, floor, last_seen_at)
        VALUES (${site.id}, ${c.code}, ${c.name}, ${c.floor}, ${lastSeen})
        RETURNING id`;
      camIds[c.code] = row.id;
    }

    const zones: { id: string; cameraId: string; name: string }[] = [];
    for (const z of ZONES) {
      const cameraId = camIds[z.cam];
      const [row] = await tx<{ id: string }[]>`
        INSERT INTO zones (camera_id, name, type, points, warn_distance_m, created_by)
        VALUES (${cameraId}, ${z.name}, ${z.type}, ${tx.json(z.points)}, ${z.warn}, ${userId})
        RETURNING id`;
      zones.push({ id: row.id, cameraId, name: z.name });
    }

    const camList = Object.values(camIds);
    const plan = [...ALERT_PLAN].sort(() => Math.random() - 0.5);
    for (let i = 0; i < plan.length; i++) {
      const type = plan[i];
      // Birinchi 4 tasi — oxirgi soatlarda (yangi), qolganlari 7 kunga taqsimlanadi.
      const daysAgo = i < 4 ? 0 : rnd(0, 6);
      const hour = type === 'after_hours' ? rnd(21, 23) : rnd(8, 17);
      const detectedAt = i < 4 ? new Date(Date.now() - rnd(5, 180) * 60_000) : tashkentTime(daysAgo, hour, rnd(0, 59));
      const ageH = (Date.now() - detectedAt.getTime()) / 3600_000;

      let severity: Severity = defaultSeverity[type];
      if (type === 'no_helmet' && Math.random() < 0.3) severity = 'kritik';
      if (type === 'no_vest' && Math.random() < 0.3) severity = 'yuqori';

      let status: AlertStatus;
      if (i < 4) status = 'yangi';
      else if (ageH < 24) status = Math.random() < 0.5 ? 'korib' : 'hal';
      else status = Math.random() < 0.88 ? 'hal' : 'korib';

      const zone = type === 'zone_intrusion' ? pick(zones) : null;
      const cameraId = zone ? zone.cameraId : pick(camList);
      const detail = zone ? `${pick(DETAILS[type])} — ${zone.name}` : pick(DETAILS[type]);
      const ackAt = status !== 'yangi' ? new Date(detectedAt.getTime() + rnd(1, 6) * 60_000) : null;
      const resolvedAt = status === 'hal' ? new Date(detectedAt.getTime() + rnd(10, 90) * 60_000) : null;
      const falsePositive = status === 'hal' && Math.random() < 0.12;

      await tx`
        INSERT INTO alerts (site_id, camera_id, zone_id, type, severity, status, detail, source, event_uid,
                            detected_at, created_at, assignee_id, acknowledged_at, resolved_by, resolved_at, false_positive, notes)
        VALUES (${site.id}, ${cameraId}, ${zone?.id ?? null}, ${type}, ${severity}, ${status}, ${detail}, 'demo',
                ${'demo:' + randomUUID()}, ${detectedAt}, ${detectedAt}, ${status !== 'yangi' ? userId : null}, ${ackAt},
                ${status === 'hal' ? userId : null}, ${resolvedAt}, ${falsePositive},
                ${status === 'hal' ? (falsePositive ? "Noto'g'ri signal — soya" : "Xodim bilan suhbat o'tkazildi, bartaraf etildi") : ''})`;
    }

    for (let d = 0; d < 7; d++) {
      const persons = rnd(400, 900);
      const violations = Math.round(persons * (rnd(30, 80) / 1000));
      await tx`
        INSERT INTO daily_stats (site_id, day, persons_checked, ppe_violations)
        VALUES (${site.id}, (now() AT TIME ZONE 'Asia/Tashkent')::date - ${d}::int, ${persons}, ${violations})
        ON CONFLICT (site_id, day) DO NOTHING`;
    }

    for (let i = 0; i < WORKERS.length; i++) {
      const w = WORKERS[i];
      const until = new Date(Date.now() + w.trainingDays * 86400_000).toISOString().slice(0, 10);
      const phone = `+998 9${rnd(0, 9)} ${rnd(100, 999)} ${rnd(10, 99)} ${rnd(10, 99)}`;
      await tx`
        INSERT INTO workers (site_id, full_name, trade, brigade, badge_code, phone, training_valid_until)
        VALUES (${site.id}, ${w.name}, ${w.trade}, ${w.brigade}, ${'QQ-' + String(i + 1).padStart(4, '0')}, ${phone}, ${until})`;
    }

    return site.id;
  });
}

/** Barcha demo obyektlarni (kaskad bilan) o'chiradi. O'chirilgan obyektlar sonini qaytaradi. */
export async function deleteDemo(): Promise<number> {
  const rows = await sql`DELETE FROM sites WHERE is_demo RETURNING id`;
  return rows.length;
}
