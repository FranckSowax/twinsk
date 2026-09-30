import { NextRequest, NextResponse } from 'next/server';
import { teamActor, unauthorized, errorResponse } from '@/lib/projects/auth';
import { createProjectFromGenerated, createProjectFromTemplate, listProjects } from '@/lib/projects/data';
import { validateGeneratedTemplate } from '@/lib/projects/ai';
import { PROJECT_TEMPLATES } from '@/lib/projects/templates/dom-tom';

// GET : projets (équipe). POST { template_key, title?, client_* , started_at? } : projet créé depuis un modèle.
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const actor = await teamActor(request);
  if (!actor) return unauthorized();
  try {
    return NextResponse.json({ projects: await listProjects(), templates: PROJECT_TEMPLATES.map((t) => ({ key: t.key, title: t.title, description: t.description, currency: t.currency })) });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(request: NextRequest) {
  const actor = await teamActor(request);
  if (!actor) return unauthorized();
  const b = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const str = (k: string) => (typeof b[k] === 'string' ? (b[k] as string) : undefined);
  try {
    const currency = (str('currency') || 'USD').toUpperCase();
    const common = { title: str('title'), currency, clientName: str('client_name'), clientCompany: str('client_company'), clientPhone: str('client_phone'), clientEmail: str('client_email'), startedAt: str('started_at'), actor };
    // Plan proposé par l'IA et relu par l'équipe : revalidé ici, jamais pris tel quel.
    if (b.generated && typeof b.generated === 'object') {
      const t = validateGeneratedTemplate(b.generated, { currency, title: str('title') || 'Projet' });
      if (!t) return NextResponse.json({ error: 'Plan généré invalide' }, { status: 400 });
      return NextResponse.json({ id: await createProjectFromGenerated(t, common) });
    }
    const id = await createProjectFromTemplate({ templateKey: str('template_key') || 'dom-tom', ...common });
    return NextResponse.json({ id });
  } catch (e) {
    return errorResponse(e);
  }
}
