'use client';
import { useCallback, useEffect, useState } from 'react';
import { Loader2, Plus, UserCheck, UserX } from 'lucide-react';

type Agent = { id: string; name: string; phone: string; active: boolean; created_at: string };

export default function AdminAgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try { const r = await fetch('/api/admin/agents'); const j = await r.json(); setAgents(j.agents || []); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const add = async () => {
    setBusy(true); setError('');
    try {
      const r = await fetch('/api/admin/agents', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone }),
      });
      const j = await r.json();
      if (!r.ok) { setError(j.error || 'Erreur'); return; }
      setName(''); setPhone(''); await load();
    } finally { setBusy(false); }
  };

  const toggle = async (a: Agent) => {
    await fetch(`/api/admin/agents/${a.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !a.active }),
    });
    await load();
  };

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="mb-1 font-display text-2xl font-bold text-slate-900">Agents Gabon</h1>
      <p className="mb-6 text-sm text-slate-500">Lien de connexion agents : <code>/agent</code></p>

      <div className="mb-6 flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-4">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom"
          className="flex-1 rounded-xl border border-slate-300 px-3 py-2" />
        <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Numéro WhatsApp"
          className="flex-1 rounded-xl border border-slate-300 px-3 py-2" />
        <button onClick={add} disabled={busy}
          className="flex items-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-2 font-semibold text-white disabled:opacity-50">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Ajouter
        </button>
        {error && <p className="w-full text-sm text-red-600">{error}</p>}
      </div>

      {loading ? <Loader2 className="mx-auto h-6 w-6 animate-spin text-emerald-500" /> : (
        <ul className="space-y-2">
          {agents.map((a) => (
            <li key={a.id} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4">
              <div>
                <p className="font-semibold text-slate-900">{a.name}</p>
                <p className="text-sm text-slate-500">{a.phone}</p>
              </div>
              <button onClick={() => toggle(a)}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold ${a.active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                {a.active ? <><UserCheck className="h-4 w-4" /> Actif</> : <><UserX className="h-4 w-4" /> Inactif</>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
