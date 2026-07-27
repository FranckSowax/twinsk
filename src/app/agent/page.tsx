import AgentApp from '@/components/agent/AgentApp';

export const metadata = { title: 'TWINSK — Espace agents' };

export default function AgentPage() {
  return (
    <main className="min-h-screen bg-slate-50">
      <AgentApp />
    </main>
  );
}
