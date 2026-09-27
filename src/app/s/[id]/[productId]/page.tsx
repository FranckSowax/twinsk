'use client';

// Cible du bouton « Ajouter au panier » d'une sélection WhatsApp.
// L'ajout se fait par un POST déclenché dans le navigateur (et non au simple
// chargement de l'adresse) : un robot qui ouvrirait le lien sans exécuter la
// page n'ajoute rien. Puis direction la page commande : produit + transport.

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { writeStoredOrderId } from '@/lib/offer-cart-session';

export default function SelectionAddPage() {
  const { id, productId } = useParams<{ id: string; productId: string }>();
  const router = useRouter();
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      const res = await fetch(`/api/selection/${id}/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_id: productId }),
      }).catch(() => null);
      const json = res ? await res.json().catch(() => ({})) : {};
      if (!alive) return;
      if (!res || !res.ok || !json.order_id) {
        setError(json.error || 'Impossible d’ajouter ce produit pour le moment.');
        return;
      }
      writeStoredOrderId(json.offer_id, json.order_id); // le panier suit le client sur le listing
      router.replace(`/offer/${json.offer_id}/order/${json.order_id}`);
    })();
    return () => { alive = false; };
  }, [id, productId, router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
      {error ? (
        <div className="max-w-sm text-center">
          <p className="text-lg font-semibold text-slate-900">Ajout impossible</p>
          <p className="mt-2 text-sm text-slate-600">{error}</p>
          <p className="mt-4 text-sm text-slate-600">Répondez-nous directement sur WhatsApp, nous l’ajoutons pour vous.</p>
        </div>
      ) : (
        <div className="text-center">
          <div className="mx-auto h-9 w-9 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
          <p className="mt-4 text-sm font-medium text-slate-700">Ajout au panier…</p>
        </div>
      )}
    </main>
  );
}
