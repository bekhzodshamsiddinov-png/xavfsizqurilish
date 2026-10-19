'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Sahifani N soniyada bir yangilaydi (yorliq yashirin bo'lsa — to'xtaydi). */
export function AutoRefresh({ seconds = 15 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => {
      if (!document.hidden) router.refresh();
    }, seconds * 1000);
    return () => clearInterval(t);
  }, [router, seconds]);
  return null;
}
