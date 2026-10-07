'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import TripAdmin from '@/components/achats/TripAdmin';

export default function AchatAdminPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <div className="space-y-3">
      <Link href="/admin/achats" className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-800"><ArrowLeft className="h-3.5 w-3.5" /> Tous les voyages</Link>
      <TripAdmin id={id} />
    </div>
  );
}
