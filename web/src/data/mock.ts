// Demo ma'lumotlar — real tizimda backend API'dan keladi

export const IMG = {
  site1: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=1200&q=70&auto=format&fit=crop',
  site2: 'https://images.unsplash.com/photo-1541888946425-d81bb19240f5?w=1200&q=70&auto=format&fit=crop',
  site3: 'https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=1200&q=70&auto=format&fit=crop',
};

export type Severity = 'kritik' | 'yuqori' | 'orta';
export type AlertStatus = 'yangi' | 'korib' | 'hal';

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

export interface AlertItem {
  id: string;
  type: string;
  detail: string;
  severity: Severity;
  camera: string;
  floor: string;
  minutesAgo: number;
  status: AlertStatus;
  assignee: string;
  img: string;
  pos: string;
}

export const alerts: AlertItem[] = [
  { id: 'A-1048', type: 'Lift shaxtasiga yaqinlashish', detail: 'Xodim xavfli zonaga 0,8 m masofagacha yaqinlashdi', severity: 'kritik', camera: 'KAM-09', floor: '9-qavat', minutesAgo: 1, status: 'yangi', assignee: 'Aliyev R. (prorab)', img: IMG.site2, pos: '30% 40%' },
  { id: 'A-1047', type: 'Strahovka kamarisiz balandlikda ishlash', detail: 'Ochiq qirra yonida himoya kamarisiz ish', severity: 'kritik', camera: 'KAM-12', floor: '12-qavat', minutesAgo: 4, status: 'yangi', assignee: 'Aliyev R. (prorab)', img: IMG.site1, pos: '60% 30%' },
  { id: 'A-1046', type: 'Kaskasiz xodim', detail: 'B seksiyada 1 nafar xodim kaskasiz', severity: 'yuqori', camera: 'KAM-05', floor: '5-qavat', minutesAgo: 7, status: 'korib', assignee: 'Karimov S.', img: IMG.site3, pos: '50% 50%' },
  { id: 'A-1045', type: 'Yuqori kuchlanish zonasiga kirish', detail: 'Ruxsatsiz shaxs elektr shchitiga yaqinlashdi', severity: 'kritik', camera: 'KAM-02', floor: '1-qavat', minutesAgo: 12, status: 'korib', assignee: 'Usmonov D.', img: IMG.site2, pos: '70% 60%' },
  { id: 'A-1044', type: 'Signal yeleksiz xodim', detail: 'Kran ishlash zonasida yeleksiz harakat', severity: 'yuqori', camera: 'KAM-14', floor: 'Hovli', minutesAgo: 18, status: 'yangi', assignee: 'Karimov S.', img: IMG.site1, pos: '20% 60%' },
  { id: 'A-1043', type: "To'siqsiz derazaga yaqinlashish", detail: '7-qavat, sharqiy tomon', severity: 'yuqori', camera: 'KAM-07', floor: '7-qavat', minutesAgo: 26, status: 'hal', assignee: 'Aliyev R. (prorab)', img: IMG.site3, pos: '20% 30%' },
  { id: 'A-1042', type: 'Kaskasiz xodim', detail: 'Material ombori kirish qismida', severity: 'orta', camera: 'KAM-01', floor: '1-qavat', minutesAgo: 41, status: 'hal', assignee: 'Usmonov D.', img: IMG.site2, pos: '50% 70%' },
  { id: 'A-1041', type: 'Qulagan odam aniqlandi', detail: "Xodim 6 soniyadan ortiq harakatsiz yotibdi — tekshirildi, dam olish", severity: 'kritik', camera: 'KAM-10', floor: '10-qavat', minutesAgo: 58, status: 'hal', assignee: 'Aliyev R. (prorab)', img: IMG.site1, pos: '80% 50%' },
];

export interface Person { x: number; y: number; w: number; h: number; helmet: boolean; vest: boolean; harness?: boolean }
export interface Camera {
  id: string;
  name: string;
  floor: string;
  img: string;
  pos: string;
  online: boolean;
  fps: number;
  people: Person[];
  zone?: { label: string; points: string };
  device: string;
  temp: number;
  storage: number;
}

export const cameras: Camera[] = [
  { id: 'KAM-09', name: 'Lift shaxtasi — shimol', floor: '9-qavat', img: IMG.site2, pos: '30% 40%', online: true, fps: 24, device: 'Jetson Orin — 3-blok', temp: 58, storage: 61,
    people: [{ x: 18, y: 30, w: 13, h: 52, helmet: true, vest: false }, { x: 58, y: 34, w: 12, h: 48, helmet: true, vest: true }],
    zone: { label: 'Lift shaxtasi', points: '34,58 54,54 56,96 30,98' } },
  { id: 'KAM-12', name: "Ochiq qirra — g'arb", floor: '12-qavat', img: IMG.site1, pos: '60% 30%', online: true, fps: 25, device: 'Jetson Orin — 3-blok', temp: 61, storage: 61,
    people: [{ x: 40, y: 22, w: 16, h: 60, helmet: true, vest: true, harness: false }],
    zone: { label: 'Ochiq qirra', points: '70,20 98,16 98,98 74,98' } },
  { id: 'KAM-05', name: 'B seksiya koridori', floor: '5-qavat', img: IMG.site3, pos: '50% 50%', online: true, fps: 23, device: 'Jetson Orin — 2-blok', temp: 54, storage: 47,
    people: [{ x: 22, y: 28, w: 12, h: 50, helmet: false, vest: true }, { x: 64, y: 30, w: 12, h: 50, helmet: true, vest: true }] },
  { id: 'KAM-02', name: 'Elektr shchit xonasi', floor: '1-qavat', img: IMG.site2, pos: '70% 60%', online: true, fps: 25, device: 'Jetson Orin — 1-blok', temp: 49, storage: 33,
    people: [{ x: 46, y: 26, w: 14, h: 56, helmet: true, vest: true }],
    zone: { label: 'Yuqori kuchlanish', points: '4,30 30,26 30,90 4,94' } },
  { id: 'KAM-14', name: 'Kran ishlash zonasi', floor: 'Hovli', img: IMG.site1, pos: '20% 60%', online: true, fps: 22, device: 'Jetson Orin — hovli', temp: 63, storage: 72,
    people: [{ x: 30, y: 40, w: 10, h: 40, helmet: true, vest: false }, { x: 52, y: 42, w: 10, h: 40, helmet: true, vest: true }, { x: 70, y: 44, w: 9, h: 38, helmet: true, vest: true }],
    zone: { label: 'Kran zonasi', points: '20,70 80,66 90,98 12,98' } },
  { id: 'KAM-07', name: 'Deraza ochiqliklari — sharq', floor: '7-qavat', img: IMG.site3, pos: '20% 30%', online: true, fps: 24, device: 'Jetson Orin — 2-blok', temp: 52, storage: 47,
    people: [{ x: 36, y: 30, w: 13, h: 52, helmet: true, vest: true }],
    zone: { label: "To'siqsiz deraza", points: '62,14 92,14 92,64 62,64' } },
  { id: 'KAM-01', name: 'Asosiy kirish', floor: '1-qavat', img: IMG.site2, pos: '50% 70%', online: true, fps: 25, device: 'Jetson Orin — 1-blok', temp: 47, storage: 33, people: [] },
  { id: 'KAM-16', name: 'Tom qismi', floor: '16-qavat', img: IMG.site1, pos: '50% 10%', online: false, fps: 0, device: 'Jetson Orin — 3-blok', temp: 0, storage: 61, people: [] },
];

export const zoneTypes = [
  { key: 'lift', label: 'Lift shaxtasi', color: '#E5383B' },
  { key: 'zina', label: 'Zina shaxtasi', color: '#F77F00' },
  { key: 'deraza', label: "To'siqsiz deraza / ochiq qirra", color: '#E5383B' },
  { key: 'tok', label: 'Yuqori kuchlanish', color: '#8B5CF6' },
  { key: 'kran', label: 'Kran ishlash zonasi', color: '#F59E0B' },
  { key: 'chuqur', label: 'Qazilgan chuqur', color: '#0EA5E9' },
];

export interface Zone {
  id: string;
  name: string;
  type: string;
  camera: string;
  floor: string;
  points: string;
  active: boolean;
  distance: number;
  alertsToday: number;
}

export const initialZones: Zone[] = [
  { id: 'Z-01', name: 'Lift shaxtasi #1', type: 'lift', camera: 'KAM-09', floor: '9-qavat', points: '34,58 54,54 56,96 30,98', active: true, distance: 2, alertsToday: 4 },
  { id: 'Z-02', name: "G'arbiy ochiq qirra", type: 'deraza', camera: 'KAM-12', floor: '12-qavat', points: '70,20 98,16 98,98 74,98', active: true, distance: 1.5, alertsToday: 3 },
  { id: 'Z-03', name: 'Elektr shchit', type: 'tok', camera: 'KAM-02', floor: '1-qavat', points: '4,30 30,26 30,90 4,94', active: true, distance: 3, alertsToday: 1 },
  { id: 'Z-04', name: 'Minorali kran radiusi', type: 'kran', camera: 'KAM-14', floor: 'Hovli', points: '20,70 80,66 90,98 12,98', active: true, distance: 5, alertsToday: 2 },
  { id: 'Z-05', name: 'Zina shaxtasi B', type: 'zina', camera: 'KAM-05', floor: '5-qavat', points: '60,20 85,20 85,70 60,70', active: false, distance: 1.5, alertsToday: 0 },
];

export interface Worker {
  id: string;
  name: string;
  role: string;
  brigade: string;
  compliance: number;
  violations: number;
  training: 'ok' | 'muddati';
  onSite: boolean;
}

export const workers: Worker[] = [
  { id: 'X-0112', name: 'Abdullayev Jasur', role: 'Betonchi', brigade: '1-brigada (Monolit)', compliance: 98, violations: 0, training: 'ok', onSite: true },
  { id: 'X-0087', name: 'Rahimov Sardor', role: 'Payvandchi', brigade: '2-brigada (Metall)', compliance: 81, violations: 4, training: 'muddati', onSite: true },
  { id: 'X-0145', name: 'Tursunov Bekzod', role: 'Elektrik', brigade: '4-brigada (Elektr)', compliance: 95, violations: 1, training: 'ok', onSite: true },
  { id: 'X-0063', name: "Qodirov O'tkir", role: 'Montajchi', brigade: '2-brigada (Metall)', compliance: 72, violations: 7, training: 'muddati', onSite: true },
  { id: 'X-0201', name: 'Nazarov Ilhom', role: 'Kranchi', brigade: '3-brigada (Kran)', compliance: 100, violations: 0, training: 'ok', onSite: true },
  { id: 'X-0178', name: 'Yusupov Doniyor', role: "G'isht teruvchi", brigade: '1-brigada (Monolit)', compliance: 89, violations: 2, training: 'ok', onSite: false },
  { id: 'X-0099', name: 'Ergashev Anvar', role: 'Armaturachi', brigade: '1-brigada (Monolit)', compliance: 93, violations: 1, training: 'ok', onSite: true },
  { id: 'X-0156', name: 'Mirzayev Shoxrux', role: 'Slingovshchik', brigade: '3-brigada (Kran)', compliance: 86, violations: 3, training: 'ok', onSite: true },
];

export const weekDays = ['Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh', 'Ya'];
export const weeklyViolations = {
  kaska: [14, 11, 12, 8, 9, 6, 5],
  yelek: [9, 10, 7, 7, 5, 6, 4],
  kamar: [6, 5, 6, 4, 3, 3, 2],
};

// 16 qavat: 0 — xavfsiz, 1 — past, 2 — o'rta, 3 — yuqori
export const floorRisk = [0, 1, 0, 0, 2, 1, 2, 0, 3, 1, 0, 3, 1, 0, 0, 1];
