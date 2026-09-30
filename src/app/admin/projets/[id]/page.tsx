'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import ProjectWorkspace from '@/components/projects/ProjectWorkspace';

export default function ProjectAdminPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <div className="space-y-3">
      <Link href="/admin/projets" className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-800"><ArrowLeft className="h-3.5 w-3.5" /> Tous les projets</Link>
      <ProjectWorkspace mode="team" viewerName="Équipe" loadUrl={`/api/projects/${id}`} actionUrl={`/api/projects/${id}/actions`} uploadUrl={`/api/projects/${id}/documents`} pdfUrl={`/api/projects/${id}/quote-pdf`} aiUrl={`/api/projects/${id}/ai`} />
    </div>
  );
}
