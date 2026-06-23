import type { Metadata } from 'next';
import ParcoursExperience from '@/components/parcours/ParcoursExperience';

export const metadata: Metadata = {
  title: 'Le parcours d’un colis — TWINSK',
  description:
    'Suivez le voyage d’un colis TWINSK, de l’usine chinoise jusqu’à la livraison à Libreville. Sourcing & logistique Chine → Afrique.',
};

export default function ParcoursPage() {
  return <ParcoursExperience />;
}
