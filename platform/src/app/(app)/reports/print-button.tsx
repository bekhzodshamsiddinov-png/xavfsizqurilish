'use client';

import { FileDown } from 'lucide-react';
import { btnClass } from '@/components/ui';

export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className={btnClass('secondary')}>
      <FileDown className="h-4 w-4" /> PDF / chop etish
    </button>
  );
}
