import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { sendWhapiText } from '@/lib/whapi';
import { toWhatsappChatId } from '@/lib/order-number';
import { phoneCandidates, generateOtpCode, hashOtp, otpRateLimited, OTP_TTL_MS } from '@/lib/agent';

// Réponse TOUJOURS générique (anti-énumération) : on n'indique jamais si le numéro existe.
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as { phone?: string };
  const candidates = phoneCandidates(body.phone);
  const generic = NextResponse.json({ success: true });
  if (!candidates.length) return generic;

  const { data: agents } = await supabaseAdmin
    .from('agents')
    .select('id, phone, active')
    .in('phone', candidates)
    .eq('active', true)
    .limit(1);
  const agent = agents?.[0];
  if (!agent) return generic;

  // Rate-limit : compte les OTP créés dans les 10 dernières minutes.
  const since = new Date(Date.now() - OTP_TTL_MS).toISOString();
  const { count } = await supabaseAdmin
    .from('agent_otps')
    .select('id', { count: 'exact', head: true })
    .eq('agent_id', agent.id)
    .gte('created_at', since);
  if (otpRateLimited(count || 0)) return generic;

  const code = generateOtpCode();
  await supabaseAdmin.from('agent_otps').insert({
    agent_id: agent.id,
    code_hash: hashOtp(code),
    expires_at: new Date(Date.now() + OTP_TTL_MS).toISOString(),
  });

  const chat = toWhatsappChatId(agent.phone);
  if (chat) {
    // fire-and-forget : ne pas bloquer la réponse (évite un canal temporel d'énumération)
    void sendWhapiText(
      `🔐 *TWINSK — Espace agents*\nVotre code de connexion : *${code}*\nValable 10 minutes. Ne le partagez pas.`,
      chat,
    ).catch(() => {});
  }
  return generic;
}
