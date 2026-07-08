import { NextRequest, NextResponse } from 'next/server';
import { isAdmin, getCollaborator } from '@/lib/collab';

// GET: rôle courant (admin / collab / null) — utilisé par le layout admin.
export async function GET(request: NextRequest) {
  if (isAdmin(request)) {
    return NextResponse.json({ role: 'admin' });
  }
  const collab = await getCollaborator(request);
  if (collab) {
    return NextResponse.json({ role: 'collab', name: collab.name, username: collab.username });
  }
  return NextResponse.json({ role: null }, { status: 401 });
}
