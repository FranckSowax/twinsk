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
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import SmartImage from '@/components/ui/SmartImage';
import ImageGallery from '@/components/ui/ImageGallery';
import MultiCurrencyPrice from '@/components/ui/MultiCurrencyPrice';
import { roundXafUp, formatXAF, formatCNY, formatUSD, formatEUR, formatInCurrency, convertFromCny, type CurrencyCode } from '@/lib/utils/formatCurrency';
import { shortenTitle, splitCategoryTitle } from '@/lib/utils/shortenTitle';
import { BatteryWarning, Info, LayoutGrid, List as ListIcon, Package, Ruler, Scale, Search, FileText } from 'lucide-react';
import { isAcompte, ACOMPTE_LABEL, ACOMPTE_BADGE } from '@/lib/acompte';

// Normalisation pour la recherche : minuscules + sans accents (« telephone » trouve « Téléphone »).
function normalizeSearch(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

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
  price_type?: string | null; // "acompte" (hérité du produit ou propre à la variante)
  price_note?: string | null;
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
  price: number | null; // prix produit exact (null = porté par paliers/variantes)
  from_price: number; // prix d'affichage « à partir de » (0 si « sur devis »)
  on_quote?: boolean; // true → « Sur devis » (prix à 0)
  price_type?: string | null; // "acompte" → montant = acompte usine, pas un prix de vente
  price_note?: string | null; // note affichée sous le prix / en infobulle
  in_cover_video?: boolean; // « Vu dans la vidéo » → badge rose fluo
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
  phase_id?: string | null;
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
    cover_video_url?: string | null; // cover vidéo mp4 (prioritaire)
    mobile_video_url?: string | null; // vidéo carrée 1:1 en tête sur mobile
    note: string | null; // meta.note — chapô/contexte
    currency?: CurrencyCode; // devise affichée (défaut XAF)
    offer_type?: 'b2c' | 'b2b'; // B2B → vue liste par défaut
  };
  items: OfferItem[];
  phases?: { id: string; title: string }[]; // phases B2B (regroupent des catégories)
  // Marque blanche : lien affilié (/b/[id]). ref = affiliate_offers.id, transmis
  // à la création de commande pour attribuer la vente ; shopName remplace le
  // branding du header.
  affiliate?: { ref: string; shopName: string };
}

interface CartLine {
  productId: string;
  variantId: string | null;
  quantity: number;
}

// Description de catégorie repliée à 2 lignes avec « Voir plus » (mobile surtout).
// Le bouton n'apparaît que si le texte déborde réellement du clamp.
function CategoryDescription({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const [clamped, setClamped] = useState(false);
  const ref = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const check = () => setClamped(el.scrollHeight > el.clientHeight + 1);
    check();
    // Re-mesure au redimensionnement (rotation mobile, resize desktop).
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [text]);

  return (
    <div className="max-w-3xl">
      <p ref={ref} className={`mt-1 text-sm text-slate-500 ${expanded ? '' : 'line-clamp-2'}`}>
        {text}
      </p>
      {(clamped || expanded) && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-0.5 text-xs font-semibold text-emerald-600 hover:underline"
        >
          {expanded ? 'Voir moins' : 'Voir plus'}
        </button>
      )}
    </div>
  );
}

export default function OfferPublicView({ offerId, offer, items, phases, affiliate }: Props) {
  const router = useRouter();
  // Devise affichée au client (défaut FCFA). Les autres devises restent en conversion (≈).
  const currency: CurrencyCode = offer.currency || 'XAF';
  const fmtPrice = (cny: number) => formatInCurrency(cny, currency);
  // Acompte : montant présenté comme « Acompte usine » (jamais comme prix de vente).
  const isAcompteLine = (p: OfferProduct, variant?: OfferVariant | null) =>
    isAcompte(p.price_type) || isAcompte(variant?.price_type);
  const cardPriceLabel = (p: { price: number | null; from_price: number; on_quote?: boolean; price_type?: string | null }) => {
    if (isAcompte(p.price_type)) {
      const amt = p.price != null ? p.price : p.from_price;
      return amt > 0 ? `${ACOMPTE_LABEL} · ${fmtPrice(amt)}` : 'Sur devis';
    }
    return p.on_quote || p.from_price <= 0
      ? 'Sur devis'
      : `À partir de ${fmtPrice(p.price != null ? p.price : p.from_price)}`;
  };
  // Formate une valeur DÉJÀ dans la devise choisie (pour les totaux sommés).
  const fmtPrimaryValue = (v: number) =>
    currency === 'CNY' ? formatCNY(v) : currency === 'USD' ? formatUSD(v) : currency === 'EUR' ? formatEUR(v) : formatXAF(v);
  const [cart, setCart] = useState<Record<string, CartLine>>({});
  const [activeProduct, setActiveProduct] = useState<OfferProduct | null>(null);
  const [selectedVariantForActive, setSelectedVariantForActive] = useState<
    string | null
  >(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  // B2B : vue « liste » par défaut ; B2C : vue « grille ».
  const [viewMode, setViewMode] = useState<'list' | 'grid'>(offer.offer_type === 'b2b' ? 'list' : 'grid');
  // Sur smartphone, on force la vue « grille » (galerie horizontale par catégorie).
  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia('(max-width: 639px)').matches) {
      setViewMode('grid');
    }
  }, []);
  // Lightbox variante : image en grand + nom + détails + description produit.
  const [variantLightbox, setVariantLightbox] = useState<{
    image: string;
    name: string;
    description: string | null;
    price: number | null;
    moq: number | null;
    capacity: string | null;
    weight: number | null;
    volume: number | null;
    dimensions: string | null;
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // Recherche dynamique : filtre les produits (titre, description, catégorie)
  // à la frappe, côté client — les catégories vides sont masquées.
  const [searchQuery, setSearchQuery] = useState('');
  const totalProducts = useMemo(
    () => items.reduce((s, it) => s + it.products.length, 0),
    [items],
  );
  const filteredItems = useMemo(() => {
    const q = normalizeSearch(searchQuery.trim());
    if (!q) return items;
    const terms = q.split(/\s+/).filter(Boolean);
    return items
      .map((item) => {
        const catText = normalizeSearch(item.description || '');
        // La catégorie matche → on garde tous ses produits.
        if (terms.every((t) => catText.includes(t))) return item;
        const products = item.products.filter((p) => {
          const hay = normalizeSearch(
            `${p.title} ${p.title_original || ''} ${p.description || ''}`,
          );
          return terms.every((t) => hay.includes(t));
        });
        return { ...item, products };
      })
      .filter((item) => item.products.length > 0);
  }, [items, searchQuery]);
  const filteredCount = useMemo(
    () => filteredItems.reduce((s, it) => s + it.products.length, 0),
    [filteredItems],
  );

  const cartLines = Object.values(cart).filter((l) => l.quantity > 0);
  const allProducts: OfferProduct[] = useMemo(
    () => items.flatMap((i) => i.products),
    [items],
  );

  const total = useMemo(() => {
    let cny = 0;
    let count = 0;
    let primary = 0; // somme des sous-totaux de ligne arrondis (devise) → total == somme des lignes
    let acompteCount = 0; // articles « acompte / sur devis » présents dans le panier
    for (const line of cartLines) {
      const p = allProducts.find((pp) => pp.id === line.productId);
      if (!p) continue;
      const variant = line.variantId
        ? p.variants?.find((v) => v.id === line.variantId)
        : null;
      count += line.quantity;
      // Ligne « acompte » (devis) : jamais de calcul prix × quantité ni de total.
      if (isAcompteLine(p, variant)) {
        acompteCount += line.quantity;
        continue;
      }
      // Prix unitaire : variante chiffrée, sinon prix produit, sinon « à partir de »
      const unit = variant && variant.price != null ? variant.price : p.price ?? p.from_price;
      const lineCny = unit * line.quantity;
      cny += lineCny;
      const v = convertFromCny(lineCny, currency);
      primary += currency === 'XAF' ? roundXafUp(v) : Math.round(v * 100) / 100;
    }
    // allAcompte : le panier ne contient que des demandes de devis (aucun prix).
    return { cny, count, primary, acompteCount, allAcompte: count > 0 && acompteCount === count };
  }, [cartLines, allProducts, currency]);

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
    if (!cartLines.length) {
      setSubmitError('Panier vide');
      return;
    }
    setSubmitting(true);
    setSubmitError('');
    try {
      // Coordonnées saisies plus tard (page commande, après le transport).
      const res = await fetch(`/api/offer-public/${offerId}/order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          affiliate_ref: affiliate?.ref,
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
    <div className="mx-auto max-w-5xl px-4 pt-6 pb-28 sm:px-6 sm:pt-10">
      {/* Vidéo carrée 1:1 en tête — MOBILE uniquement (autoplay + boucle) */}
      {offer.mobile_video_url && (
        <div className="mb-6 overflow-hidden rounded-3xl bg-black sm:hidden">
          <video
            src={offer.mobile_video_url}
            className="aspect-square w-full object-cover"
            muted
            loop
            autoPlay
            playsInline
          />
        </div>
      )}

      {/* En-tête (non flottant) : titre + thème + bascule de vue */}
      <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm sm:px-6">
        {/* Ligne 1 : titre + thème + bascule de vue */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-green-500 text-white">
              <Sparkles className="h-4 w-4" />
            </div>
            <p className="truncate text-sm font-bold text-slate-900">{affiliate?.shopName || offer.title}</p>
            {offer.theme && (
              <span className="hidden sm:inline-flex flex-shrink-0 items-center gap-1 rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-semibold text-purple-700">
                <Tag className="h-2.5 w-2.5" />
                {offer.theme}
              </span>
            )}
          </div>
          {/* View toggle */}
          <div className="hidden sm:flex flex-shrink-0 items-center gap-0.5 rounded-lg border border-slate-200 bg-slate-50 p-0.5">
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
        </div>
      </div>

      {/* En-tête : thème (badge) + titre, AU-DESSUS de la cover */}
      <div className="mb-4">
        {offer.theme && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500 px-3 py-1 text-xs font-bold uppercase tracking-wider text-white shadow-sm">
            <Tag className="h-3 w-3" />
            {offer.theme}
          </span>
        )}
        <h1 className="mt-3 font-display text-3xl font-bold uppercase tracking-tight text-slate-900 sm:text-4xl lg:text-5xl">
          {offer.theme || offer.title}
        </h1>
        {offer.theme && (
          <p className="mt-1 text-base font-medium text-slate-600 dark:text-slate-300 sm:text-lg">
            {offer.title}
          </p>
        )}
        {offer.description && (
          <p className="mt-3 max-w-2xl text-sm text-slate-500 dark:text-slate-400 sm:text-base">
            {offer.description}
          </p>
        )}
      </div>

      {/* Cover : vidéo (mp4) prioritaire, sinon image, sinon dégradé.
          Masquée sur mobile si une vidéo 1:1 est présente (elle la remplace). */}
      <div className={`relative mb-8 overflow-hidden rounded-3xl border border-slate-200 bg-slate-900 ${offer.mobile_video_url ? 'hidden sm:block' : ''}`}>
        {offer.cover_video_url ? (
          <video
            src={offer.cover_video_url}
            className="h-64 w-full bg-black object-cover sm:h-80"
            muted
            loop
            autoPlay
            playsInline
            controls
            poster={offer.cover_image_url || undefined}
          />
        ) : offer.cover_image_url ? (
          <SmartImage
            src={offer.cover_image_url}
            alt={offer.theme || offer.title}
            className="h-64 w-full object-cover sm:h-80"
          />
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
      </div>

      {/* Barre de recherche dynamique (dès 5 produits) — sticky pendant le scroll */}
      {totalProducts >= 5 && (
        <div className="sticky top-2 z-30 mb-6">
          <div className="relative rounded-2xl border border-slate-200 bg-white/95 shadow-lg shadow-slate-900/5 backdrop-blur-md">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher un produit… (ex : four, lit, chaise)"
              className="w-full rounded-2xl border-0 bg-transparent py-3.5 pl-12 pr-24 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-400 sm:text-base [&::-webkit-search-cancel-button]:hidden"
            />
            <div className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-2">
              {searchQuery.trim() && (
                <>
                  <span className="hidden whitespace-nowrap text-xs font-semibold text-emerald-600 sm:inline">
                    {filteredCount} produit(s)
                  </span>
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    aria-label="Effacer la recherche"
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </>
              )}
            </div>
          </div>
          {searchQuery.trim() && (
            <p className="mt-1.5 px-1 text-xs font-medium text-slate-500 sm:hidden">
              {filteredCount} produit(s) trouvé(s)
            </p>
          )}
        </div>
      )}

      {/* Aucun résultat de recherche */}
      {searchQuery.trim() && filteredCount === 0 && (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white py-14 text-center">
          <Search className="mx-auto h-10 w-10 text-slate-300" />
          <p className="mt-3 font-semibold text-slate-700">
            Aucun produit ne correspond à « {searchQuery.trim()} »
          </p>
          <p className="mt-1 text-sm text-slate-400">Essayez un autre mot-clé, ou parcourez tout le catalogue.</p>
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="mt-4 rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-600"
          >
            Voir tous les produits
          </button>
        </div>
      )}

      {/* Categories (regroupées par phase pour les offres B2B) */}
      <div className="space-y-10">
        {(() => {
          const hasPhases = !!phases && phases.length > 0;
          const rank = new Map((phases || []).map((p, i) => [p.id, i]));
          const ordered = hasPhases
            ? [...filteredItems].sort((a, b) => (rank.get(a.phase_id ?? '') ?? 9999) - (rank.get(b.phase_id ?? '') ?? 9999))
            : filteredItems;
          return ordered.map((item, idx) => {
            const showPhase =
              hasPhases && (idx === 0 || ordered[idx - 1].phase_id !== item.phase_id);
            const phaseTitle = item.phase_id
              ? phases?.find((p) => p.id === item.phase_id)?.title
              : null;
            const { short: catShort, rest: catRest } = splitCategoryTitle(item.description);
            return (
          <div key={item.id} className="space-y-4">
            {showPhase && phaseTitle && (
              <div className="rounded-2xl bg-slate-900 px-5 py-3 text-white">
                <p className="font-display text-lg font-bold uppercase tracking-wide">{phaseTitle}</p>
              </div>
            )}
          <section>
            <div className="mb-4">
              <h2 className="font-display text-xl font-bold text-slate-900">
                {catShort || 'Produits'}
              </h2>
              {catRest && <CategoryDescription text={catRest} />}
              <p className="mt-1 text-xs text-slate-400">
                {item.products.length} produit(s) disponible(s)
              </p>
            </div>
            {viewMode === 'grid' ? (
              // Mobile : galerie qui défile horizontalement (snap) · Desktop : grille.
              <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:grid sm:snap-none sm:grid-cols-2 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-3">
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
                      className={`group relative flex w-[68%] flex-shrink-0 snap-start flex-col overflow-hidden rounded-2xl border-2 bg-white text-left transition-all hover:border-emerald-400 sm:w-auto sm:flex-shrink ${
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
                        {p.in_cover_video && (
                          <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full bg-[#ff1493] px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-white shadow-lg shadow-[#ff1493]/50">
                            ▶ Vu dans la vidéo
                          </span>
                        )}
                        {isAcompte(p.price_type) && (
                          <span className="absolute top-2 left-2 inline-flex items-center gap-1 rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-white shadow-lg shadow-amber-500/40">
                            {ACOMPTE_BADGE}
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
                          <p className={`text-base font-bold ${isAcompte(p.price_type) ? 'text-amber-600' : 'text-emerald-600'}`}>
                            {cardPriceLabel(p)}
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
                              {p.in_cover_video && (
                                <span className="inline-flex flex-shrink-0 items-center gap-1 rounded-full bg-[#ff1493] px-1.5 py-0.5 text-[9px] font-black uppercase text-white shadow-sm shadow-[#ff1493]/50">
                                  ▶ Vu dans la vidéo
                                </span>
                              )}
                              {isAcompte(p.price_type) && (
                                <span className="inline-flex flex-shrink-0 items-center gap-1 rounded-full bg-amber-500 px-1.5 py-0.5 text-[9px] font-black uppercase text-white shadow-sm">
                                  {ACOMPTE_BADGE}
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
                            <p className={`text-sm font-bold ${isAcompte(p.price_type) ? 'text-amber-600' : 'text-emerald-600'}`}>
                              {cardPriceLabel(p)}
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
          </div>
            );
          });
        })()}
      </div>

      {/* Product modal */}
      <AnimatePresence>
        {activeProduct && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setActiveProduct(null)}
            className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/70 p-0 backdrop-blur-sm sm:p-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="min-h-full w-full overflow-hidden rounded-none bg-white shadow-2xl sm:my-8 sm:min-h-0 sm:max-w-xl sm:rounded-3xl"
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
                      videos={activeProduct.videos}
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
                  {activeProduct.in_cover_video && (
                    <span className="mb-1.5 inline-flex items-center gap-1 rounded-full bg-[#ff1493] px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wider text-white shadow-lg shadow-[#ff1493]/50">
                      ▶ Vu dans la vidéo
                    </span>
                  )}
                  <h2 className="font-display text-lg font-bold text-slate-900 sm:text-xl">
                    {activeProduct.title}
                  </h2>
                  {activeProduct.title_original && (
                    <p className="mt-1 text-xs italic text-slate-400">{activeProduct.title_original}</p>
                  )}
                </div>

                {(() => {
                  const sel = variantOfActive(activeProduct, selectedVariantForActive);
                  const variantPrice = sel?.price;
                  // Prix exact (produit ou variante sélectionnée), sinon « à partir de »
                  const exact = variantPrice ?? activeProduct.price;
                  const acompte = isAcompteLine(activeProduct, sel);
                  const note = sel?.price_note || activeProduct.price_note || null;
                  // Acompte : montant présenté comme « Acompte usine », jamais comme prix de vente.
                  if (acompte) {
                    const amt = exact ?? activeProduct.from_price;
                    return (
                      <div className="space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500 px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wider text-white">
                            {ACOMPTE_BADGE}
                          </span>
                          <span className="text-xs font-semibold uppercase tracking-wider text-amber-600">{ACOMPTE_LABEL}</span>
                        </div>
                        {amt != null && amt > 0 ? (
                          <MultiCurrencyPrice amountCny={amt} variant="large" primary={currency} only />
                        ) : (
                          <span className="font-display text-2xl font-bold text-amber-600">Sur devis</span>
                        )}
                        <p className="text-xs text-slate-500">
                          Montant d’acompte usine — pas le prix de vente final.
                          {note ? ` ${note}` : ''}
                        </p>
                      </div>
                    );
                  }
                  // « Sur devis » : produit à 0 sans variante chiffrée sélectionnée.
                  if ((activeProduct.on_quote || activeProduct.from_price <= 0) && exact == null) {
                    return <span className="font-display text-2xl font-bold text-emerald-600">Sur devis</span>;
                  }
                  if (exact != null) {
                    return <MultiCurrencyPrice amountCny={exact} variant="large" primary={currency} only />;
                  }
                  return (
                    <div className="flex items-baseline gap-2">
                      <span className="text-xs font-medium uppercase tracking-wider text-slate-400">
                        À partir de
                      </span>
                      <MultiCurrencyPrice amountCny={activeProduct.from_price} variant="large" primary={currency} only />
                    </div>
                  );
                })()}

                {/* Paliers de prix par quantité (v3.1) — sans objet pour un acompte */}
                {!isAcompte(activeProduct.price_type) && activeProduct.price_tiers && activeProduct.price_tiers.length > 0 && (
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
                              {fmtPrice(t.price)}
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
                                  <span
                                    role="button"
                                    tabIndex={0}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setVariantLightbox({
                                        image: v.image_url as string,
                                        name: v.name,
                                        description: activeProduct.description,
                                        price: v.price ?? null,
                                        moq: v.moq ?? null,
                                        capacity: v.capacity ?? null,
                                        weight: v.weight ?? null,
                                        volume: v.volume ?? null,
                                        dimensions: v.dimensions ?? null,
                                      });
                                    }}
                                    className="group relative h-10 w-10 flex-shrink-0 cursor-zoom-in overflow-hidden rounded-md ring-1 ring-emerald-200"
                                    title="Voir l'image"
                                  >
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={v.image_url} alt={v.name} className="h-full w-full object-cover" />
                                    <span className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/25">
                                      <Search className="h-3.5 w-3.5 text-white opacity-0 transition-opacity group-hover:opacity-100" />
                                    </span>
                                  </span>
                                ) : null}
                                {active && <Check className="h-4 w-4 text-emerald-600" />}
                                <span>{v.name}</span>
                              </div>
                              {v.price != null && (
                                <div className="flex flex-col items-end gap-0.5">
                                  {isAcompteLine(activeProduct, v) && (
                                    <span className="inline-flex items-center rounded-full bg-amber-500 px-1.5 py-0.5 text-[9px] font-black uppercase text-white">
                                      {ACOMPTE_BADGE}
                                    </span>
                                  )}
                                  <MultiCurrencyPrice amountCny={v.price} variant="stacked" primary={currency} only />
                                </div>
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
                  // Acompte : le CTA d'achat devient « Demander un devis » (le produit
                  // rejoint quand même le panier → coordonnées récoltées au checkout).
                  const acompte = isAcompteLine(
                    activeProduct,
                    variantOfActive(activeProduct, selectedVariantForActive),
                  );
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
                          : acompte
                            ? existing
                              ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/25 hover:bg-amber-600'
                              : 'border-2 border-amber-400 bg-white text-amber-700 hover:bg-amber-50'
                            : existing
                              ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/25 hover:bg-emerald-600'
                              : 'border-2 border-emerald-400 bg-white text-emerald-700 hover:bg-emerald-50'
                      }`}
                    >
                      {needsVariant ? (
                        <>Choisissez d&apos;abord une variante</>
                      ) : acompte ? (
                        <>
                          <FileText className="h-5 w-5" />
                          {existing ? 'Ajouté — demander le devis' : 'Demander un devis'}
                        </>
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
            className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/70 p-0 backdrop-blur-sm sm:p-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="min-h-full w-full overflow-hidden rounded-none bg-white shadow-2xl sm:my-8 sm:min-h-0 sm:max-w-md sm:rounded-3xl"
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
                      const unit = variant && variant.price != null ? variant.price : p.price ?? p.from_price;
                      const acompte = isAcompteLine(p, variant);
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
                              {acompte
                                ? `${ACOMPTE_LABEL} × ${line.quantity}`
                                : unit > 0
                                  ? `${fmtPrice(unit)} × ${line.quantity}`
                                  : `Sur devis × ${line.quantity}`}
                            </p>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <p className={`text-sm font-bold ${acompte ? 'text-amber-600' : 'text-emerald-600'}`}>
                              {acompte ? 'Sur devis' : unit > 0 ? fmtPrice(unit * line.quantity) : 'Sur devis'}
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

                {/* Total (les lignes acompte/devis n'entrent pas dans le total). */}
                {cartLines.length > 0 && (
                  <div className="flex items-center justify-between rounded-xl bg-emerald-50 px-4 py-3">
                    <p className="text-sm font-semibold text-emerald-700">
                      {total.allAcompte ? 'Sur devis' : 'Total panier'}
                    </p>
                    {total.allAcompte ? (
                      <span className="text-sm font-bold text-amber-600">Devis à établir</span>
                    ) : (
                      <MultiCurrencyPrice amountCny={total.cny} xafOverrideFcfa={currency === "XAF" ? total.primary : undefined} variant="stacked" primary={currency} only />
                    )}
                  </div>
                )}
                {cartLines.length > 0 && total.acompteCount > 0 && !total.allAcompte && (
                  <p className="rounded-xl bg-amber-50 px-4 py-2 text-center text-xs font-medium text-amber-700">
                    Dont {total.acompteCount} article{total.acompteCount > 1 ? 's' : ''} sur devis (acompte usine, non inclus dans le total).
                  </p>
                )}

                {/* Les coordonnées sont demandées à l'étape suivante
                    (après le choix du transport, avant le paiement). */}
                {cartLines.length > 0 && (
                  <p className="rounded-xl bg-slate-50 px-4 py-3 text-center text-xs text-slate-500">
                    {total.allAcompte
                      ? 'Étape suivante : laissez vos coordonnées, notre équipe vous envoie le devis.'
                      : 'Étape suivante : choix du transport, puis vos coordonnées et le paiement.'}
                  </p>
                )}

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
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : total.allAcompte ? <FileText className="h-4 w-4" /> : <Send className="h-4 w-4" />}
                  {total.allAcompte ? 'Demander un devis' : 'Valider et choisir le transport'}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Barre panier fixée en bas (pleine largeur, ancrée — pas flottante) */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-4 py-3 shadow-[0_-4px_12px_rgba(0,0,0,0.06)] backdrop-blur">
        <div className="mx-auto max-w-5xl">
          <motion.button
            type="button"
            onClick={() => setCheckoutOpen(true)}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            disabled={!cartLines.length}
            className="flex w-full items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-gradient-to-r from-emerald-500 to-green-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-500/25 disabled:opacity-50"
          >
            <ShoppingBag className="h-4 w-4 flex-shrink-0" />
            {total.count > 0 ? (
              <span className="flex items-center gap-1.5">
                <span className="tabular-nums">{total.count} article{total.count > 1 ? 's' : ''}</span>
                <span className="opacity-70">·</span>
                <span className="tabular-nums">{total.allAcompte ? 'Demander un devis' : fmtPrimaryValue(total.primary)}</span>
              </span>
            ) : (
              'Voir le panier'
            )}
          </motion.button>
        </div>
      </div>

      {/* Lightbox variante : image + description (au-dessus du modal produit) */}
      <AnimatePresence>
        {variantLightbox && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setVariantLightbox(null)}
            className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-slate-900/80 p-0 backdrop-blur-sm sm:p-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 16 }}
              onClick={(e) => e.stopPropagation()}
              className="min-h-full w-full overflow-hidden bg-white shadow-2xl sm:my-8 sm:min-h-0 sm:max-w-lg sm:rounded-3xl"
            >
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={variantLightbox.image}
                  alt={variantLightbox.name}
                  className="max-h-[60vh] w-full bg-slate-50 object-contain"
                />
                <button
                  type="button"
                  onClick={() => setVariantLightbox(null)}
                  className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="space-y-3 p-5">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-display text-lg font-bold text-slate-900">{variantLightbox.name}</h3>
                  {variantLightbox.price != null && (
                    <MultiCurrencyPrice amountCny={variantLightbox.price} variant="stacked" primary={currency} only />
                  )}
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
                  {variantLightbox.moq != null && <span>MOQ : {variantLightbox.moq}</span>}
                  {variantLightbox.capacity && <span>Capacité : {variantLightbox.capacity}</span>}
                  {variantLightbox.weight != null && <span>Poids : {variantLightbox.weight} kg</span>}
                  {variantLightbox.volume != null && <span>Vol : {variantLightbox.volume} m³</span>}
                  {variantLightbox.dimensions && <span>Dim : {variantLightbox.dimensions}</span>}
                </div>
                {variantLightbox.description && (
                  <p className="whitespace-pre-line border-t border-slate-100 pt-3 text-sm leading-relaxed text-slate-600">
                    {variantLightbox.description}
                  </p>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
