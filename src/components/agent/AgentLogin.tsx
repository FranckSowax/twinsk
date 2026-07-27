'use client';
import { useState } from 'react';
import { Loader2, Smartphone, KeyRound } from 'lucide-react';

type Agent = { id: string; name: string };

export default function AgentLogin({ onAuthed }: { onAuthed: (a: Agent) => void }) {
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const requestOtp = async () => {
    setBusy(true); setError('');
    try {
      await fetch('/api/agent/otp/request', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });
      setStep('code');
    } finally { setBusy(false); }
  };

  const verify = async () => {
    setBusy(true); setError('');
    try {
      const r = await fetch('/api/agent/otp/verify', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, code }),
      });
      const j = await r.json();
      if (!r.ok) { setError(j.error || 'Code invalide'); return; }
      onAuthed(j.agent);
    } finally { setBusy(false); }
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <h1 className="mb-1 text-center font-display text-2xl font-bold text-slate-900">Espace agents</h1>
      <p className="mb-6 text-center text-sm text-slate-500">TWINSK Gabon</p>

      {step === 'phone' ? (
        <div className="space-y-3 rounded-3xl border border-slate-200 bg-white p-6">
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-700"><Smartphone className="h-4 w-4" /> Votre numéro WhatsApp</label>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel"
            placeholder="+241 ..." className="w-full rounded-xl border border-slate-300 px-4 py-3 text-lg" />
          <button onClick={requestOtp} disabled={busy || phone.replace(/\D/g, '').length < 6}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-5 py-3 font-semibold text-white disabled:opacity-50">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Recevoir le code
          </button>
        </div>
      ) : (
        <div className="space-y-3 rounded-3xl border border-slate-200 bg-white p-6">
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-700"><KeyRound className="h-4 w-4" /> Code reçu par WhatsApp</label>
          <input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            inputMode="numeric" placeholder="123456" className="w-full rounded-xl border border-slate-300 px-4 py-3 text-center text-2xl tracking-[0.4em]" />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button onClick={verify} disabled={busy || code.length !== 6}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-5 py-3 font-semibold text-white disabled:opacity-50">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Se connecter
          </button>
          <button onClick={() => setStep('phone')} className="w-full text-center text-xs text-slate-400">Changer de numéro</button>
        </div>
      )}
      <p className="mt-4 text-center text-xs text-slate-400">Accès réservé aux agents autorisés.</p>
    </div>
  );
}
