'use client';

// Options d'un <select> de catalogues, rangées en deux groupes : B2C puis B2B.

import { groupOffersByKind } from '@/lib/offer-groups';

export default function OfferOptions<T extends { id: string; title: string; offer_type?: string | null }>({
  offers,
  label,
}: {
  offers: T[];
  /** Texte de l'option (défaut : le titre). */
  label?: (o: T) => string;
}) {
  return (
    <>
      {groupOffersByKind(offers).map((g) => (
        <optgroup key={g.kind} label={g.label}>
          {g.items.map((o) => (
            <option key={o.id} value={o.id}>
              {label ? label(o) : o.title}
            </option>
          ))}
        </optgroup>
      ))}
    </>
  );
}
