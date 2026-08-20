import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { isAdmin } from '@/lib/collab';
import { dbError, notFound, unauthorized } from '@/lib/sourcing/api';

const BUCKET = 'request-images';

// DELETE: retire une annexe, fichier de stockage compris.
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isAdmin(request)) return unauthorized();
  const { id } = await params;

  const { data: image } = await supabaseAdmin
    .from('sourcing_images')
    .select('id, storage_key')
    .eq('id', id)
    .maybeSingle();
  if (!image) return notFound('Annexe');

  // Le fichier part d'abord ; si le stockage échoue on garde la ligne pour ne pas
  // laisser d'orphelin invisible.
  const { error: storageErr } = await supabaseAdmin.storage.from(BUCKET).remove([image.storage_key]);
  if (storageErr) return dbError('images.storage.delete', storageErr, 'Échec de la suppression');

  const { error } = await supabaseAdmin.from('sourcing_images').delete().eq('id', id);
  if (error) return dbError('images.delete', error);
  return NextResponse.json({ success: true });
}
