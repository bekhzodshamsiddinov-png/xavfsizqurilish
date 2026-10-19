import { sql } from '@/lib/db';
import { getUser } from '@/lib/security/session';
import { can } from '@/lib/security/rbac';
import { audit } from '@/lib/security/audit';
import { currentSite } from '@/lib/site';
import { alertTypeLabel, severityMeta, statusMeta, type AlertStatus, type AlertType, type Severity } from '@/lib/labels';

export const dynamic = 'force-dynamic';

/** CSV maydoni: qo'shtirnoq ekranlanadi va Excel formula-inyeksiyasining oldi olinadi (=, +, -, @ bilan boshlanuvchi qiymatlar). */
function cell(v: unknown) {
  let s = v === null || v === undefined ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

export async function GET() {
  const user = await getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });
  if (user.mustChangePw) return new Response('Forbidden', { status: 403 });
  if (!can(user.role, 'report.export')) return new Response('Forbidden', { status: 403 });
  const site = await currentSite();
  if (!site) return new Response('Not found', { status: 404 });

  const rows = await sql<{ id: string; type: AlertType; severity: Severity; status: AlertStatus; detail: string; detected_at: Date; camera: string | null; floor: string | null; zone: string | null; false_positive: boolean; resolver: string | null; resolved_at: Date | null }[]>`
    SELECT a.id, a.type, a.severity, a.status, a.detail, a.detected_at, c.code AS camera, c.floor, z.name AS zone,
           a.false_positive, u.full_name AS resolver, a.resolved_at
    FROM alerts a LEFT JOIN cameras c ON c.id = a.camera_id LEFT JOIN zones z ON z.id = a.zone_id LEFT JOIN users u ON u.id = a.resolved_by
    WHERE a.site_id = ${site.id} AND a.detected_at > now() - interval '90 days'
    ORDER BY a.detected_at DESC LIMIT 20000`;

  const head = ['ID', 'Vaqt', 'Turi', 'Daraja', 'Holat', 'Kamera', 'Qavat', 'Zona', 'Tafsilot', "Yolg'on signal", 'Hal qilgan', 'Hal qilingan vaqt'];
  const lines = rows.map((r) => [
    r.id, new Date(r.detected_at).toISOString(), alertTypeLabel[r.type], severityMeta[r.severity].label, statusMeta[r.status].label,
    r.camera, r.floor, r.zone, r.detail, r.false_positive ? 'ha' : "yo'q", r.resolver, r.resolved_at ? new Date(r.resolved_at).toISOString() : '',
  ].map(cell).join(','));
  await audit(user.id, 'report.export_csv', site.id, { rows: rows.length });
  const csv = '﻿' + [head.map(cell).join(','), ...lines].join('\r\n');
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="signallar-${new Date().toISOString().slice(0, 10)}.csv"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
