'use client';

import { AnimatePresence, motion } from 'framer-motion';
import {
  Check,
  Loader2,
  Plus,
  Send,
  ShoppingBag,
  Sparkles,
  Tag,
  X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import SmartImage from '@/components/ui/SmartImage';
import ImageGallery from '@/components/ui/ImageGallery';
import { VideoEmbed } from '@/components/ui/VideoEmbed';
import MultiCurrencyPrice from '@/components/ui/MultiCurrencyPrice';
import { toMultiCurrency } from '@/lib/utils/formatCurrency';
import { shortenTitle, splitCategoryTitle } from '@/lib/utils/shortenTitle';
import { BatteryWarning, Info, LayoutGrid, List as ListIcon, Package, Ruler, Scale } from 'lucide-react';

const formatFCFA = (cny: number) => toMultiCurrency(cny).formatted.xaf;
// Prix affiché : montant FCFA, ou « Sur devis » quand le prix est masqué (null).
const priceLabel = (cny: number | null | undefined) =>
  cny == null ? 'Sur devis' : formatFCFA(cny);

interface OfferVariant {
  id: string;
  name: string;
  image_url?: string | null;
  price: number | null;
  moq: number | null;
  weight: number | null;
  volume: number | null;
  dimensions: string | null;
  capacity: string | null;
}

interface OfferProduct {
  id: string;
  title: string;
  title_original: string | null;
  description: string | null;
  image_url: string;
  thumbnail_url: string;
  gallery: string[];
  detail_images: string[];
  videos: string[];
  price: number | null; // null = « sur devis »
  price_tiers: { min_qty: number; price: number }[] | null;
  variants_total: number | null;
  moq: number | null;
  weight: number | null;
  volume: number | null;
  dimensions: string | null;
  dimensions_cm: { length?: number | null; width?: number | null; height?: number | null } | null;
  has_battery: boolean;
  info_manquante: string | null;
  seller: string | null;
  variants: OfferVariant[] | null;
}

interface OfferItem {
  id: string;
  image_url: string | null;
  description: string | null;
  products: OfferProduct[];
}

interface Props {
  offerId: string;
  offer: {
    id: string;
    title: string;
    theme: string | null;
    description: string | null;
    cover_image_url: string | null;
    note: string | null; // meta.note — chapô/contexte
  };
  items: OfferItem[];
}

interface CartLine {
  productId: string;
  variantId: string | null;
  quantity: number;
}

export default function OfferPublicView({ offerId, offer, items }: Props) {
  const router = useRouter();
  const [cart, setCart] = useState<Record<string, CartLine>>({});
  const [activeProduct, setActiveProduct] = useState<OfferProduct | null>(null);
  const [selectedVariantForActive, setSelectedVariantForActive] = useState<
    string | null
  >(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('grid');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const cartLines = Object.values(cart).filter((l) => l.quantity > 0);
  const allProducts: OfferProduct[] = useMemo(
    () => items.flatMap((i) => i.products),
    [items],
  );

  const total = useMemo(() => {
    let cny = 0;
    let count = 0;
    let quoteCount = 0; // lignes « sur devis » (prix null) : comptées mais hors total chiffré
    for (const line of cartLines) {
      const p = allProducts.find((pp) => pp.id === line.productId);
      if (!p) continue;
      const variant = line.variantId
        ? p.variants?.find((v) => v.id === line.variantId)
        : null;
      const unit = variant && variant.price != null ? variant.price : p.price;
      count += line.quantity;
      if (unit == null) quoteCount += line.quantity;
      else cny += unit * line.quantity;
    }
    return { cny, count, quoteCount };
  }, [cartLines, allProducts]);

  const cartKey = (productId: string, variantId: string | null) =>
    `${productId}::${variantId || ''}`;

  const inCart = (productId: string, variantId: string | null) => {
    return !!cart[cartKey(productId, variantId)];
  };

  const updateCartLine = (
    productId: string,
    variantId: string | null,
    quantity: number,
  ) => {
    const key = cartKey(productId, variantId);
    setCart((prev) => {
      const next = { ...prev };
      if (quantity <= 0) {
        delete next[key];
      } else {
        next[key] = { productId, variantId, quantity };
      }
      return next;
    });
  };

  const openProduct = (p: OfferProduct) => {
    setActiveProduct(p);
    // Default-select the first variant if any in cart, else null
    const existing = Object.values(cart).find((l) => l.productId === p.id);
    setSelectedVariantForActive(existing?.variantId ?? null);
  };

  const addToCart = (p: OfferProduct) => {
    const variantId = selectedVariantForActive;
    if (p.variants && p.variants.length > 0 && !variantId) return;
    const existing = cart[cartKey(p.id, variantId)];
    const qty = existing ? existing.quantity + 1 : 1;
    updateCartLine(p.id, variantId, qty);
    setActiveProduct(null);
  };

  const submitOrder = async () => {
    if (!name.trim() || !phone.trim()) {
      setSubmitError('Nom et numéro WhatsApp requis');
      return;
    }
    if (!cartLines.length) {
      setSubmitError('Panier vide');
      return;
    }
    setSubmitting(true);
    setSubmitError('');
    try {
      const res = await fetch(`/api/offer-public/${offerId}/order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_name: name.trim(),
          client_phone: phone.trim(),
          client_email: email.trim() || undefined,
          picks: cartLines.map((l) => ({
            product_id: l.productId,
            variant_id: l.variantId,
            quantity: l.quantity,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.order_id) {
        setSubmitError(data?.error || 'Erreur enregistrement');
        return;
      }
      router.push(`/offer/${offerId}/order/${data.order_id}`);
    } catch {
      setSubmitError('Erreur réseau');
    } finally {
      setSubmitting(false);
    }
  };

  const variantOfActive = (p: OfferProduct | null, variantId: string | null) => {
    if (!p?.variants || !variantId) return null;
    return p.variants.find((v) => v.id === variantId) || null;
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
      {/* Sticky header with cart total */}
      <div className="sticky top-2 z-30 mb-6 flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur sm:px-6">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-green-500 text-white">
            <Sparkles className="h-4 w-4" />
          </div>
          <p className="truncate text-sm font-bold text-slate-900">{offer.title}</p>
          {offer.theme && (
            <span className="hidden sm:inline-flex flex-shrink-0 items-center gap-1 rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-semibold text-purple-700">
              <Tag className="h-2.5 w-2.5" />
              {offer.theme}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="hidden sm:flex items-center gap-0.5 rounded-lg border border-slate-200 bg-slate-50 p-0.5">
            <button
              type="button"
              onClick={() => setViewMode('list')}
              title="Vue liste"
              className={`flex h-7 w-7 items-center justify-center rounded transition-colors ${
                viewMode === 'list'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <ListIcon className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              title="Vue grille"
              className={`flex h-7 w-7 items-center justify-center rounded transition-colors ${
                viewMode === 'grid'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
          </div>
          <motion.button
            type="button"
            onClick={() => setCheckoutOpen(true)}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            disabled={!cartLines.length}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-green-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-500/25 disabled:opacity-50"
          >
            <ShoppingBag className="h-4 w-4" />
            {total.count > 0
              ? `${total.count} · ${total.cny > 0 ? formatFCFA(total.cny) : 'sur devis'}`
              : 'Panier'}
          </motion.button>
        </div>
      </div>

      {/* Cover hero */}
      <div className="relative mb-8 overflow-hidden rounded-3xl border border-slate-200 bg-slate-900">
        {offer.cover_image_url ? (
          <>
            <SmartImage
              src={offer.cover_image_url}
              alt={offer.theme || offer.title}
              className="h-64 w-full object-cover sm:h-80"
            />
            {/* Dark gradient overlay for legibility */}
            <div className="absolute inset-0 bg-gradient-to-b from-slate-900/60 via-slate-900/20 to-slate-900/85" />
          </>
        ) : (
          <div className="relative h-56 w-full bg-gradient-to-br from-emerald-600 via-emerald-500 to-green-500 sm:h-72">
            <div
              aria-hidden
              className="absolute inset-0 opacity-30"
              style={{
                backgroundImage:
                  'radial-gradient(circle at 30% 30%, white 1px, transparent 0), radial-gradient(circle at 70% 60%, white 1px, transparent 0)',
                backgroundSize: '40px 40px, 60px 60px',
              }}
            />
          </div>
        )}

        {/* Overlay content */}
        <div className="absolute inset-x-0 bottom-0 p-6 sm:p-8">
          {offer.theme && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500 px-3 py-1 text-xs font-bold uppercase tracking-wider text-white shadow-lg">
              <Tag className="h-3 w-3" />
              {offer.theme}
            </span>
          )}
          <h1 className="mt-3 font-display text-3xl font-bold uppercase tracking-tight text-white drop-shadow-lg sm:text-4xl lg:text-5xl">
            {offer.theme || offer.title}
          </h1>
          {offer.theme && (
            <p className="mt-1 text-base font-medium text-white/85 sm:text-lg">
              {offer.title}
            </p>
          )}
          {offer.description && (
            <p className="mt-3 max-w-2xl text-sm text-white/90 sm:text-base">
              {offer.description}
            </p>
          )}
        </div>
      </div>

      {/* Note de contexte / analyse (meta.note) */}
      {offer.note && (
        <div className="mx-auto mt-4 max-w-4xl px-4">
          <div className="whitespace-pre-wrap rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {offer.note}
          </div>
        </div>
      )}

      {/* Categories */}
      <div className="space-y-10">
        {items.map((item) => {
          const { short: catShort, rest: catRest } = splitCategoryTitle(item.description);
          return (
          <section key={item.id}>
            <div className="mb-4">
              <h2 className="font-display text-xl font-bold text-slate-900">
                {catShort || 'Produits'}
              </h2>
              {catRest && (
                <p className="mt-1 line-clamp-2 max-w-3xl text-sm text-slate-500">
                  {catRest}
                </p>
              )}
              <p className="mt-1 text-xs text-slate-400">
                {item.products.length} produit(s) disponible(s)
              </p>
            </div>
            {viewMode === 'grid' ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {item.products.map((p) => {
                  const lineCount = Object.values(cart).filter((l) => l.productId === p.id).length;
                  const hasVariants = !!p.variants && p.variants.length > 0;
                  return (
                    <motion.button
                      type="button"
                      key={p.id}
                      layout
                      whileHover={{ y: -2 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => openProduct(p)}
                      className={`group relative flex flex-col overflow-hidden rounded-2xl border-2 bg-white text-left transition-all hover:border-emerald-400 ${
                        lineCount > 0 ? 'border-emerald-500 shadow-lg shadow-emerald-500/10' : 'border-slate-200'
                      }`}
                    >
                      <div className="relative aspect-square w-full overflow-hidden bg-slate-100">
                        <SmartImage
                          src={p.image_url}
                          fallbackSrc={p.thumbnail_url}
                          alt={p.title}
                          className="h-full w-full object-cover transition-transform group-hover:scale-105"
                        />
                        {p.has_battery && (
                          <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-orange-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white shadow-lg">
                            <BatteryWarning className="h-2.5 w-2.5" />
                            Batterie
                          </span>
                        )}
                        {lineCount > 0 && (
                          <span className="absolute right-2 top-2 inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-emerald-500 px-2 text-xs font-bold text-white shadow-lg">
                            {lineCount}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-1 flex-col p-3">
                        <p
                          className="line-clamp-2 min-h-[2.5rem] text-sm font-semibold text-slate-900"
                          title={p.title}
                        >
                          {shortenTitle(p.title, 5)}
                        </p>
                        {hasVariants && (
                          <span className="mt-1 inline-flex w-fit items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                            {p.variants!.length} variantes
                          </span>
                        )}
                        <div className="mt-2 flex items-baseline justify-between">
                          <p className="text-base font-bold text-emerald-600">
                            {priceLabel(p.price)}
                          </p>
                          {p.moq != null && (
                            <p className="text-[10px] text-slate-500">MOQ {p.moq}</p>
                          )}
                        </div>
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                <ul className="divide-y divide-slate-100">
                  {item.products.map((p) => {
                    const lineCount = Object.values(cart).filter((l) => l.productId === p.id).length;
                    const hasVariants = !!p.variants && p.variants.length > 0;
                    return (
                      <li key={p.id}>
                        <motion.button
                          type="button"
                          layout
                          whileTap={{ scale: 0.995 }}
                          onClick={() => openProduct(p)}
                          className={`flex w-full items-center gap-3 p-3 text-left transition-colors hover:bg-emerald-50 ${
                            lineCount > 0 ? 'bg-emerald-50/40' : 'bg-white'
                          }`}
                        >
                          <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-xl bg-slate-100">
                            <SmartImage
                              src={p.image_url}
                              fallbackSrc={p.thumbnail_url}
                              alt={p.title}
                              className="h-full w-full object-cover"
                            />
                            {lineCount > 0 && (
                              <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-500 px-1 text-[10px] font-bold text-white shadow">
                                {lineCount}
                              </span>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p
                                className="line-clamp-1 text-sm font-semibold text-slate-900"
                                title={p.title}
                              >
                                {shortenTitle(p.title)}
                              </p>
                              {p.has_battery && (
                                <span className="inline-flex flex-shrink-0 items-center gap-1 rounded-full bg-orange-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-orange-700">
                                  <BatteryWarning className="h-2.5 w-2.5" />
                                  Batterie
                                </span>
                              )}
                            </div>
                            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-500">
                              {hasVariants && (
                                <span className="font-semibold text-slate-700">{p.variants!.length} variantes</span>
                              )}
                              {p.moq != null && <span>MOQ {p.moq}</span>}
                              {p.weight != null && <span>{p.weight} kg</span>}
                            </div>
                          </div>
                          <div className="flex-shrink-0 text-right">
                            <p className="text-sm font-bold text-emerald-600">
                              {priceLabel(p.price)}
                            </p>
                            <p className="mt-0.5 text-[10px] text-emerald-600/70">
                              Voir détails →
                            </p>
                          </div>
                        </motion.button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </section>
          );
        })}
      </div>

      {/* Product modal */}
      <AnimatePresence>
        {activeProduct && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setActiveProduct(null)}
            className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/70 p-4 backdrop-blur-sm"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="my-8 w-full max-w-xl overflow-hidden rounded-3xl bg-white shadow-2xl"
            >
              <div className="relative">
                {(() => {
                  const baseGallery = activeProduct.gallery.length
                    ? activeProduct.gallery
                    : [activeProduct.image_url];
                  const variantImg = variantOfActive(activeProduct, selectedVariantForActive)?.image_url || null;
                  const images = variantImg
                    ? [variantImg, ...baseGallery.filter((u) => u !== variantImg)]
                    : baseGallery;
                  return (
                    <ImageGallery
                      key={variantImg || 'base'}
                      images={images}
                      alt={activeProduct.title}
                    />
                  );
                })()}
                <button
                  type="button"
                  onClick={() => setActiveProduct(null)}
                  className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-slate-700 shadow-lg backdrop-blur"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-5 p-5">
                <div>
                  <h2 className="font-display text-lg font-bold text-slate-900 sm:text-xl">
                    {activeProduct.title}
                  </h2>
                  {activeProduct.title_original && (
                    <p className="mt-1 text-xs italic text-slate-400">{activeProduct.title_original}</p>
                  )}
                </div>

                {(() => {
                  const effective =
                    variantOfActive(activeProduct, selectedVariantForActive)?.price ??
                    activeProduct.price;
                  return effective == null ? (
                    <p className="inline-flex items-center rounded-xl bg-slate-100 px-3 py-1.5 text-lg font-bold text-slate-700">
                      Sur devis
                    </p>
                  ) : (
                    <MultiCurrencyPrice amountCny={effective} variant="large" primary="XAF" />
                  );
                })()}

                {/* Paliers de prix par quantité (v3.1) */}
                {activeProduct.price_tiers && activeProduct.price_tiers.length > 0 && (
                  <div className="overflow-hidden rounded-2xl border border-slate-200">
                    <p className="border-b border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Prix par quantité
                    </p>
                    <table className="w-full text-sm">
                      <tbody className="divide-y divide-slate-100">
                        {activeProduct.price_tiers.map((t) => (
                          <tr key={t.min_qty}>
                            <td className="px-4 py-2 text-slate-600">≥ {t.min_qty} pcs</td>
                            <td className="px-4 py-2 text-right font-semibold text-emerald-600">
                              {formatFCFA(t.price)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {activeProduct.has_battery && (
                  <div className="flex items-start gap-2 rounded-xl border-2 border-orange-300 bg-orange-50 px-3 py-2.5 text-sm text-orange-800">
                    <BatteryWarning className="mt-0.5 h-4 w-4 flex-shrink-0" />
                    <div>
                      <p className="font-bold">Produit avec batterie</p>
                      <p className="text-xs text-orange-700">
                        Contraintes de transport aérien (tarif majoré) et documents
                        douaniers spécifiques.
                      </p>
                    </div>
                  </div>
                )}

                {activeProduct.description && (
                  <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
                    {activeProduct.description}
                  </div>
                )}

                {/* Détails techniques (v3.1) — galerie secondaire, distincte de la principale */}
                {activeProduct.detail_images.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Détails techniques
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                      {activeProduct.detail_images.map((src) => (
                        <a
                          key={src}
                          href={src}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block overflow-hidden rounded-lg border border-slate-200 bg-slate-50"
                        >
                          <SmartImage
                            src={src}
                            fallbackSrc={src}
                            alt="Détail technique"
                            className="h-24 w-full object-cover transition-transform hover:scale-105"
                          />
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {activeProduct.videos.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      {activeProduct.videos.length > 1 ? 'Vidéos' : 'Vidéo'}
                    </p>
                    <div className="space-y-2">
                      {activeProduct.videos.map((v) => (
                        <VideoEmbed key={v} url={v} />
                      ))}
                    </div>
                  </div>
                )}

                {/* Logistique */}
                {(activeProduct.weight != null ||
                  activeProduct.volume != null ||
                  activeProduct.dimensions ||
                  activeProduct.dimensions_cm) && (
                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                      <Package className="h-3.5 w-3.5" />
                      Logistique
                    </p>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      {activeProduct.weight != null && (
                        <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2">
                          <Scale className="h-4 w-4 text-slate-400" />
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                              Poids
                            </p>
                            <p className="font-medium text-slate-900">
                              {activeProduct.weight} kg
                            </p>
                          </div>
                        </div>
                      )}
                      {activeProduct.volume != null && (
                        <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2">
                          <Package className="h-4 w-4 text-slate-400" />
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                              CBM
                            </p>
                            <p className="font-medium text-slate-900">
                              {activeProduct.volume.toFixed(4)} m³
                            </p>
                          </div>
                        </div>
                      )}
                      {(activeProduct.dimensions || activeProduct.dimensions_cm) && (
                        <div className="col-span-2 flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2">
                          <Ruler className="h-4 w-4 text-slate-400" />
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                              Dimensions
                            </p>
                            <p className="font-medium text-slate-900">
                              {activeProduct.dimensions ||
                                (activeProduct.dimensions_cm
                                  ? `${activeProduct.dimensions_cm.length ?? '?'}×${activeProduct.dimensions_cm.width ?? '?'}×${activeProduct.dimensions_cm.height ?? '?'} cm`
                                  : '—')}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {activeProduct.info_manquante && (
                  <p className="flex items-start gap-1.5 text-xs italic text-slate-500">
                    <Info className="mt-0.5 h-3 w-3 flex-shrink-0" />
                    À confirmer : {activeProduct.info_manquante}
                  </p>
                )}

                {/* Variants */}
                {activeProduct.variants && activeProduct.variants.length > 0 && (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4">
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-emerald-700">
                      Choisissez une variante
                    </p>
                    {activeProduct.variants_total != null &&
                      activeProduct.variants_total > activeProduct.variants.length && (
                        <p className="mb-3 text-xs text-slate-500">
                          {activeProduct.variants_total} variantes disponibles — échantillon représentatif affiché
                        </p>
                      )}
                    <div className="space-y-2">
                      {activeProduct.variants.map((v) => {
                        const active = v.id === selectedVariantForActive;
                        return (
                          <button
                            key={v.id || v.name}
                            type="button"
                            onClick={() =>
                              setSelectedVariantForActive(active ? null : v.id)
                            }
                            className={`block w-full rounded-xl border-2 p-3 text-left text-sm transition-all ${
                              active
                                ? 'border-emerald-500 bg-emerald-100 ring-2 ring-emerald-200'
                                : 'border-emerald-200/60 bg-white hover:border-emerald-400 hover:bg-emerald-50'
                            }`}
                          >
                            <div className="mb-1 flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 font-semibold text-slate-900">
                                {v.image_url ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={v.image_url}
                                    alt={v.name}
                                    className="h-10 w-10 flex-shrink-0 rounded-md object-cover ring-1 ring-emerald-200"
                                  />
                                ) : null}
                                {active && <Check className="h-4 w-4 text-emerald-600" />}
                                <span>{v.name}</span>
                              </div>
                              {v.price != null ? (
                                <MultiCurrencyPrice amountCny={v.price} variant="stacked" primary="XAF" />
                              ) : (
                                <span className="whitespace-nowrap text-xs font-semibold text-slate-500">
                                  Sur devis
                                </span>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
                              {v.moq != null && <span>MOQ : {v.moq}</span>}
                              {v.capacity && <span>Capacité : {v.capacity}</span>}
                              {v.weight != null && <span>Poids : {v.weight} kg</span>}
                              {v.volume != null && <span>Vol : {v.volume} m³</span>}
                              {v.dimensions && <span>Dim : {v.dimensions}</span>}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {(() => {
                  const needsVariant =
                    !!activeProduct.variants &&
                    activeProduct.variants.length > 0 &&
                    !selectedVariantForActive;
                  const existing = inCart(activeProduct.id, selectedVariantForActive);
                  return (
                    <motion.button
                      type="button"
                      onClick={() => addToCart(activeProduct)}
                      disabled={needsVariant}
                      whileHover={!needsVariant ? { scale: 1.02 } : undefined}
                      whileTap={!needsVariant ? { scale: 0.98 } : undefined}
                      className={`flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3.5 text-base font-semibold transition-colors ${
                        needsVariant
                          ? 'cursor-not-allowed bg-slate-100 text-slate-400'
                          : existing
                            ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/25 hover:bg-emerald-600'
                            : 'border-2 border-emerald-400 bg-white text-emerald-700 hover:bg-emerald-50'
                      }`}
                    >
                      {needsVariant ? (
                        <>Choisissez d&apos;abord une variante</>
                      ) : existing ? (
                        <>
                          <Plus className="h-5 w-5" />
                          Ajouter encore +1
                        </>
                      ) : (
                        <>
                          <ShoppingBag className="h-5 w-5" />
                          Ajouter au panier
                        </>
                      )}
                    </motion.button>
                  );
                })()}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cart / checkout modal */}
      <AnimatePresence>
        {checkoutOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => !submitting && setCheckoutOpen(false)}
            className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/70 p-4 backdrop-blur-sm"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="my-8 w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                <h2 className="flex items-center gap-2 font-display text-lg font-bold text-slate-900">
                  <ShoppingBag className="h-5 w-5 text-emerald-500" />
                  Valider mon panier
                </h2>
                <button
                  type="button"
                  onClick={() => setCheckoutOpen(false)}
                  disabled={submitting}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-4 p-5">
                {/* Cart lines */}
                {cartLines.length === 0 ? (
                  <p className="rounded-xl bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
                    Votre panier est vide.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {cartLines.map((line) => {
                      const p = allProducts.find((pp) => pp.id === line.productId);
                      if (!p) return null;
                      const variant = line.variantId
                        ? p.variants?.find((v) => v.id === line.variantId)
                        : null;
                      const unit = variant && variant.price != null ? variant.price : p.price;
                      const key = cartKey(line.productId, line.variantId);
                      return (
                        <div
                          key={key}
                          className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3"
                        >
                          <div className="h-14 w-14 flex-shrink-0 overflow-hidden rounded-lg bg-slate-100">
                            <SmartImage
                              src={p.image_url}
                              fallbackSrc={p.thumbnail_url}
                              alt={p.title}
                              className="h-full w-full object-cover"
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-slate-900" title={p.title}>{shortenTitle(p.title)}</p>
                            {variant && (
                              <p className="text-xs text-emerald-600">{variant.name}</p>
                            )}
                            <p className="text-xs text-slate-500">
                              {unit == null ? 'Sur devis' : `${formatFCFA(unit)} × ${line.quantity}`}
                            </p>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <p className="text-sm font-bold text-emerald-600">
                              {unit == null ? 'Sur devis' : formatFCFA(unit * line.quantity)}
                            </p>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() =>
                                  updateCartLine(line.productId, line.variantId, line.quantity - 1)
                                }
                                className="flex h-6 w-6 items-center justify-center rounded bg-slate-100 text-slate-700 hover:bg-slate-200"
                              >
                                −
                              </button>
                              <span className="w-6 text-center text-xs font-semibold">{line.quantity}</span>
                              <button
                                type="button"
                                onClick={() =>
                                  updateCartLine(line.productId, line.variantId, line.quantity + 1)
                                }
                                className="flex h-6 w-6 items-center justify-center rounded bg-slate-100 text-slate-700 hover:bg-slate-200"
                              >
                                +
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Total */}
                {cartLines.length > 0 && (
                  <div className="flex items-center justify-between rounded-xl bg-emerald-50 px-4 py-3">
                    <div>
                      <p className="text-sm font-semibold text-emerald-700">Total panier</p>
                      {total.quoteCount > 0 && (
                        <p className="text-xs text-slate-500">
                          + {total.quoteCount} article{total.quoteCount > 1 ? 's' : ''} sur devis
                        </p>
                      )}
                    </div>
                    {total.cny > 0 ? (
                      <MultiCurrencyPrice amountCny={total.cny} variant="stacked" primary="XAF" />
                    ) : (
                      <p className="text-sm font-bold text-slate-700">Sur devis</p>
                    )}
                  </div>
                )}

                {/* Customer form */}
                <div className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Vos coordonnées
                  </p>
                  <input
                    type="text"
                    placeholder="Votre nom complet *"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                  />
                  <input
                    type="tel"
                    placeholder="Numéro WhatsApp (avec indicatif +241 / +242…) *"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                  />
                  <input
                    type="email"
                    placeholder="Email (optionnel)"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                  />
                </div>

                {submitError && (
                  <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{submitError}</p>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-4">
                <button
                  type="button"
                  onClick={() => setCheckoutOpen(false)}
                  disabled={submitting}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
                >
                  Continuer mes achats
                </button>
                <motion.button
                  type="button"
                  onClick={submitOrder}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  disabled={submitting || cartLines.length === 0}
                  className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-green-500 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-500/25 disabled:opacity-60"
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Valider et choisir le transport
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
