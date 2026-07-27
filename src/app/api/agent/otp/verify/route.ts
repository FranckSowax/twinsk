import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import {
  normalizePhone, verifyOtpHash, signAgentToken, AGENT_COOKIE, SESSION_MAX_AGE,
} from '@/lib/agent';

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as { phone?: string; code?: string };
  const phone = normalizePhone(body.phone);
  const code = (body.code || '').replace(/\D/g, '');
  const fail = () => NextResponse.json({ error: 'Code invalide ou expiré' }, { status: 401 });
  if (phone.length < 6 || code.length !== 6) return fail();

  const { data: agent } = await supabaseAdmin
    .from('agents')
    .select('id, name, active')
    .eq('phone', phone)
    .eq('active', true)
    .single();
  if (!agent) return fail();

  const { data: otp } = await supabaseAdmin
    .from('agent_otps')
    .select('id, code_hash, expires_at, consumed_at')
    .eq('agent_id', agent.id)
    .is('consumed_at', null)
    .gte('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  if (!otp || !verifyOtpHash(code, otp.code_hash)) return fail();

  await supabaseAdmin.from('agent_otps').update({ consumed_at: new Date().toISOString() }).eq('id', otp.id);

  const res = NextResponse.json({ success: true, agent: { id: agent.id, name: agent.name } });
  res.cookies.set(AGENT_COOKIE, signAgentToken(agent.id), {
    httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: SESSION_MAX_AGE,
  });
  return res;
}
