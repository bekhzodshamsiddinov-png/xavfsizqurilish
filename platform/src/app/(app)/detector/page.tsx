import Link from 'next/link';
import { ScanEye } from 'lucide-react';
import { sql } from '@/lib/db';
import { requirePage } from '@/lib/security/session';
import { currentSite } from '@/lib/site';
import type { ZoneType } from '@/lib/labels';
import { Card, EmptyState, Notice, PageTitle, btnClass } from '@/components/ui';
import { Detector } from './detector.client';

export const metadata = { title: 'Brauzer detektori' };

export default async function DetectorPage() {
  await requirePage('detector.run');
  const site = await currentSite();
  const cameras = site
    ? await sql<{ id: string; code: string; name: string; floor: string }[]>`SELECT id, code, name, floor FROM cameras WHERE site_id = ${site.id} ORDER BY code`
    : [];
  const zones = cameras.length
    ? await sql<{ id: string; camera_id: string; name: string; type: ZoneType; points: [number, number][] }[]>`
        SELECT z.id, z.camera_id, z.name, z.type, z.points FROM zones z JOIN cameras c ON c.id = z.camera_id
        WHERE c.site_id = ${site!.id} AND z.active`
    : [];

  return (
    <div>
      <PageTitle
        title="Brauzer detektori"
        subtitle="Telefon yoki noutbuk kamerasini AI xavfsizlik kamerasiga aylantiring — qo'shimcha uskunasiz"
      />
      {!cameras.length ? (
        <Card><EmptyState icon={<ScanEye className="h-6 w-6" />} title="Kamera ro'yxatdan o'tmagan"
          text="Detektor qaysi kamera nomidan ishlashini bilishi uchun avval kamera qo'shing va unga xavfli zona chizing."
          action={<Link href="/cameras" className={btnClass()}>Kamera qo'shish</Link>} /></Card>
      ) : (
        <>
          <Detector cameras={cameras} zones={zones} />
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <Notice tone="info"><b>Qanday ishlaydi:</b> AI modeli (COCO-SSD) to'g'ridan-to'g'ri brauzeringizda ishlaydi. Video hech qayerga yuborilmaydi — faqat hodisa kadri saqlanadi.</Notice>
            <Notice tone="warn"><b>Cheklov:</b> brauzer rejimi odamni va xavfli zonani aniqlaydi. Kaska/yelek/kamar aniqlash maxsus o'qitilgan model bilan obyektdagi edge-qurilmada ishlaydi.</Notice>
            <Notice tone="ok"><b>Maslahat:</b> telefonni shtativga mahkamlang, zonani o'sha kamera kadrida chizing va ekranni yoqiq qoldiring.</Notice>
          </div>
        </>
      )}
    </div>
  );
}
