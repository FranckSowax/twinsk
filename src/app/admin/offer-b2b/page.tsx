'use client';

import OffersListPage from '@/components/admin/OffersListPage';

// Offres B2B (professionnels) — mêmes fonctionnalités que /admin/offer,
// seules les offres de type b2b sont listées/créées ici.
export default function AdminOfferB2BListPage() {
  return <OffersListPage type="b2b" />;
}
