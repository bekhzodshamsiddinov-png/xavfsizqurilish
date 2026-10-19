export type Severity = 'kritik' | 'yuqori' | 'orta';
export type AlertStatus = 'yangi' | 'korib' | 'hal';
export type AlertType = 'no_helmet' | 'no_vest' | 'no_harness' | 'zone_intrusion' | 'person_down' | 'after_hours' | 'other';
export type ZoneType = 'lift' | 'zina' | 'deraza' | 'tok' | 'kran' | 'chuqur' | 'boshqa';

export const ALERT_TYPES: AlertType[] = ['no_helmet', 'no_vest', 'no_harness', 'zone_intrusion', 'person_down', 'after_hours', 'other'];
export const ZONE_TYPES: ZoneType[] = ['lift', 'zina', 'deraza', 'tok', 'kran', 'chuqur', 'boshqa'];
export const SEVERITIES: Severity[] = ['kritik', 'yuqori', 'orta'];

export const alertTypeLabel: Record<AlertType, string> = {
  no_helmet: 'Kaskasiz xodim',
  no_vest: 'Signal yeleksiz xodim',
  no_harness: 'Strahovka kamarisiz balandlikda',
  zone_intrusion: 'Xavfli zonaga yaqinlashish',
  person_down: 'Qulagan / harakatsiz odam',
  after_hours: 'Ish vaqtidan tashqari harakat',
  other: 'Boshqa xavf',
};

export const defaultSeverity: Record<AlertType, Severity> = {
  no_helmet: 'yuqori',
  no_vest: 'orta',
  no_harness: 'kritik',
  zone_intrusion: 'kritik',
  person_down: 'kritik',
  after_hours: 'yuqori',
  other: 'orta',
};

export const zoneTypeMeta: Record<ZoneType, { label: string; color: string }> = {
  lift: { label: 'Lift shaxtasi', color: '#E5383B' },
  zina: { label: 'Zina shaxtasi', color: '#F77F00' },
  deraza: { label: "To'siqsiz deraza / ochiq qirra", color: '#DC2626' },
  tok: { label: 'Yuqori kuchlanish', color: '#8B5CF6' },
  kran: { label: 'Kran ishlash zonasi', color: '#F59E0B' },
  chuqur: { label: 'Qazilgan chuqur', color: '#0EA5E9' },
  boshqa: { label: 'Boshqa xavfli joy', color: '#64748B' },
};

export const severityMeta: Record<Severity, { label: string; dot: string; chip: string }> = {
  kritik: { label: 'Kritik', dot: 'bg-red-500', chip: 'bg-red-50 text-red-700 ring-red-200' },
  yuqori: { label: 'Yuqori', dot: 'bg-orange-500', chip: 'bg-orange-50 text-orange-700 ring-orange-200' },
  orta: { label: "O'rta", dot: 'bg-amber-400', chip: 'bg-amber-50 text-amber-800 ring-amber-200' },
};

export const statusMeta: Record<AlertStatus, { label: string; chip: string }> = {
  yangi: { label: 'Yangi', chip: 'bg-red-500 text-white' },
  korib: { label: "Ko'rib chiqilmoqda", chip: 'bg-sky-100 text-sky-800' },
  hal: { label: 'Hal qilindi', chip: 'bg-emerald-100 text-emerald-800' },
};

export function timeAgo(d: Date | string) {
  const min = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  if (min < 1) return 'hozirgina';
  if (min < 60) return `${min} daqiqa oldin`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} soat oldin`;
  return `${Math.floor(h / 24)} kun oldin`;
}

const TZ = 'Asia/Tashkent';
export function fmtDateTime(d: Date | string | null) {
  if (!d) return '—';
  return new Intl.DateTimeFormat('uz-UZ', { timeZone: TZ, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(d));
}
