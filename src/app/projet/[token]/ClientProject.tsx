'use client';

import ProjectWorkspace from '@/components/projects/ProjectWorkspace';

export default function ClientProject({ token, viewerName }: { token: string; viewerName: string }) {
  const base = `/api/projects/public/${token}`;
  return <ProjectWorkspace mode="client" viewerName={viewerName} loadUrl={base} actionUrl={`${base}/actions`} uploadUrl={`${base}/documents`} />;
}
