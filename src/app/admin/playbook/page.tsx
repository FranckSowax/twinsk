'use client';

// Le Playbook est fusionné dans l'onglet WhatsApp (/admin/whatsapp).
// Cette page ne sert plus que de redirection pour les anciens liens.

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function PlaybookRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/admin/whatsapp');
  }, [router]);
  return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
    </div>
  );
}
