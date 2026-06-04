'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Image from 'next/image';
import {
  AlertTriangle,
  Battery,
  ExternalLink,
  Mail,
  MapPin,
  Package,
  Phone,
  Printer,
  Ruler,
  Scale,
  ShoppingBag,
  User,
} from 'lucide-react';

interface ChosenVariant {
  id: string;
  name: string;
  image_url: string | null;
  price: number | null;
  moq: number | null;
  weight: number | null;
  volume: number | null;
  dimensions: string | null;
  capacity: string | null;
}

interface OrderProduct {
  id: string;
  source: string;
  title: string;
  title_original: string | null;
  description: string | null;
  image_url: string;
  extra_images: string[];
  videos: string[];
  price_cny: number;
  quantity: number;
  moq: number | null;
  weight: number | null;
  volume: number | null;
  dimensions: string | null;
  dimensions_cm: { length?: number | null; width?: number | null; height?: number | null } | null;
  has_battery: boolean;
  info_manquante: string | null;
  seller: string | null;
  product_url: string | null;
  chosen_variant: ChosenVariant | null;
}

interface OrderNote {
  id: string;
  author: string;
  message: string | null;
  media_urls: string[] | null;
  created_at: string;
}

interface OrderItem {
  id: string;
  image_url: string | null;
  description: string | null;
  client_note: string | null;
  selection_source: 'client' | 'admin' | 'none';
  notes: OrderNote[];
  products: OrderProduct[];
}

interface OrderSummary {
  request: {
    id: string;
    client_name: string | null;
    client_email: string | null;
    client_phone: string | null;
    destination: string | null;
    status: string;
    notes: string | null;
    created_at: string;
    proposal_currency: string;
  };
  items: OrderItem[];
  totals: {
    product_count: number;
    total_quantity: number;
    total_weight_kg: number;
    total_volume_m3: number;
    has_battery_any: boolean;
    items_with_missing_info: {
      id: string;
      title: string;
      reason: string;
      seller: string | null;
      product_url: string | null;
    }[];
  };
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

export default function OrderSummaryPage() {
  const params = useParams();
  const uuid = params?.uuid as string;
  const [data, setData] = useState<OrderSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!uuid) return;
    let active = true;
    (async () => {
      try {
        const res = await fetch(`/api/order-summary/${uuid}`);
        const json = await res.json();
        if (!active) return;
        if (!res.ok) {
          setError(json.error || 'Erreur de chargement');
        } else {
          setData(json);
        }
      } catch {
        if (active) setError('Erreur réseau');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [uuid]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="rounded-2xl bg-white p-8 text-center shadow-lg">
          <p className="text-lg font-semibold text-slate-900">Commande introuvable</p>
          <p className="mt-2 text-sm text-slate-500">{error}</p>
        </div>
      </div>
    );
  }

  const { request, items, totals } = data;
  const missing = totals.items_with_missing_info;
  const shortRef = request.id.slice(0, 8).toUpperCase();

  return (
    <div className="min-h-screen bg-slate-50 pb-20 print:bg-white">
      <header className="border-b border-slate-200 bg-white print:hidden">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-6 py-4">
          <div>
            <p className="text-xs uppercase tracking-wider text-slate-500">Fiche commande collaborateur</p>
            <p className="text-lg font-semibold text-slate-900">TWK-{shortRef}</p>
          </div>
          <button
            type="button"
            onClick={() => window.print()}
            className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <Printer className="h-4 w-4" />
            Imprimer
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 px-6 py-8 print:px-0 print:py-4">
        <section className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
              <User className="h-3.5 w-3.5" /> Client
            </p>
            <p className="text-base font-semibold text-slate-900">
              {request.client_name || '—'}
            </p>
            <div className="mt-3 space-y-1.5 text-sm text-slate-600">
              {request.client_email && (
                <p className="flex items-center gap-2">
                  <Mail className="h-3.5 w-3.5 text-slate-400" />
                  <a href={`mailto:${request.client_email}`} className="hover:text-amber-600">
                    {request.client_email}
                  </a>
                </p>
              )}
              {request.client_phone && (
                <p className="flex items-center gap-2">
                  <Phone className="h-3.5 w-3.5 text-slate-400" />
                  <a href={`tel:${request.client_phone}`} className="hover:text-amber-600">
                    {request.client_phone}
                  </a>
                </p>
              )}
              {request.destination && (
                <p className="flex items-center gap-2">
                  <MapPin className="h-3.5 w-3.5 text-emerald-500" />
                  <span className="font-medium text-emerald-700">{request.destination}</span>
                </p>
              )}
            </div>
            <p className="mt-3 text-xs text-slate-400">
              Demande créée le {formatDate(request.created_at)} — statut : {request.status}
            </p>
            {request.notes && (
              <div className="mt-3 rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
                <p className="mb-1 font-semibold uppercase tracking-wider text-slate-500">Notes admin</p>
                {request.notes}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
              <ShoppingBag className="h-3.5 w-3.5" /> Synthèse commande
            </p>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-[10px] uppercase tracking-wider text-slate-400">Produits</p>
                <p className="text-xl font-bold text-slate-900">{totals.product_count}</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-[10px] uppercase tracking-wider text-slate-400">Qté totale</p>
                <p className="text-xl font-bold text-slate-900">{totals.total_quantity}</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-[10px] uppercase tracking-wider text-slate-400">Poids estimé</p>
                <p className="text-xl font-bold text-slate-900">
                  {totals.total_weight_kg > 0 ? `${totals.total_weight_kg} kg` : '—'}
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-[10px] uppercase tracking-wider text-slate-400">Volume (CBM)</p>
                <p className="text-xl font-bold text-slate-900">
                  {totals.total_volume_m3 > 0 ? `${totals.total_volume_m3} m³` : '—'}
                </p>
              </div>
            </div>
            {totals.has_battery_any && (
              <div className="mt-3 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                <Battery className="h-4 w-4" />
                Contient au moins un produit avec batterie — contraintes transport aérien.
              </div>
            )}
          </div>
        </section>

        {missing.length > 0 && (
          <section className="rounded-2xl border-2 border-rose-300 bg-rose-50 p-5 print:break-inside-avoid">
            <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-rose-800">
              <AlertTriangle className="h-4 w-4" />
              Infos manquantes — à demander aux fournisseurs ({missing.length})
            </p>
            <ul className="space-y-2">
              {missing.map((m) => (
                <li key={m.id} className="rounded-xl bg-white p-3 text-sm">
                  <p className="font-medium text-slate-900">{m.title}</p>
                  <p className="mt-1 text-xs text-rose-700">{m.reason}</p>
                  <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-600">
                    {m.seller && (
                      <span>
                        <span className="font-semibold">Fournisseur :</span> {m.seller}
                      </span>
                    )}
                    {m.product_url && (
                      <a
                        href={m.product_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-amber-700 hover:text-amber-900"
                      >
                        <ExternalLink className="h-3 w-3" />
                        Source produit
                      </a>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="space-y-5">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
            Produits commandés
          </h2>
          {items.map((item) => (
            <div
              key={item.id}
              className="rounded-2xl border border-slate-200 bg-white p-5 print:break-inside-avoid"
            >
              <div className="mb-4 flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  {item.image_url && (
                    <Image
                      src={item.image_url}
                      alt=""
                      width={56}
                      height={56}
                      className="h-14 w-14 rounded-xl object-cover"
                    />
                  )}
                  <div>
                    <p className="text-base font-semibold text-slate-900">
                      {item.description || 'Article'}
                    </p>
                    {item.selection_source === 'admin' && (
                      <p className="mt-1 text-xs text-amber-700">
                        ⚠ Sélection admin par défaut — le client n&apos;a pas encore validé son choix
                      </p>
                    )}
                    {item.selection_source === 'client' && (
                      <p className="mt-1 text-xs text-emerald-700">
                        ✓ Sélection finale du client
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {item.client_note && (
                <div className="mb-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-amber-700">
                    Note client
                  </p>
                  {item.client_note}
                </div>
              )}

              <div className="space-y-4">
                {item.products.map((p) => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </div>

              {item.notes.length > 0 && (
                <div className="mt-4 space-y-2 border-t border-slate-100 pt-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    Échanges ({item.notes.length})
                  </p>
                  {item.notes.map((n) => (
                    <div key={n.id} className="rounded-lg bg-slate-50 p-2 text-xs">
                      <p className="mb-0.5 text-slate-500">
                        <span className="font-semibold">{n.author === 'client' ? 'Client' : 'Admin'}</span>
                        {' · '}
                        {formatDate(n.created_at)}
                      </p>
                      {n.message && <p className="text-slate-700">{n.message}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}

function ProductCard({ product: p }: { product: OrderProduct }) {
  const variant = p.chosen_variant;
  const displayImage = variant?.image_url || p.image_url;
  const unitWeight = variant?.weight ?? p.weight;
  const unitVolume = variant?.volume ?? p.volume;
  const unitDims = variant?.dimensions ?? p.dimensions;
  const unitMoq = variant?.moq ?? p.moq;
  const unitPriceCny = variant?.price ?? p.price_cny;
  const totalPriceCny = unitPriceCny != null ? unitPriceCny * p.quantity : null;

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
      <div className="flex gap-4">
        {displayImage && (
          <Image
            src={displayImage}
            alt={p.title}
            width={96}
            height={96}
            className="h-24 w-24 flex-shrink-0 rounded-xl object-cover"
          />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-medium text-slate-900">{p.title}</p>
              {p.title_original && (
                <p className="mt-0.5 text-xs italic text-slate-400">{p.title_original}</p>
              )}
              {variant && (
                <p className="mt-1 inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                  Variante : {variant.name}
                </p>
              )}
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-wider text-slate-400">Quantité</p>
              <p className="text-2xl font-bold text-slate-900">×{p.quantity}</p>
            </div>
          </div>

          {p.info_manquante && (
            <div className="mt-2 flex items-start gap-1.5 rounded-lg bg-rose-50 px-2 py-1.5 text-xs text-rose-700">
              <AlertTriangle className="mt-0.5 h-3 w-3 flex-shrink-0" />
              <span>À confirmer : {p.info_manquante}</span>
            </div>
          )}

          <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
            {unitWeight != null ? (
              <div className="flex items-center gap-1.5 rounded-lg bg-white px-2 py-1.5">
                <Scale className="h-3 w-3 text-slate-400" />
                <span>{unitWeight} kg</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 rounded-lg bg-rose-50 px-2 py-1.5 text-rose-700">
                <Scale className="h-3 w-3" />
                <span>poids ?</span>
              </div>
            )}
            {unitVolume != null ? (
              <div className="flex items-center gap-1.5 rounded-lg bg-white px-2 py-1.5">
                <Package className="h-3 w-3 text-slate-400" />
                <span>{unitVolume} m³</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 rounded-lg bg-rose-50 px-2 py-1.5 text-rose-700">
                <Package className="h-3 w-3" />
                <span>volume ?</span>
              </div>
            )}
            {(unitDims || p.dimensions_cm) && (
              <div className="flex items-center gap-1.5 rounded-lg bg-white px-2 py-1.5">
                <Ruler className="h-3 w-3 text-slate-400" />
                <span>
                  {unitDims ||
                    `${p.dimensions_cm?.length ?? '?'}×${p.dimensions_cm?.width ?? '?'}×${p.dimensions_cm?.height ?? '?'} cm`}
                </span>
              </div>
            )}
            {unitMoq != null && (
              <div className="flex items-center gap-1.5 rounded-lg bg-white px-2 py-1.5">
                <ShoppingBag className="h-3 w-3 text-slate-400" />
                <span>MOQ {unitMoq}</span>
              </div>
            )}
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-3">
            <div className="flex flex-wrap items-center gap-3 text-xs">
              {p.seller && (
                <span className="text-slate-600">
                  <span className="font-semibold">Fournisseur :</span> {p.seller}
                </span>
              )}
              {p.product_url && (
                <a
                  href={p.product_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-md bg-slate-900 px-2 py-1 text-white hover:bg-slate-700"
                >
                  <ExternalLink className="h-3 w-3" />
                  Source
                </a>
              )}
              <span className="rounded-md bg-slate-200 px-2 py-1 font-mono text-slate-700">
                {p.source}
              </span>
              {p.has_battery && (
                <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-1 text-amber-800">
                  <Battery className="h-3 w-3" />
                  Batterie
                </span>
              )}
            </div>
            {unitPriceCny != null && (
              <div className="text-right">
                <p className="text-[10px] uppercase tracking-wider text-slate-400">Prix unitaire (CNY)</p>
                <p className="text-sm font-semibold text-slate-900">¥{unitPriceCny.toFixed(2)}</p>
                {totalPriceCny != null && (
                  <p className="text-[10px] text-slate-500">Total : ¥{totalPriceCny.toFixed(2)}</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
