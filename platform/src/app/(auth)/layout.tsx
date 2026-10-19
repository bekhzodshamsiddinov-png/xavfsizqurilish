import { ShieldCheck, HardHat, BellRing, Lock } from 'lucide-react';
import { Logo } from '@/components/ui';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <section className="relative hidden overflow-hidden bg-[#14161A] p-12 text-white lg:flex lg:flex-col">
        <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-[#FFC400]/10 blur-3xl" />
        <div className="absolute -bottom-32 -left-20 h-96 w-96 rounded-full bg-[#FFC400]/5 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <Logo size={44} />
          <div>
            <div className="text-xl font-bold">Qurilish Qalqoni</div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[#FFC400]">AI xavfsizlik platformasi</div>
          </div>
        </div>
        <div className="relative mt-auto max-w-lg">
          <h2 className="text-4xl font-bold leading-tight tracking-tight">
            Har bir quruvchi kechqurun uyiga <span className="text-[#FFC400]">sog'-salomat</span> qaytishi kerak.
          </h2>
          <p className="mt-4 text-slate-400">
            Kameralar va sun'iy intellekt himoya vositalarini tekshiradi, xavfli zonaga yaqinlashgan odamni darhol ogohlantiradi.
          </p>
          <ul className="mt-8 space-y-3 text-sm text-slate-300">
            <li className="flex items-center gap-3"><HardHat className="h-5 w-5 text-[#FFC400]" /> Kaska, yelek va strahovka kamari nazorati</li>
            <li className="flex items-center gap-3"><BellRing className="h-5 w-5 text-[#FFC400]" /> Sirena, ovozli xabar va Telegram ogohlantirishlari</li>
            <li className="flex items-center gap-3"><ShieldCheck className="h-5 w-5 text-[#FFC400]" /> Xavfli zonalarni bir daqiqada belgilash</li>
          </ul>
        </div>
        <div className="relative mt-12 flex items-center gap-2 text-xs text-slate-500">
          <Lock className="h-3.5 w-3.5" /> Shifrlangan ulanish · Ikki bosqichli autentifikatsiya · Audit jurnali
        </div>
      </section>
      <section className="flex items-center justify-center bg-[#F6F7F9] px-4 py-12">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <Logo size={40} />
            <div className="text-lg font-bold">Qurilish Qalqoni</div>
          </div>
          {children}
        </div>
      </section>
    </div>
  );
}
