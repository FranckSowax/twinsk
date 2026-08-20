import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { isAdmin } from '@/lib/collab';
import { dbError, unauthorized } from '@/lib/sourcing/api';

// DELETE: retire une ligne de journal.
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isAdmin(request)) return unauthorized();
  const { id } = await params;

  const { error } = await supabaseAdmin.from('sourcing_contact_log').delete().eq('id', id);
  if (error) return dbError('log.delete', error);
  return NextResponse.json({ success: true });
}
