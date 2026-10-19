import React, { useState } from 'react';
import { Volume2, Flag, ThumbsDown, LayoutGrid, Grid2x2, X, HardHat, Shirt, Link2, EyeOff, Eye } from 'lucide-react';
import { PageTitle, Button, Modal, useToast } from '../components/ui';
import { CameraFeed } from '../components/CameraFeed';
import { cameras, type Camera } from '../data/mock';

const filters = ['Barchasi', 'Qoidabuzarlik bor', 'Xavfli zonalar', 'Oflayn'] as const;

export function LiveView() {
  const [selected, setSelected] = useState<Camera | null>(null);
  const [filter, setFilter] = useState<(typeof filters)[number]>('Barchasi');
  const [dense, setDense] = useState(false);
  const [blur, setBlur] = useState(true);
  const toast = useToast();

  const list = cameras.filter((c) => {
    if (filter === 'Qoidabuzarlik bor') return c.people.some((p) => !p.helmet || !p.vest || p.harness === false);
    if (filter === 'Xavfli zonalar') return !!c.zone;
    if (filter === 'Oflayn') return !c.online;
    return true;
  });

  return (
    <div>
      <PageTitle
        title="Jonli kuzatuv"
        subtitle="AI har bir kadrda kaska, signal yelek, strahovka kamari va xavfli zonalarni tekshiradi"
        action={
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={() => setBlur(!blur)}>
              {blur ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              <span className="hidden sm:inline">{blur ? 'Yuzlar xiralashtirilgan' : 'Yuzlar ochiq'}</span>
            </Button>
            <div className="flex rounded-xl bg-white p-1 ring-1 ring-slate-200">
              <button onClick={() => setDense(false)} className={`rounded-lg p-2 ${!dense ? 'bg-slate-900 text-white' : 'text-slate-500'}`} aria-label="2 ustun"><Grid2x2 className="h-4 w-4" /></button>
              <button onClick={() => setDense(true)} className={`rounded-lg p-2 ${dense ? 'bg-slate-900 text-white' : 'text-slate-500'}`} aria-label="3 ustun"><LayoutGrid className="h-4 w-4" /></button>
            </div>
          </div>
        }
      />

      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {filters.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition ${
              filter === f ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <div className={`grid gap-4 ${dense ? 'sm:grid-cols-2 xl:grid-cols-3' : 'md:grid-cols-2'}`}>
        {list.map((c) => (
          <button key={c.id} onClick={() => c.online && setSelected(c)} className="text-left transition hover:-translate-y-0.5 focus:outline-none">
            <CameraFeed cam={c} blurFaces={blur} />
          </button>
        ))}
      </div>

      <Modal open={!!selected} onClose={() => setSelected(null)} wide>
        {selected && (
          <div className="grid lg:grid-cols-[1fr_340px]">
            <div className="bg-[#0B0C0E] p-3 sm:p-4">
              <CameraFeed cam={selected} large blurFaces={blur} />
            </div>
            <div className="flex flex-col p-5">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">{selected.id} · {selected.floor}</div>
                  <h3 className="mt-1 text-lg font-bold text-slate-900">{selected.name}</h3>
                </div>
                <button onClick={() => setSelected(null)} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"><X className="h-5 w-5" /></button>
              </div>

              <div className="mt-5 text-sm font-semibold text-slate-700">Aniqlangan odamlar ({selected.people.length})</div>
              <ul className="mt-2 space-y-2">
                {selected.people.map((p, i) => (
                  <li key={i} className="rounded-xl bg-slate-50 p-3">
                    <div className="text-sm font-semibold text-slate-900">Shaxs #{i + 1}</div>
                    <div className="mt-2 flex flex-wrap gap-1.5 text-xs font-semibold">
                      <Pill ok={p.helmet} icon={HardHat} label="Kaska" />
                      <Pill ok={p.vest} icon={Shirt} label="Yelek" />
                      {p.harness !== undefined && <Pill ok={p.harness} icon={Link2} label="Kamar" />}
                    </div>
                  </li>
                ))}
              </ul>

              <div className="mt-auto space-y-2 pt-6">
                <Button className="w-full" onClick={() => toast(`Ovozli ogohlantirish yuborildi — ${selected.floor} karnayi`)}>
                  <Volume2 className="h-4 w-4" /> Ovozli ogohlantirish yuborish
                </Button>
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="secondary" onClick={() => { toast('Hodisa sifatida saqlandi'); setSelected(null); }}><Flag className="h-4 w-4" /> Hodisa</Button>
                  <Button variant="secondary" onClick={() => { toast("Yolg'on signal — AI modeli uchun belgilandi"); setSelected(null); }}><ThumbsDown className="h-4 w-4" /> Yolg'on signal</Button>
                </div>
                <p className="pt-1 text-center text-[11px] text-slate-400">"Yolg'on signal" belgilari AI modelini qayta o'qitishda ishlatiladi</p>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function Pill({ ok, icon: Icon, label }: { ok: boolean; icon: React.ElementType; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 ${ok ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-700'}`}>
      <Icon className="h-3.5 w-3.5" /> {label} {ok ? 'bor' : "yo'q"}
    </span>
  );
}

