import { NextRequest, NextResponse } from 'next/server';
import { teamActor, unauthorized, errorResponse, readUpload } from '@/lib/projects/auth';
import { addSupplierPhotos } from '@/lib/projects/data';

// POST multipart « files » (équipe) : photos des produits reçues de l'usine,
// ajoutées à sa fiche et montrées au client (anonymisées : vérifier l'absence de logo).
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string; supplierId: string }> }) {
  const actor = await teamActor(request);
  if (!actor) return unauthorized();
  const { id, supplierId } = await params;
  try {
    const form = await request.formData();
    const files = form.getAll('files').filter((f): f is File => f instanceof File);
    if (!files.length) return NextResponse.json({ error: 'Aucune photo' }, { status: 400 });
    const read = [];
    for (const f of files.slice(0, 12)) read.push(await readUpload(f));
    return NextResponse.json({ photos: await addSupplierPhotos(id, supplierId, read, actor) });
  } catch (e) {
    return errorResponse(e);
  }
}
