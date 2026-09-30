// Rendu du PDF du devis projet (serveur), commun aux routes équipe et client.
import { createElement } from 'react';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { renderToBuffer } from '@react-pdf/renderer';
import ProjectQuotePDF from '@/components/projects/ProjectQuotePDF';
import type { PublicProject } from './public';

let logo: string | null | undefined;
function logoDataUrl(): string | null {
  if (logo !== undefined) return logo;
  try {
    logo = `data:image/jpeg;base64,${readFileSync(path.join(process.cwd(), 'public', 'twinsk-logo.jpg')).toString('base64')}`;
  } catch {
    logo = null;
  }
  return logo;
}

export async function renderProjectQuotePdf(p: PublicProject, clientName: string): Promise<Buffer> {
  const el = createElement(ProjectQuotePDF, { p, logoUrl: logoDataUrl(), date: new Date().toLocaleDateString('fr-FR'), clientName });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return renderToBuffer(el as any);
}
