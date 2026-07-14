'use client';

import OffersListPage from '@/components/admin/OffersListPage';

// Offres B2C — même moteur que /admin/offer-b2b (composant partagé).
export default function AdminOfferListPage() {
  return <OffersListPage type="b2c" />;
}
