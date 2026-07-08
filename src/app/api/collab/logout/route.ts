import { NextResponse } from 'next/server';

// POST: déconnexion collaborateur.
export async function POST() {
  const res = NextResponse.json({ success: true });
  res.cookies.set('collab_token', '', { path: '/', maxAge: 0 });
  return res;
}
