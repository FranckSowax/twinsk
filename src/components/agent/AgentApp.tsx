'use client';
import { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import AgentLogin from './AgentLogin';
import AgentOrders from './AgentOrders';

type Agent = { id: string; name: string };

export default function AgentApp() {
  const [agent, setAgent] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/agent/me');
      const j = await r.json();
      setAgent(j.agent ?? null);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  const logout = useCallback(async () => {
    await fetch('/api/agent/logout', { method: 'POST' });
    setAgent(null);
  }, []);

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-emerald-500" /></div>;
  }
  if (!agent) return <AgentLogin onAuthed={setAgent} />;
  return <AgentOrders agent={agent} onLogout={logout} />;
}
