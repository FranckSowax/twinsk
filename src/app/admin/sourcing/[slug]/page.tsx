import type { Metadata } from 'next';
import { SourcingCockpit } from '@/components/sourcing/SourcingCockpit';

export const metadata: Metadata = {
  title: 'Cockpit de sourcing — Twinsk',
};

/**
 * Le cockpit charge ses données côté client, par les routes /api/sourcing gardées
 * par le cookie admin. Rien n'est lu ici en rendu serveur : les pages /admin sont
 * servies sans contrôle d'accès dans ce dépôt, et un rendu serveur mettrait prix
 * d'achat et coordonnées fournisseurs dans le HTML envoyé à n'importe qui.
 */
export default async function SourcingCockpitPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <SourcingCockpit slug={slug} />
    </div>
  );
}
