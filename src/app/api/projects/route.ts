import { NextRequest, NextResponse } from 'next/server';
import { teamActor, unauthorized, errorResponse } from '@/lib/projects/auth';
import { createProjectFromTemplate, listProjects } from '@/lib/projects/data';
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
  const b = (await request.json().catch(() => ({}))) as Record<string, string | undefined>;
  try {
    const id = await createProjectFromTemplate({ templateKey: b.template_key || 'dom-tom', title: b.title, clientName: b.client_name, clientCompany: b.client_company, clientPhone: b.client_phone, clientEmail: b.client_email, startedAt: b.started_at, actor });
    return NextResponse.json({ id });
  } catch (e) {
    return errorResponse(e);
  }
}
