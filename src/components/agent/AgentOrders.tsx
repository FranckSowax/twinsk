'use client';
export default function AgentOrders({ agent, onLogout }: { agent: { id: string; name: string }; onLogout: () => void }) {
  return <div className="p-6">Connecté : {agent.name} <button onClick={onLogout}>Déconnexion</button></div>;
}
