import AgentApp from '@/components/agent/AgentApp';
import { COUNTRY } from '@/config/countries';

export const metadata = { title: `${COUNTRY.senderName} — Espace agents` };

export default function AgentPage() {
  return (
    <main className="min-h-screen bg-slate-50">
      <AgentApp />
    </main>
  );
}
