import { NextResponse } from 'next/server';
import { AGENT_COOKIE } from '@/lib/agent';

export async function POST() {
  const res = NextResponse.json({ success: true });
  res.cookies.set(AGENT_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 });
  return res;
}
