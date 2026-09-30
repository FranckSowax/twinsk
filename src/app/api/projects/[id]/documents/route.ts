import { NextRequest, NextResponse } from 'next/server';
import { teamActor, unauthorized, errorResponse, readUpload } from '@/lib/projects/auth';
import { storeDocument } from '@/lib/projects/data';
import type { DocumentCategory } from '@/lib/projects/types';

// POST multipart (équipe) : files[], category, internal ('1' = réservé à l'équipe).
// Renvoie les documents créés et leurs pièces jointes (à rattacher à une tâche, un échange…).
export const dynamic = 'force-dynamic';
const CATS: DocumentCategory[] = ['site', 'technical', 'admin', 'reports', 'misc'];

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await teamActor(request);
  if (!actor) return unauthorized();
  const { id } = await params;
  try {
    const form = await request.formData();
    const category = (String(form.get('category') || 'misc') as DocumentCategory);
    const internal = String(form.get('internal') || '') === '1';
    const files = form.getAll('files').filter((f): f is File => f instanceof File);
    if (!files.length) return NextResponse.json({ error: 'Aucun fichier' }, { status: 400 });
    const out = [];
    for (const f of files.slice(0, 10)) out.push(await storeDocument(id, await readUpload(f), { category: CATS.includes(category) ? category : 'misc', internal }, actor));
    return NextResponse.json({ documents: out });
  } catch (e) {
    return errorResponse(e);
  }
}
