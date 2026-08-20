import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { supabaseAdmin } from '@/lib/supabase/server';
import { isAdmin } from '@/lib/collab';
import { badRequest, dbError, unauthorized } from '@/lib/sourcing/api';

const BUCKET = 'request-images';
const PREFIX = 'sourcing';
const MAX_SIZE = 10 * 1024 * 1024;
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * POST: annexes visuelles (photos de moule, échantillons, certificats).
 * Le redimensionnement à 1 600 px et la conversion WebP se font côté client, avant
 * l'envoi : le serveur ne fait que valider et stocker. Route authentifiée — ces
 * images sont identifiantes et ne doivent pas transiter par un point d'entrée ouvert.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isAdmin(request)) return unauthorized();
  const { id } = await params;

  const form = await request.formData().catch(() => null);
  if (!form) return badRequest('Requête multipart attendue');

  const files = form.getAll('files').filter((f): f is File => f instanceof File);
  if (!files.length) return badRequest('Aucun fichier fourni');

  const supplierId = (form.get('supplier_id') as string) || null;
  const caption = (form.get('caption') as string)?.trim() || null;
  const width = Number(form.get('width')) || null;
  const height = Number(form.get('height')) || null;

  const { count } = await supabaseAdmin
    .from('sourcing_images')
    .select('id', { count: 'exact', head: true })
    .eq('project_id', id);
  let position = count ?? 0;

  const created = [];
  for (const file of files) {
    if (!ALLOWED.includes(file.type)) {
      return badRequest(`Type de fichier non supporté : ${file.type}`);
    }
    if (file.size > MAX_SIZE) {
      return badRequest(`Fichier trop volumineux : ${file.name} (max 10 Mo)`);
    }

    const ext = file.name.split('.').pop()?.toLowerCase() || 'webp';
    const storageKey = `${PREFIX}/${id}/${uuidv4()}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: upErr } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(storageKey, buffer, { contentType: file.type, upsert: false });
    if (upErr) return dbError('images.upload', upErr, 'Échec du téléversement');

    const { data, error } = await supabaseAdmin
      .from('sourcing_images')
      .insert({
        project_id: id,
        supplier_id: supplierId,
        filename: file.name,
        storage_key: storageKey,
        mime: file.type,
        bytes: file.size,
        width,
        height,
        caption,
        position: position++,
      })
      .select()
      .single();
    if (error) return dbError('images.create', error);

    const { data: urlData } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(storageKey);
    created.push({ ...data, url: urlData.publicUrl });
  }

  return NextResponse.json(created);
}
